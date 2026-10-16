# Cloud storage dependency repair

`payloadcms-plugin-cloud-storage-3.91.0-hls.2.tgz` is a locally maintained,
metadata-only patch of the official MIT-licensed Payload 3.91.0 package.
All 120 non-manifest files (JavaScript, declarations, maps, documentation and
license) are byte-identical. Only the unused `find-node-modules`
dependency/development types are removed, and `_hlsPatch` identifies the repair.
The upstream version is retained because Payload enforces exact equality across
its packages; the local archive, integrity and patch identifier distinguish this
from the official artifact. The S3 adapter and AWS
SDK remain installed and functional.

The removed chain brings GHSA-vfj7-8cjw-p6xm into the production dependency
graph. No call to it was found in the installed plugin runtime. This is a
dependency removal, not a claim that the vulnerable braces implementation was
patched. The upstream removal proposal is
https://github.com/payloadcms/payload/pull/18645 (unmerged when reviewed).

`cloud-storage-provenance.json` pins the original registry archive integrity,
original manifest, every unchanged file hash and patched archive integrity.
`npm run security:vendor-storage` reproduces the archive from that pinned input;
`npm run security:verify-storage` rejects modified installed code or a returning
vulnerable chain. `npm run security:check` runs that verification and the normal
unfiltered npm audit. It remains a mandatory prebuild gate.

`src/lib/storage-s3.test.ts` exercises actual S3 SDK upload, read, ranges, cache
validation, deletion, responsive images and CDN URLs on a loopback-only store.
This does not prove production bucket credentials or permissions. Verify a
separate staging bucket before an approved release. Replace this local patch
with an official compatible release once upstream ships the removal; then
regenerate the lockfile and repeat all storage, access and build checks.
