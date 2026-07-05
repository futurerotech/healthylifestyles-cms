/**
 * Role-based access control. Two roles:
 *  - admin  → full control (content + settings + users + redirects)
 *  - editor → content only (tools, articles, categories, authors, media)
 */
import type { Access, FieldAccess } from 'payload';

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin';

export const isAdminOrEditor: Access = ({ req }) =>
  req.user?.role === 'admin' || req.user?.role === 'editor';

/** Public read of published content (so Astro can fetch at build time). */
export const publicRead: Access = () => true;

/**
 * Public read for drafts-enabled collections: anonymous requests only see
 * PUBLISHED docs; logged-in staff see everything (incl. drafts in the admin).
 * Without this, Payload returns never-published drafts to anonymous reads —
 * plain `publicRead` on a versioned collection leaks unreviewed drafts to the
 * public API and therefore to the static site build.
 */
export const publishedPublicRead: Access = ({ req }) =>
  req.user ? true : { _status: { equals: 'published' } };

/** Logged-in staff (any role). */
export const isStaff: Access = ({ req }) => Boolean(req.user);

/** Field-level: only admins can change this field (e.g. a user's role). */
export const isAdminField: FieldAccess = ({ req }) => req.user?.role === 'admin';
