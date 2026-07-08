/**
 * GSC Preflight Diagnostic (§2).
 *
 * Verifies that:
 * 1. The service account can authenticate.
 * 2. GSC_SITE_URL appears in the verified sites list with owner/full-user permission.
 * 3. A smoke-test URL inspection returns a real verdict (not a permission error).
 *
 * Usage: npx tsx --env-file=.env scripts/seo/gsc-preflight.ts
 */
import { getGoogleAuth } from '../../src/lib/google-auth'
import { SITE_BASE_URL, GSC_SITE_URL, absoluteUrl } from '../../src/lib/site-config'

async function main() {
  console.log('=== GSC Preflight Diagnostic ===\n')
  console.log(`SITE_BASE_URL: ${SITE_BASE_URL}`)
  console.log(`GSC_SITE_URL:  ${GSC_SITE_URL}`)
  console.log()

  // 1. Auth
  console.log('--- Step 1: Authentication ---')
  let auth
  try {
    auth = await getGoogleAuth()
    console.log('✅ Service account authenticated.')
  } catch (err) {
    console.log(`❌ Authentication failed: ${(err as Error).message}`)
    process.exit(1)
  }

  // 2. List verified sites
  console.log('\n--- Step 2: Verified Sites ---')
  const { google } = await import('googleapis')
  const searchconsole = google.searchconsole({ version: 'v1', auth })

  let siteList: any[] = []
  try {
    const res = await searchconsole.sites.list()
    siteList = res.data.siteEntry || []
    console.log(`Found ${siteList.length} verified properties.`)
    for (const site of siteList) {
      console.log(`  - ${site.siteUrl} [${site.permissionLevel}]`)
    }
  } catch (err) {
    console.log(`❌ Failed to list sites: ${(err as Error).message}`)
    process.exit(1)
  }

  // 3. Check our property
  console.log('\n--- Step 3: Property Match ---')
  const match = siteList.find((s) => s.siteUrl === GSC_SITE_URL)
  if (!match) {
    console.log(`❌ GSC_SITE_URL "${GSC_SITE_URL}" not found in verified properties.`)
    console.log(`   Action: Add the service-account email as Owner/Full user at`)
    console.log(`   Search Console → Settings → Users and permissions for property ${GSC_SITE_URL}`)
    process.exit(1)
  }

  console.log(`✅ Property found: ${match.siteUrl} [${match.permissionLevel}]`)

  if (match.permissionLevel !== 'siteOwner' && match.permissionLevel !== 'siteFullUser') {
    console.log(`❌ Permission level is "${match.permissionLevel}" — need siteOwner or siteFullUser.`)
    process.exit(1)
  }
  console.log(`✅ Permission level OK: ${match.permissionLevel}`)

  // 4. Smoke test — inspect ONE URL
  console.log('\n--- Step 4: URL Inspection Smoke Test ---')
  const smokeUrl = absoluteUrl('/wellness-hub/how-much-water-should-you-drink-a-day')
  console.log(`Inspecting: ${smokeUrl}`)

  try {
    const res = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: smokeUrl,
        siteUrl: GSC_SITE_URL,
        languageCode: 'en-US',
      },
    })

    const result = res.data.inspectionResult
    if (!result) {
      console.log('❌ No inspection result returned (possibly "Unknown / not part of this property").')
      process.exit(1)
    }

    const indexStatus = result.indexStatusResult
    console.log(`✅ Verdict: ${indexStatus?.verdict || 'unknown'}`)
    console.log(`   Coverage: ${indexStatus?.coverageState || 'n/a'}`)
    console.log(`   Last crawled: ${indexStatus?.lastCrawledTime || 'n/a'}`)
    console.log(`   Google canonical: ${indexStatus?.googleCanonical || 'n/a'}`)
    console.log(`   Declared canonical: ${indexStatus?.userCanonical || 'n/a'}`)

    if (indexStatus?.verdict === 'VERDICT_UNSPECIFIED' || !indexStatus?.coverageState) {
      console.log('\n⚠️  Verdict is empty — URL may not be indexed yet or property mismatch.')
    } else {
      console.log('\n✅ Smoke test PASSED — real verdict returned.')
    }
  } catch (err: any) {
    console.log(`❌ Inspection failed: ${err.message}`)
    if (err.code === 403) {
      console.log('   This is a permission error — verify the service account has access.')
    }
    process.exit(1)
  }

  console.log('\n=== Preflight PASSED ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Preflight failed:', err.message)
  process.exit(1)
})
