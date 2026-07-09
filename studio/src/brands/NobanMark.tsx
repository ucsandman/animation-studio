import React from 'react';

export const NobanMark: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="none" style={{color}}>
    <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
    <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
    <path d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2.6" fill="currentColor" />
  </svg>
);
