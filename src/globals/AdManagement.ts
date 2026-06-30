import type { GlobalConfig } from 'payload';
import { isAdminOrEditor } from '../access/roles';
import { triggerVercelDeploy } from '../hooks/triggerVercelDeploy';

export const AdManagement: GlobalConfig = {
  slug: 'ad-management',
  label: 'Ad Management',
  admin: { group: 'Settings' },
  access: { read: () => true, update: isAdminOrEditor },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'AdSense',
          fields: [
            {
              name: 'adsenseEnabled', type: 'checkbox', defaultValue: false,
              admin: { description: 'Master toggle for AdSense. Disable to show only placeholders.' },
            },
            {
              name: 'adsenseClient', type: 'text',
              admin: { description: 'e.g. ca-pub-1234567890123456', condition: (d) => d?.adsenseEnabled },
            },
            {
              name: 'lazyLoad', type: 'checkbox', defaultValue: true,
              admin: { description: 'Load ads via IntersectionObserver (250px viewport margin). Prevents layout shift.' },
            },
            {
              name: 'partytownEnabled', type: 'checkbox', defaultValue: true,
              label: 'Offload to Partytown web worker',
              admin: { description: 'Run AdSense/Analytics scripts in a web worker so they never block the main thread.' },
            },
          ],
        },
        {
          label: 'Ad Slots',
          description: 'Configure each ad placement on the site.',
          fields: [
            {
              name: 'slots',
              type: 'array',
              labels: { singular: 'Ad Slot', plural: 'Ad Slots' },
              minRows: 4,
              maxRows: 10,
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'placement',
                      type: 'select',
                      required: true,
                      admin: { width: '30%' },
                      options: [
                        { label: 'Header Banner', value: 'header' },
                        { label: 'Sidebar', value: 'sidebar' },
                        { label: 'In-Content (after paragraph 3)', value: 'inContent' },
                        { label: 'Sticky Mobile Footer', value: 'stickyFooter' },
                        { label: 'After Result', value: 'afterResult' },
                        { label: 'Mid Content', value: 'midContent' },
                      ],
                    },
                    {
                      name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '10%' },
                    },
                    {
                      name: 'format', type: 'select', defaultValue: 'auto', admin: { width: '20%' },
                      options: [
                        { label: 'Auto (responsive)', value: 'auto' },
                        { label: 'Rectangle (300×250)', value: 'rectangle' },
                        { label: 'Leaderboard (728×90)', value: 'leaderboard' },
                        { label: 'Sidebar (300×600)', value: 'sidebar' },
                        { label: 'Mobile Banner (320×100)', value: 'mobileBanner' },
                      ],
                    },
                    {
                      name: 'label', type: 'text', admin: { width: '40%', description: 'Optional admin label.' },
                    },
                  ],
                },
                {
                  name: 'adsenseSlotId', type: 'text',
                  admin: { description: 'AdSense data-ad-slot. Only used when AdSense is enabled.' },
                },
                {
                  name: 'customCode', type: 'textarea',
                  admin: {
                    description: 'Custom ad code (HTML/JS). Used instead of AdSense when provided.',
                  },
                },
                {
                  name: 'affiliateBanner',
                  type: 'group',
                  label: 'Affiliate Banner Override',
                  admin: { description: 'If set, an affiliate banner replaces AdSense for this slot.' },
                  fields: [
                    { name: 'image', type: 'upload', relationTo: 'media' },
                    { name: 'alt', type: 'text' },
                    { name: 'url', type: 'text' },
                    { name: 'width', type: 'number' },
                    { name: 'height', type: 'number' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Affiliate Banners',
          fields: [
            {
              name: 'affiliates',
              type: 'array',
              labels: { singular: 'Affiliate Banner', plural: 'Affiliate Banners' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
                    { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '10%' } },
                    { name: 'url', type: 'text', required: true, admin: { width: '50%' } },
                  ],
                },
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'alt', type: 'text' },
                {
                  type: 'row',
                  fields: [
                    { name: 'width', type: 'number', admin: { width: '50%' } },
                    { name: 'height', type: 'number', admin: { width: '50%' } },
                  ],
                },
                {
                  name: 'targetSlots', type: 'select', hasMany: true,
                  admin: { description: 'Which slots this banner can appear in (leave empty for all).' },
                  options: [
                    { label: 'Header', value: 'header' },
                    { label: 'Sidebar', value: 'sidebar' },
                    { label: 'In-Content', value: 'inContent' },
                    { label: 'Sticky Footer', value: 'stickyFooter' },
                    { label: 'After Result', value: 'afterResult' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: { afterChange: [triggerVercelDeploy] },
};
