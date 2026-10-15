import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = '20261008_225200_add_media_object_key'
const migrations = resolve(process.cwd(), 'src/migrations')

describe('S3 media schema migration', () => {
  it('registers the nullable object key expected by Payload media queries', () => {
    const index = readFileSync(resolve(migrations, 'index.ts'), 'utf8')
    expect(index).toContain(`name: '${migrationName}'`)

    const migration = readFileSync(resolve(migrations, `${migrationName}.ts`), 'utf8')
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "_objectkey" varchar/)
  })
})
