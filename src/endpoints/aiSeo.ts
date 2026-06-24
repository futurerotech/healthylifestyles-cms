import type { Endpoint, PayloadRequest } from 'payload';

/* ---------------------------------------------------------------------------
 * AI SEO Copilot — DeepSeek-powered endpoint dedicated to generating
 * click-optimised meta titles, SEO descriptions, and LSI keyword clusters.
 *
 * POST /api/ai-seo
 *   Body: { task, context }
 *   Auth: staff-only
 * ------------------------------------------------------------------------- */

const DEEPSEEK_BASE = 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const SYSTEM = `You are a senior SEO strategist and copywriter for HealthyLifeStyles ("Trusted Wellness"), a health & wellness tools and information site.

Your job is to generate high-CTR meta tags and keyword suggestions that follow these rules:

- Titles: 40-60 characters, front-load the primary keyword, include a value proposition or emotional trigger, no clickbait, no health promises.
- Descriptions: 150-155 characters, include primary keyword naturally, include soft CTA ("Learn how", "Discover", "Find out"), unique per page, no quotes or ALL CAPS.
- Keywords: Suggest 8-12 LSI/relevant keywords that search engines associate with the topic. Include a mix of short-tail and long-tail variations.

TONE: Professional, trustworthy, warm. Match the site's American English spelling.
SAFETY: Never suggest titles or descriptions that promise medical outcomes, diagnoses, or cures. Never use fear-mongering.

Return STRICT JSON only — no markdown fences, no extra text.`;

type SeoTask = 'title' | 'description' | 'keywords';

type SeoBody = { task: SeoTask; context: Record<string, unknown> };

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function extractText(content: unknown): string {
  if (!content || typeof content !== 'object') return str(content);
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') parts.push(n.text as string);
    if (n.root) walk(n.root);
    if (Array.isArray(n.children)) (n.children as unknown[]).forEach(walk);
  }
  walk(content);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const PROMPTS: Record<SeoTask, { maxTokens: number; build: (c: Record<string, unknown>) => string }> = {
  title: {
    maxTokens: 800,
    build: (c) => {
      const title = str(c.title || c.name);
      const excerpt = str(c.excerpt);
      const targetKw = str(c.keywords);
      const contentText = extractText(c.content);
      return `Generate 3 click-optimised SEO meta titles for the following content. Each must be ≤ 60 characters.

Page title: ${title || '(not set)'}
Excerpt: ${excerpt || '(not set)'}
Target keyword(s): ${targetKw || '(not set)'}
Content:
${contentText.slice(0, 3000) || '(no content yet)'}

Return STRICT JSON:
{
  "options": [
    { "title": "string (≤ 60 chars)", "rationale": "one-liner why this title works" },
    { "title": "string (≤ 60 chars)", "rationale": "one-liner why this title works" },
    { "title": "string (≤ 60 chars)", "rationale": "one-liner why this title works" }
  ],
  "recommended": number (0, 1, or 2 — index of best pick)
}`;
    },
  },

  description: {
    maxTokens: 800,
    build: (c) => {
      const title = str(c.title || c.name);
      const excerpt = str(c.excerpt);
      const targetKw = str(c.keywords);
      const contentText = extractText(c.content);
      return `Generate 3 SEO meta descriptions for this content. Each must be 140-155 characters.

Page title: ${title || '(not set)'}
Excerpt: ${excerpt || '(not set)'}
Target keyword(s): ${targetKw || '(not set)'}
Content:
${contentText.slice(0, 3000) || '(no content yet)'}

Return STRICT JSON:
{
  "options": [
    { "description": "string (140-155 chars)", "charCount": number, "keywordIncluded": boolean },
    { "description": "string (140-155 chars)", "charCount": number, "keywordIncluded": boolean },
    { "description": "string (140-155 chars)", "charCount": number, "keywordIncluded": boolean }
  ],
  "recommended": number
}`;
    },
  },

  keywords: {
    maxTokens: 800,
    build: (c) => {
      const title = str(c.title || c.name);
      const excerpt = str(c.excerpt);
      const contentText = extractText(c.content);
      const currentKws = str(c.keywords);
      return `Suggest LSI and related keywords for this content. Include short-tail and long-tail variations.

Page title: ${title || '(not set)'}
Excerpt: ${excerpt || '(not set)'}
Current keywords: ${currentKws || '(none)'}
Content:
${contentText.slice(0, 3000) || '(no content yet)'}

Return STRICT JSON:
{
  "clusters": [
    {
      "group": "string — thematic group label (e.g. 'Symptoms', 'Causes', 'Prevention')",
      "keywords": ["string", "string", "string"]
    }
  ],
  "recommended": ["string", "string", "string", "string", "string", "string", "string", "string"]
}`;
    },
  },
};

async function callDeepSeek(system: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 429) throw new Error('Rate limited — try again in a moment.');
    if (res.status === 401) throw new Error('Invalid DeepSeek API key.');
    throw new Error(`DeepSeek API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = body?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('DeepSeek returned an empty response.');
  return text;
}

export const aiSeo: Endpoint = {
  path: '/ai-seo',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: 'AI SEO Copilot is not configured. Set DEEPSEEK_API_KEY on the server.' },
        { status: 503 },
      );
    }

    let body: SeoBody;
    try {
      body = req.json ? ((await req.json()) as SeoBody) : ({} as SeoBody);
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!body.task || !(body.task in PROMPTS)) {
      return Response.json(
        { error: `Unknown task. Expected: ${Object.keys(PROMPTS).join(', ')}.` },
        { status: 400 },
      );
    }

    const { maxTokens, build } = PROMPTS[body.task];
    const userPrompt = build(body.context || {});

    try {
      const result = await callDeepSeek(SYSTEM, userPrompt, maxTokens);
      return Response.json({ task: body.task, result });
    } catch (err) {
      const msg = (err as Error).message;
      req.payload?.logger?.error?.('AI SEO error: ' + msg);
      if (msg.startsWith('Rate limited')) return Response.json({ error: msg }, { status: 429 });
      if (msg.startsWith('Invalid DeepSeek')) return Response.json({ error: msg }, { status: 502 });
      return Response.json({ error: 'Unexpected error from AI SEO Copilot.' }, { status: 500 });
    }
  },
};
