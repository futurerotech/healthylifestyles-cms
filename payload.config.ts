import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
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
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./payload.db',
      authToken: process.env.DATABASE_TOKEN,
    },
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
