/**
 * Cleanup duplicated Authors in the Payload CMS database.
 *
 * Detected state:  20 authors (10 copies each of 2 unique authors).
 * Desired state:    2 authors (1 Editorial Team + 1 Medical Review Board).
 *
 * All articles referencing duplicate author IDs are remapped to the master
 * IDs before deletion. All related version/rels tables are also cleaned.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                         */
/* ------------------------------------------------------------------ */
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env'), 'utf-8');
const uri = env.match(/^DATABASE_URI=(.+)$/m)[1].trim();
const db = createClient({ url: uri });

/* ------------------------------------------------------------------ */
/*  1.  Identify duplicate authors & master IDs                       */
/* ------------------------------------------------------------------ */
console.log('\n═══ Author Cleanup ═══\n');

const all = await db.execute('SELECT id, name, slug FROM authors ORDER BY id');
console.log(`Found ${all.rows.length} authors in database.\n`);

for (const r of all.rows) {
  console.log(`  id=${String(r.id).padEnd(3)}  ${r.name}`);
}

/* Master instances = lowest id for each unique slug. */
const bySlug = new Map();
for (const r of all.rows) {
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
  bySlug.get(r.slug).push(r.id);
}

const masterIds = new Set();       // IDs we keep
const deleteIds = [];              // IDs we delete

for (const [slug, ids] of bySlug) {
  ids.sort((a, b) => a - b);
  masterIds.add(ids[0]);
  for (let i = 1; i < ids.length; i++) deleteIds.push(ids[i]);
}

console.log(`\nKeeping masters:   ${[...masterIds].join(', ')}`);
console.log(`Deleting orphans:  ${deleteIds.join(', ')}\n`);

/* ------------------------------------------------------------------ */
/*  2.  Remap every table that has an FK pointing at an author        */
/* ------------------------------------------------------------------ */

/* — 2a. articles.author_id                                           */
const artBefore = await db.execute(
  'SELECT COUNT(*) as cnt FROM articles WHERE author_id IN (' + deleteIds.join(',') + ')'
);
if (artBefore.rows[0].cnt > 0) {
  console.log(`Remapping ${artBefore.rows[0].cnt} articles from deleted author → master (id=1)`);
  await db.execute('UPDATE articles SET author_id = 1 WHERE author_id IN (' + deleteIds.join(',') + ')');
} else {
  console.log('No articles reference duplicate authors.');
}

/* — 2b. articles.reviewer_id                                        */
const revBefore = await db.execute(
  'SELECT COUNT(*) as cnt FROM articles WHERE reviewer_id IN (' + deleteIds.join(',') + ')'
);
if (revBefore.rows[0].cnt > 0) {
  console.log(`Remapping ${revBefore.rows[0].cnt} article reviewers → master (id=2)`);
  await db.execute('UPDATE articles SET reviewer_id = 2 WHERE reviewer_id IN (' + deleteIds.join(',') + ')');
} else {
  console.log('No article reviewers reference duplicate authors.');
}

/* — 2c.  Scan every *_rels table for an `authors_id` column         */
const relsTables = (await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%\\_%\\_rels'"
)).rows;
for (const t of relsTables) {
  const cols = (await db.execute('PRAGMA table_info("' + t.name + '")')).rows;
  const authorCol = cols.find(c => c.name === 'authors_id');
  if (!authorCol) continue;
  const relCount = await db.execute(
    'SELECT COUNT(*) as cnt FROM "' + t.name + '" WHERE authors_id IN (' + deleteIds.join(',') + ')'
  );
  if (relCount.rows[0].cnt > 0) {
    console.log(`${t.name}: remapping ${relCount.rows[0].cnt} rows → master`);
    await db.execute(
      'UPDATE "' + t.name + '" SET authors_id = 1 WHERE authors_id IN (' + deleteIds.join(',') + ')'
    );
  }
}

