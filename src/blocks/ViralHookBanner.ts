import type { Block } from 'payload';

export const ViralHookBannerBlock: Block = {
  slug: 'viralHookBanner',
  labels: { singular: 'Viral Hook Banner', plural: 'Viral Hook Banners' },
  fields: [
    { name: 'hook', type: 'text', required: true, admin: { description: 'The bold hook line (e.g. "Did you know?").' } },
    { name: 'subtext', type: 'textarea', admin: { description: 'Supporting sentence beneath the hook.' } },
    {
      type: 'row',
      fields: [
        {
          name: 'bgColor',
          type: 'text',
          defaultValue: '#f0fdf4',
          admin: { width: '50%', description: 'Background hex color.' },
        },
        {
          name: 'textColor',
          type: 'text',
          defaultValue: '#166534',
          admin: { width: '50%', description: 'Text hex color.' },
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'url', type: 'text' },
      ],
    },
  ],
};
