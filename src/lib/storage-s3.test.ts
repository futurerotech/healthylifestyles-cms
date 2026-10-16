// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { S3 } from '@aws-sdk/client-s3';
import { s3Storage } from '@payloadcms/storage-s3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// These pinned implementation files are also checked byte-for-byte by security:verify-storage.
import { createS3Adapter } from '../../node_modules/@payloadcms/storage-s3/dist/adapter.js';
import { getAfterReadHook } from '../../node_modules/@payloadcms/plugin-cloud-storage/dist/hooks/afterRead.js';
import { Media } from '../collections/Media';

describe('real S3 SDK and storage adapter against an isolated loopback object store', () => {
  let server: Server;
  let client: S3;
  let endpoint: string;
  const objects = new Map<string, { buffer: Buffer; contentType: string; etag: string }>();
  const errors = vi.fn();
  const filenames: string[] = [];
  let adapter: ReturnType<ReturnType<typeof createS3Adapter>>;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const key = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname);
      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const buffer = Buffer.concat(chunks);
        const etag = `"${createHash('md5').update(buffer).digest('hex')}"`;
        objects.set(key, { buffer, contentType: String(req.headers['content-type']), etag });
        res.writeHead(200, { ETag: etag }).end();
        return;
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        res.writeHead(204).end();
        return;
      }
      const object = objects.get(key);
      if (!object) {
        res.writeHead(404, { 'Content-Type': 'application/xml' }).end('<Error><Code>NoSuchKey</Code></Error>');
        return;
      }
      const headers = { 'Content-Type': object.contentType, ETag: object.etag };
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ''));
      const buffer = range ? object.buffer.subarray(Number(range[1]), Number(range[2]) + 1) : object.buffer;
      res.writeHead(range ? 206 : 200, {
        ...headers, 'Content-Length': buffer.length,
        ...(range ? { 'Content-Range': `bytes ${range[1]}-${range[2]}/${object.buffer.length}` } : {}),
      });
      res.end(req.method === 'HEAD' ? undefined : buffer);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    client = new S3({
      endpoint, region: 'auto', forcePathStyle: true, maxAttempts: 1,
      credentials: { accessKeyId: 'loopback-test', secretAccessKey: 'loopback-test-only' },
    });
    adapter = createS3Adapter({
      bucket: 'test-media', config: { endpoint }, getStorageClient: () => client,
    })({ collection: Media as any, prefix: 'media' });
  });

  afterAll(async () => {
    client?.destroy();
    if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  });

  const serve = (filename: string, headers: Record<string, string> = {}) => adapter.staticHandler(
    { headers: new Headers(headers), payload: { logger: { error: errors } } } as any,
    { doc: { filename, prefix: 'media' }, headers: new Headers(), params: { filename } } as any,
  );

  it('uploads original plus every configured responsive image, then reads identical bytes', async () => {
    const original = await sharp({ create: { width: 1800, height: 1100, channels: 3, background: '#78aa44' } }).webp().toBuffer();
    const sizes = (Media.upload as any).imageSizes;
    const variants = [{ name: 'original', width: 1800, height: 1100 }, ...sizes];
    for (const size of variants) {
      const buffer = size.name === 'original' ? original : await sharp(original).resize(size.width, size.height).webp().toBuffer();
      const filename = `image-${size.name}.webp`;
      filenames.push(filename);
      await adapter.handleUpload({
        data: { filename }, storageFilePath: `media/${filename}`,
        file: { buffer, mimeType: 'image/webp', filename, filesize: buffer.length },
      } as any);
      expect(objects.get(`/test-media/media/${filename}`)?.buffer).toEqual(buffer);
      const response = await serve(filename);
      expect(response?.status).toBe(200);
      expect(response?.headers.get('content-type')).toBe('image/webp');
      const read = Buffer.from(await response!.arrayBuffer());
      expect(read).toEqual(buffer);
      expect((await sharp(read).metadata()).width).toBe(size.width);
      expect(await adapter.generateURL!({ filename, prefix: 'media' } as any)).toBe(`${endpoint}/test-media/media/${filename}`);
    }
    expect(filenames).toHaveLength(5);
    expect(errors).not.toHaveBeenCalled();
  });

  it('preserves range, conditional requests and missing-file responses', async () => {
    const filename = filenames[0];
    const object = objects.get(`/test-media/media/${filename}`)!;
    const range = await serve(filename, { range: 'bytes=0-15' });
    expect(range?.status).toBe(206);
    expect(Buffer.from(await range!.arrayBuffer())).toEqual(object.buffer.subarray(0, 16));
    expect((await serve(filename, { 'if-none-match': object.etag }))?.status).toBe(304);
    expect((await serve(filename, { range: 'bytes=99999999-' }))?.status).toBe(416);
    expect((await serve('absent.webp'))?.status).toBe(404);
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps custom CDN URLs for originals and responsive sizes, including existing object keys', async () => {
    for (const name of ['original', 'thumbnail', 'card', 'hero', 'og']) {
      const filename = `image-${name}.webp`;
      const hook = getAfterReadHook({
        adapter, collection: Media as any, disablePayloadAccessControl: true,
        size: name === 'original' ? undefined : { name } as any,
        generateFileURL: ({ filename, prefix }) => `https://images.example.invalid/${prefix}/${filename}`,
      });
      expect(await hook({
        data: { filename, prefix: 'media', _objectKey: 'existing-key', sizes: { [name]: { filename } } },
      } as any)).toBe(`https://images.example.invalid/media/existing-key/${filename}`);
    }
  });

  it('retains storage fields when S3 is disabled, avoiding environment-dependent schema changes', async () => {
    for (const enabled of [true, false]) {
      const config = await s3Storage({
        enabled, alwaysInsertFields: true, bucket: 'test-media',
        collections: { media: { prefix: 'media' } }, config: { endpoint, region: 'auto' },
      })({ collections: [{ ...Media, fields: [...Media.fields] }] } as any);
      const collection = config.collections!.find(c => c.slug === 'media')!;
      expect(collection.fields.some(f => 'name' in f && f.name === 'prefix')).toBe(true);
      expect(collection.fields.some(f => 'name' in f && f.name === '_objectKey')).toBe(true);
    }
  });

  it('deletes every stored variant through the actual adapter', async () => {
    for (const filename of filenames) await adapter.handleDelete({ storageFilePath: `media/${filename}` } as any);
    expect(objects.size).toBe(0);
    expect((await serve(filenames[0]))?.status).toBe(404);
  });
});
