/**
 * Custom admin sidebar nav — server component.
 *
 * Reuses Payload's own `groupNavItems()` (from @payloadcms/ui/shared) for
 * permission filtering + grouping, so the visible items and group order are
 * identical to the default nav. Only the rendering is custom: a branded
 * header, the iconified links (NavClient), and a logout footer. This keeps us
 * off Payload's private internals (NavWrapper/NavHamburger/SettingsMenuButton
 * aren't part of the public exports map) while staying permission-correct.
 *
 * Registered via `admin.components.Nav` (capital N) in payload.config.ts.
 */
import type { Payload } from 'payload';
import { EntityType, groupNavItems } from '@payloadcms/ui/shared';
import React from 'react';
import { formatAdminURL } from 'payload/shared';
import { NavClient } from './NavClient';
import DeployButton from '@/components/admin/DeployButton';

const baseClass = 'nav';

interface NavProps {
  payload: Payload;
  visibleEntities: { collections: string[]; globals: string[] };
  req: any;
  config?: any;
  [key: string]: unknown;
}

export const Nav = async (props: NavProps) => {
  // groupNavItems expects SanitizedPermissions + union slugs from payload-types;
  // props are passed through loosely (codebase-wide pattern — see AGENTS.md).
  const { i18n, payload, permissions, visibleEntities } = props as any;

  if (!payload?.config) return null;

  const { collections, globals, routes } = payload.config;
  const adminRoute = routes?.admin ?? '/admin';

  const groups = (groupNavItems as any)(
    [
      ...collections
        .filter(({ slug }: { slug: string }) => visibleEntities.collections.includes(slug))
        .map((collection: any) => ({ type: EntityType.collection, entity: collection })),
      ...globals
        .filter(({ slug }: { slug: string }) => visibleEntities.globals.includes(slug))
        .map((global: any) => ({ type: EntityType.global, entity: global })),
    ],
    permissions,
    i18n,
  );

  const dashboardHref = formatAdminURL({ adminRoute, path: '' }) || '/admin';
  const logoutHref = formatAdminURL({ adminRoute, path: '/logout' }) || '/admin/logout';

  return (
    <aside className={`${baseClass} ${baseClass}--nav-open hls-nav`}>
      <div className={`${baseClass}__brand`}>
        <svg width="26" height="26" viewBox="0 0 48 48" role="img" aria-label="HealthyLifeStyles">
          <defs>
            <linearGradient id="hls-nav-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22c55e" />
              <stop offset="1" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#hls-nav-grad)" />
          <path d="M9 25h6l3-9 5 16 4-11 2.5 4H39" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`${baseClass}__brand-text`}>HealthyLifeStyles</span>
      </div>

      <nav className={`${baseClass}__wrap`}>
        <NavClient groups={groups as any} adminRoute={adminRoute} dashboardHref={dashboardHref} />
      </nav>

      <div className={`${baseClass}__footer`}>
        <DeployButton />
        <a className={`${baseClass}__link ${baseClass}__link--logout`} href={logoutHref}>
          <svg className={`${baseClass}__link-icon`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className={`${baseClass}__link-label`}>Log out</span>
        </a>
      </div>
    </aside>
  );
};

export default Nav;