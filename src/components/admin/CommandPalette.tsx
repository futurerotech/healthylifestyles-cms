'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords: string;
}

const ITEMS: PaletteItem[] = [
  // Navigate
  { id: 'nav-articles', label: 'Articles', href: '/admin/collections/articles', group: 'Navigate', keywords: 'articles content posts wellness hub' },
  { id: 'nav-tools', label: 'Tools', href: '/admin/collections/tools', group: 'Navigate', keywords: 'tools calculators formula' },
  { id: 'nav-authors', label: 'Authors', href: '/admin/collections/authors', group: 'Navigate', keywords: 'authors writers bylines' },
  { id: 'nav-categories', label: 'Categories', href: '/admin/collections/categories', group: 'Navigate', keywords: 'categories groups sections' },
  { id: 'nav-media', label: 'Media Library', href: '/admin/collections/media', group: 'Navigate', keywords: 'media images uploads files' },
  { id: 'nav-redirects', label: 'Redirects', href: '/admin/collections/redirects', group: 'Navigate', keywords: 'redirects 301 urls' },
  { id: 'nav-users', label: 'Users', href: '/admin/collections/users', group: 'Navigate', keywords: 'users accounts admins' },
  { id: 'nav-settings', label: 'Site Settings', href: '/admin/globals/settings', group: 'Navigate', keywords: 'settings config site' },
  // Create
  { id: 'create-article', label: 'New Article', href: '/admin/collections/articles/create', group: 'Create', keywords: 'create new article post write' },
  { id: 'create-tool', label: 'New Tool', href: '/admin/collections/tools/create', group: 'Create', keywords: 'create new tool calculator' },
  { id: 'create-author', label: 'New Author', href: '/admin/collections/authors/create', group: 'Create', keywords: 'create new author writer' },
  // Quick Actions
  { id: 'drafts', label: 'Review Drafts', href: '/admin/collections/articles?where[_status][equals]=draft', group: 'Quick Actions', keywords: 'drafts review pending' },
  { id: 'content-gaps', label: 'Content Gaps', href: '/admin', group: 'Quick Actions', keywords: 'gaps missing orphan tools' },
  { id: 'indexing', label: 'Request Indexing', href: '/admin', group: 'Quick Actions', keywords: 'indexing seo google search' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ITEMS;
    const q = query.toLowerCase();
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const flatCount = filtered.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIdx((prev) => (prev + 1) % flatCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIdx((prev) => (prev - 1 + flatCount) % flatCount);
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[activeIdx]) {
            window.location.href = filtered[activeIdx].href;
            setOpen(false);
          }
          break;
      }
    },
    [filtered, activeIdx, flatCount],
  );

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('.hls-cp__item--active') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div className="hls-cp-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="hls-cp" onClick={(e) => e.stopPropagation()}>
        <div className="hls-cp__input-wrap">
          <svg className="hls-cp__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="hls-cp__input"
            type="text"
            placeholder="Search pages, create content..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hls-cp__hint">ESC</kbd>
        </div>
        <div className="hls-cp__list" ref={listRef}>
          {groups.length === 0 ? (
            <div className="hls-cp__empty">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="hls-cp__group">
                <div className="hls-cp__group-label">{group}</div>
                {items.map((item) => {
                  const flatIdx = filtered.indexOf(item);
                  return (
                    <a
                      key={item.id}
                      className={`hls-cp__item ${flatIdx === activeIdx ? 'hls-cp__item--active' : ''}`}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                    >
                      <span className="hls-cp__item-label">{item.label}</span>
                      <span className="hls-cp__item-keywords">{item.keywords.split(' ').slice(0, 3).join(', ')}</span>
                    </a>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="hls-cp__footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
