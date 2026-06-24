'use client';
import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/* Social-card preview for the OG image: shows roughly how a shared link looks
 * on Facebook / LinkedIn / X. The upload field value may already be a populated
 * media object (with a url) or just an id — if it's an id we fetch the doc once.
 * Defensive throughout: no image just shows the site-default placeholder. */

const ORIGIN = 'https://www.healthylifestyles.com';

function urlFromValue(v: any): string | null {
  if (!v || typeof v !== 'object') return null;
  return v.sizes?.og?.url || v.sizes?.card?.url || v.url || null;
}

export const OgPreview: React.FC = () => {
  const [ogImage, metaTitle, metaDesc, title, name] = useFormFields(([fields]) => [
    fields?.['seo.ogImage']?.value,
    fields?.['seo.metaTitle']?.value,
    fields?.['seo.metaDescription']?.value,
    fields?.title?.value,
    fields?.name?.value,
  ]) as any[];

  const [fetched, setFetched] = React.useState<string | null>(null);
  const direct = urlFromValue(ogImage);

  React.useEffect(() => {
    let alive = true;
    setFetched(null);
    const id = typeof ogImage === 'object' ? ogImage?.id : ogImage;
    if (!direct && id) {
      fetch(`/api/media/${id}?depth=0`)
        .then((r) => (r.ok ? r.json() : null))
        .then((doc) => {
          if (alive) setFetched(urlFromValue(doc));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [ogImage, direct]);

  const img = direct || fetched;
  const cardTitle = String(metaTitle || title || name || 'Untitled page');
  const cardDesc = String(metaDesc || 'Add a meta description to control the share preview.');

  return (
    <div className="hls-og">
      <div className="hls-og__card">
        <div className={`hls-og__media${img ? '' : ' hls-og__media--empty'}`}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" />
          ) : (
            <span>No OG image — shares use the site default</span>
          )}
        </div>
        <div className="hls-og__body">
          <div className="hls-og__domain">healthylifestyles.com</div>
          <div className="hls-og__title">{cardTitle}</div>
          <div className="hls-og__desc">{cardDesc}</div>
        </div>
      </div>
      <p className="hls-og__note">Recommended: 1200×630px. {ORIGIN.replace('https://', '')}</p>
    </div>
  );
};

export default OgPreview;
