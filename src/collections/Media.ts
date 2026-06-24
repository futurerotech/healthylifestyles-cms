import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';

/**
 * Media library. Uploads are converted to WebP at several sizes via sharp, and
 * alt text is required for accessibility/SEO. Reusable across tools & articles.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    listSearchableFields: ['alt', 'filename', 'credit'],
  },
  access: { read: publicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    // Serve modern formats; generate responsive sizes.
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      { name: 'thumbnail', width: 400, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'card', width: 768, formatOptions: { format: 'webp', options: { quality: 82 } } },
      { name: 'hero', width: 1600, formatOptions: { format: 'webp', options: { quality: 82 } } },
      { name: 'og', width: 1200, height: 630, formatOptions: { format: 'webp', options: { quality: 85 } } },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true, admin: { description: 'Describe the image for screen readers and SEO.' } },
    { name: 'credit', type: 'text', admin: { description: 'Optional photographer/source credit.' } },
  ],
};
