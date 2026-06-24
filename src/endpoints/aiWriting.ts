import type { Endpoint, PayloadRequest } from 'payload';

/* ---------------------------------------------------------------------------
 * DeepSeek-powered AI Writing Assistant for the article editor.
 *
 * POST /api/ai-writing
 *   Body: { task, context }
 *   Auth: staff-only
 *
 * Three tasks:
 *   seoGaps          → structured SEO audit of the current draft
 *   internalLinks    → 5 contextual internal link suggestions
 *   metaDescription  → generate a 140–155 char meta description
 * ------------------------------------------------------------------------- */

const DEEPSEEK_BASE = 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/* ---- YMYL-safe system prompt (shared across all tasks) ---- */
const SYSTEM = `You are a professional medical content editor for HealthyLifeStyles ("Trusted Wellness"), a free health and wellness tools and information site for a general audience.

EXPERTISE AND AUTHORITY:
- You are a board-certified physician and medical writer with 15+ years of experience creating health content for public consumption.
- You write at an 8th-grade reading level for a general adult audience in the US, UK, Canada, and Australia.
- You follow AMA style and cite only authoritative sources: WHO, CDC, AHA, NIH, Mayo Clinic, PubMed-indexed journals, and national health services (NHS, Health Canada, Australian Government Department of Health).

ABSOLUTE SAFETY GUARDRAILS — THESE ARE NEVER VIOLATED:
- Content is educational and informational only. NEVER diagnose, prescribe, or give individual medical advice.
- NEVER recommend specific dosages, medications, or treatments.
- NEVER suggest extreme dieting, fasting, or weight-loss targets below safe thresholds.
- For pregnancy, pediatric, cardiac, or mental-health topics, always include a disclaimer to consult a qualified healthcare professional.
- Every article must include: "This information is for educational purposes only and is not a substitute for professional medical advice. Consult your healthcare provider before making any changes to your health regimen."
- Never invent citations, statistics, or studies. Only reference real, verifiable sources.
- Avoid absolute language ("guaranteed", "cure", "proven"). Use appropriate hedging ("may help", "is associated with", "studies suggest").
- No fear-mongering, no clickbait, no health promises.

TONAL GUIDELINES:
- Warm, empathetic, and empowering — never alarming or condescending.
- Clear, direct, plain English. Define technical terms when first used.
- Recognize that health decisions are personal and should be made with a provider.
- Be inclusive of diverse body types, ages, genders, and cultural backgrounds.
- Use person-first language ("people with diabetes" not "diabetics").`;

type Task = 'seoGaps' | 'internalLinks' | 'metaDescription';

