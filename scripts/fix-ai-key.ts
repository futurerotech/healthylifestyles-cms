import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { encryptField, decryptField } from '../src/lib/crypto'

async function main() {
  const payload = await getPayload({ config: configPromise })
  const raw = await payload.findGlobal({ slug: 'ai-settings', context: { internal: true } }) as any

  const p = raw.providers[0]
  console.log('Raw apiKey from DB:', p.apiKey?.slice(0, 30) + '...')
  console.log('Starts with enc:?', p.apiKey?.startsWith('enc:'))

  // Try to decrypt
  const decrypted = decryptField(p.apiKey || '')
  console.log('Decrypted:', decrypted.slice(0, 15) + '...')

  // If the stored value is ••••, we need to re-encrypt the real key
  if (decrypted === '••••' || !decrypted.startsWith('sk-')) {
    console.log('\nKey is masked — need to re-store with encryption.')
    console.log('Reading NARAROUTER_API_KEY from env...')
    const realKey = process.env.NARAROUTER_API_KEY
    if (!realKey) {
      console.log('NARAROUTER_API_KEY not set in env!')
      process.exit(1)
    }
    const encrypted = encryptField(realKey)
    console.log('Encrypted key:', encrypted.slice(0, 20) + '...')

    // Re-store
    await payload.updateGlobal({
      slug: 'ai-settings',
      data: {
        providers: [{
          label: p.label,
          providerUrl: p.providerUrl,
          apiKey: encrypted,
          enabled: true,
        }],
      } as any,
    })
    console.log('Re-stored with proper encryption.')

    // Verify
    const raw2 = await payload.findGlobal({ slug: 'ai-settings', context: { internal: true } }) as any
    const decrypted2 = decryptField(raw2.providers[0].apiKey)
    console.log('Verify decrypted:', decrypted2.slice(0, 12) + '...')
  }

  await payload.destroy()
}

main().catch(console.error)
