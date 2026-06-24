import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access/roles';

const SOCIAL_PLATFORMS = [
  'Facebook', 'X (Twitter)', 'Instagram', 'YouTube', 'LinkedIn',
  'Pinterest', 'TikTok', 'Threads', 'Bluesky',
] as const;

export const SocialMedia: GlobalConfig = {
  slug: 'social-media',
  label: 'Social Media & Viral Preview',
  admin: { group: 'SEO' },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profiles',
          description: 'Official social media URLs for the brand. Used in footer, schema.org sameAs, and share buttons.',
          fields: [
            {
              name: 'profiles',
              type: 'array',
              labels: { singular: 'Profile', plural: 'Profiles' },
              minRows: 0,
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'platform',
                      type: 'select',
                      required: true,
                      admin: { width: '40%' },
                      options: SOCIAL_PLATFORMS.map((p) => ({ label: p, value: p })),
                    },
                    { name: 'url', type: 'text', required: true, admin: { width: '60%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Meta Tags',
          description: 'Global social-meta overrides applied to every page unless the document provides its own.',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'twitterSite', type: 'text', label: 'X/Twitter @username', admin: { width: '50%', description: 'twitter:site — e.g. @HealthyLifeStyl' } },
                { name: 'facebookAppId', type: 'text', label: 'Facebook App ID', admin: { width: '50%', description: 'fb:app_id' } },
              ],
            },
            { name: 'publisherUrl', type: 'text', label: 'Google Publisher URL', admin: { description: 'Google Search publisher link (sameAs).' } },
            { name: 'defaultShareText', type: 'text', label: 'Default share text', defaultValue: 'Check this out from HealthyLifeStyles: {title} {url}' },
          ],
        },
        {
          label: 'Defaults',
          fields: [
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media', admin: { description: 'Fallback OG image (1200×630px) when a document has none.' } },
            { name: 'defaultTwitterImage', type: 'upload', relationTo: 'media', admin: { description: 'Fallback X/Twitter card image (1200×600px) when a document has none.' } },
            {
              type: 'row',
              fields: [
                { name: 'twitterCardStyle', type: 'select', defaultValue: 'summary_large_image', options: [
                  { label: 'Summary card', value: 'summary' },
                  { label: 'Summary with large image', value: 'summary_large_image' },
                ], admin: { width: '50%' } },
                { name: 'ogLocale', type: 'text', defaultValue: 'en_US', admin: { width: '50%', description: 'og:locale' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};
