import type { Field } from 'payload';

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Auto-fills `slug` from another field (e.g. name/title) when left blank. */
export const slugField = (from = 'name'): Field => ({
  name: 'slug',
  type: 'text',
  unique: false,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Lowercase URL segment. Auto-generated from the name — edit if you need a custom URL.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (value) return slugify(String(value));
        const source = data?.[from];
        return source ? slugify(String(source)) : value;
      },
    ],
  },
});
