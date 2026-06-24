import React from 'react';

/* Branded list empty states. Rendered via each collection's beforeListTable
 * slot; hidden by default and revealed (with Payload's default "No results"
 * hidden) only when the list is empty — see `body:has(.no-results)` in
 * custom.scss. Static markup, so there's no runtime risk. */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICONS = {
  article: (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
    </Svg>
  ),
  tool: (
    <Svg>
      <path d="M10 2v7.31" /><path d="M14 9.3V1.99" /><path d="M8.5 2h7" /><path d="M14 9.3a6.5 6.5 0 1 1-4 0" /><path d="M5.58 16.5h12.85" />
    </Svg>
  ),
  author: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  media: (
    <Svg>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Svg>
  ),
};

function Empty({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="hls-empty" role="status">
      <span className="hls-empty__icon">{icon}</span>
      <h2 className="hls-empty__title">{title}</h2>
      <p className="hls-empty__body">{body}</p>
      <a className="hls-empty__btn" href={href}>{cta}</a>
    </div>
  );
}

export const EmptyArticles = () => (
  <Empty icon={ICONS.article} title="No guides yet" body="Write your first Wellness Hub article — it’ll show up right here." href="/admin/collections/articles/create" cta="Create new article" />
);
export const EmptyTools = () => (
  <Empty icon={ICONS.tool} title="No calculators yet" body="Build your first tool — formula calculators need no code." href="/admin/collections/tools/create" cta="Create new tool" />
);
export const EmptyAuthors = () => (
  <Empty icon={ICONS.author} title="No authors yet" body="Add an author so articles have a trusted byline and reviewer." href="/admin/collections/authors/create" cta="Create new author" />
);
export const EmptyMedia = () => (
  <Empty icon={ICONS.media} title="No media yet" body="Upload an image to use in articles and tool cards." href="/admin/collections/media/create" cta="Upload media" />
);
