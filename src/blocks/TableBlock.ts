import type { Block } from 'payload';

export const TableBlock: Block = {
  slug: 'table',
  labels: { singular: 'Table', plural: 'Tables' },
  fields: [
    { name: 'caption', type: 'text' },
    { name: 'headers', type: 'text', hasMany: true },
    {
      name: 'rows',
      type: 'array',
      labels: { singular: 'Row', plural: 'Rows' },
      fields: [
        { name: 'cells', type: 'text', hasMany: true },
      ],
    },
  ],
};
