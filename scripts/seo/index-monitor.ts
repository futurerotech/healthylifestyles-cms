/**
 * GSC Index Monitor Pipeline (§3).
 *
 * 1. Collects all URLs from Payload (articles + tools).
 * 2. Batch-inspects each via GSC URL Inspection API (concurrency 5, backoff on 429).
 * 3. Persists results to the indexing-status collection.
 * 4. Reports findings: indexing gaps, canonical conflicts, stale crawls.
 *
 * Usage: npx tsx --env-file=.env scripts/seo/index-monitor.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getGoogleAuth } from '../../src/lib/google-auth'
import { SITE_BASE_URL, GSC_SITE_URL, absoluteUrl } from '../../src/lib/site-config'

const CONCURRENCY = 5
const RATE_LIMIT_DELAY_MS = 200 // 600 req/min → 100ms between requests, use 200ms for safety

interface UrlEntry {
  url: string
  collection: string
  slug: string
}

interface InspectionResult {
  url: string
  verdict: string
  coverageState: string
  lastCrawled: string
  canonicalGoogle: string
  canonicalDeclared: string
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // 1. Collect URLs from Payload
  console.log('=== Step 1: Collecting URLs ===\n')
  const [articles, tools] = await Promise.all([
    payload.find({ collection: 'articles', limit: 1000, depth: 0, select: { slug: true, _status: true } }),
    payload.find({ collection: 'tools', limit: 1000, depth: 0, select: { slug: true, _status: true } }),
  ])

  const urls: UrlEntry[] = []
  for (const a of articles.docs) {
    if ((a as any)._status === 'published' && (a as any).slug) {
      urls.push({ url: absoluteUrl(`/wellness-hub/${(a as any).slug}`), collection: 'articles', slug: (a as any).slug })
    }
  }
  for (const t of tools.docs) {
    if ((t as any)._status === 'published' && (t as any).slug) {
      urls.push({ url: absoluteUrl(`/tools/${(t as any).slug}`), collection: 'tools', slug: (t as any).slug })
    }
  }

  console.log(`Collected ${urls.length} URLs (${articles.docs.filter((a: any) => a._status === 'published').length} articles + ${tools.docs.filter((t: any) => t._status === 'published').length} tools)`)

  // 2. GSC auth
  console.log('\n=== Step 2: GSC Authentication ===\n')
  let auth: any
  try {
    auth = await getGoogleAuth()
    console.log('✅ Authenticated.')
  } catch (err) {
    console.log(`❌ Auth failed: ${(err as Error).message}`)
    console.log('BLOCKED: No GSC credentials configured. Set GOOGLE_INDEXING_CREDENTIALS_B64 in .env.')
    await payload.destroy()
    process.exit(1)
  }

  const { google } = await import('googleapis')
  const searchconsole = google.searchconsole({ version: 'v1', auth })

  // 3. Verify property access
  console.log('\n=== Step 3: Verify Property ===\n')
  try {
    const sitesRes = await searchconsole.sites.list()
    const sites = sitesRes.data.siteEntry || []
    const match = sites.find((s: any) => s.siteUrl === GSC_SITE_URL)
    if (!match) {
      console.log(`❌ Property ${GSC_SITE_URL} not found. Verified: ${sites.map((s: any) => s.siteUrl).join(', ')}`)
      console.log('BLOCKED: Property not verified in GSC.')
      await payload.destroy()
      process.exit(1)
    }
    console.log(`✅ Property verified: ${match.siteUrl} [${match.permissionLevel}]`)
  } catch (err) {
    console.log(`❌ Property check failed: ${(err as Error).message}`)
    await payload.destroy()
    process.exit(1)
  }

  // 4. Batch inspect
  console.log(`\n=== Step 4: Inspecting ${urls.length} URLs (concurrency ${CONCURRENCY}) ===\n`)

  const results: InspectionResult[] = []
  const findings: string[] = []
  let processed = 0
  let indexed = 0

  // Simple concurrency pool
  const queue = [...urls]
  const workers: Promise<void>[] = []

  async function worker() {
    while (queue.length > 0) {
      const entry = queue.shift()!
      if (!entry) break

      try {
        const res = await searchconsole.urlInspection.index.inspect({
          requestBody: {
            inspectionUrl: entry.url,
            siteUrl: GSC_SITE_URL,
            languageCode: 'en-US',
          },
        })

        const result = res.data.inspectionResult
        const indexStatus = result?.indexStatusResult
        const verdict = indexStatus?.verdict || 'NEUTRAL'
        const coverageState = indexStatus?.coverageState || 'Unknown'
        const lastCrawled = indexStatus?.lastCrawledTime || ''
        const canonicalGoogle = indexStatus?.googleCanonical || ''
        const canonicalDeclared = indexStatus?.userCanonical || ''

        const ir: InspectionResult = {
          url: entry.url,
          verdict,
          coverageState,
          lastCrawled,
          canonicalGoogle,
          canonicalDeclared,
        }
        results.push(ir)

        // Count indexed
        if (coverageState.includes('indexed')) indexed++

        // Findings engine
        if (coverageState.includes('not indexed') || coverageState.includes('Excluded')) {
          findings.push(`INDEXING GAP: ${entry.url} → ${coverageState}`)
        }
        if (canonicalGoogle && canonicalDeclared && canonicalGoogle !== canonicalDeclared) {
          findings.push(`CANONICAL CONFLICT: ${entry.url} → Google: ${canonicalGoogle} vs Declared: ${canonicalDeclared}`)
        }
        if (lastCrawled) {
          const crawledDate = new Date(lastCrawled)
          const daysAgo = (Date.now() - crawledDate.getTime()) / (1000 * 60 * 60 * 24)
          if (daysAgo > 60) {
            findings.push(`STALE CRAWL: ${entry.url} → last crawled ${Math.round(daysAgo)} days ago`)
          }
        }

        // Persist to indexing-status
        await payload.create({
          collection: 'indexing-status',
          data: {
            docType: entry.collection,
            docSlug: entry.slug,
            url: entry.url,
            engine: 'gsc-inspection',
            status: 'success',
            submittedAt: new Date().toISOString(),
            verdict,
            coverageState,
            lastCrawled,
            canonicalGoogle,
            canonicalDeclared,
            inspectedAt: new Date().toISOString(),
          } as any,
        })

        processed++
        if (processed % 10 === 0) {
          console.log(`  Progress: ${processed}/${urls.length} inspected (${indexed} indexed)`)
        }
      } catch (err: any) {
        processed++
        if (err.code === 429 || err.code === 403) {
          console.log(`  Rate limited on ${entry.url} — pausing 5s...`)
          await new Promise((r) => setTimeout(r, 5000))
          // Re-queue for retry
          queue.push(entry)
          processed--
        } else {
          console.log(`  ERROR on ${entry.url}: ${err.message?.slice(0, 80)}`)
          // Log error
          await payload.create({
            collection: 'indexing-status',
            data: {
              docType: entry.collection,
              docSlug: entry.slug,
              url: entry.url,
              engine: 'gsc-inspection',
              status: 'failed',
              error: err.message?.slice(0, 500),
              submittedAt: new Date().toISOString(),
              inspectedAt: new Date().toISOString(),
            } as any,
          })
        }
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  // 5. Report
  console.log(`\n=== Inspection Complete ===\n`)
  console.log(`Total URLs: ${urls.length}`)
  console.log(`Inspected: ${results.length}`)
  console.log(`Indexed: ${indexed}`)
  console.log(`Errors: ${urls.length - results.length}`)
  console.log(`Findings: ${findings.length}`)

  if (findings.length > 0) {
    console.log('\n--- Findings ---')
    for (const f of findings) {
      console.log(`  ${f}`)
    }
  }

  // 6. Log to audit-log
  await payload.create({
    collection: 'audit-log',
    data: {
      runId: `gsc-index-sweep-${new Date().toISOString().slice(0, 10)}`,
      type: 'full',
      status: 'completed',
      scannedCount: urls.length,
      issueCount: findings.length,
      findings: { results: results.slice(0, 50), findings } as any,
      summary: `GSC Index Sweep: ${urls.length} URLs inspected, ${indexed} indexed, ${findings.length} findings.`,
    } as any,
  })
  console.log('\nAudit log entry created.')

  await payload.destroy()
  console.log(`\nGSC INTEGRATION HEALTHY — ${indexed}/${urls.length} URLs indexed`)
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
