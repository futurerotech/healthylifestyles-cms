import type { Block } from 'payload';

export const TwoColumnBlock: Block = {
  slug: 'twoColumn',
  labels: { singular: 'Two-Column Layout', plural: 'Two-Column Layouts' },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: { width: '50%', description: 'Image (left column).' },
        },
        {
          name: 'imageSide',
          type: 'select',
          defaultValue: 'left',
          admin: { width: '50%' },
          options: [
            { label: 'Image on left', value: 'left' },
            { label: 'Image on right', value: 'right' },
          ],
        },
      ],
    },
    { name: 'heading', type: 'text' },
    { name: 'text', type: 'textarea', required: true, admin: { description: 'Body text for the text column.' } },
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
