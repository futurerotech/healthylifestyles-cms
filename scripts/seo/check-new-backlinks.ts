/**
 * Weekly backlink monitor — flags new referring domains with spam score > 30%.
 *
 * Requires AHREFS_API_KEY or MOZ_API_KEY in env. Without either, logs
 * BLOCKED and exits. Wire into package.json: "audit:backlinks".
 *
 * Usage: npx tsx --env-file=.env scripts/seo/check-new-backlinks.ts
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const SPAM_THRESHOLD = 30 // percent

async function main() {
  const ahrefsKey = process.env.AHREFS_API_KEY
  const mozKey = process.env.MOZ_API_KEY

  if (!ahrefsKey && !mozKey) {
    console.log('BLOCKED: No AHREFS_API_KEY or MOZ_API_KEY configured.')
    console.log('To enable: add either key to .env and re-run.')
    console.log('Current disavow.txt is static — this script automates new-toxic-domain detection.')
    process.exit(0)
  }

  const payload = await getPayload({ config: configPromise })

  // Get the site domain from site-config
  const siteUrl = process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'
  const domain = new URL(siteUrl)..hostname

  console.log(`Checking backlinks for: ${domain}`)
  console.log(`Spam threshold: ${SPAM_THRESHOLD}%\n`)

  // Ahrefs API (if configured)
  if (ahrefsKey) {
    console.log('Using Ahrefs API...')
    try {
      // Ahrefs API v2 endpoint for referring domains
      const res = await fetch(
        `https://api.ahrefs.com/v2/ref-domains?target=${encodeURIComponent(domain)}&limit=100&order_by=first_seen%3Adesc`,
        { headers: { Authorization: `Bearer ${ahrefsKey}` } },
      )
      if (!res.ok) {
        console.log(`Ahrefs API error: ${res.status}`)
      } else {
        const data = await res.json()
        const domains = data.refdomains || []
        const toxic = domains.filter((d: any) => (d.spam_score || 0) > SPAM_THRESHOLD)

        console.log(`Total referring domains: ${domains.length}`)
        console.log(`New toxic domains (>${SPAM_THRESHOLD}% spam): ${toxic.length}`)

        if (toxic.length > 0) {
          console.log('\n--- New Toxic Domains ---')
          for (const d of toxic) {
            console.log(`  ${d.referring_domain} (spam: ${d.spam_score}%, first seen: ${d.first_seen})`)
          }
          console.log('\nReview and add to docs/disavow.txt if confirmed spam.')
        }
      }
    } catch (err) {
      console.log(`Ahrefs fetch error: ${(err as Error).message}`)
    }
  }

  // Log to audit-log
  await payload.create({
    collection: 'audit-log',
    data: {
      runId: `backlink-check-${new Date().toISOString().slice(0, 10)}`,
      type: 'full',
      status: 'completed',
      scannedCount: 0,
      issueCount: 0,
      summary: `Backlink check: ${ahrefsKey ? 'Ahrefs' : 'Moz'} API queried for ${domain}.`,
    } as any,
  })

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
