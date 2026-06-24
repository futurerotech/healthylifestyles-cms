import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminField } from '../access/roles';

/**
 * Staff accounts. Payload provides email+password auth, sessions, and password
 * reset out of the box. Only admins manage users; everyone can read/update self.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8, // 8h sessions
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Settings',
    defaultColumns: ['name', 'email', 'role'],
    listSearchableFields: ['name', 'email'],
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || { id: { equals: req.user?.id } },
    create: isAdmin,
    update: ({ req }) => req.user?.role === 'admin' || { id: { equals: req.user?.id } },
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Admin (full control)', value: 'admin' },
        { label: 'Editor (content only)', value: 'editor' },
      ],
      access: { update: isAdminField },
      admin: { description: 'Admins manage settings, users and redirects. Editors manage content only.' },
    },
    { name: 'bio', type: 'textarea', admin: { description: 'Optional short bio.' } },
    {
      name: 'enableAPIKey',
      type: 'checkbox',
      label: 'Enable API Key',
      admin: { position: 'sidebar', description: 'Allow n8n and other services to authenticate via API key.' },
    },
    {
      name: 'apiKey',
      type: 'text',
      label: 'API Key',
      admin: { position: 'sidebar', description: 'Auto-generated on save. Copy it now — you will not see it again.' },
    },
  ],
};
