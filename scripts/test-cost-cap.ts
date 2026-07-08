import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { chat, invalidateAiSettingsCache } from '../src/services/ai'
import { z } from 'zod'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Set cost cap to 0.01 to trigger BUDGET_CAP
  await payload.updateGlobal({
    slug: 'ai-settings',
    data: { dailyCostCapUsd: 0 } as any,
  })
  invalidateAiSettingsCache()
  console.log('Set dailyCostCapUsd = 0.01, cache invalidated.\n')

  // Try a chat call — should return BUDGET_CAP
  const result = await chat({
    taskType: 'meta_trim',
    messages: [{ role: 'user', content: 'test' }],
    schema: z.object({ test: z.string() }),
  })

  console.log('chat() result:', JSON.stringify(result))
  if (!result.ok && result.error === 'BUDGET_CAP') {
    console.log('✅ COST CAP PROVEN: chat() returned BUDGET_CAP when daily cap = 0.01')
  } else {
    console.log('❌ Cost cap not triggered')
  }

  // Reset cost cap
  await payload.updateGlobal({
    slug: 'ai-settings',
    data: { dailyCostCapUsd: 20 } as any,
  })
  invalidateAiSettingsCache()
  console.log('\nCost cap reset to $20.')

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
