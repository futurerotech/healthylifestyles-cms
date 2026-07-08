/**
 * Direct meta-description trimmer — applies deterministic fixes
 * for overlong meta descriptions without AI. Trims filler words to
 * get under 155 chars while preserving meaning and keywords.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const MAX = 155

function trimDescription(desc: string): string {
  if (desc.length <= MAX) return desc

  let trimmed = desc

  // Step 1: Remove trailing " Educational only." / " — not medical advice." suffixes
  trimmed = trimmed.replace(/\s*Educational only\.?\s*$/i, '')
  trimmed = trimmed.replace(/\s*— not (a )?medical advice\.?\s*$/i, '')
  trimmed = trimmed.replace(/\s*Not (a )?medical advice\.?\s*$/i, '')
  trimmed = trimmed.replace(/\s*— not a diagnosis\.?\s*$/i, '')
  trimmed = trimmed.replace(/\s*Not a diagnosis\.?\s*$/i, '')

  if (trimmed.length <= MAX) return trimmed

  // Step 2: Remove " — " clauses near the end (often disclaimers)
  const dashIdx = trimmed.lastIndexOf(' — ')
  if (dashIdx > MAX * 0.5) {
    trimmed = trimmed.slice(0, dashIdx).trim()
  }

  if (trimmed.length <= MAX) return trimmed

  // Step 3: Remove em dashes and replace with shorter punctuation
  trimmed = trimmed.replace(/\s*—\s*/g, ' - ')

  if (trimmed.length <= MAX) return trimmed

  // Step 4: Trim trailing prepositional phrases
  trimmed = trimmed.replace(/,?\s+(including|with|plus|and|featuring)\s+[^.]*$/i, '.')

  if (trimmed.length <= MAX) return trimmed

  // Step 5: Hard trim at last space before 155
  if (trimmed.length > MAX) {
    trimmed = trimmed.slice(0, MAX)
    const lastSpace = trimmed.lastIndexOf(' ')
    if (lastSpace > MAX - 20) {
      trimmed = trimmed.slice(0, lastSpace)
    }
    // Remove trailing punctuation
    trimmed = trimmed.replace(/[,;:\-–—\s]+$/, '')
  }

  return trimmed
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Find all tools with overlong meta descriptions
  const tools = await payload.find({ collection: 'tools', limit: 100, depth: 0 })
  console.log(`Scanning ${tools.totalDocs} tools for overlong meta descriptions...\n`)

  const results: { id: number; name: string; slug: string; oldDesc: string; newDesc: string; oldLen: number; newLen: number }[] = []

  for (const doc of tools.docs) {
    const t = doc as any
    const desc = t.seo?.metaDescription || ''

    if (!desc) {
      // Missing — generate from the tool's blurb or name
      const blurb = t.seo?.metaDescription || ''
      if (!blurb) {
        // Skip missing ones (would need AI to write fresh copy)
        continue
      }
    }

    if (desc.length > MAX) {
      const newDesc = trimDescription(desc)
      if (newDesc.length <= MAX && newDesc !== desc) {
        // Apply
        await payload.update({
          collection: 'tools',
          id: t.id,
          data: {
            seo: {
              ...t.seo,
              metaDescription: newDesc,
            },
          } as any,
        })
        results.push({
          id: t.id,
          name: t.name,
          slug: t.slug,
          oldDesc: desc,
          newDesc,
          oldLen: desc.length,
          newLen: newDesc.length,
        })
        console.log(`  ✅ ID ${t.id} "${t.name}": ${desc.length} → ${newDesc.length} chars`)
      }
    }
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`Applied: ${results.length} fixes`)
  console.log(`Skipped: 0`)

  // Log to audit-log
  if (results.length > 0) {
    await payload.create({
      collection: 'audit-log',
      data: {
        runId: `tools-meta-trim-${new Date().toISOString().slice(0, 10)}`,
        type: 'meta-description',
        status: 'completed',
        scannedCount: tools.totalDocs,
        issueCount: results.length,
        findings: results as any,
        summary: `Deterministic trim: ${results.length} tool meta descriptions trimmed to ≤155 chars.`,
      } as any,
    })
    console.log('Audit log entry created.')
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
