/**
 * AI SEO Autopilot — Phase 1 Audit Runner.
 *
 * Crawls 10 articles, runs the meta-description detector,
 * logs findings to the audit-log collection, and prints a report.
 *
 * Usage: npx tsx --env-file=.env scripts/ai-audit/run-audit.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { crawlArticles } from './crawler'
import { detectMetaDescriptionIssues, type Finding } from './detectors'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // 1. Crawl 10 articles
  console.log('=== Crawling articles (limit 10) ===\n')
  const pages = await crawlArticles(payload, 10)
  console.log(`Crawled ${pages.length} pages.\n`)

  // 2. Run detector
  console.log('=== Running meta-description detector ===\n')
  const findings = detectMetaDescriptionIssues(pages)

  // 3. Print report
  console.log(`Findings: ${findings.length} issues across ${pages.length} pages\n`)
  console.log('ID  | Severity   | Issue                                          | Page')
  console.log('----|------------|------------------------------------------------|----')

  for (const f of findings) {
    const sev = f.severity.padEnd(10)
    const issue = f.issue.slice(0, 46).padEnd(46)
    console.log(`${String(f.pageId).padEnd(3)} | ${sev} | ${issue} | ${f.url}`)
  }

  // Summary
  const critical = findings.filter((f) => f.severity === 'critical').length
  const warning = findings.filter((f) => f.severity === 'warning').length
  const info = findings.filter((f) => f.severity === 'info').length

  console.log(`\nSummary: ${critical} critical, ${warning} warnings, ${info} info`)
  console.log(`Pages with no issues: ${pages.length - new Set(findings.map((f) => f.pageId)).size}/${pages.length}`)

  // 4. Log to audit-log collection
  const runId = `phase1-meta-desc-${new Date().toISOString().slice(0, 10)}`
  await payload.create({
    collection: 'audit-log',
    data: {
      runId,
      type: 'meta-description',
      status: 'completed',
      scannedCount: pages.length,
      issueCount: findings.length,
      findings: findings as any,
      summary: `Scanned ${pages.length} articles. Found ${findings.length} issues (${critical} critical, ${warning} warnings, ${info} info).`,
    } as any,
  })
  console.log(`\nAudit log entry created: ${runId}`)

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
