import type { Block } from 'payload';

export const ListBlock: Block = {
  slug: 'list',
  labels: { singular: 'List', plural: 'Lists' },
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'unordered',
      options: [
        { label: 'Bullet list', value: 'unordered' },
        { label: 'Numbered list', value: 'ordered' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Item', plural: 'Items' },
      required: true,
      minRows: 1,
      fields: [
        { name: 'text', type: 'textarea', required: true },
      ],
    },
  ],
};
