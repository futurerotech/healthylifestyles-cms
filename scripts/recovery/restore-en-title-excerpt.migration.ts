/**
 * Phase D — RESTORATION MIGRATION TEMPLATE (reviewed; NOT yet in the migration chain).
 *
 * ⚠ DO NOT copy into cms/src/migrations/ until it has passed the Phase-C dry run
 *   against a restored production-shaped snapshot (see runbook). It is kept out
 *   of the live chain so CI cannot auto-apply an untested data write.
 *
 * Purpose: restore ONLY missing English title/excerpt into `articles_locales`
 * from the reviewed, committed recovery artifact. Forward-only. Never reverts
 * localization, never creates articles, never overwrites a non-empty value.
 *
 * Verified schema (from generated migration 20260711_184910):
 *   articles_locales(title varchar, excerpt varchar, id serial pk,
 *                    _locale "_locales" NOT NULL, _parent_id int NOT NULL)
 *   UNIQUE INDEX (_locale,_parent_id)   -- supports ON CONFLICT
 *   articles.slug SURVIVES on the base table (only title/excerpt were dropped).
 *
 * Safety: advisory xact lock; TEMP staging (no schema change to protected
 * tables); INSERT ... ON CONFLICT DO NOTHING + UPDATE ... WHERE col IS NULL
 * (never overwrites real values/translations); all invariants enforced in-DB
 * with RAISE EXCEPTION so any failure rolls back the whole transaction.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ARTIFACT = resolve(process.cwd(), 'scripts/recovery/artifact/recovered-articles.json')
const MAX_RECORDS = 5000 // bounded (Rule 10)
const LOCK_KEY = 918_273_641 // fixed advisory key for this recovery

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const art = JSON.parse(readFileSync(ARTIFACT, 'utf-8'))
  const records: { slug: string; title: string; excerpt: string | null }[] = art.records ?? []
  if (!Array.isArray(records) || records.length === 0) throw new Error('recovery artifact empty/invalid — aborting')
  if (records.length > MAX_RECORDS) throw new Error(`artifact has ${records.length} rows (> ${MAX_RECORDS} cap) — aborting`)
  if (Array.isArray(art.conflicts) && art.conflicts.length) throw new Error(`artifact has unresolved conflicts: ${art.conflicts.join(', ')}`)

  // Serialize concurrent runs; released automatically on commit/rollback.
  await db.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_KEY})`)

  // Preflight: fail BEFORE any write if the verified schema/state differs.
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.articles_locales') IS NULL THEN
        RAISE EXCEPTION 'articles_locales missing — schema differs from verified'; END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='articles_locales' AND column_name='title') THEN
        RAISE EXCEPTION 'articles_locales.title missing — schema differs'; END IF;
      IF EXISTS (SELECT _parent_id,_locale FROM articles_locales
                 GROUP BY _parent_id,_locale HAVING count(*)>1) THEN
        RAISE EXCEPTION 'duplicate (_parent_id,_locale) rows exist — aborting'; END IF;
      IF EXISTS (SELECT 1 FROM articles_locales l LEFT JOIN articles a ON a.id=l._parent_id
                 WHERE a.id IS NULL) THEN
        RAISE EXCEPTION 'orphan articles_locales rows exist — aborting'; END IF;
    END $$;
  `)

  // Stage the artifact in a TEMP table (dropped at commit) — one parameterized
  // INSERT per row uses only the confirmed db.execute(sql`…`) parameter API.
  await db.execute(sql`CREATE TEMP TABLE _recover_incoming (slug text PRIMARY KEY, title text NOT NULL, excerpt text) ON COMMIT DROP`)
  for (const r of records) {
    if (!r.slug || !r.title) throw new Error(`record for slug="${r.slug}" missing title — aborting (never fabricate)`)
    await db.execute(sql`INSERT INTO _recover_incoming (slug,title,excerpt) VALUES (${r.slug},${r.title},${r.excerpt}) ON CONFLICT (slug) DO NOTHING`)
  }

  // Abort if any artifact slug maps to 0 or >1 base articles (ambiguous).
  await db.execute(sql`
    DO $$
    DECLARE bad text;
    BEGIN
      SELECT string_agg(i.slug, ', ') INTO bad FROM _recover_incoming i
      WHERE (SELECT count(*) FROM articles a WHERE a.slug=i.slug) <> 1;
      IF bad IS NOT NULL THEN RAISE EXCEPTION 'slugs not uniquely matched to a base article: %', bad; END IF;
    END $$;
  `)

  // 1) Insert a missing `en` mapping (idempotent via the verified unique index).
  await db.execute(sql`
    INSERT INTO articles_locales (_locale,_parent_id,title,excerpt)
    SELECT 'en', a.id, i.title, i.excerpt
    FROM _recover_incoming i JOIN articles a ON a.slug=i.slug
    ON CONFLICT ("_locale","_parent_id") DO NOTHING
  `)
  // 2) Fill title/excerpt ONLY where currently NULL — never overwrite real
  //    values or human translations (Rules 6,7). excerpt fill only when we have one.
  await db.execute(sql`
    UPDATE articles_locales l SET title=i.title
    FROM _recover_incoming i JOIN articles a ON a.slug=i.slug
    WHERE l._parent_id=a.id AND l._locale='en' AND l.title IS NULL
  `)
  await db.execute(sql`
    UPDATE articles_locales l SET excerpt=i.excerpt
    FROM _recover_incoming i JOIN articles a ON a.slug=i.slug
    WHERE l._parent_id=a.id AND l._locale='en' AND l.excerpt IS NULL AND i.excerpt IS NOT NULL
  `)

  // Post-write invariants — any failure RAISEs → full rollback.
  await db.execute(sql`
    DO $$
    BEGIN
      -- every incoming article now has exactly one en mapping
      IF EXISTS (
        SELECT 1 FROM _recover_incoming i JOIN articles a ON a.slug=i.slug
        WHERE (SELECT count(*) FROM articles_locales l WHERE l._parent_id=a.id AND l._locale='en') <> 1
      ) THEN RAISE EXCEPTION 'post: an incoming article lacks exactly one en mapping'; END IF;
      -- every incoming article now has a non-null en title
      IF EXISTS (
        SELECT 1 FROM _recover_incoming i JOIN articles a ON a.slug=i.slug
        JOIN articles_locales l ON l._parent_id=a.id AND l._locale='en'
        WHERE l.title IS NULL
      ) THEN RAISE EXCEPTION 'post: en title still NULL after restore'; END IF;
      -- no orphans introduced
      IF EXISTS (SELECT 1 FROM articles_locales l LEFT JOIN articles a ON a.id=l._parent_id WHERE a.id IS NULL)
        THEN RAISE EXCEPTION 'post: orphan locale row present'; END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Non-destructive by policy: this migration cannot distinguish rows it wrote
  // from pre-existing/edited content without mutating the protected schema, so
  // an automated down could delete real data. Fail loudly instead.
  throw new Error(
    'No automated down. To reverse, restore the pre-migration verified backup — ' +
      'deleting recovered locale rows risks removing legitimate content/translations.',
  )
}
