import React from 'react';

/** Collapsed-nav / compact brand mark: the green rounded heartbeat square. */
export const Icon: React.FC = () => (
  <svg
    className="hls-admin-icon"
    width="26"
    height="26"
    viewBox="0 0 48 48"
    role="img"
    aria-label="HealthyLifeStyles"
  >
    <defs>
      <linearGradient id="hls-icon-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#22c55e" />
        <stop offset="1" stopColor="#16a34a" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#hls-icon-grad)" />
    <path
      d="M9 25h6l3-9 5 16 4-11 2.5 4H39"
      fill="none"
      stroke="#ffffff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Icon;
