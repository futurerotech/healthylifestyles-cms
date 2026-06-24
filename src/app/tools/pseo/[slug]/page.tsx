import config from '@payload-config';
import { getPayload } from 'payload';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifestyles.com';

async function getPage(slug: string) {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'pseo-pages',
    where: { slug: { equals: slug }, status: { equals: 'published' } } as any,
    depth: 1,
    limit: 1,
  });
  return (result.docs as any[])?.[0] || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};

  return {
    title: page.seo?.metaTitle || page.headline,
    description: page.seo?.metaDescription,
    robots: page.seo?.noIndex ? 'noindex' : 'index, follow',
    alternates: { canonical: `${SITE_URL}/tools/pseo/${page.slug}` },
    openGraph: {
      title: page.seo?.metaTitle || page.headline,
      description: page.seo?.metaDescription,
      url: `${SITE_URL}/tools/pseo/${page.slug}`,
      type: 'website',
    },
  };
}

export default async function PseoPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main className="pseo-page">
      <article>
        <header className="pseo-page__header">
          <h1>{page.headline}</h1>
          {page.subheadline && <p className="pseo-page__sub">{page.subheadline}</p>}
        </header>

        <div
          className="pseo-page__body"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />

        {page.ctaText && page.ctaUrl && (
          <div className="pseo-page__cta">
            <a href={page.ctaUrl} className="pseo-page__cta-link">{page.ctaText}</a>
          </div>
        )}
      </article>
    </main>
  );
}
