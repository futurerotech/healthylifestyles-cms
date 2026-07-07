import type { CollectionConfig } from 'payload';
import { isAdminOrEditor } from '../access/roles';
import { slugField } from '../fields/slug';

/**
 * AI SEO Autopilot — prompt registry (§3 Module B).
 * Versioned, human-approved prompts for each detector and fixer.
 * No prompt is ever hardcoded in the executor — it pulls from here.
 */
export const PromptRegistry: CollectionConfig = {
  slug: 'prompt-registry',
  admin: {
    group: 'Autopilot',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'version', 'active'],
    listSearchableFields: ['name', 'type'],
  },
  access: {
    read: isAdminOrEditor,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Human-readable prompt name.' } },
    slugField('name'),
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Detector', value: 'detector' },
        { label: 'Fixer', value: 'fixer' },
        { label: 'Analyzer', value: 'analyzer' },
      ],
    },
    { name: 'version', type: 'number', required: true, defaultValue: 1, admin: { description: 'Prompt version — bump when the prompt changes.' } },
    { name: 'active', type: 'checkbox', defaultValue: false, admin: { description: 'Only one prompt per type+name should be active.' } },
    { name: 'prompt', type: 'textarea', required: true, admin: { description: 'The full prompt text. Variables in {{double braces}}.' } },
    {
      name: 'model',
      type: 'select',
      defaultValue: 'gemini-2.0-flash',
      options: [
        { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
        { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        { label: 'DeepSeek Chat', value: 'deepseek-chat' },
      ],
    },
    {
      name: 'variables',
      type: 'json',
      admin: { description: 'Schema of variables this prompt expects (for validation).' },
    },
  ],
  timestamps: true,
};
