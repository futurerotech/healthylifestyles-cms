import Anthropic from '@anthropic-ai/sdk';
import {
  articleSchema,
  sectionSchemas,
  ARTICLE_TOOL_SCHEMA,
  titlesSchema,
  TITLES_TOOL_SCHEMA,
  claimsSchema,
  CLAIMS_TOOL_SCHEMA,
  type GeneratedArticle,
  type RegenSection,
  type SectionResult,
  type SuggestedTitles,
  type ExtractedClaims,
} from './articleSchema';

/**
 * Typed AI service for article generation.
 *
 * - Forces STRUCTURED output via Anthropic tool use (the model must call our
 *   `emit_article` tool whose input_schema is our JSON Schema) — we never parse
 *   free text.
 * - Validates the tool input against the Zod schema; on failure it asks the
 *   model to fix ONCE (feeding back the validation errors) before giving up.
 * - Retries transient provider errors (429/5xx/overloaded) with exponential
 *   backoff; caps output tokens; surfaces clear typed errors.
 * - Provider-swappable: the Anthropic implementation is the default; point
 *   `AI_PROVIDER=openai` once an OpenAI provider is wired (stub below).
 */

/* ------------------------------ errors ----------------------------- */

export type AIErrorCode =
  | 'not_configured'
  | 'refusal'
  | 'invalid_output'
  | 'provider_error'
  | 'rate_limited';

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    /** Suggested HTTP status for the API layer. */
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/* ------------------------------ config ----------------------------- */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
/** Hard ceiling on output tokens regardless of caller request. */
const MAX_OUTPUT_TOKENS = 8000;
const MAX_RETRIES = 3;

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------- provider ----------------------------- */

interface ToolCallArgs {
  system: string;
  messages: Anthropic.MessageParam[];
  tool: Anthropic.Tool;
  maxTokens: number;
}

interface ToolCallResult {
  /** Raw, unvalidated tool input from the model. */
  input: unknown;
  /** The assistant message content (for a follow-up repair turn). */
  assistantContent: Anthropic.ContentBlock[];
  /** The tool_use block id (needed to answer with a tool_result). */
  toolUseId: string;
}

interface LLMProvider {
  readonly name: string;
  callTool(args: ToolCallArgs): Promise<ToolCallResult>;
}

const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  async callTool({ system, messages, tool, maxTokens }) {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

    const message = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: Math.min(maxTokens, MAX_OUTPUT_TOKENS),
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages,
      }),
    );

    // Safety classifiers can decline — check before reading content.
    if ((message.stop_reason as string) === 'refusal') {
      throw new AIError('refusal', 'The request was declined by the model\'s safety filters.', 422);
    }

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tool.name,
    );
    if (!toolUse) {
      throw new AIError('invalid_output', 'Model did not return the expected structured tool call.', 502);
    }

    return { input: toolUse.input, assistantContent: message.content, toolUseId: toolUse.id };
  },
};

function getProvider(): LLMProvider {
  if (PROVIDER === 'anthropic') return anthropicProvider;
  // Extension point: implement an OpenAI provider (function-calling) and return
  // it here. Kept unimplemented so the build never depends on an uninstalled SDK.
  throw new AIError('not_configured', `AI provider "${PROVIDER}" is not implemented. Set AI_PROVIDER=anthropic.`, 503);
}

/* --------------------------- retry/backoff ------------------------- */

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err instanceof Anthropic.APIError ? err.status : undefined;
      const retryable = status === undefined ? false : RETRYABLE_STATUS.has(status);
      if (!retryable || attempt === MAX_RETRIES) break;
      // Exponential backoff with jitter: ~0.5s, 1s, 2s (+ up to 250ms).
      const delay = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      await sleep(delay);
    }
  }
  throw mapProviderError(lastErr);
}

function mapProviderError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof Anthropic.RateLimitError) {
    return new AIError('rate_limited', 'The AI provider is rate-limited — try again shortly.', 429);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AIError('not_configured', 'Invalid Anthropic API key.', 502);
  }
  if (err instanceof Anthropic.APIError) {
    return new AIError('provider_error', `AI provider error (${err.status ?? 'network'}).`, 502);
  }
  return new AIError('provider_error', `Unexpected AI error: ${(err as Error)?.message ?? 'unknown'}.`, 500);
}

/* --------------------------- core runner --------------------------- */

function ensureConfigured(): void {
  if (!process.env.ANTHROPIC_API_KEY && PROVIDER === 'anthropic') {
    throw new AIError('not_configured', 'AI is not configured. Set ANTHROPIC_API_KEY on the server.', 503);
  }
}

/**
 * Run a structured generation with a single in-loop repair: call the tool,
 * validate with Zod, and if it fails feed the errors back once for a fix.
 */
