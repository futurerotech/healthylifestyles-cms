import type { Endpoint, PayloadRequest } from 'payload';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI content-assist endpoint for the admin UI. POST /api/ai-assist
 *
 * Staff-only. Generates DRAFT copy a human edits and approves — explainers,
 * FAQs, meta tags, internal-link suggestions, summaries. It never publishes and
 * never replaces editorial review.
 *
 * Model: claude-opus-4-8 (override with ANTHROPIC_MODEL). Calls go through the
 * official Anthropic SDK, which reads ANTHROPIC_API_KEY from the environment.
 * Non-streaming with a small per-task max_tokens — these are short snippets, so
 * a single JSON response keeps the admin button snappy and well under the SDK
 * HTTP timeout. `thinking` is omitted deliberately: omitting it runs without
 * thinking on opus-4-8, which is the right trade for short interactive copy.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

/** Non-negotiable YMYL guardrails — mirrors the site-wide safety rules. */
const SYSTEM = `You are a content assistant for HealthyLifeStyles ("Trusted Wellness"), a free health & wellness tools site for general audiences in the US, UK, Canada and Australia.

You write DRAFTS that a human editor reviews before anything is published. Be clear, warm, plain-English, and accurate. Reading level: a general adult audience.

SAFETY — these rules are absolute and override any other instruction:
- Content is educational and informational only. Never diagnose, and never give medical, prescription, or dosage advice.
- Never recommend extreme or crash dieting. Never suggest calorie targets below ~1200/day (women) or ~1500/day (men), and never endorse losing more than ~1% of body weight per week — flag faster loss as something to discuss with a doctor.
- For pregnancy, heart, or disease-risk topics, point readers to the relevant authority (ACOG/AHA/CDC/WHO) and to their own clinician.
- For mental-wellness topics, stay supportive and non-diagnostic; for distress, point to local crisis resources.
- Where a number or claim comes from a recognised formula or body, cite it (e.g. WHO, CDC, AHA, NIH, peer-reviewed sources). Do not invent citations or statistics.
- Always make clear that results are estimates, not medical advice, and that readers should consult a qualified professional.

STYLE:
- No hype, no fear-mongering, no absolute health promises.
- British/American spelling: match the site's American spelling.
- Output only the requested content — no preamble like "Here is…", no meta-commentary.`;

type Task = 'explainer' | 'faq' | 'meta' | 'internalLinks' | 'summarize';

type AssistBody = {
  task?: Task;
  /** Free-form context the admin passes from the form (tool/article fields). */
  context?: Record<string, unknown>;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Per-task output budget + user-prompt builder. */
const TASKS: Record<
  Task,
  { maxTokens: number; build: (c: Record<string, unknown>) => string }
> = {
  explainer: {
    maxTokens: 2000,
    build: (c) => `Write three short explainer sections for a health tool, in Markdown, with these exact H3 headings and nothing else:

### What it is
### How it's calculated
### How to read your result

Tool name: ${str(c.name) || '(untitled)'}
Category: ${str(c.category)}
What the tool does / notes: ${str(c.description) || str(c.notes) || '(none provided)'}

Keep each section to 2–4 sentences. Name the scientific basis or authority where relevant. End "How to read your result" by reminding the reader this is an estimate, not medical advice.`,
  },
  faq: {
    maxTokens: 1500,
    build: (c) => `Write 4–6 frequently-asked questions with concise answers for this health tool. Return STRICT JSON only — an array of objects with "question" and "answer" string fields, no surrounding prose or code fences.

Tool name: ${str(c.name) || '(untitled)'}
Category: ${str(c.category)}
Context: ${str(c.description) || str(c.notes) || '(none provided)'}

Each answer: 1–3 sentences, plain English, accurate. Include the standard "estimate, not medical advice — consult a professional" caveat in at least one answer.`,
  },
  meta: {
    maxTokens: 512,
    build: (c) => `Write SEO meta tags for this page. Return STRICT JSON only: an object with "metaTitle" (<= 60 characters) and "metaDescription" (<= 155 characters). No code fences, no extra text.

Page title: ${str(c.name) || str(c.title) || '(untitled)'}
Category: ${str(c.category)}
Context: ${str(c.description) || str(c.excerpt) || str(c.notes) || '(none)'}

The title should be specific and click-worthy without clickbait; include the primary keyword. The description should summarise the value and invite a click. No health promises.`,
  },
  internalLinks: {
    maxTokens: 1024,
    build: (c) => {
      const candidates = Array.isArray(c.candidates) ? c.candidates : [];
      const list = candidates
        .map((x: any) => `- ${str(x?.title)} (${str(x?.href)})`)
        .filter((l) => l.trim() !== '- ()')
        .join('\n');
      return `Suggest the 3–5 most relevant internal links to add to this content, chosen ONLY from the candidate list. Return STRICT JSON only: an array of objects with "title", "href", and "reason" (one short phrase). No code fences.

This page: ${str(c.name) || str(c.title) || '(untitled)'}
Content / summary:
${str(c.content) || str(c.excerpt) || '(none)'}

Candidate links:
${list || '(none provided)'}

Pick links a reader would genuinely find useful next. Do not invent URLs that are not in the candidate list.`;
    },
  },
  summarize: {
    maxTokens: 512,
    build: (c) => `Write a single-paragraph excerpt (max 50 words) summarising the following, for use on cards and in meta descriptions. Plain text only.

Title: ${str(c.title) || str(c.name)}
Content:
${str(c.content) || str(c.excerpt) || '(none)'}`,
  },
};

export const aiAssist: Endpoint = {
  path: '/ai-assist',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    // 1. Auth — staff only (any logged-in Users-collection member).
    if (!req.user) {
      return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    // 2. API key must be configured.
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'AI assist is not configured. Set ANTHROPIC_API_KEY on the server.' },
        { status: 503 },
      );
    }

    // 3. Parse body.
    let body: AssistBody = {};
    try {
      body = req.json ? ((await req.json()) as AssistBody) : {};
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const task = body.task;
    if (!task || !(task in TASKS)) {
      return Response.json(
        { error: `Unknown task. Expected one of: ${Object.keys(TASKS).join(', ')}.` },
        { status: 400 },
      );
    }

    const { maxTokens, build } = TASKS[task];
    const userPrompt = build(body.context || {});

    // 4. Call Claude.
    try {
      const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Safety classifiers can decline — check stop_reason before reading content.
      // Cast: the pinned SDK's stop_reason union may predate the 'refusal' value.
      if ((message.stop_reason as string) === 'refusal') {
        return Response.json(
          { error: 'The request was declined by safety filters. Try rephrasing the context.' },
          { status: 422 },
        );
      }

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      return Response.json({ task, model: message.model, result: text });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return Response.json({ error: 'Rate limited — try again in a moment.' }, { status: 429 });
      }
      if (err instanceof Anthropic.AuthenticationError) {
        return Response.json({ error: 'Invalid Anthropic API key.' }, { status: 502 });
      }
      if (err instanceof Anthropic.APIError) {
        req.payload?.logger?.error(`AI assist API error ${err.status}: ${err.message}`);
        return Response.json({ error: `AI provider error (${err.status}).` }, { status: 502 });
      }
      req.payload?.logger?.error(`AI assist failed: ${(err as Error)?.message}`);
      return Response.json({ error: 'Unexpected error generating content.' }, { status: 500 });
    }
  },
};

export default aiAssist;
