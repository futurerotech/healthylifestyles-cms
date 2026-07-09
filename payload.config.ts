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
import { LinkProspects } from './src/collections/LinkProspects';
import { OutreachTemplates } from './src/collections/OutreachTemplates';
import { Backlinks } from './src/collections/Backlinks';
import { EmbedLogs } from './src/collections/EmbedLogs';
import { SiteAudits } from './src/collections/SiteAudits';
import { AuditLog } from './src/collections/AuditLog';
import { PromptRegistry } from './src/collections/PromptRegistry';
import { PendingDeploys } from './src/collections/PendingDeploys';
import { DeployLog } from './src/collections/DeployLog';
import { Settings } from './src/globals/Settings';
import { Indexing } from './src/globals/Indexing';
import { SocialMedia } from './src/globals/SocialMedia';
import { AdManagement } from './src/globals/AdManagement';
import { LeadGen } from './src/globals/LeadGen';
import { Audience } from './src/globals/Audience';
import { AiSettings } from './src/globals/AiSettings';
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
import { trackEmbed } from './src/endpoints/trackEmbed';
import { checkBacklinks } from './src/endpoints/checkBacklinks';
import { runAudit } from './src/endpoints/runAudit';
import { analyzeRecipe } from './src/endpoints/analyzeRecipe';
import { schemaFlagsCron } from './src/endpoints/schemaFlagsCron';
import { ALLOWED_ORIGINS, CMS_ORIGIN } from './src/lib/allowedOrigins';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const IS_PROD = process.env.NODE_ENV === 'production';
// Browser-origin whitelist + canonical domains live in ONE place —
// src/lib/allowedOrigins.ts — shared with the deploy and report routes.
// (NEXT_PUBLIC_SITE_URL stays the FRONTEND origin; see the util's docs.)

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

