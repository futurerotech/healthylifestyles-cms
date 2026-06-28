'use client';

import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                        */
/* -------------------------------------------------------------------------- */

const LIMITS = {
  ogTitle: { idealMin: 40, idealMax: 60, hardMax: 90, label: 'OG Title' },
  ogDesc:  { idealMin: 150, idealMax: 155, hardMax: 200, label: 'OG Description' },
  twitterTitle: { idealMin: 40, idealMax: 60, hardMax: 90, label: 'X Title' },
  twitterDesc:  { idealMin: 150, idealMax: 155, hardMax: 200, label: 'X Description' },
  ogImage: { width: 1200, height: 630, ratio: '1.91:1', label: 'OG Image' },
  twitterImage: { width: 1200, height: 600, ratio: '2:1', label: 'X Card Image' },
};

function tone(len: number, opts: { idealMin: number; idealMax: number; hardMax: number }): 'muted' | 'ok' | 'warn' | 'over' {
  if (len === 0) return 'muted';
  if (len > opts.hardMax) return 'over';
  if (len > opts.idealMax || len < opts.idealMin) return 'warn';
  return 'ok';
}

function fmtTone(t: string) {
  switch (t) {
    case 'ok':    return '✓';
    case 'warn':  return '⚠';
    case 'over':  return '✗';
    default:      return '–';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* -------------------------------------------------------------------------- */
/*  Image dimension checker                                                   */
/* -------------------------------------------------------------------------- */

interface ImgInfo {
  width: number;
  height: number;
  url: string;
}

async function fetchImgInfo(idOrObj: unknown): Promise<ImgInfo | null> {
  const id = typeof idOrObj === 'object' && idOrObj !== null ? (idOrObj as any).id : idOrObj;
  if (!id) return null;
  try {
    const res = await fetch(`/api/media/${id}?depth=0`);
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc?.url) return null;
    const sizes = doc.sizes || {};
    const best = sizes.og || sizes.card || {};
    return {
      width: best.width || doc.width || 0,
      height: best.height || doc.height || 0,
      url: best.url || doc.url,
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

type PreviewMode = 'facebook' | 'twitter' | 'all';

export const SocialPreview: React.FC<{ path?: string }> = ({ path = 'seo' }) => {
  const fields = useFormFields(([f]) => f);
  const prefix = path ? `${path}.` : '';

  const rawTitle = fields?.[`${prefix}ogTitle`]?.value || fields?.title?.value || fields?.name?.value || '';
  const rawDesc  = fields?.[`${prefix}ogDescription`]?.value || fields?.[`${prefix}metaDescription`]?.value || '';
  const rawOgImg = fields?.[`${prefix}ogImage`]?.value || fields?.heroImage?.value;
  const rawTwitterTitle = fields?.[`${prefix}twitterTitle`]?.value || rawTitle;
  const rawTwitterDesc  = fields?.[`${prefix}twitterDescription`]?.value || rawDesc;
  const rawTwitterImg   = fields?.[`${prefix}twitterImage`]?.value || rawOgImg;
  const slug   = fields?.slug?.value || '';

  const ogTitle   = String(rawTitle || '');
  const ogDesc    = String(rawDesc || '');
  const xTitle    = String(rawTwitterTitle || '');
  const xDesc     = String(rawTwitterDesc || '');

  const [ogImg, setOgImg] = React.useState<ImgInfo | null>(null);
  const [xImg, setXImg] = React.useState<ImgInfo | null>(null);
  const [mode, setMode] = React.useState<PreviewMode>('all');

  React.useEffect(() => {
    fetchImgInfo(rawOgImg).then(setOgImg);
  }, [rawOgImg]);

  React.useEffect(() => {
    fetchImgInfo(rawTwitterImg).then(setXImg);
  }, [rawTwitterImg]);

  const charValidations = [
    { key: 'ogTitle', label: 'OG Title',       val: ogTitle, limits: LIMITS.ogTitle },
    { key: 'ogDesc',  label: 'OG Description', val: ogDesc,  limits: LIMITS.ogDesc },
    { key: 'xTitle',  label: 'X Title',         val: xTitle,  limits: LIMITS.twitterTitle },
    { key: 'xDesc',   label: 'X Description',   val: xDesc,   limits: LIMITS.twitterDesc },
  ] as const;

  const imgValidations = [
    { key: 'ogImage', label: 'OG Image', info: ogImg, limits: LIMITS.ogImage },
    { key: 'xImage',  label: 'X Card Image', info: xImg, limits: LIMITS.twitterImage },
  ] as const;

  const imgOk = (info: ImgInfo | null, l: { width: number; height: number }) => {
    if (!info) return 'muted';
    if (info.width >= l.width && info.height >= l.height) return 'ok';
    return 'warn';
  };

  return (
    <div className="hls-soc">
      {/* Mode toggle */}
      <div className="hls-soc__tabs">
        {(['all', 'facebook', 'twitter'] as const).map((m) => (
          <button key={m} type="button" className={`hls-soc__tab${mode === m ? ' is-active' : ''}`} onClick={() => setMode(m)}>
            {m === 'all' ? 'Both' : m === 'facebook' ? 'Facebook OG' : 'X / Twitter'}
          </button>
        ))}
      </div>

      {/* Validation summary */}
      <div className="hls-soc__validations">
        <div className="hls-soc__v-group">
          <span className="hls-soc__v-heading">Character Lengths</span>
          {charValidations.map((cv) => {
            const t = tone(cv.val.length, cv.limits);
            return (
              <div key={cv.key} className={`hls-soc__v-row hls-soc__v-row--${t}`}>
                <span className="hls-soc__v-icon">{fmtTone(t)}</span>
                <span className="hls-soc__v-label">{cv.label}:</span>
                <span className="hls-soc__v-count">{cv.val.length} chars</span>
                <span className="hls-soc__v-reco">(ideal {cv.limits.idealMin}–{cv.limits.idealMax}, max {cv.limits.hardMax})</span>
              </div>
            );
          })}
        </div>
        <div className="hls-soc__v-group">
          <span className="hls-soc__v-heading">Image Dimensions</span>
          {imgValidations.map((iv) => {
            const t = imgOk(iv.info, iv.limits);
            return (
              <div key={iv.key} className={`hls-soc__v-row hls-soc__v-row--${t}`}>
                <span className="hls-soc__v-icon">{fmtTone(t)}</span>
                <span className="hls-soc__v-label">{iv.label}:</span>
                <span className="hls-soc__v-count">
                  {iv.info ? `${iv.info.width}×${iv.info.height}px` : 'No image set'}
                </span>
                <span className="hls-soc__v-reco">(min {iv.limits.width}×{iv.limits.height}px, {iv.limits.ratio})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Facebook OG preview */}
      {(mode === 'all' || mode === 'facebook') && (
        <div className="hls-soc__card hls-soc__card--fb">
          <div className="hls-soc__card-header">Facebook / LinkedIn / OG</div>
          <div className="hls-soc__fb">
            <div className={`hls-soc__fb-img${ogImg ? '' : ' hls-soc__fb-img--empty'}`}>
              {ogImg ? (
                <img src={ogImg.url} alt="" />
              ) : (
                <span>No OG image — shares use site default</span>
              )}
            </div>
            <div className="hls-soc__fb-body">
              <div className="hls-soc__fb-domain">healthylifesstyles.com</div>
              <div className="hls-soc__fb-title">{truncate(ogTitle || 'Untitled page', 90)}</div>
              <div className="hls-soc__fb-desc">{truncate(ogDesc || 'Add a meta description to control the share preview.', 200)}</div>
            </div>
          </div>
        </div>
      )}

      {/* X/Twitter card preview */}
      {(mode === 'all' || mode === 'twitter') && (
        <div className="hls-soc__card hls-soc__card--x">
          <div className="hls-soc__card-header">X (Twitter) Card</div>
          <div className="hls-soc__x">
            <div className={`hls-soc__x-img${xImg ? '' : ' hls-soc__x-img--empty'}`}>
              {xImg ? (
                <img src={xImg.url} alt="" />
              ) : (
                <span>No card image</span>
              )}
            </div>
            <div className="hls-soc__x-body">
              <div className="hls-soc__x-domain">healthylifesstyles.com</div>
              <div className="hls-soc__x-title">{truncate(xTitle || ogTitle || 'Untitled page', 90)}</div>
              <div className="hls-soc__x-desc">{truncate(xDesc || ogDesc || '', 200)}</div>
            </div>
          </div>
        </div>
      )}

      {/* SMS / iMessage snippet */}
      <div className="hls-soc__card hls-soc__card--sms">
        <div className="hls-soc__card-header">SMS / iMessage Preview</div>
        <div className="hls-soc__sms">
          <div className="hls-soc__sms-bubble">
            <span className="hls-soc__sms-label">Link preview will appear as:</span>
            <span className="hls-soc__sms-title">{truncate(ogTitle || 'Untitled page', 60)}</span>
            <span className="hls-soc__sms-url">healthylifesstyles.com{slug ? `/${slug}` : ''}</span>
            <span className="hls-soc__sms-desc">{truncate(ogDesc || '', 80)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialPreview;
