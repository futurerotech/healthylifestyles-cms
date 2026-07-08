import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { encryptField } from '../src/lib/crypto'

async function main() {
  const payload = await getPayload({ config: configPromise })

  const naraKey = process.env.NARAROUTER_API_KEY || ''
  const deepseekKey = process.env.DEEPSEEK_API_KEY || ''

  const providers: any[] = []

  if (deepseekKey) {
    providers.push({
      label: 'DeepSeek Direct',
      providerUrl: 'https://api.deepseek.com/v1',
      apiKey: encryptField(deepseekKey),
      enabled: true,
    })
  }

  if (naraKey) {
    providers.push({
      label: 'NaraRouter',
      providerUrl: 'https://router.bynara.id/v1',
      apiKey: encryptField(naraKey),
      enabled: true,
    })
  }

  if (providers.length === 0) {
    console.log('No AI keys found in env.')
    process.exit(1)
  }

  await payload.updateGlobal({
    slug: 'ai-settings',
    data: {
      providers,
      defaultModel: 'deepseek-chat',
      taskModelMap: [
        { taskType: 'meta_trim', model: 'deepseek-chat', maxTokens: 1024, temperature: 0.3 },
      ],
      requestTimeoutMs: 30000,
      dailyCostCapUsd: 20,
    } as any,
  })

  console.log(`AiSettings updated with ${providers.length} providers:`)
  for (const p of providers) {
    console.log(`  - ${p.label} (${p.providerUrl})`)
  }
  console.log(`  Default model: deepseek-chat`)

  await payload.destroy()
}

main().catch(console.error)
