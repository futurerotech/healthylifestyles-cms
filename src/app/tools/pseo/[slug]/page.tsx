import config from '@payload-config';
import { getPayload } from 'payload';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifesstyles.com';

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

  // E-E-A-T for programmatic pages (the riskiest under Google's scaled-content
  // and YMYL policies): declare a reviewed MedicalWebPage with a publisher +
  // logo + medical reviewer, plus a breadcrumb. Pairs with the visible
  // not-medical-advice disclaimer below.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        '@id': `${SITE_URL}/tools/pseo/${page.slug}#webpage`,
        url: `${SITE_URL}/tools/pseo/${page.slug}`,
        name: page.seo?.metaTitle || page.headline,
        description: page.seo?.metaDescription || undefined,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        lastReviewed: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
        reviewedBy: { '@type': 'Organization', name: 'HealthyLifeStyles Medical Review Team' },
        publisher: {
          '@type': 'Organization',
          name: 'HealthyLifeStyles',
          url: SITE_URL,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: page.headline },
        ],
      },
    ],
  };

  return (
    <main className="pseo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

        <footer className="pseo-page__disclaimer">
          This content is for general education and wellness only — not medical advice,
          diagnosis, or treatment. Always consult a qualified healthcare professional.
        </footer>
      </article>
    </main>
  );
}
