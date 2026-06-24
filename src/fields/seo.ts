import type { Field } from 'payload';

export const seoField: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO & Social Share',
  admin: { description: 'Search-engine and social-share metadata. Derived from content when left blank.' },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Title tag — ≤ 60 chars. Front-load your target keyword.',
            components: {
              Field: '@/components/admin/AiSeoField#AiTitleField',
            },
          },
        },
        {
          name: 'canonical',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Override the canonical URL (leave blank to auto-derive).',
          },
        },
      ],
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      admin: {
        description: 'Meta description — 150–155 chars. Include keyword + value proposition + CTA.',
        components: {
          Field: '@/components/admin/AiSeoField#AiDescriptionField',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'keywords',
          type: 'text',
          hasMany: true,
          admin: {
            width: '50%',
            description: 'Primary keyword(s) this page targets.',
            components: {
              Field: '@/components/admin/AiSeoField#AiKeywordsField',
            },
          },
        },
        {
          name: 'noIndex',
          type: 'checkbox',
          label: 'No-index (hide from search engines)',
          defaultValue: false,
          admin: { width: '50%', description: 'Check to add <meta name="robots" content="noindex">.' },
        },
      ],
    },
    { name: 'ogImage', type: 'upload', relationTo: 'media', admin: { description: 'Social share image (defaults to site fallback OG image).' } },
    { name: 'ogTitle', type: 'text', admin: { description: 'Override og:title (defaults to metaTitle or page title).' } },
    { name: 'ogDescription', type: 'textarea', admin: { description: 'Override og:description (defaults to metaDescription).' } },
    { name: 'twitterTitle', type: 'text', admin: { description: 'Override twitter:title (defaults to og:title).' } },
    { name: 'twitterDescription', type: 'text', admin: { description: 'Override twitter:description (defaults to og:description).' } },
    { name: 'twitterImage', type: 'upload', relationTo: 'media', admin: { description: 'Override twitter:image (defaults to og:image).' } },
    {
      name: 'serpPreview',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/SerpPreview#SerpPreview' } },
    },
    {
      name: 'socialPreview',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/SocialPreview#SocialPreview' } },
    },
    {
      name: 'ogPreview',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/OgPreview#OgPreview' } },
    },
  ],
};
