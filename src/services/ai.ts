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
 * Multi-provider AI service.
 *
 * The provider is chosen PER REQUEST (from the article's `aiProvider` field),
 * never from an env var. Each provider routes to its own isolated async
 * function behind one interface — `generateWithProvider(provider, prompt)` →
 * text. Structured generators (article / section / titles / claims) build a
 * JSON-Schema-instructed prompt, call that, then parse + Zod-validate with a
 * single repair pass, so every provider yields the same validated shape.
 */

/* ---------------------------- providers ---------------------------- */

export type AIProvider = 'gemini' | 'deepseek' | 'zai' | 'local' | 'anthropic';

const VALID_PROVIDERS: readonly AIProvider[] = ['gemini', 'deepseek', 'zai', 'local', 'anthropic'];

/** Guard: coerce arbitrary input to a valid provider, defaulting to gemini. Never throws. */
export function coerceProvider(value: unknown): AIProvider {
  if (typeof value === 'string' && (VALID_PROVIDERS as readonly string[]).includes(value)) {
    return value as AIProvider;
  }
  if (value != null && value !== '') {
    console.warn(`[ai] Unknown aiProvider "${String(value)}" — falling back to "gemini".`);
  }
  return 'gemini';
}

/* ------------------------------ errors ----------------------------- */

export type AIErrorCode = 'not_configured' | 'refusal' | 'invalid_output' | 'provider_error' | 'rate_limited';

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/* ------------------------------ config ----------------------------- */

const MAX_OUTPUT_TOKENS = 8000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  let res: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    res = await fetch(url, init);
    if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === MAX_RETRIES) return res;
    await sleep(600 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  return res as Response;
}

/* --------------------- per-provider implementations ---------------- */

/** Google Gemini (free tier) via REST. JSON mime forces clean JSON output. */
async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIError('not_configured', 'Gemini needs GEMINI_API_KEY.', 503);
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetchRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw new AIError('provider_error', `Gemini error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`, 502);
  const json: any = await res.json().catch(() => ({}));
  const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('');
  if (!text) throw new AIError('provider_error', 'Gemini returned no text.', 502);
  return text;
}

