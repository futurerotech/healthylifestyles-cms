/**
 * AI SEO Autopilot — Live Executor for Tools collection.
 *
 * Crawls all tools, detects meta description issues, and with --execute
 * flag applies AI-generated fixes directly to the live database.
 *
 * Usage:
 *   DRY-RUN:  npx tsx --env-file=.env scripts/ai-audit/run-tools-audit.ts
 *   EXECUTE:  npx tsx --env-file=.env scripts/ai-audit/run-tools-audit.ts --execute
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { crawlTools } from './crawler'
import { detectMetaDescriptionIssues } from './detectors'
import { executeDryRun, executeLive, type ProposedFix } from './executor'

const EXECUTE = process.argv.includes('--execute')

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY-RUN (no writes)'}\n`)

  // 1. Crawl ALL tools
  console.log('=== Step 1: Crawling tools ===\n')
  const pages = await crawlTools(payload, 100)
  console.log(`Crawled ${pages.length} tools.\n`)

  // 2. Detect issues — filter to critical + warning only for execution
  console.log('=== Step 2: Detecting meta description issues ===\n')
  const allFindings = detectMetaDescriptionIssues(pages)
  // For --execute: only process critical (missing) + warning (overlong), skip info (too short)
  const findings = EXECUTE
    ? allFindings.filter((f) => f.severity === 'critical' || f.severity === 'warning')
    : allFindings
  console.log(`Found ${allFindings.length} total issues, processing ${findings.length} (${EXECUTE ? 'critical+warning only' : 'all'}).`)

  if (findings.length === 0) {
    console.log('No issues found — all tools have valid meta descriptions.')
    await payload.destroy()
    return
  }

  // Print findings
  for (const f of findings) {
    console.log(`  [${f.severity}] ID ${f.pageId} "${f.title}": ${f.issue}`)
    console.log(`    Current: "${f.currentValue.slice(0, 80)}..."`)
  }
  console.log()

  // 3. Execute
  console.log(`=== Step 3: ${EXECUTE ? 'Applying AI fixes LIVE' : 'Generating proposed fixes (DRY-RUN)'} ===\n`)

  let fixes: ProposedFix[]
  if (EXECUTE) {
    fixes = await executeLive(payload, findings)
  } else {
    fixes = await executeDryRun(findings)
  }

  // 4. Report
  console.log(`\n=== Results ===\n`)
  const applied = fixes.filter((f) => f.status === 'applied')
  const proposed = fixes.filter((f) => f.status === 'proposed')
  console.log(`Total fixes: ${fixes.length}`)
  console.log(`  Applied (live): ${applied.length}`)
  console.log(`  Proposed (dry-run): ${proposed.length}`)

  for (const fix of fixes) {
    console.log(`\n  ${fix.status === 'applied' ? '✅ APPLIED' : '📝 PROPOSED'} [${fix.confidence}] ${fix.slug}:`)
    console.log(`    Old: "${fix.currentValue.slice(0, 80)}"`)
    console.log(`    New: "${fix.proposedValue}"`)
    console.log(`    Chars: ${fix.proposedValue.length} | Model: ${fix.aiModel}`)
  }

  // 5. Log to audit-log
  const runId = `tools-meta-${EXECUTE ? 'execute' : 'dryrun'}-${new Date().toISOString().slice(0, 10)}`
  await payload.create({
    collection: 'audit-log',
    data: {
      runId,
      type: 'meta-description',
      status: 'completed',
      scannedCount: pages.length,
      issueCount: findings.length,
      findings: fixes as any,
      summary: `${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}: Scanned ${pages.length} tools, found ${findings.length} issues, ${applied.length} applied live, ${proposed.length} proposed.`,
    } as any,
  })
  console.log(`\nAudit log entry: ${runId}`)

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