/* — 2d.  Scan every *_v (version) table for author FK columns       */
const vTables = (await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '\\_%\\_v'"
)).rows;
for (const t of vTables) {
  const cols = (await db.execute('PRAGMA table_info("' + t.name + '")')).rows;
  for (const col of cols) {
    if (!col.name.includes('author')) continue;
    const vCount = await db.execute(
      'SELECT COUNT(*) as cnt FROM "' + t.name + '" WHERE "' + col.name + '" IN (' + deleteIds.join(',') + ')'
    );
    if (vCount.rows[0].cnt > 0) {
      const master = col.name.includes('reviewer') ? 2 : 1;
      console.log(`${t.name}.${col.name}: remapping ${vCount.rows[0].cnt} rows → master (id=${master})`);
      await db.execute(
        'UPDATE "' + t.name + '" SET "' + col.name + '" = ' + master +
        ' WHERE "' + col.name + '" IN (' + deleteIds.join(',') + ')'
      );
    }
  }
}

/* — 2e.  Scan any other table with a column containing 'author'     */
const allTables = (await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
)).rows;
for (const t of allTables) {
  if (t.name.startsWith('_') || t.name.includes('_rels')) continue;  // already handled above
  const cols = (await db.execute('PRAGMA table_info("' + t.name + '")')).rows;
  for (const col of cols) {
    if (!col.name.includes('author')) continue;
    // These are in the main data tables (articles already handled above)
    if (t.name === 'articles' && (col.name === 'author_id' || col.name === 'reviewer_id')) continue;
    const count = await db.execute(
      'SELECT COUNT(*) as cnt FROM "' + t.name + '" WHERE "' + col.name + '" IN (' + deleteIds.join(',') + ')'
    );
    if (count.rows[0].cnt > 0) {
      const master = col.name.includes('reviewer') ? 2 : 1;
      console.log(`${t.name}.${col.name}: remapping ${count.rows[0].cnt} rows → master (id=${master})`);
      await db.execute(
        'UPDATE "' + t.name + '" SET "' + col.name + '" = ' + master +
        ' WHERE "' + col.name + '" IN (' + deleteIds.join(',') + ')'
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  3.  Delete duplicate authors                                      */
/* ------------------------------------------------------------------ */
console.log(`\nDeleting ${deleteIds.length} duplicate authors...`);
const del = await db.execute('DELETE FROM authors WHERE id IN (' + deleteIds.join(',') + ')');
console.log(`Deleted ${del.rowsAffected} rows.`);

/* Also clean up any orphaned _v rows for the deleted authors. */
for (const t of vTables) {
  const cols = (await db.execute('PRAGMA table_info("' + t.name + '")')).rows;
  for (const col of cols) {
    if (!col.name.includes('author')) continue;
    const orphaned = await db.execute(
      'SELECT COUNT(*) as cnt FROM "' + t.name + '" WHERE "' + col.name + '" NOT IN (SELECT id FROM authors)'
    );
    if (orphaned.rows[0].cnt > 0) {
      console.log(`Cleaning ${orphaned.rows[0].cnt} orphaned rows from ${t.name}.${col.name}`);
      await db.execute(
        'DELETE FROM "' + t.name + '" WHERE "' + col.name + '" NOT IN (SELECT id FROM authors)'
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  4.  Final verification                                            */
/* ------------------------------------------------------------------ */
console.log('\n═══ Verification ═══\n');
const final = await db.execute('SELECT id, name, slug FROM authors ORDER BY id');
console.log(`Authors remaining: ${final.rows.length}`);
for (const r of final.rows) {
  console.log(`  id=${r.id}  ${r.name}`);
}

// Confirm no articles point to non-existent authors
const orphaned = await db.execute(
  'SELECT COUNT(*) as cnt FROM articles WHERE author_id NOT IN (SELECT id FROM authors)'
);
if (orphaned.rows[0].cnt > 0) {
  console.log(`\n⚠ WARNING: ${orphaned.rows[0].cnt} articles reference non-existent authors!`);
} else {
  console.log('\nAll article author references are valid.');
}

await db.close();
