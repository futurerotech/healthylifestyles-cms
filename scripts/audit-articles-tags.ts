import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // ── 1. Fetch all articles ───────────────────────────────────────
  const articles = await payload.find({
    collection: 'articles',
    limit: 100,
    sort: 'id',
    depth: 1,  // populate relationships (reviewer, tags, category)
  })

  console.log(`=== ARTICLES AUDIT (${articles.totalDocs} total) ===\n`)

  // ── 2. Check each article for missing reviewer ──────────────────
  console.log('--- (a) Articles MISSING a medical reviewer ---\n')
  const missingReviewer: any[] = []
  const hasReviewer: any[] = []

  for (const doc of articles.docs) {
    const a = doc as any
    const reviewer = a.reviewer || a.reviewedBy
    if (!reviewer || (typeof reviewer === 'object' && !reviewer?.id)) {
      missingReviewer.push({
        id: a.id,
        title: a.title || '(untitled)',
        slug: a.slug,
        category: typeof a.category === 'object' ? a.category?.slug : a.category,
        status: a._status,
      })
    } else {
      const reviewerName = typeof reviewer === 'object' ? reviewer.name || reviewer.id : reviewer
      hasReviewer.push({
        id: a.id,
        title: a.title || '(untitled)',
        slug: a.slug,
        reviewer: reviewerName,
      })
    }
  }

  if (missingReviewer.length > 0) {
    console.log(`FOUND ${missingReviewer.length} articles WITHOUT a reviewer:\n`)
    console.log('ID  | Title                                              | Slug                              | Category       | Status')
    console.log('----|----------------------------------------------------|-----------------------------------|----------------|--------')
    for (const a of missingReviewer) {
      const title = (a.title || '').padEnd(50).slice(0, 50)
      const slug = (a.slug || '').padEnd(33).slice(0, 33)
      const cat = (a.category || '').padEnd(14).slice(0, 14)
      const status = a.status || ''
      console.log(`${String(a.id).padEnd(3)} | ${title} | ${slug} | ${cat} | ${status}`)
    }
  } else {
    console.log('All articles have a reviewer assigned.')
  }

  console.log(`\n${hasReviewer.length} articles HAVE a reviewer:`)
  for (const a of hasReviewer) {
    console.log(`  ID ${a.id}: ${a.title} -> reviewer: ${a.reviewer}`)
  }

  // ── 3. Fetch all tags ───────────────────────────────────────────
  console.log('\n\n=== TAGS AUDIT ===\n')
  const tags = await payload.find({
    collection: 'tags',
    limit: 100,
    sort: 'name',
    depth: 0,
  })

  console.log(`Total tags: ${tags.totalDocs}\n`)
  console.log('ID  | Name                                     | Slug                               | Article count')
  console.log('----|------------------------------------------|------------------------------------|-------------')

  const slugMap = new Map<string, any[]>()
  const nameMap = new Map<string, any[]>()

  for (const doc of tags.docs) {
    const t = doc as any
    const name = (t.name || '').padEnd(40).slice(0, 40)
    const slug = (t.slug || '').padEnd(34).slice(0, 34)
    console.log(`${String(t.id).padEnd(3)} | ${name} | ${slug} | (check articles)`)

    // Track duplicates by slug
    const slugKey = (t.slug || '').toLowerCase().trim()
    if (!slugMap.has(slugKey)) slugMap.set(slugKey, [])
    slugMap.get(slugKey)!.push(t)

    // Track near-duplicates by name (case-insensitive)
    const nameKey = (t.name || '').toLowerCase().trim()
    if (!nameMap.has(nameKey)) nameMap.set(nameKey, [])
    nameMap.get(nameKey)!.push(t)
  }

  // ── 4. Report duplicates ────────────────────────────────────────
  console.log('\n--- (b) Duplicate/near-duplicate Tags ---\n')

  let foundDupes = false

  // Check by slug
  console.log('By slug:')
  for (const [slug, tagList] of slugMap) {
    if (tagList.length > 1) {
      foundDupes = true
      console.log(`  DUPLICATE slug "${slug}":`)
      for (const t of tagList) {
        console.log(`    ID ${t.id}: name="${t.name}" slug="${t.slug}"`)
      }
    }
  }

  // Check by name (case-insensitive)
  console.log('\nBy name (case-insensitive):')
  for (const [name, tagList] of nameMap) {
    if (tagList.length > 1) {
      foundDupes = true
      console.log(`  DUPLICATE name "${name}":`)
      for (const t of tagList) {
        console.log(`    ID ${t.id}: name="${t.name}" slug="${t.slug}"`)
      }
    }
  }

  // Check for near-duplicate slugs (e.g. "hydration" vs "hydratation")
  console.log('\nNear-duplicate slugs (similar but not exact):')
  const slugList = [...slugMap.keys()].sort()
  for (let i = 0; i < slugList.length; i++) {
    for (let j = i + 1; j < slugList.length; j++) {
      const a = slugList[i]
      const b = slugList[j]
      // Check Levenshtein-like: if one contains the other or differ by 1-2 chars
      if (a !== b && (a.includes(b) || b.includes(a) || levenshtein(a, b) <= 2)) {
        const tagA = slugMap.get(a)!
        const tagB = slugMap.get(b)!
        foundDupes = true
        console.log(`  NEAR-DUPE: "${a}" (ID ${tagA[0].id}, name="${tagA[0].name}") ~ "${b}" (ID ${tagB[0].id}, name="${tagB[0].name}")`)
      }
    }
  }

  if (!foundDupes) {
    console.log('  No duplicates found.')
  }

  // ── 5. Fetch all authors (potential reviewers) ──────────────────
  console.log('\n\n=== AVAILABLE REVIEWERS (Authors) ===\n')
  const authors = await payload.find({
    collection: 'authors',
    limit: 50,
    sort: 'name',
    depth: 0,
  })
  for (const doc of authors.docs) {
    const a = doc as any
    console.log(`  ID ${a.id}: ${a.name} (slug: ${a.slug})${a.credential ? ' — ' + a.credential : ''}`)
  }

  await payload.destroy()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
    }
  }
  return dp[m][n]
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
