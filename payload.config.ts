import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import sharp from 'sharp';

import { Users } from './src/collections/Users';
import { Media } from './src/collections/Media';
import { Categories } from './src/collections/Categories';
import { Authors } from './src/collections/Authors';
import { Tools } from './src/collections/Tools';
import { Articles } from './src/collections/Articles';
import { Redirects } from './src/collections/Redirects';
import { ToolUsage } from './src/collections/ToolUsage';
import { Personas } from './src/collections/Personas';
import { Profiles } from './src/collections/Profiles';
import { Pages } from './src/collections/Pages';
import { IndexingStatus } from './src/collections/IndexingStatus';
import { PseoTemplates } from './src/collections/PseoTemplates';
import { PseoDatasets } from './src/collections/PseoDatasets';
import { PseoPages } from './src/collections/PseoPages';
import { Leads } from './src/collections/Leads';
import { Subscribers } from './src/collections/Subscribers';
import { PushSubscriptions } from './src/collections/PushSubscriptions';
import { PushHistory } from './src/collections/PushHistory';
import { Tags } from './src/collections/Tags';
import { Settings } from './src/globals/Settings';
import { Indexing } from './src/globals/Indexing';
import { SocialMedia } from './src/globals/SocialMedia';
import { AdManagement } from './src/globals/AdManagement';
import { LeadGen } from './src/globals/LeadGen';
import { Audience } from './src/globals/Audience';
import { aiAssist } from './src/endpoints/aiAssist';
import { trackUsage } from './src/endpoints/trackUsage';
import { aiWriting } from './src/endpoints/aiWriting';
import { aiSeo } from './src/endpoints/aiSeo';
import { pseoGenerate } from './src/endpoints/pseoGenerate';
import { profileIdentify, profileRecordUsage, profileGet } from './src/endpoints/profiles';
import { csvImport } from './src/endpoints/csvImport';
import { sendPush } from './src/endpoints/sendPush';
import { subscriberSync } from './src/endpoints/subscriberSync';
import { generateArticleEndpoint, regenerateSectionEndpoint, suggestTitlesEndpoint, verifySourcesEndpoint } from './src/endpoints/generateArticle';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Public site origin — the Astro frontend that consumes this CMS at build/runtime.
 * Used to scope CORS/CSRF for the public-facing REST + custom endpoints.
 * Defaults to the Astro dev server; override via NEXT_PUBLIC_SITE_URL in prod.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4321';
const ALLOWED_ORIGINS = [SITE_URL, 'http://localhost:4321', 'http://localhost:3000'].filter(
  (v, i, arr) => v && arr.indexOf(v) === i,
);

// Fail fast: signing sessions/JWTs with an empty secret is a silent security hole.
if (!process.env.PAYLOAD_SECRET) {
  throw new Error(
    'PAYLOAD_SECRET is not set. Define it in .env before starting the CMS ' +
      '(e.g. `openssl rand -hex 32`).',
  );
}

// Postgres connection string is mandatory — without it the CMS has no database.
if (!process.env.DATABASE_URI) {
  throw new Error(
    'DATABASE_URI is not set. Provide a PostgreSQL connection string ' +
      '(e.g. postgres://user:pass@host/db?sslmode=require).',
  );
}

/**
 * Persistent media storage. Hostinger wipes the app folder on every redeploy, so
 * locally-stored uploads vanish. When the S3/R2 env vars are present, uploads go
 * to the bucket instead and survive deploys. When S3_PUBLIC_URL is also set, media
 * docs get ABSOLUTE public URLs (served straight from the bucket / CDN) so the
 * static Astro site can load them directly. Without S3 env (local dev) it falls
 * back to the Media collection's local staticDir — nothing else changes.
 */
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
const s3Enabled = !!(
  process.env.S3_BUCKET &&
  process.env.S3_ENDPOINT &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY
);

const storagePlugins = s3Enabled
  ? [
      s3Storage({
        collections: {
          media: {
            prefix: 'media',
            // With a public base URL, serve files straight from the bucket (no
            // Payload proxy) so their `url` is absolute + public for the SSG site.
            ...(S3_PUBLIC_URL
              ? {
                  disablePayloadAccessControl: true as const,
                  generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
                    `${S3_PUBLIC_URL}/${prefix ? `${prefix}/` : ''}${filename}`,
                }
              : {}),
          },
        },
        bucket: process.env.S3_BUCKET as string,
        config: {
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION || 'auto',
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
          },
          // Required for Cloudflare R2 (and MinIO); harmless for AWS S3.
          forcePathStyle: true,
        },
      }),
    ]
  : [];

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — HealthyLifeStyles Admin',
      description: 'Manage tools, articles and settings for HealthyLifeStyles.',
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/admin-icon.svg' }],
      openGraph: {
        title: 'HealthyLifeStyles Admin',
        description: 'Manage tools, articles and settings for HealthyLifeStyles.',
        images: [{ url: '/admin-og.svg', width: 1200, height: 630 }],
      },
    },
    components: {
      graphics: {
        Logo: '@/components/admin/Logo#Logo',
        Icon: '@/components/admin/Icon#Icon',
      },
      Nav: '@/components/admin/Nav#Nav',
      beforeLogin: ['@/components/admin/BeforeLogin#BeforeLogin'],
      beforeDashboard: ['@/components/admin/Dashboard#Dashboard'],
    },
    // Suppress Payload's default collection/global "card" widgets so the only
    // dashboard content is our custom analytics Dashboard (beforeDashboard).
    dashboard: {
      widgets: [],
      defaultLayout: [],
    },
  },
  collections: [Users, Media, Categories, Tags, Authors, Tools, Articles, Pages, Redirects, ToolUsage, Personas, Profiles, IndexingStatus, PseoTemplates, PseoDatasets, PseoPages, Leads, Subscribers, PushSubscriptions, PushHistory],
  globals: [Settings, Indexing, SocialMedia, AdManagement, LeadGen, Audience],
  editor: lexicalEditor(),
  plugins: storagePlugins,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
      // Supabase presents a cert that isn't in Node's default trust store, and
      // recent pg treats sslmode=require as verify-full. Encrypt the connection
      // without CA verification (the documented Supabase + node-postgres setup).
      ssl: { rejectUnauthorized: false },
    },
    // Pin the migration folder so `payload migrate` finds it on deploy
    // regardless of the host's working directory.
    migrationDir: path.resolve(dirname, 'src/migrations'),
    // Schema is owned by committed migrations, applied manually via
    // `npm run migrate`. `push` (Payload's dev auto-schema-sync) is OFF
    // everywhere by default and only turns on when a developer explicitly sets
    // ALLOW_DB_PUSH=true — intended for a throwaway local dev database. This
    // universally protects the live Supabase schema from accidental
    // mutation/drops during local `npm run dev`.
    push: process.env.ALLOW_DB_PUSH === 'true',
  }),
  secret: process.env.PAYLOAD_SECRET,
  serverURL: process.env.SERVER_URL || SITE_URL,
  cors: ALLOWED_ORIGINS,
  csrf: ALLOWED_ORIGINS,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  sharp,
  endpoints: [aiAssist, trackUsage, aiWriting, aiSeo, pseoGenerate, profileIdentify, profileRecordUsage, profileGet, csvImport, sendPush, subscriberSync, generateArticleEndpoint, regenerateSectionEndpoint, suggestTitlesEndpoint, verifySourcesEndpoint],
});
