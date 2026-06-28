import { AIError } from './ai';

/**
 * Reputable-source web search for the "Find & verify sources" assist.
 *
 * Restricts results to recognised health authorities so the editor is shown
 * trustworthy candidates. Provider: Tavily (TAVILY_API_KEY) via raw fetch — a
 * clear extension point for Brave/Bing/Google CSE. This ASSISTS a human; it
 * never certifies accuracy, never writes to the article.
 */

const AUTHORITY_DOMAINS = [
  'who.int',
  'cdc.gov',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'medlineplus.gov',
  'niddk.nih.gov',
  'heart.org',
  'acog.org',
  'nhs.uk',
  'mayoclinic.org',
  'hopkinsmedicine.org',
];

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

/** Whether the search provider has its key configured. */
export function isSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

/** Search the authority allow-list for a claim. Returns [] on no match. */
export async function searchReputable(query: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new AIError('not_configured', 'Source search needs TAVILY_API_KEY.', 503);

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: 4,
      include_domains: AUTHORITY_DOMAINS,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new AIError('provider_error', `Source search error ${res.status}: ${t.slice(0, 150)}`, 502);
  }

  const json: any = await res.json().catch(() => ({}));
  const results = Array.isArray(json?.results) ? json.results : [];
  return results
    .map((r: any) => ({
      title: String(r?.title || r?.url || ''),
      url: String(r?.url || ''),
      snippet: typeof r?.content === 'string' ? r.content.slice(0, 200) : undefined,
    }))
    .filter((r: SearchResult) => r.url.startsWith('http'));
}
