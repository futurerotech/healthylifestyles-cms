/**
 * Backlink HTTP client: public internet only, with every DNS answer checked
 * at socket-connection time, so the checked address is the address used.
 * Redirects are handled manually and validated at every hop.
 *
 * No provider requests occur in isolated staging: the endpoint guard runs
 * before this module is called.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 1024 * 1024;
// Node BlockList maps IPv4 to ::ffff: addresses when checking mixed-family
// lists. Keep IPv4 and IPv6 subnet policies separate so the blocked
// ::ffff:0:0/96 range does not accidentally reject every public IPv4 host.
const denied4 = new BlockList();
const denied6 = new BlockList();

const blocked4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
const blocked6: Array<[string, number]> = [
  ['::', 96], ['::1', 128], ['::ffff:0:0', 96],
  ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 32], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
];
for (const [address, bits] of blocked4) denied4.addSubnet(address, bits, 'ipv4');
for (const [address, bits] of blocked6) denied6.addSubnet(address, bits, 'ipv6');

export function blockedBacklinkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return denied4.check(address, 'ipv4');
  if (family === 6) return denied6.check(address, 'ipv6');
  return true;
}

export function validatePublicBacklinkUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new TypeError('Backlink URL is invalid'); }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username || url.password || url.port) {
    throw new TypeError('Backlink URL scheme, credentials or port not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' ||
      ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.onion'].some(s => host.endsWith(s)) ||
      (isIP(host) !== 0 && blockedBacklinkAddress(host))) {
    throw new TypeError('Backlink URL is not a public destination');
  }
  return url;
}

export type PublicAddress = { address: string; family: number };
export function selectPublicDnsAddress(records: PublicAddress[]): PublicAddress {
  if (!records.length || records.some(a =>
    (a.family !== 4 && a.family !== 6) || isIP(a.address) !== a.family || blockedBacklinkAddress(a.address)
  )) throw new Error('Backlink hostname resolves to a non-public address');
  // Prefer IPv4 where available. The resolver returns this exact address to
  // the HTTP socket; a second, unverified lookup never occurs.
  return records.find(a => a.family === 4) ?? records[0];
}

const guardedLookup = ((
  hostname: string,
  _options: unknown,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
) => {
  dnsLookup(hostname, { all: true })
    .then(records => {
      const selected = selectPublicDnsAddress(records);
      callback(null, selected.address, selected.family);
    })
    .catch((error: unknown) => callback(
      error instanceof Error ? error : new Error('Backlink DNS lookup failed'), '', 4,
    ));
}) as LookupFunction;

export type BacklinkPage = {
  status: number;
  location?: string;
  contentType?: string;
  body: AsyncIterable<Uint8Array | string>;
  close: () => void;
};
export type BacklinkTransport = (
  url: URL, options: { signal: AbortSignal; userAgent: string },
) => Promise<BacklinkPage>;

const requestPublicPage: BacklinkTransport = (url, options) => new Promise((resolve, reject) => {
  const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
    method: 'GET',
    lookup: guardedLookup,
    autoSelectFamily: false,
    signal: options.signal,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': options.userAgent,
    },
  }, response => {
    const location = response.headers.location;
    const contentType = response.headers['content-type'];
    resolve({
      status: response.statusCode ?? 0,
      location: Array.isArray(location) ? location[0] : location,
      contentType: Array.isArray(contentType) ? contentType[0] : contentType,
      body: response,
      close: () => response.destroy(),
    });
  });
  request.once('error', reject);
  request.end();
});

async function readBoundedBody(page: BacklinkPage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of page.body) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_HTML_BYTES) {
      page.close();
      throw new Error('Backlink HTML exceeds size limit');
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export type BacklinkHttpResponse = {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
};

export async function fetchSafeBacklink(
  raw: string,
  options: { signal: AbortSignal; userAgent: string },
  transport: BacklinkTransport = requestPublicPage,
): Promise<BacklinkHttpResponse> {
  let destination = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = validatePublicBacklinkUrl(destination);
    const page = await transport(url, options);
    if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
      page.close();
      if (hop === MAX_REDIRECTS) throw new Error('Backlink redirect limit exceeded');
      destination = new URL(page.location, url).toString();
      continue;
    }
    if (page.status === 404 || page.status === 410) {
      page.close();
      return { status: page.status, ok: false, text: async () => '' };
    }
    if (page.status < 200 || page.status >= 300 || page.status === 204 ||
        (page.contentType && !/^\s*(?:text\/html|application\/xhtml\+xml)\b/i.test(page.contentType))) {
      page.close();
      return { status: page.status, ok: false, text: async () => '' };
    }
    const html = await readBoundedBody(page);
    return { status: page.status, ok: true, text: async () => html };
  }
  throw new Error('Backlink redirect limit exceeded');
}
