/**
 * Staging mirror import CLI, for the isolated Hostinger QA runtime ONLY, after owner
 * authorization. Run with: npx payload run scripts/staging/import-bundle.ts -- <action>
 *
 *   --verify  <bundle.json>   read-only: compare the staging database with the bundle
 *   --import  <bundle.json>   import the sanitized public bundle (all 16 release articles required)
 *   --cleanup <import-uuid>   compensating cleanup of one committed import, by its journal
 *   --list                    journal status and counts (no content)
 *
 * The library refuses to run (before any database access) unless HLS_ISOLATED_STAGING=true,
 * HLS_STAGING_IMPORT_APPROVED=yes, the declared and the actually connected staging host
 * match, the journal key is set, and no indexing or deploy credential is present.
 * Output never contains record content, secrets or connection strings.
 */
import { readFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import config from '@payload-config';
import { parseStagingImportArgs, summarizeReport } from '../../src/lib/staging-import-cli';
import { importBundle, verifyImport, cleanupImport, listImportJournals, ImportCommittedError, RELEASE_ARTICLE_IDS } from '../../src/lib/staging-import';

const args = process.argv.slice(2).filter((a) => a !== '--');
let action;
try { action = parseStagingImportArgs(args); } catch (e) { console.error((e as Error).message); process.exit(2); }
const payload: any = await getPayload({ config });
try {
  if (action.action === 'list') console.log(JSON.stringify(await listImportJournals(payload)));
  else if (action.action === 'cleanup') console.log(JSON.stringify(await cleanupImport(payload, action.importId)));
  else {
    const bundle = JSON.parse(await readFile(action.bundlePath, 'utf8'));
    if (action.action === 'verify') {
      const problems = await verifyImport(payload, bundle);
      console.log(JSON.stringify({ verified: problems.length === 0, problems: problems.length }));
      if (problems.length) process.exitCode = 1;
    } else {
      console.log(JSON.stringify(summarizeReport(await importBundle(payload, bundle, { requiredArticleIds: RELEASE_ARTICLE_IDS }))));
    }
  }
} catch (e) {
  if (e instanceof ImportCommittedError) console.error(JSON.stringify({ committed: true, ...summarizeReport(e.report), recovery: 'run --cleanup with this importId' }));
  console.error(String((e as Error)?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '<connection>'));
  process.exitCode = 1;
} finally {
  process.exit(process.exitCode ?? 0);
}
