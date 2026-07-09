/**
 * build-disavow.ts
 *
 * Idempotent CSV → disavow builder.
 *
 * Reads a referring-domains CSV (Ahrefs/Semrush/Moz), flags toxic domains,
 * merges with the existing docs/disavow.txt, and produces:
 *   - docs/disavow-proposed.txt        (strict GSC format, for human approval)
 *   - docs/disavow-review-manifest.json(human + machine-readable evidence)
 *   - docs/disavow-history/YYYY-MM-DD-proposed.txt (versioned snapshot)
 *
 * After the manifest is approved, rename disavow-proposed.txt to disavow.txt
 * and the dated snapshot to YYYY-MM-DD-disavow.txt.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/seo/build-disavow.ts docs/seo/backlinks-2026-07-09.csv
 */
import * as fs from 'fs'
import * as path from 'path'

const DOCS_DIR = path.resolve(process.cwd(), 'docs')
const EXISTING_DISAVOW = path.join(DOCS_DIR, 'disavow.txt')
const PROPOSED_DISAVOW = path.join(DOCS_DIR, 'disavow-proposed.txt')
const MANIFEST_PATH = path.join(DOCS_DIR, 'disavow-review-manifest.json')
const HISTORY_DIR = path.join(DOCS_DIR, 'disavow-history')

const SPAM_THRESHOLD = 30

interface CsvRow {
  referringDomain: string
  targetUrl: string
  dr: number | undefined
  spamScore: number | undefined
  firstSeen: string
}

interface ManifestEntry {
  domain: string
  action: 'disavow' | 'review' | 'keep'
  reasons: string[]
  evidence: {
    targetUrl?: string
    dr?: number
    spamScore?: number
    firstSeen?: string
  }
}

interface Manifest {
  generatedAt: string
  inputCsv: string
  existingDomains: string[]
  proposedDomains: string[]
  newDomains: string[]
  entries: ManifestEntry[]
}

// ---------------------------------------------------------------------------
// CSV parsing (supports quoted fields, CRLF/LF, auto-detect vendor headers)
// ---------------------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.length > 0 || lines.length > 0) {
        lines.push(current)
        current = ''
      }
      if (ch === '\r' && next === '\n') i++
    } else {
      current += ch
    }
  }
  if (current.length > 0) lines.push(current)

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1).map(splitLine)
  return { headers, rows }
}

function splitLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function findHeaderIndex(headers: string[], variants: string[]): number {
  for (const v of variants) {
    const idx = headers.indexOf(v.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

function normalizeRows(headers: string[], rows: string[][]): CsvRow[] {
  const domainIdx = findHeaderIndex(headers, ['referring domain', 'domain', 'source', 'referring_domain'])
  const targetIdx = findHeaderIndex(headers, ['target url', 'linked page', 'url', 'target', 'target_url'])
  const drIdx = findHeaderIndex(headers, ['dr', 'da', 'authority score', 'domain rating'])
  const spamIdx = findHeaderIndex(headers, ['spam score', 'as', 'spam_score'])
  const firstSeenIdx = findHeaderIndex(headers, ['first seen', 'date first seen', 'first_seen'])

  if (domainIdx === -1) throw new Error('CSV missing referring domain column')

  return rows
    .map((r) => ({
      referringDomain: cleanDomain(r[domainIdx] || ''),
      targetUrl: targetIdx === -1 ? '' : (r[targetIdx] || '').trim(),
      dr: drIdx === -1 ? undefined : parseNumber(r[drIdx]),
      spamScore: spamIdx === -1 ? undefined : parseNumber(r[spamIdx]),
      firstSeen: firstSeenIdx === -1 ? '' : (r[firstSeenIdx] || '').trim(),
    }))
    .filter((r) => r.referringDomain)
}

function cleanDomain(raw: string): string {
  let d = raw.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '')
  d = d.replace(/^www\./, '')
  d = d.replace(/\/.*$/, '')
  return d
}

function parseNumber(raw: string): number | undefined {
  const n = parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

const PBN_PATTERNS = [
  /buyseo|seolink|backlink|linkbarn|rankseo/i,
  /(blog\d+|qowap|onesmablog|jaiblogs|getblogs|dbblog)\.\w+$/i,
]

const FOREIGN_TLD_PATTERNS = [
  /\.(ru|cn|tk|ml|ga|cf|top|xyz|click|link|work)\b/i,
]

function evaluate(row: CsvRow): { action: ManifestEntry['action']; reasons: string[] } {
  const reasons: string[] = []

  if (row.spamScore !== undefined && row.spamScore > SPAM_THRESHOLD) {
    reasons.push(`spam score ${row.spamScore}% > ${SPAM_THRESHOLD}%`)
  }

  if (row.targetUrl && /\/game\//i.test(row.targetUrl)) {
    reasons.push(`cross-contamination: targets non-existent /game/ path (${row.targetUrl})`)
  }

  if (PBN_PATTERNS.some((p) => p.test(row.referringDomain))) {
    reasons.push('PBN / link-seller footprint in domain name')
  }

  if (FOREIGN_TLD_PATTERNS.some((p) => p.test(row.referringDomain))) {
    reasons.push('foreign/irrelevant TLD for US health audience')
  }

  if (reasons.length === 0) return { action: 'keep', reasons: ['no toxic signals'] }

  // Hard spam rules auto-disavow; anything else gets flagged for review.
  const hard =
    (row.spamScore !== undefined && row.spamScore > SPAM_THRESHOLD) ||
    (row.targetUrl && /\/game\//i.test(row.targetUrl)) ||
    PBN_PATTERNS.some((p) => p.test(row.referringDomain))

  return { action: hard ? 'disavow' : 'review', reasons }
}

// ---------------------------------------------------------------------------
// Disavow file helpers
// ---------------------------------------------------------------------------

function parseExistingDisavow(filePath: string): { commentLines: string[]; domains: string[] } {
  if (!fs.existsSync(filePath)) return { commentLines: [], domains: [] }
  const text = fs.readFileSync(filePath, 'utf-8')
  const commentLines: string[] = []
  const domains: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) {
      commentLines.push(trimmed)
    } else if (trimmed.startsWith('domain:')) {
      domains.push(trimmed.replace(/^domain:/, '').trim().toLowerCase())
    }
  }
  return { commentLines, domains }
}

function buildDisavowText(commentLines: string[], domains: string[]): string {
  const header = [
    '# HealthyLifeStyles — Google Disavow File',
    `# Generated: ${new Date().toISOString().slice(0, 10)}`,
    '# Domain-level disavow. Keep comments above the domain: lines.',
    '#',
  ]
  const preservedComments = commentLines.filter(
    (l) =>
      !l.startsWith('# HealthyLifeStyles') &&
      !l.startsWith('# Generated:') &&
      !l.startsWith('# Domain-level') &&
      l !== '#',
  )
  const body = [
    ...header,
    ...preservedComments,
    ...domains.map((d) => `domain:${d}`),
    '',
  ]
  return body.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/seo/build-disavow.ts <path-to-csv>')
    process.exit(1)
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(csvPath, 'utf-8')
  const { headers, rows } = parseCsv(raw)
  console.log(`Detected CSV headers: ${headers.join(', ')}`)
  console.log(`Rows: ${rows.length}`)

  const normalized = normalizeRows(headers, rows)
  console.log(`Normalized rows: ${normalized.length}`)

  const { commentLines, domains: existingDomains } = parseExistingDisavow(EXISTING_DISAVOW)
  console.log(`Existing disavow domains: ${existingDomains.length}`)

  const entries: ManifestEntry[] = []
  const proposedDomainSet = new Set<string>(existingDomains)

  for (const row of normalized) {
    const { action, reasons } = evaluate(row)
    entries.push({
      domain: row.referringDomain,
      action,
      reasons,
      evidence: {
        targetUrl: row.targetUrl || undefined,
        dr: row.dr,
        spamScore: row.spamScore,
        firstSeen: row.firstSeen || undefined,
      },
    })

    if (action === 'disavow') {
      proposedDomainSet.add(row.referringDomain)
    }
  }

  // Preserve existing domains even if they don't appear in the new CSV.
  const allExistingEntries: ManifestEntry[] = existingDomains.map((d) => ({
    domain: d,
    action: 'disavow',
    reasons: ['existing entry from prior disavow file'],
    evidence: {},
  }))

  // Merge entries: existing first, then new, dedupe by domain.
  const seen = new Set<string>()
  const mergedEntries: ManifestEntry[] = []
  for (const e of [...allExistingEntries, ...entries]) {
    if (seen.has(e.domain)) continue
    seen.add(e.domain)
    mergedEntries.push(e)
  }

  const proposedDomains = Array.from(proposedDomainSet).sort()
  const newDomains = proposedDomains.filter((d) => !existingDomains.includes(d))

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    inputCsv: path.resolve(csvPath),
    existingDomains,
    proposedDomains,
    newDomains,
    entries: mergedEntries,
  }

  // Write outputs
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true })
  }

  const dateStamp = new Date().toISOString().slice(0, 10)
  const historyPath = path.join(HISTORY_DIR, `${dateStamp}-proposed.txt`)

  fs.writeFileSync(PROPOSED_DISAVOW, buildDisavowText(commentLines, proposedDomains), 'utf-8')
  fs.writeFileSync(historyPath, buildDisavowText(commentLines, proposedDomains), 'utf-8')
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log('\n--- Summary ---')
  console.log(`Existing domains: ${existingDomains.length}`)
  console.log(`New domains to disavow: ${newDomains.length}`)
  console.log(`Proposed total: ${proposedDomains.length}`)
  console.log(`Review entries: ${mergedEntries.filter((e) => e.action === 'review').length}`)
  console.log(`\nOutputs:`)
  console.log(`  ${PROPOSED_DISAVOW}`)
  console.log(`  ${historyPath}`)
  console.log(`  ${MANIFEST_PATH}`)

  if (newDomains.length > 0) {
    console.log('\nNew domains flagged for disavow:')
    for (const d of newDomains) {
      const e = mergedEntries.find((x) => x.domain === d)
      console.log(`  domain:${d}  # ${e?.reasons.join('; ') || ''}`)
    }
    console.log('\nReview the manifest, then approve to finalize docs/disavow.txt.')
  }
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
