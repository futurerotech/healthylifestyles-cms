import type { Block } from 'payload';

export const ToolEmbedBlock: Block = {
  slug: 'toolEmbed',
  labels: { singular: 'Tool Embed', plural: 'Tool Embeds' },
  fields: [
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
      admin: { description: 'Select the calculator or tool to embed inline.' },
    },
    {
      name: 'label',
      type: 'text',
      admin: { description: 'Optional CTA label shown with the embed (e.g. "Try it: Calorie Calculator").' },
    },
  ],
};
