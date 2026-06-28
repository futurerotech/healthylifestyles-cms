import { AIError } from './ai';

/**
 * Optional hero-image generation for AI articles.
 *
 * Provider-swappable via IMAGE_PROVIDER ("openai" = DALL·E 3 [OPENAI_API_KEY],
 * "flux" = fal.ai Flux [FAL_KEY]). Raw fetch — no extra SDK. A LOCKED brand
 * style block + hard guardrails are prepended to the model's suggested prompt:
 * bright/airy wellness, green+navy palette, soft-3D illustration, 16:9, and
 * NO text/logos/packaging, NO real or identifiable people, body-positive.
 */

/* --------------------- locked brand style + guards ----------------- */

const BRAND_STYLE = [
  'Bright, airy wellness illustration in a soft-3D / modern editorial illustration style.',
  'Color palette: fresh wellness green (#16A34A and #22C55E) with deep navy (#0A1628) and light mint accents, plenty of clean white space.',
  'Calm, optimistic, premium, inclusive and body-positive health imagery.',
  'Wide 16:9 composition.',
  'Absolutely NO text, words, letters, numbers, captions, watermarks or logos.',
  'NO brand packaging or product labels.',
  'NO real, identifiable, or famous people; avoid recognizable faces.',
  'Never depict extreme thinness, dieting shame, or disordered-eating cues.',
].join(' ');

/** Negative prompt for providers that support one (Flux). */
const NEGATIVE = 'text, words, letters, captions, watermark, logo, brand, packaging, label, real person, identifiable face, celebrity, extreme thinness, weighing scale shaming, deformed, low quality';

function buildImagePrompt(subject: string): string {
  const clean = (subject || '').trim() || 'a calm, healthy lifestyle scene with fresh food and movement';
  return `${BRAND_STYLE}\n\nSubject: ${clean}`;
}

/* ------------------------------- types ----------------------------- */

export interface GeneratedImage {
  data: Buffer;
  contentType: string;
  ext: string;
  /** Provider's revised prompt, when available (DALL·E rewrites prompts). */
  revisedPrompt?: string;
}

interface ImageProvider {
  readonly name: string;
  readonly envKey: string;
  generate(prompt: string): Promise<GeneratedImage>;
}

/* ------------------------------ helpers ---------------------------- */

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i <= attempts; i++) {
    res = await fetch(url, init);
    if (res.ok || !RETRYABLE.has(res.status) || i === attempts) return res;
    await sleep(700 * 2 ** i + Math.floor(Math.random() * 250));
  }
  return res as Response;
}

/* ---------------------------- providers ---------------------------- */

const openaiProvider: ImageProvider = {
  name: 'openai',
  envKey: 'OPENAI_API_KEY',
  async generate(prompt) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new AIError('not_configured', 'Image generation needs OPENAI_API_KEY (DALL·E 3).', 503);
    // DALL·E 3 has no negative-prompt field, so the NO-rules live in the prompt.
    const res = await fetchWithRetry('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024', // ~16:9
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new AIError('provider_error', `DALL·E 3 error ${res.status}: ${t.slice(0, 200)}`, 502);
    }
    const json: any = await res.json().catch(() => ({}));
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new AIError('provider_error', 'DALL·E 3 returned no image.', 502);
    return { data: Buffer.from(b64, 'base64'), contentType: 'image/png', ext: 'png', revisedPrompt: json?.data?.[0]?.revised_prompt };
  },
};

const fluxProvider: ImageProvider = {
  name: 'flux',
  envKey: 'FAL_KEY',
  async generate(prompt) {
    const key = process.env.FAL_KEY;
    if (!key) throw new AIError('not_configured', 'Image generation needs FAL_KEY (Flux via fal.ai).', 503);
    const res = await fetchWithRetry('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: NEGATIVE,
        image_size: 'landscape_16_9',
        num_images: 1,
        enable_safety_checker: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new AIError('provider_error', `Flux error ${res.status}: ${t.slice(0, 200)}`, 502);
    }
    const json: any = await res.json().catch(() => ({}));
    const img = json?.images?.[0];
    if (!img?.url) throw new AIError('provider_error', 'Flux returned no image.', 502);
    const bin = await fetch(img.url);
    if (!bin.ok) throw new AIError('provider_error', `Could not download Flux image (${bin.status}).`, 502);
    const data = Buffer.from(await bin.arrayBuffer());
    const contentType = img.content_type || bin.headers.get('content-type') || 'image/png';
    return { data, contentType, ext: contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png' };
  },
};

function getProvider(): ImageProvider {
  return (process.env.IMAGE_PROVIDER || 'openai').toLowerCase() === 'flux' ? fluxProvider : openaiProvider;
}

/* ------------------------------ public ----------------------------- */

/** Whether the selected image provider has its API key configured. */
export function isImageConfigured(): boolean {
  return Boolean(process.env[getProvider().envKey]);
}

/** Generate a branded, guardrailed hero image from the model's suggested prompt. */
export async function generateHeroImage(subject: string): Promise<GeneratedImage> {
  return getProvider().generate(buildImagePrompt(subject));
}