async function runStructured<T>(opts: {
  system: string;
  userPrompt: string;
  tool: Anthropic.Tool;
  validate: (input: unknown) => { ok: true; data: T } | { ok: false; errors: string };
  maxTokens: number;
}): Promise<T> {
  ensureConfigured();
  const provider = getProvider();

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.userPrompt }];

  const first = await provider.callTool({ system: opts.system, messages, tool: opts.tool, maxTokens: opts.maxTokens });
  const firstCheck = opts.validate(first.input);
  if (firstCheck.ok) return firstCheck.data;

  // One repair attempt: answer the tool call with the validation errors.
  const repairMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: 'assistant', content: first.assistantContent },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: first.toolUseId,
          is_error: true,
          content: `Your output failed validation. Fix ONLY these problems and call the tool again with corrected JSON:\n${firstCheck.errors}`,
        },
      ],
    },
  ];

  const second = await provider.callTool({ system: opts.system, messages: repairMessages, tool: opts.tool, maxTokens: opts.maxTokens });
  const secondCheck = opts.validate(second.input);
  if (secondCheck.ok) return secondCheck.data;

  throw new AIError('invalid_output', `Model output failed schema validation after one repair attempt: ${secondCheck.errors}`, 422);
}

const ARTICLE_TOOL: Anthropic.Tool = {
  name: 'emit_article',
  description: 'Emit a complete, structured E-E-A-T health article matching the schema. Call this tool exactly once.',
  input_schema: ARTICLE_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

/* ------------------------------ public ----------------------------- */

export interface GenerateArticleInput {
  system: string;
  /** Fully-built user prompt incl. the dynamic Payload context. */
  prompt: string;
  maxTokens?: number;
}

export async function generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle> {
  return runStructured<GeneratedArticle>({
    system: input.system,
    userPrompt: input.prompt,
    tool: ARTICLE_TOOL,
    maxTokens: input.maxTokens ?? MAX_OUTPUT_TOKENS,
    validate: (raw) => {
      const r = articleSchema.safeParse(raw);
      return r.success ? { ok: true, data: r.data } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

export interface RegenerateSectionInput<S extends RegenSection> {
  section: S;
  system: string;
  prompt: string;
  maxTokens?: number;
}

export async function regenerateSection<S extends RegenSection>(
  input: RegenerateSectionInput<S>,
): Promise<SectionResult<S>> {
  const schema = sectionSchemas[input.section];
  const tool: Anthropic.Tool = {
    name: 'emit_section',
    description: `Emit ONLY the "${input.section}" section of a health article, as structured JSON. Call this tool exactly once.`,
    input_schema: sectionToolSchema(input.section) as unknown as Anthropic.Tool.InputSchema,
  };
  return runStructured<SectionResult<S>>({
    system: input.system,
    userPrompt: input.prompt,
    tool,
    maxTokens: input.maxTokens ?? 1500,
    validate: (raw) => {
      const r = schema.safeParse(raw);
      return r.success ? { ok: true, data: r.data as SectionResult<S> } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

/** "Generate from tool": 5 article titles with distinct search intents. */
export async function suggestTitles(input: { system: string; prompt: string }): Promise<SuggestedTitles> {
  const tool: Anthropic.Tool = {
    name: 'emit_titles',
    description: 'Emit exactly 5 article titles, each targeting a distinct search intent. Call this tool once.',
    input_schema: TITLES_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
  };
  return runStructured<SuggestedTitles>({
    system: input.system,
    userPrompt: input.prompt,
    tool,
    maxTokens: 800,
    validate: (raw) => {
      const r = titlesSchema.safeParse(raw);
      return r.success ? { ok: true, data: r.data } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

/** "Find & verify sources": extract the article's key checkable claims + search queries. */
export async function extractClaims(input: { system: string; prompt: string }): Promise<ExtractedClaims> {
  const tool: Anthropic.Tool = {
    name: 'emit_claims',
    description: 'Emit the key checkable factual claims/numbers in the article, each with a search query. Call this tool once.',
    input_schema: CLAIMS_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
  };
  return runStructured<ExtractedClaims>({
    system: input.system,
    userPrompt: input.prompt,
    tool,
    maxTokens: 1500,
    validate: (raw) => {
      const r = claimsSchema.safeParse(raw);
      return r.success ? { ok: true, data: r.data } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

/* --------------------------- small helpers ------------------------- */

function formatZodErrors(err: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }): string {
  return err.issues
    .slice(0, 20)
    .map((i) => `- ${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

/** A minimal JSON Schema per regenerate-section (mirrors sectionSchemas). */
function sectionToolSchema(section: RegenSection): Record<string, unknown> {
  const a = ARTICLE_TOOL_SCHEMA.properties;
  switch (section) {
    case 'snippet':
      return { type: 'object', additionalProperties: false, properties: { snippetAnswer: a.snippetAnswer }, required: ['snippetAnswer'] };
    case 'meta':
      return { type: 'object', additionalProperties: false, properties: { metaTitle: a.metaTitle, metaDescription: a.metaDescription }, required: ['metaTitle', 'metaDescription'] };
    case 'faq':
      return { type: 'object', additionalProperties: false, properties: { faq: a.faq }, required: ['faq'] };
    case 'intro':
      return { type: 'object', additionalProperties: false, properties: { body: a.body }, required: ['body'] };
  }
}
