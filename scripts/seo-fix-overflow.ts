import { getPayload } from 'payload'
import configPromise from '@payload-config'

const FIXES: Record<number, { field: string; value: string }[]> = {
  5: [{
    field: 'ogDescription',
    value: 'Lose fat without losing muscle: the three levers that matter — a moderate deficit, high protein, and resistance training. Free tool included.',
  }],
  6: [{
    field: 'twitterDescription',
    value: "How due dates are calculated from conception, last period, or IVF transfer. Free due date calculator. Understand Naegele's rule and ultrasound dating.",
  }],
  7: [{
    field: 'ogDescription',
    value: 'Compare 16:8, 18:6, OMAD, and 5:2 fasting schedules. Learn what breaks a fast and find a schedule you can keep. Free fasting timer included.',
  }],
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Fixing 3 over-limit fields...\n')

  for (const [id, fixes] of Object.entries(FIXES)) {
    for (const fix of fixes) {
      const len = fix.value.length
      const ok = len <= 155 ? 'OK' : 'STILL OVER'
      console.log(`Article ${id} ${fix.field}: ${len} chars [${ok}]`)

      const seoUpdate: any = {}
      seoUpdate[fix.field] = fix.value
      await payload.update({ collection: 'articles', id: Number(id), data: { seo: seoUpdate } as any })
      console.log(`  Written: "${fix.value.slice(0, 60)}..."`)
    }
  }

  // Verify
  console.log('\nVerification:')
  for (const id of Object.keys(FIXES).map(Number)) {
    const a = await payload.findByID({ collection: 'articles', id, depth: 0 }) as any
    const seo = a.seo || {}
    for (const fix of FIXES[id]) {
      const val = seo[fix.field] || ''
      const len = val.length
      console.log(`  Article ${id} ${fix.field}: ${len} chars [${len <= 155 ? 'OK' : 'OVER'}]`)
    }
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
