import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, readdir, rename } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';

// Exact published input, not an unreviewed branch or floating upstream release.
const upstream = {
  package: '@payloadcms/plugin-cloud-storage', version: '3.91.0',
  url: 'https://registry.npmjs.org/@payloadcms/plugin-cloud-storage/-/plugin-cloud-storage-3.91.0.tgz',
  integrity: 'sha512-VWA73ZUC31hFcB2H2Szgeveo+BLm6JW8YK6x1lTNgkEd+q6iApXSKPQcWBs87hI9TidoaxB+FtIsJ2kMPyaeBw==',
};
const hash = (algorithm, data) => createHash(algorithm).update(data).digest(algorithm === 'sha512' ? 'base64' : 'hex');
if (!process.env.npm_execpath) throw new Error('Run through npm run security:vendor-storage');
await mkdir('.security-work', { recursive: true });
const work = await mkdtemp(resolve('.security-work/storage-'));
const response = await fetch(upstream.url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Upstream archive HTTP ${response.status}`);
const source = Buffer.from(await response.arrayBuffer());
if (`sha512-${hash('sha512', source)}` !== upstream.integrity) throw new Error('Upstream integrity mismatch');
const archive = join(work, 'upstream.tgz');
await writeFile(archive, source);
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
if (entries.some(p => !p.startsWith('package/') || p.split('/').includes('..'))) throw new Error('Unsafe archive path');
execFileSync('tar', ['-xzf', archive, '-C', work]);
const directory = join(work, 'package');
const original = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
if (original.name !== upstream.package || original.version !== upstream.version || !original.dependencies['find-node-modules']) throw new Error('Unexpected upstream manifest');
const files = {};
async function inspect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected package symlink');
    if (entry.isDirectory()) await inspect(file);
    else {
      const name = relative(directory, file).replaceAll('\\', '/');
      if (name === 'package.json') continue;
      const bytes = await readFile(file);
      if (name.endsWith('.js') && /find-node-modules|findNodeModules/.test(bytes.toString())) throw new Error('Dependency is referenced by runtime code');
      files[name] = hash('sha256', bytes);
    }
  }
}
await inspect(directory);
const patched = structuredClone(original);
patched.version = '3.91.0+hls.1';
delete patched.dependencies['find-node-modules'];
delete patched.devDependencies['@types/find-node-modules'];
await writeFile(join(directory, 'package.json'), JSON.stringify(patched, null, 2) + '\n');
await mkdir('vendor', { recursive: true });
const packed = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', resolve('vendor')], { cwd: directory, encoding: 'utf8', windowsHide: true }));
const target = resolve('vendor/payloadcms-plugin-cloud-storage-3.91.0-hls.1.tgz');
await rename(resolve('vendor', packed[0].filename), target);
const receipt = {
  upstream, patch: 'Remove an unused dependency and its unused development types; no executable, declaration, source-map, license or documentation bytes changed.',
  localVersion: patched.version, upstreamManifest: original,
  upstreamProposal: 'https://github.com/payloadcms/payload/pull/18645',
  advisory: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  archive: 'payloadcms-plugin-cloud-storage-3.91.0-hls.1.tgz',
  archiveIntegrity: `sha512-${hash('sha512', await readFile(target))}`,
  unchangedFiles: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
};
await writeFile('vendor/cloud-storage-provenance.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(`Vendored metadata-only patch; ${Object.keys(files).length} upstream files unchanged. MIT license retained.`);
