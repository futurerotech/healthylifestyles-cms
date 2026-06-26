import type { Block } from 'payload';

export const PeopleAlsoAskBlock: Block = {
  slug: 'peopleAlsoAsk',
  labels: { singular: 'People Also Ask', plural: 'People Also Ask' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Optional heading above the FAQ block (e.g. "People also ask").' },
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Question', plural: 'Questions' },
      required: true,
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'question', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'answer', type: 'textarea', required: true, admin: { width: '50%' } },
          ],
        },
      ],
    },
  ],
};
