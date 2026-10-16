import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

const receipt = JSON.parse(await readFile('vendor/cloud-storage-provenance.json', 'utf8'));
const archive = await readFile(resolve('vendor', receipt.archive));
assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, receipt.archiveIntegrity, 'Patched archive changed without review');
const require = createRequire(import.meta.url);
const root = dirname(dirname(require.resolve('@payloadcms/plugin-cloud-storage')));
const installed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const payloadRoot = dirname(dirname(require.resolve('payload')));
assert.equal(installed.version, JSON.parse(await readFile(join(payloadRoot, 'package.json'), 'utf8')).version,
  'Payload requires exact version equality; never bypass its dependency checker');
const expected = structuredClone(receipt.upstreamManifest);
expected.version = receipt.localVersion;
expected._hlsPatch = receipt.patchID;
delete expected.dependencies['find-node-modules'];
delete expected.devDependencies['@types/find-node-modules'];
assert.deepEqual(installed, expected, 'Only the reviewed manifest removal and explicit patch identifier are allowed');
const files = {};
async function inspect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const file = join(folder, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Unexpected package symlink');
    if (entry.isDirectory()) await inspect(file);
    else {
      const name = relative(root, file).replaceAll('\\', '/');
      if (name !== 'package.json') files[name] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
}
await inspect(root);
assert.deepEqual(files, receipt.unchangedFiles, 'Installed storage code differs from the verified official package');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.ok(!Object.keys(lock.packages).some(p => /(?:^|\/)(?:braces|find-node-modules|findup-sync|micromatch)$/.test(p)), 'Removed vulnerable chain returned');
console.log(`Storage provenance verified: ${Object.keys(files).length} files identical to official ${receipt.upstream.version}; vulnerable chain absent.`);
