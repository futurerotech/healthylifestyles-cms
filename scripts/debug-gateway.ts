import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { decryptField } from '../src/lib/crypto'

async function main() {
  const payload = await getPayload({ config: configPromise })
  const raw = await payload.findGlobal({ slug: 'ai-settings', context: { internal: true } }) as any

  const p = raw.providers[0]
  const apiKey = decryptField(p.apiKey)
  const url = `${p.providerUrl.replace(/\/$/, '')}/chat/completions`
  const model = raw.defaultModel

  console.log('URL:', url)
  console.log('Model:', model)
  console.log('Key:', apiKey.slice(0, 12) + '...')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Respond only with valid JSON.' },
          { role: 'user', content: 'Write a 150 char meta description for a BMI calculator. Respond as {"metaDescription": "..."}' },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    })

    console.log('Status:', res.status)
    const data = await res.json()
    console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500))
  } catch (err) {
    console.log('Error:', (err as Error).name, (err as Error).message)
  }

  await payload.destroy()
}

main().catch(console.error)
