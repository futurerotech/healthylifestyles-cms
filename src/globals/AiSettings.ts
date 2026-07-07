import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'
import { encryptField, decryptField } from '../lib/crypto'

/**
 * AI SEO Autopilot — provider-agnostic AI settings (§2).
 *
 * Configures the failover chain of OpenAI-compatible providers,
 * per-task model routing, timeout, and daily cost cap.
 * API keys are encrypted at rest (AES-256-GCM) and masked in the UI.
 */

let cacheInvalidator: (() => void) | null = null
export function registerAiSettingsCacheInvalidator(fn: () => void) {
  cacheInvalidator = fn
}

export const AiSettings: GlobalConfig = {
  slug: 'ai-settings',
  admin: {
    group: 'Autopilot',
    description: 'Configure AI providers, model routing, and budget caps for the SEO Autopilot.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
  },
  hooks: {
    afterChange: [() => { cacheInvalidator?.() }],
  },
  fields: [
    {
      name: 'providers',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'Order = failover priority. First provider is primary.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'providerUrl',
          type: 'text',
          required: true,
          defaultValue: 'https://api.openai.com/v1',
          validate: (v: string) => /^https?:\/\/.+/.test(v || '') || 'Must be a valid base URL (no trailing /chat/completions)',
        },
        {
          name: 'apiKey',
          type: 'text',
          required: true,
          admin: {
            components: { Field: '@/components/admin/MaskedField#default' },
            description: 'Encrypted at rest. Shown as •••• after save.',
          },
          hooks: {
            beforeChange: [({ value }) => encryptField(value)],
            afterRead: [({ value, req }) => {
              // Return masked unless internal context (server-side call)
              if (req?.context?.internal) return decryptField(value)
              return '••••'
            }],
          },
        },
        { name: 'enabled', type: 'checkbox', defaultValue: true },
      ],
    },
    { name: 'defaultModel', type: 'text', required: true, defaultValue: 'glm-5.2-plan' },
    {
      name: 'taskModelMap',
      type: 'array',
      admin: { description: 'Per-task overrides. Falls back to defaultModel.' },
      fields: [
        {
          name: 'taskType',
          type: 'select',
          required: true,
          options: [
            { label: 'Meta trim', value: 'meta_trim' },
            { label: 'FAQ generation', value: 'faq_gen' },
            { label: 'Cannibalization', value: 'cannibalization' },
            { label: 'Article generation', value: 'article_gen' },
            { label: 'Link fix', value: 'link_fix' },
          ],
        },
        { name: 'model', type: 'text', required: true },
        { name: 'maxTokens', type: 'number', defaultValue: 4096 },
        { name: 'temperature', type: 'number', defaultValue: 0.3 },
      ],
    },
    { name: 'requestTimeoutMs', type: 'number', defaultValue: 60000 },
    { name: 'dailyCostCapUsd', type: 'number', defaultValue: 20 },
  ],
}
