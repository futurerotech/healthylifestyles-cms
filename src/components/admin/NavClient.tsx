'use client';

/**
 * Custom nav link renderer with lucide-react icons per collection/global.
 *
 * Renders each permission-visible, grouped entity as a Payload <Link> with a
 * lucide icon keyed by slug. Uses the same active-link rule, href builder, and
 * class names (`nav__link`, `nav__link-label`, `nav__link-indicator`) as
 * Payload's default nav so existing custom.scss rules keep applying.
 */
import { getTranslation } from '@payloadcms/translations';
import { Link, useTranslation } from '@payloadcms/ui';
import { EntityType } from '@payloadcms/ui/shared';
import { usePathname } from 'next/navigation.js';
import { formatAdminURL } from 'payload/shared';
import React, { Fragment } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  CircleDot,
  Database,
  FileCode2,
  Files,
  FileText,
  Fingerprint,
  FlaskConical,
  FolderTree,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Megaphone,
  Newspaper,
  PenTool,
  Radar,
  Search,
  Settings,
  Share2,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

const baseClass = 'nav';

const COLLECTION_ICONS: Record<string, LucideIcon> = {
  articles: Newspaper,
  authors: PenTool,
  categories: FolderTree,
  leads: UserPlus,
  media: ImageIcon,
  pages: FileText,
  tools: FlaskConical,
  'pseo-templates': FileCode2,
  'pseo-datasets': Database,
  'pseo-pages': Files,
  'push-history': BellRing,
  'push-subscriptions': BellRing,
  subscribers: Mail,
  personas: UsersRound,
  profiles: Fingerprint,
  'tool-usage': BarChart3,
  'indexing-status': Search,
  redirects: ArrowLeftRight,
  users: Users,
};

const GLOBAL_ICONS: Record<string, LucideIcon> = {
  settings: Settings,
  indexing: Search,
  'social-media': Share2,
  'ad-management': Megaphone,
  'lead-gen': Gift,
  audience: Radar,
};

function iconFor(slug: string, type: string): LucideIcon {
  if (type === EntityType.global) return GLOBAL_ICONS[slug] ?? CircleDot;
  return COLLECTION_ICONS[slug] ?? CircleDot;
}

interface NavEntity {
  slug: string;
  type: string;
  label: Record<string, string> | string;
}

interface NavGroupData {
  label: Record<string, string> | string;
  entities: NavEntity[];
}

interface NavClientProps {
  groups: NavGroupData[];
  adminRoute: string;
  dashboardHref: string;
}

export const NavClient: React.FC<NavClientProps> = ({ groups, adminRoute, dashboardHref }) => {
  const pathname = usePathname();
  const { i18n } = useTranslation();

  const isActive = (href: string) =>
    (pathname === href || (pathname.startsWith(href) && ['/', undefined].includes(pathname[href.length])));

  const renderEntity = (entity: NavEntity, i: number) => {
    const { slug, type, label } = entity;
    const href =
      type === EntityType.collection
        ? formatAdminURL({ adminRoute, path: `/collections/${slug}` })
        : formatAdminURL({ adminRoute, path: `/globals/${slug}` });
    const id = `nav-${type === EntityType.global ? 'global-' : ''}${slug}`;
    const active = isActive(href);
    const Icon = iconFor(slug, type);

    const Label = (
      <Fragment>
        {active && <div className={`${baseClass}__link-indicator`} />}
        <Icon className={`${baseClass}__link-icon`} size={16} aria-hidden="true" />
        <span className={`${baseClass}__link-label`}>{getTranslation(label, i18n)}</span>
      </Fragment>
    );

    return (
      <Link key={`${id}-${i}`} className={`${baseClass}__link`} href={href} id={id} prefetch={false}>
        {Label}
      </Link>
    );
  };

  return (
    <Fragment>
      {/* Dashboard home link — sits above the grouped collections. */}
      <Link
        className={`${baseClass}__link ${baseClass}__link--home`}
        href={dashboardHref}
        id="nav-dashboard"
        prefetch={false}
      >
        {isActive(dashboardHref) && <div className={`${baseClass}__link-indicator`} />}
        <LayoutDashboard className={`${baseClass}__link-icon`} size={16} aria-hidden="true" />
        <span className={`${baseClass}__link-label`}>Dashboard</span>
      </Link>

      {groups.map((group, key) => {
        const groupLabel = getTranslation(group.label, i18n);
        return (
          <div key={key} className={`${baseClass}__group`}>
            <div className={`${baseClass}__group-label`}>{groupLabel}</div>
            {group.entities.map(renderEntity)}
          </div>
        );
      })}
    </Fragment>
  );
};