// The S3 plugin is ALWAYS instantiated so the DB schema (its `prefix` field) and
// the admin importMap are identical in every environment — they never differ
// based on whether the S3 env vars happen to be set, which is what caused the
// blank admin (missing importMap entry) and migration flip-flops. `enabled` only
// toggles whether uploads actually go to the bucket: on in prod, off in local dev
// (falls back to the Media collection's local staticDir). `alwaysInsertFields`
// keeps the `prefix` column present regardless of `enabled`.
const storagePlugins = [
  s3Storage({
    enabled: s3Enabled,
    alwaysInsertFields: true,
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
    bucket: process.env.S3_BUCKET || 'healthylifestyles-media',
    config: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      // Required for Cloudflare R2 (and MinIO); harmless for AWS S3.
      forcePathStyle: true,
    },
  }),
];

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
      afterNavLinks: ['@/components/admin/DeployButton#default'],
    },
    // Suppress Payload's default collection/global "card" widgets so the only
    // dashboard content is our custom analytics Dashboard (beforeDashboard).
    dashboard: {
      widgets: [],
      defaultLayout: [],
    },
  },
  collections: [Users, Media, Categories, Tags, Authors, Tools, Articles, Pages, Redirects, ToolUsage, Personas, Profiles, IndexingStatus, PseoTemplates, PseoDatasets, PseoPages, Leads, Subscribers, PushSubscriptions, PushHistory, LinkProspects, OutreachTemplates, Backlinks, EmbedLogs, SiteAudits, AuditLog, PromptRegistry, PendingDeploys, DeployLog],
  globals: [Settings, Indexing, SocialMedia, AdManagement, LeadGen, Audience, AiSettings],
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
  // The CMS's own public URL (cookie/CSRF anchor + absolute admin URLs) — NOT
  // the frontend. Env override first; in production default to the CMS domain.
  serverURL: process.env.SERVER_URL || (IS_PROD ? CMS_ORIGIN : 'http://localhost:3000'),
  cors: ALLOWED_ORIGINS,
  csrf: ALLOWED_ORIGINS,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  sharp,
  endpoints: [aiAssist, trackUsage, aiWriting, aiSeo, pseoGenerate, profileIdentify, profileRecordUsage, profileGet, csvImport, sendPush, subscriberSync, generateArticleEndpoint, regenerateSectionEndpoint, suggestTitlesEndpoint, verifySourcesEndpoint, trackEmbed, checkBacklinks, runAudit, analyzeRecipe, schemaFlagsCron],
  // Seed the four default outreach templates once (idempotent: only when the
  // collection is empty). Runs at server boot, never during `payload migrate`.
  onInit: async (payload) => {
    try {
      const { totalDocs } = await payload.count({ collection: 'outreach-templates' as never });
      if (totalDocs > 0) return;
      const templates = [
        {
          name: 'Guest post pitch',
          type: 'guest-post',
          subject: 'Guest post idea for {{siteName}}',
          body:
            'Hi {{contactName}},\n\n' +
            "I'm {{myName}} from HealthyLifeStyles — we build free, evidence-based health calculators.\n\n" +
            'I had an article idea your readers might genuinely use: a practical, non-preachy piece I could write for {{siteName}} (happy to share 2–3 title options). I write from the data our calculators produce, cite primary sources (CDC/WHO/NHS), and keep it educational — no medical claims.\n\n' +
            'If guest contributions are open, could you point me at your guidelines?\n\nThanks either way,\n{{myName}}',
          notes: 'Personalize with a line about a recent post of theirs BEFORE the pitch. Never send as-is.',
        },
        {
          name: '“We made a free calculator”',
          type: 'free-calculator',
          subject: 'A free {{toolName}} your readers can use',
          body:
            'Hi {{contactName}},\n\n' +
            'I noticed {{pageUrl}} covers this topic well. We built a free, no-signup {{toolName}} that might be a useful add-on for your readers: {{toolUrl}}\n\n' +
            "It's evidence-based (sources cited on the page), mobile-friendly, and embeddable — if you'd rather host it inside your article, the embed snippet is one copy-paste.\n\n" +
            'If it fits, a mention or embed would make my day. Happy to return the favor with a look at anything you want feedback on.\n\n{{myName}}',
          notes: 'Best template for a tools site — the tool does the persuading. Only send to genuinely relevant pages.',
        },
        {
          name: 'Broken-link outreach',
          type: 'broken-link',
          subject: 'Broken link on {{pageUrl}}',
          body:
            'Hi {{contactName}},\n\n' +
            'Quick heads-up: {{pageUrl}} links to a resource that now 404s (happy to send the exact anchor if useful).\n\n' +
            'If you want a drop-in replacement, we maintain a free {{toolName}} that covers the same ground: {{toolUrl}} — evidence-based and no signup.\n\n' +
            'Either way, hope the heads-up helps!\n\n{{myName}}',
          notes: 'Verify the broken link yourself first (curl/browser). The value = the heads-up; the link is the ask.',
        },
        {
          name: 'Data-study pitch',
          type: 'data-study',
          subject: 'New data: what {{toolName}} usage reveals',
          body:
            'Hi {{contactName}},\n\n' +
            'We aggregated anonymous usage from our {{toolName}} and found a pattern your audience might care about (happy to share the chart + methodology).\n\n' +
            "If you cover this, you're welcome to the data with attribution — full dataset, methodology, and a quotable summary here: {{toolUrl}}\n\n" +
            'Want the one-page summary?\n\n{{myName}}',
          notes: 'Only use with REAL aggregated data you can defend. Never invent statistics — that torches trust and rankings.',
        },
      ];
      for (const t of templates) {
        await payload.create({ collection: 'outreach-templates' as never, data: t as never });
      }
      payload.logger.info('Seeded 4 default outreach templates.');
    } catch (err) {
      payload.logger.warn('Outreach template seeding skipped: ' + ((err as Error)?.message || 'unknown'));
    }
  },
});
