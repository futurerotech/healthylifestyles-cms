import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrations = resolve(process.cwd(), 'src/migrations')
const name = '20261008_190423_add_reset_password_requested_at'

describe('Payload auth schema migration', () => {
  it('registers the PostgreSQL column required by the users query', () => {
    const index = readFileSync(resolve(migrations, 'index.ts'), 'utf8')
    expect(index).toContain(`name: '${name}'`)

    const migration = readFileSync(resolve(migrations, `${name}.ts`), 'utf8')
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp\(3\) with time zone/)
  })
})
