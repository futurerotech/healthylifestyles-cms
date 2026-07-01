import type { GlobalConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const LeadGen: GlobalConfig = {
  slug: 'lead-gen',
  label: 'Lead Generation',
  admin: { group: 'Settings' },
  access: { read: publicRead, update: isAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Offers',
          description: 'Design downloadable PDF or tips offers shown after calculator results.',
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Master toggle for all lead-gen CTAs.' },
            },
            {
              name: 'successMessage',
              type: 'textarea',
              defaultValue: 'Thanks! Your free guide is on its way. Check your inbox shortly.',
              admin: { description: 'Message shown after a successful submission.' },
            },
            {
              name: 'offers',
              type: 'array',
              labels: { singular: 'Offer', plural: 'Offers' },
              minRows: 0,
              maxRows: 20,
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  admin: { description: 'Internal label (not shown to users).' },
                },
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'headline',
                  type: 'text',
                  required: true,
                  admin: { description: 'Big CTA headline, e.g. "Get Your Personalized BMI Report".' },
                },
                {
                  name: 'description',
                  type: 'textarea',
                  admin: { description: 'Short explanation of what they get.' },
                },
                {
                  name: 'offerType',
                  type: 'select',
                  defaultValue: 'pdf',
                  options: [
                    { label: 'Downloadable PDF', value: 'pdf' },
                    { label: 'Customized Tips', value: 'tips' },
                  ],
                  admin: { description: 'What the user receives in exchange for their email.' },
                },
                {
                  name: 'pdf',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    condition: (_, siblingData) => siblingData?.offerType === 'pdf',
                    description: 'The PDF file users will download after submitting.',
                  },
                },
                {
                  name: 'tipsText',
                  type: 'richText',
                  admin: {
                    condition: (_, siblingData) => siblingData?.offerType === 'tips',
                    description: 'Tips content shown after submission (can include personalized placeholders like {{value}}).',
                  },
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Get Your Free Report',
                  admin: { description: 'Text on the submit button.' },
                },
                {
                  name: 'collectName',
                  type: 'checkbox',
                  defaultValue: true,
                  label: 'Collect first name',
                  admin: { description: 'Show a "First name" field alongside email.' },
                },
                {
                  name: 'tools',
                  type: 'relationship',
                  relationTo: 'tools',
                  hasMany: true,
                  admin: { description: 'Which tools show this offer. Leave empty to show on all tools.' },
                },
                {
                  name: 'placement',
                  type: 'select',
                  defaultValue: 'afterResult',
                  options: [
                    { label: 'After result', value: 'afterResult' },
                    { label: 'Sidebar', value: 'sidebar' },
                    { label: 'Inline content', value: 'midContent' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Integration',
          fields: [
            {
              name: 'n8nWebhookUrl',
              type: 'text',
              admin: {
                description: 'Your n8n webhook URL where leads are forwarded (POST JSON). Leave empty to log locally.',
              },
            },
            {
              name: 'n8nApiKey',
              type: 'text',
              admin: {
                description: 'Optional API key sent as Authorization header to the n8n webhook.',
              },
            },
          ],
        },
      ],
    },
  ],
};
