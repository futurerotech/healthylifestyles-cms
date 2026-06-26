import type { Block } from 'payload';

export const TextBlock: Block = {
  slug: 'text',
  labels: { singular: 'Text', plural: 'Text Blocks' },
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'p',
      options: [
        { label: 'Paragraph', value: 'p' },
        { label: 'Heading 2', value: 'h2' },
        { label: 'Heading 3', value: 'h3' },
      ],
    },
    { name: 'text', type: 'textarea', required: true },
  ],
};
