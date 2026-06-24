import React from 'react';

/** Full brand lockup for the login screen + expanded nav: mark + wordmark. */
export const Logo: React.FC = () => (
  <span className="hls-admin-logo">
    <span className="hls-admin-logo__mark" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 48 48">
        <defs>
          <linearGradient id="hls-logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#hls-logo-grad)" />
        <path
          d="M9 25h6l3-9 5 16 4-11 2.5 4H39"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
    <span className="hls-admin-logo__text">
      <span className="hls-admin-logo__name">HealthyLifeStyles</span>
      <span className="hls-admin-logo__sub">Trusted Wellness</span>
    </span>
  </span>
);

export default Logo;
