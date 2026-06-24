import type { GlobalConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const Settings: GlobalConfig = {
  slug: 'settings',
  admin: { group: 'Settings' },
  access: { read: publicRead, update: isAdmin },
  versions: { max: 20 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Brand',
          fields: [
            { name: 'siteTitle', type: 'text', required: true, defaultValue: 'HealthyLifeStyles' },
            { name: 'tagline', type: 'text', defaultValue: 'Trusted Wellness' },
            { name: 'description', type: 'textarea' },
            { name: 'logo', type: 'upload', relationTo: 'media', admin: { description: 'Site logo (SVG preferred).' } },
            { name: 'favicon', type: 'upload', relationTo: 'media', admin: { description: 'Favicon — 32×32 PNG or ICO.' } },
            {
              type: 'row',
              fields: [
                { name: 'primaryColor', type: 'text', defaultValue: '#22c55e', admin: { width: '50%', description: 'Brand primary (e.g. button backgrounds).' } },
                { name: 'secondaryColor', type: 'text', defaultValue: '#3b82f6', admin: { width: '50%', description: 'Brand secondary (e.g. accent links).' } },
              ],
            },
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media', admin: { description: 'Fallback OG image for social shares.' } },
          ],
        },
        {
          label: 'Navigation',
          fields: [
            {
              name: 'nav', type: 'array', labels: { singular: 'Nav item', plural: 'Nav items' },
              admin: { description: 'Drag to reorder. Appears in the header.' },
              fields: [
                { type: 'row', fields: [
                  { name: 'label', type: 'text', required: true, admin: { width: '50%' } },
                  { name: 'href', type: 'text', required: true, admin: { width: '50%' } },
                ] },
              ],
            },
          ],
        },
        {
          label: 'Footer',
          fields: [
            { name: 'copyrightText', type: 'text', defaultValue: '© 2026 HealthyLifeStyles. All rights reserved.' },
            {
              name: 'footerLinks', type: 'array', labels: { singular: 'Footer link', plural: 'Footer links' },
              fields: [
                { type: 'row', fields: [
                  { name: 'label', type: 'text', required: true, admin: { width: '50%' } },
                  { name: 'href', type: 'text', required: true, admin: { width: '50%' } },
                ] },
              ],
            },
            {
              name: 'social', type: 'array', labels: { singular: 'Social link', plural: 'Social links' },
              fields: [
                { type: 'row', fields: [
                  { name: 'platform', type: 'select', options: ['Facebook', 'X (Twitter)', 'Instagram', 'YouTube', 'LinkedIn', 'Pinterest', 'TikTok', 'Threads', 'Bluesky'], admin: { width: '50%' } },
                  { name: 'url', type: 'text', required: true, admin: { width: '50%' } },
                ] },
              ],
            },
          ],
        },
        {
          label: 'Integrations & Legal',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'ga4Id', type: 'text', admin: { width: '50%', description: 'e.g. G-XXXXXXXXXX' } },
                { name: 'searchConsoleId', type: 'text', admin: { width: '50%', description: 'Verification token.' } },
              ],
            },
            { name: 'adsEnabled', type: 'checkbox', defaultValue: false, admin: { description: 'Master toggle for ad slots.' } },
            { name: 'adsenseClient', type: 'text', admin: { condition: (d) => d?.adsEnabled, description: 'ca-pub-…' } },
            { name: 'affiliateDisclosure', type: 'textarea', defaultValue: 'As an affiliate we may earn from qualifying purchases — at no extra cost to you.' },
            { name: 'cookieConsentText', type: 'textarea' },
          ],
        },
      ],
    },
  ],
};
