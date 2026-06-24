'use client';

import React from 'react';

export function CmdPaletteTrigger() {
  return (
    <button
      className="hls-dash__cmd-hint"
      onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }))}
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span>Quick search...</span>
      <kbd className="hls-dash__cmd-kbd">Ctrl+K</kbd>
    </button>
  );
}