/** Any OpenAI-compatible chat-completions endpoint (DeepSeek, Z.ai, local). */
async function callOpenAICompatible(opts: {
  label: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  prompt: string;
  requireKey: boolean;
}): Promise<string> {
  if (opts.requireKey && !opts.apiKey) {
    throw new AIError('not_configured', `${opts.label} is not configured (missing API key).`, 503);
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  const res = await fetchRetry(`${opts.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: 'user', content: opts.prompt }],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new AIError('provider_error', `${opts.label} error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`, 502);
  const json: any = await res.json().catch(() => ({}));
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new AIError('provider_error', `${opts.label} returned no text.`, 502);
  return text;
}

const callDeepSeek = (prompt: string): Promise<string> =>
  callOpenAICompatible({
    label: 'DeepSeek',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    prompt,
    requireKey: true,
  });

const callZai = (prompt: string): Promise<string> =>
  callOpenAICompatible({
    label: 'Z.ai',
    baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY,
    // Set ZAI_MODEL to the exact id you have access to (e.g. glm-5.2 / glm-4.6).
    model: process.env.ZAI_MODEL || 'glm-4-plus',
    prompt,
    requireKey: true,
  });

const callLocal = (prompt: string): Promise<string> =>
  callOpenAICompatible({
    label: 'Local AI',
    baseURL: process.env.LOCAL_AI_BASE_URL || 'http://localhost:11434/v1', // Ollama/LM Studio default
    apiKey: process.env.LOCAL_AI_API_KEY,
    model: process.env.LOCAL_AI_MODEL || 'gemma3',
    prompt,
    requireKey: false,
  });

/** Anthropic Claude via the official SDK (plain text completion). */
async function callAnthropic(prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIError('not_configured', 'Anthropic needs ANTHROPIC_API_KEY.', 503);
  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    if ((message.stop_reason as string) === 'refusal') {
      throw new AIError('refusal', 'The request was declined by the model\'s safety filters.', 422);
    }
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new AIError('provider_error', 'Anthropic returned no text.', 502);
    return text;
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

function mapAnthropicError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AIError('rate_limited', 'Anthropic is rate-limited — try again shortly.', 429);
  if (err instanceof Anthropic.AuthenticationError) return new AIError('not_configured', 'Invalid Anthropic API key.', 502);
  if (err instanceof Anthropic.APIError) return new AIError('provider_error', `Anthropic error (${err.status ?? 'network'}).`, 502);
  return new AIError('provider_error', `Unexpected AI error: ${(err as Error)?.message ?? 'unknown'}.`, 500);
}

/** Provider → isolated function map (no if/else chains). */
const PROVIDERS: Record<AIProvider, (prompt: string) => Promise<string>> = {
  gemini: callGemini,
  deepseek: callDeepSeek,
  zai: callZai,
  local: callLocal,
  anthropic: callAnthropic,
};

/** Single entry point: route a prompt to the chosen provider, return its text. */
export async function generateWithProvider(provider: AIProvider, prompt: string): Promise<string> {
  const fn = PROVIDERS[provider] ?? PROVIDERS.gemini;
  return fn(prompt);
}

/* --------------------------- structured core ----------------------- */

/** Pull the first JSON object out of a model response (tolerant of code fences/prose). */
function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}

/**
 * Run a structured generation through any provider: instruct JSON matching the
 * schema, parse + validate, and on failure feed the errors back ONCE for a fix.
 */
async function runStructured<T>(opts: {
  provider: AIProvider;
  system: string;
  userPrompt: string;
  schemaForPrompt: unknown;
  validate: (input: unknown) => { ok: true; data: T } | { ok: false; errors: string };
}): Promise<T> {
  const base = `${opts.system}\n\n${opts.userPrompt}\n\nIMPORTANT: Respond with ONLY a single valid JSON object that conforms EXACTLY to this JSON Schema. No prose, no explanation, no markdown, no code fences.\n\nJSON Schema:\n${JSON.stringify(opts.schemaForPrompt)}`;

  const first = opts.validate(extractJson(await generateWithProvider(opts.provider, base)));
  if (first.ok) return first.data;

  const repair = `${base}\n\nYour previous response was invalid. It failed validation with these problems:\n${first.errors}\n\nReturn the corrected JSON object only.`;
  const second = opts.validate(extractJson(await generateWithProvider(opts.provider, repair)));
  if (second.ok) return second.data;

  throw new AIError('invalid_output', `Model output failed schema validation after one repair attempt: ${second.errors}`, 422);
}

/* ------------------------------ public ----------------------------- */

export interface GenerateArticleInput {
  provider: AIProvider;
  system: string;
  /** Fully-built user prompt incl. the dynamic Payload context. */
  prompt: string;
}

export async function generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle> {
  return runStructured<GeneratedArticle>({
    provider: input.provider,
    system: input.system,
    userPrompt: input.prompt,
    schemaForPrompt: ARTICLE_TOOL_SCHEMA,
    validate: (raw) => {
      const r = articleSchema.safeParse(raw);
      return r.success ? { ok: true, data: r.data } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

export interface RegenerateSectionInput<S extends RegenSection> {
  provider: AIProvider;
  section: S;
  system: string;
  prompt: string;
}

export async function regenerateSection<S extends RegenSection>(input: RegenerateSectionInput<S>): Promise<SectionResult<S>> {
  const schema = sectionSchemas[input.section];
  return runStructured<SectionResult<S>>({
    provider: input.provider,
    system: input.system,
    userPrompt: input.prompt,
    schemaForPrompt: sectionToolSchema(input.section),
    validate: (raw) => {
      const r = schema.safeParse(raw);
      return r.success ? { ok: true, data: r.data as SectionResult<S> } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

/** "Generate from tool": 5 article titles with distinct search intents. */
export async function suggestTitles(input: { provider: AIProvider; system: string; prompt: string }): Promise<SuggestedTitles> {
  return runStructured<SuggestedTitles>({
    provider: input.provider,
    system: input.system,
    userPrompt: input.prompt,
    schemaForPrompt: TITLES_TOOL_SCHEMA,
    validate: (raw) => {
      const r = titlesSchema.safeParse(raw);
      return r.success ? { ok: true, data: r.data } : { ok: false, errors: formatZodErrors(r.error) };
    },
  });
}

/** "Find & verify sources": extract the article's key checkable claims + queries. */
export async function extractClaims(input: { provider: AIProvider; system: string; prompt: string }): Promise<ExtractedClaims> {
  return runStructured<ExtractedClaims>({
    provider: input.provider,
    system: input.system,
    userPrompt: input.prompt,
    schemaForPrompt: CLAIMS_TOOL_SCHEMA,
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

/** Minimal JSON Schema per regenerate-section (mirrors sectionSchemas). */
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