type WritingBody = {
  task: Task;
  context: Record<string, unknown>;
};

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function extractContentText(content: unknown): string {
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

/* ---- Per-task prompt builders ---- */
const TASKS: Record<Task, { maxTokens: number; build: (c: Record<string, unknown>) => string }> = {
  /* ── 1. SEO Gap Analysis ── */
  seoGaps: {
    maxTokens: 2000,
    build: (c) => {
      const title = str(c.title);
      const excerpt = str(c.excerpt);
      const metaTitle = str(c.metaTitle);
      const metaDescription = str(c.metaDescription);
      const keywords = str(c.keywords);
      const category = str(c.category);
      const contentText = extractContentText(c.content);

      return `You are auditing the SEO readiness of a health article draft. Analyze the following content and identify gaps.

Article Title: ${title || '(not set)'}
Article Excerpt: ${excerpt || '(not set)'}
Current Meta Title: ${metaTitle || '(not set)'}
Current Meta Description: ${metaDescription || '(not set)'}
Target Keywords: ${keywords || '(not set)'}
Category: ${category || '(not set)'}

Article Content:
${contentText.slice(0, 8000) || '(no content yet)'}

Provide a structured SEO gap analysis in this exact JSON format — no markdown fences, no extra text:
{
  "score": 0-100,
  "titleAssessment": { "score": "good"|"fair"|"poor", "feedback": "string" },
  "metaDescriptionAssessment": { "score": "good"|"fair"|"poor", "feedback": "string" },
  "contentGaps": [
    { "issue": "string", "severity": "high"|"medium"|"low", "recommendation": "string" }
  ],
  "keywordUsage": { "primaryInTitle": boolean, "primaryInFirst200": boolean, "primaryInH2": boolean, "suggestedKeywords": ["string"] },
  "readability": { "estimatedLevel": "string", "suggestion": "string" },
  "missingElements": ["string"]
}`;
    },
  },

  /* ── 2. Internal Link Suggestions ── */
  internalLinks: {
    maxTokens: 2000,
    build: (c) => {
      const title = str(c.title);
      const contentText = extractContentText(c.content);
      let candidates = '';
      if (Array.isArray(c.articles)) {
        candidates = (c.articles as Array<Record<string, unknown>>)
          .map((a) => `- "${str(a.title)}" (/${str(a.slug)}) — ${str(a.category)}`)
          .join('\n');
      }

      return `You are suggesting internal links for a new health article on HealthyLifeStyles. Suggest exactly 5 existing articles from our site to link from this new article.

Current Article Title: ${title || '(untitled)'}
Current Article Content:
${contentText.slice(0, 6000) || '(no content yet)'}

Available articles on the site:
${candidates || '(no other articles available)'}

For each suggestion, explain why it is relevant and where in the article it should be placed. Return STRICT JSON only — no markdown fences, no extra text:
{
  "suggestions": [
    {
      "articleTitle": "string",
      "articleSlug": "string",
      "relevance": "high"|"medium",
      "placementContext": "string — describe where in the new article this link fits",
      "reason": "string — why this link adds value for the reader"
    }
  ]
}`;
    },
  },

  /* ── 3. Meta Description Generation ── */
  metaDescription: {
    maxTokens: 800,
    build: (c) => {
      const title = str(c.title);
      const excerpt = str(c.excerpt);
      const keywords = str(c.keywords);
      const contentText = extractContentText(c.content);

      return `Generate an SEO meta description for this health article.

Article Title: ${title || '(untitled)'}
Article Excerpt: ${excerpt || '(not set)'}
Target Keywords: ${keywords || '(not set)'}
Article Content:
${contentText.slice(0, 4000) || '(no content yet)'}

Requirements:
- Between 140 and 155 characters
- Include the primary keyword naturally
- Include a soft call-to-action (e.g., "Learn how", "Discover", "Find out")
- No quotes, no ALL CAPS
- Professional medical tone — not hype
- Unique from any existing meta description

Return STRICT JSON only — no markdown fences, no extra text:
{
  "metaDescription": "string (140–155 chars)",
  "characterCount": number,
  "primaryKeywordIncluded": boolean,
  "alternatives": ["string", "string"]
}`;
    },
  },
};

async function callDeepSeek(
  system: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

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
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 429) throw new Error('Rate limited — try again in a moment.');
    if (res.status === 401) throw new Error('Invalid DeepSeek API key.');
    throw new Error(`DeepSeek API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const body = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('DeepSeek returned an empty response.');

  return text;
}

export const aiWriting: Endpoint = {
  path: '/ai-writing',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    /* Auth — staff only */
    if (!req.user) {
      return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    /* API key check */
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: 'AI Writing Assistant is not configured. Set DEEPSEEK_API_KEY on the server.' },
        { status: 503 },
      );
    }

    /* Parse body */
    let body: WritingBody;
    try {
      body = req.json ? ((await req.json()) as WritingBody) : ({} as WritingBody);
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

    try {
      const result = await callDeepSeek(SYSTEM, userPrompt, maxTokens);
      return Response.json({ task, result });
    } catch (err) {
      const msg = (err as Error).message;
      req.payload?.logger?.error?.('AI Writing error: ' + msg);

      if (msg.startsWith('Rate limited')) {
        return Response.json({ error: msg }, { status: 429 });
      }
      if (msg.startsWith('Invalid DeepSeek')) {
        return Response.json({ error: msg }, { status: 502 });
      }
      return Response.json(
        { error: 'Unexpected error from AI Writing Assistant. Please try again.' },
        { status: 500 },
      );
    }
  },
};
