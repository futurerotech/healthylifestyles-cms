import type { Block } from 'payload';

export const CalculatorEmbedBlock: Block = {
  slug: 'calculatorEmbed',
  labels: { singular: 'Calculator Embed', plural: 'Calculator Embeds' },
  fields: [
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
      admin: { description: 'Select which calculator to embed inline.' },
    },
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'inline',
      options: [
        { label: 'Inline (within content)', value: 'inline' },
        { label: 'Full-width banner', value: 'banner' },
      ],
    },
  ],
};
