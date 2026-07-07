import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { encryptField } from '../src/lib/crypto'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Seed AiSettings with NaraRouter as the primary provider
  const naraKey = process.env.NARAROUTER_API_KEY || ''
  if (!naraKey) {
    console.log('NARAROUTER_API_KEY not set — cannot seed. Set it in .env first.')
    process.exit(1)
  }

  const encrypted = encryptField(naraKey)

  await payload.updateGlobal({
    slug: 'ai-settings',
    data: {
      providers: [
        {
          label: 'NaraRouter',
          providerUrl: 'https://router.bynara.id/v1',
          apiKey: encrypted,
          enabled: true,
        },
      ],
      defaultModel: 'deepseek-v4-flash',
      taskModelMap: [
        { taskType: 'meta_trim', model: 'deepseek-v4-flash', maxTokens: 1024, temperature: 0.3 },
      ],
      requestTimeoutMs: 30000,
      dailyCostCapUsd: 20,
    } as any,
  })

  console.log('AiSettings seeded with NaraRouter provider.')
  console.log('  Provider: NaraRouter (router.bynara.id/v1)')
  console.log('  Default model: deepseek-v4-flash')
  console.log('  Cost cap: $20/day')
  console.log('  API key: encrypted at rest')

  // Verify
  const raw = await payload.findGlobal({ slug: 'ai-settings', context: { internal: true } }) as any
  console.log(`\nVerification:`)
  console.log(`  Providers: ${raw.providers?.length}`)
  console.log(`  Provider 0 label: ${raw.providers?.[0]?.label}`)
  console.log(`  Provider 0 enabled: ${raw.providers?.[0]?.enabled}`)
  console.log(`  Default model: ${raw.defaultModel}`)
  console.log(`  API key (masked): ${raw.providers?.[0]?.apiKey?.slice(0, 10)}...`)

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
