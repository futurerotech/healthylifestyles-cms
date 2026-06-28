'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAllFormFields, useConfig } from '@payloadcms/ui';

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function dateStr(v: unknown): string {
  if (!v) return new Date().toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function resolveRel(v: unknown): string | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.name === 'string') return o.name;
    if (typeof o.title === 'string') return o.title;
    if (typeof o.slug === 'string') return o.slug;
    if (typeof o.id === 'string') return o.id;
    if (typeof o.id === 'number') return String(o.id);
  }
  return undefined;
}

function generateToolSchema(data: Record<string, unknown>): Record<string, unknown> {
  const name = fmt(data.name);
  const slug = fmt(data.slug);
  const desc = fmt((data as any).seo?.metaDescription || data.whatItIs);
  const outputs = (data.outputs as any[]) || [];
  const hasBands = outputs.some((o: any) => o.bands?.length > 0);

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        '@id': `https://www.healthylifesstyles.com/tools/${slug}#webpage`,
        url: `https://www.healthylifesstyles.com/tools/${slug}`,
        name: name || 'Health Calculator',
        description: desc || undefined,
        inLanguage: 'en-US',
        isPartOf: {
          '@id': 'https://www.healthylifesstyles.com/#website',
        },
        about: {
          '@type': 'Thing',
          name: 'Health & fitness calculation',
        },
        // E-E-A-T: a YMYL health page should declare when it was reviewed and by whom.
        lastReviewed: dateStr((data as any).updatedAt),
        reviewedBy: {
          '@type': 'Organization',
          name: 'HealthyLifeStyles Medical Review Team',
        },
        mainEntity: {
          '@type': 'WebApplication',
          '@id': `https://www.healthylifesstyles.com/tools/${slug}#app`,
          name: name || 'Health Calculator',
          applicationCategory: 'HealthApplication',
          operatingSystem: 'Any',
          browserRequirements: 'JavaScript',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `https://www.healthylifesstyles.com/tools/${slug}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: 'https://www.healthylifesstyles.com/tools' },
          { '@type': 'ListItem', position: 2, name: name || 'Calculator' },
        ],
      },
    ],
  };

  if (hasBands) {
    const bandItems = outputs.flatMap((o: any) =>
      (o.bands || []).map((b: any) => ({
        '@type': 'StatisticalVariable',
        name: b.label || 'Range',
        description: `${fmt(o.label || '')}: up to ${b.upTo} ${fmt(o.unit || '')}`,
      })),
    );
    (schema['@graph'] as any[]).push({
      '@type': 'DefinedTermSet',
      name: `${name} Result Categories`,
      hasDefinedTerm: bandItems,
    });
  }

  return schema;
}

function generateArticleSchema(data: Record<string, unknown>): Record<string, unknown> {
  const title = fmt(data.title);
  const slug = fmt(data.slug);
  const desc = fmt((data as any).seo?.metaDescription || data.excerpt);
  const author = resolveRel(data.author) || 'HealthyLifeStyles Editorial Team';
  const pubDate = dateStr(data.publishDate);
  const faqs = (data.faq as any[]) || [];
  const entities = ((data.semanticEntities as any[]) || []).filter((e) => e?.term);

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      '@id': `https://www.healthylifesstyles.com/wellness-hub/${slug}#article`,
      headline: title || 'Wellness Article',
      description: desc || undefined,
      image: `https://www.healthylifesstyles.com/og/articles/${slug}.png`,
      inLanguage: 'en-US',
      datePublished: pubDate,
      dateModified: dateStr((data as any).updatedDate || (data as any).updatedAt || data.publishDate),
      // E-E-A-T: honest org-level authorship + a named medical reviewer + a
      // publisher with a logo (required for Google Article rich results).
      author: {
        '@type': 'Organization',
        name: author,
        url: 'https://www.healthylifesstyles.com/about',
      },
      reviewedBy: {
        '@type': 'Organization',
        name: 'HealthyLifeStyles Medical Review Team',
        url: 'https://www.healthylifesstyles.com/about',
      },
      publisher: {
        '@type': 'Organization',
        name: 'HealthyLifeStyles',
        url: 'https://www.healthylifesstyles.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.healthylifesstyles.com/icon-512.png',
        },
      },
      isPartOf: {
        '@type': 'WebPage',
        '@id': `https://www.healthylifesstyles.com/wellness-hub/${slug}#webpage`,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://www.healthylifesstyles.com/wellness-hub/${slug}`,
      },
      ...(entities.length
        ? {
            about: entities.map((e: any) => ({ '@type': 'DefinedTerm', name: e.term, ...(e.url ? { url: e.url } : {}) })),
            keywords: entities.map((e: any) => e.term).join(', '),
          }
        : {}),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `https://www.healthylifesstyles.com/wellness-hub/${slug}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wellness Hub', item: 'https://www.healthylifesstyles.com/wellness-hub' },
        { '@type': 'ListItem', position: 2, name: title || 'Article' },
      ],
    },
  ];

  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `https://www.healthylifesstyles.com/wellness-hub/${slug}#faq`,
      mainEntity: faqs.map((f: any) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function generatePageSchema(data: Record<string, unknown>): Record<string, unknown> {
  const title = fmt(data.title);
  const slug = fmt(data.slug);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://www.healthylifesstyles.com/${slug}#webpage`,
        url: `https://www.healthylifesstyles.com/${slug}`,
        name: title || 'Page',
        inLanguage: 'en-US',
        isPartOf: { '@id': 'https://www.healthylifesstyles.com/#website' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `https://www.healthylifesstyles.com/${slug}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.healthylifesstyles.com' },
          { '@type': 'ListItem', position: 2, name: title || 'Page' },
        ],
      },
    ],
  };
}

const COLLECTION_PATTERNS: Record<string, (d: Record<string, unknown>) => Record<string, unknown>> = {
  tools: generateToolSchema,
  articles: generateArticleSchema,
  pages: generatePageSchema,
};

export const SchemaGenerator: React.FC = () => {
  const config = useConfig();
  const [copied, setCopied] = useState(false);
  const [fields] = useAllFormFields();

  // Guard `window`: Payload SSRs client components for the initial HTML, where
  // `window` is undefined. Reading it at render time throws (ReferenceError) and
  // crashes the whole edit view to a blank/dark screen. Fall back to 'pages'
  // during SSR; it resolves to the real collection on the client render.
  const collectionSlug =
    typeof window !== 'undefined' && (config as any)?.routes?.admin
      ? window.location.pathname.match(/\/(collections|pages)\/(\w+)/)?.[2] || 'pages'
      : 'pages';

  const fieldValues = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      if (field?.value !== undefined) {
        map[key] = field.value;
      }
    }
    return map;
  }, [fields]);

  const generator = COLLECTION_PATTERNS[collectionSlug] || generatePageSchema;

  const jsonLd = useMemo(() => {
    try {
      return generator(fieldValues);
    } catch {
      return { error: 'Could not generate schema from current data.' };
    }
  }, [fieldValues, generator]);

  const pretty = useMemo(() => JSON.stringify(jsonLd, null, 2), [jsonLd]);

  const copy = () => {
    navigator.clipboard.writeText(pretty).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="hls-schema">
      <div className="hls-schema__bar">
        <span className="hls-schema__label">Schema.org JSON-LD</span>
        <button type="button" className="hls-schema__copy" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="hls-schema__code"><code>{pretty}</code></pre>
    </div>
  );
};

export default SchemaGenerator;
