import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const Audience: GlobalConfig = {
  slug: 'audience',
  label: 'Audience',
  admin: { group: 'Settings' },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'n8n Integration',
          fields: [
            {
              name: 'n8nWebhookUrl',
              type: 'text',
              admin: {
                description: 'n8n webhook URL for new subscriber events. Leave empty to skip forwarding.',
              },
            },
            {
              name: 'n8nApiKey',
              type: 'text',
              admin: {
                description: 'Optional Bearer token sent to the n8n webhook as Authorization header.',
              },
            },
            {
              name: 'forwardOnCreate',
              type: 'checkbox',
              defaultValue: true,
              label: 'Forward new subscribers to n8n',
              admin: { description: 'When enabled, each new subscriber is POSTed to the n8n webhook.' },
            },
          ],
        },
        {
          label: 'Push Notifications',
          fields: [
            {
              name: 'pushEnabled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Master toggle for web push notifications.' },
            },
            {
              name: 'vapidSubject',
              type: 'text',
              admin: {
                description: 'VAPID subject (mailto: or URL), e.g. mailto:hello@healthylifesstyles.com',
              },
            },
            {
              name: 'vapidPublicKey',
              type: 'text',
              admin: {
                description: 'VAPID public key. Generate with: npx web-push generate-vapid-keys',
              },
            },
            {
              name: 'vapidPrivateKey',
              type: 'text',
              admin: {
                description: 'VAPID private key (kept secret, never exposed to the client).',
              },
            },
            {
              name: 'defaultIcon',
              type: 'text',
              admin: {
                description: 'Default icon URL for push notifications (120x120px minimum).',
              },
            },
            {
              name: 'autoPushOnPublish',
              type: 'checkbox',
              defaultValue: false,
              label: 'Auto-send push on article publish',
              admin: { description: 'When an article is published, automatically send a push notification to all subscribers.' },
            },
          ],
        },
        {
          label: 'CSV Import',
          fields: [
            {
              name: 'csvFile',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Upload a CSV file with subscriber data. Required columns: email. Optional: name, interests.',
              },
            },
            {
              name: 'csvEmailColumn',
              type: 'text',
              defaultValue: 'email',
              admin: { description: 'Column name in the CSV containing email addresses.' },
            },
            {
              name: 'csvNameColumn',
              type: 'text',
              admin: { description: 'Column name in the CSV containing subscriber names (optional).' },
            },
            {
              name: 'csvInterestsColumn',
              type: 'text',
              admin: { description: 'Column name in the CSV containing interest tags (semicolon-separated, optional).' },
            },
            {
              name: 'csvImportStatus',
              type: 'select',
              defaultValue: 'idle',
              options: [
                { label: 'Idle', value: 'idle' },
                { label: 'Importing', value: 'importing' },
                { label: 'Complete', value: 'complete' },
                { label: 'Failed', value: 'failed' },
              ],
              admin: { readOnly: true, description: 'Status of the last CSV import.' },
            },
            {
              name: 'csvImportResult',
              type: 'json',
              admin: { readOnly: true, description: 'Result summary from the last CSV import.' },
            },
            {
              name: 'csvImport',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/ImportCsvButton#ImportCsvButton' } },
            },
          ],
        },
        {
          label: 'Analytics',
          fields: [
            {
              name: 'projectedRpm',
              type: 'number',
              defaultValue: 8,
              admin: {
                description:
                  'Projected revenue per 1,000 tool sessions (USD). Used only for the "Projected Revenue" card on the dashboard — it is an estimate, not real earnings. Adjust to match your AdSense/monetization RPM.',
                step: 0.1,
              },
              // Ensure a non-negative RPM so the projection can't go negative.
              validate: (val: unknown) => (val == null || (typeof val === 'number' && val >= 0) ? true : 'RPM must be 0 or greater.'),
            },
          ],
        },
      ],
    },
  ],
};
