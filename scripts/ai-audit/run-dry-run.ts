/**
 * AI SEO Autopilot — Phase 2 DRY-RUN Executor.
 *
 * Runs the audit crawler + detectors, then for each finding asks Gemini
 * to propose a fix. All proposed fixes are logged to the audit-log
 * collection. NO content is modified — this is dry-run only.
 *
 * Usage: npx tsx --env-file=.env scripts/ai-audit/run-dry-run.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { crawlArticles } from './crawler'
import { detectMetaDescriptionIssues } from './detectors'
import { executeDryRun } from './executor'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // 1. Crawl articles
  console.log('=== Step 1: Crawling articles ===\n')
  const pages = await crawlArticles(payload, 10)
  console.log(`Crawled ${pages.length} pages.\n`)

  // 2. Detect issues
  console.log('=== Step 2: Detecting issues ===\n')
  const findings = detectMetaDescriptionIssues(pages)
  console.log(`Found ${findings.length} issues.\n`)

  if (findings.length === 0) {
    console.log('No issues found — nothing to fix. DRY-RUN complete.')
    await payload.destroy()
    return
  }

  // 3. Generate proposed fixes (DRY-RUN)
  console.log('=== Step 3: Generating proposed fixes (DRY-RUN) ===\n')
  const fixes = await executeDryRun(findings)

  for (const fix of fixes) {
    console.log(`  [${fix.confidence.toUpperCase()}] ${fix.slug}:`)
    console.log(`    Issue: ${fix.issue}`)
    console.log(`    Current: "${fix.currentValue.slice(0, 60)}..."`)
    console.log(`    Proposed [${fix.proposedValue.length} chars]: "${fix.proposedValue}"`)
    console.log()
  }

  // 4. Log to audit-log
  const runId = `phase2-dryrun-${new Date().toISOString().slice(0, 10)}`
  await payload.create({
    collection: 'audit-log',
    data: {
      runId,
      type: 'meta-description',
      status: 'completed',
      scannedCount: pages.length,
      issueCount: findings.length,
      findings: fixes as any,
      summary: `DRY-RUN: Scanned ${pages.length} articles, found ${findings.length} issues, generated ${fixes.length} proposed fixes. No content was modified.`,
    } as any,
  })

  console.log(`Audit log entry created: ${runId}`)
  console.log(`\nDRY-RUN COMPLETE — ${fixes.length} proposed fixes logged for human review.`)
  console.log('No content was modified.')

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
