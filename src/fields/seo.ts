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
          // P16-C: advisory guidance only (length is a display concern, not a
          // ranking rule). Blank-ish values are rejected; real values are never
          // truncated or rewritten.
          validate: (value: unknown) =>
            typeof value === 'string' && value.length > 0 && value.trim().length === 0
              ? 'Meta title is whitespace-only — clear it or write a real title.'
              : true,
          admin: {
            width: '50%',
            description: 'Title tag. Advisory ~30–60 chars (guidance, not a ranking rule). Front-load the topic.',
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
      validate: (value: unknown) =>
        typeof value === 'string' && value.length > 0 && value.trim().length === 0
          ? 'Meta description is whitespace-only — clear it or write a real description.'
          : true,
      admin: {
        description: 'Meta description. Advisory ~120–160 chars (guidance, not a ranking rule). Lead with the value proposition.',
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
