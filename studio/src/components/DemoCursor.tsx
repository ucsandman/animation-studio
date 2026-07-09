import React from 'react';
import type {Brand} from '../lib/brand';
import type {ClickEvent} from '../lib/telemetry';
import {cursorAt} from '../lib/telemetry';

const RIPPLE_MS = 400;

export const DemoCursor: React.FC<{
  clickList: ClickEvent[];
  timeMs: number;
  brand: Brand;
}> = ({clickList, timeMs, brand}) => {
  const {x, y, press} = cursorAt(clickList, timeMs);
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {/* click ripples */}
      {clickList.map((c, i) => {
        const dt = timeMs - c.t;
        if (dt < 0 || dt > RIPPLE_MS) return null;
        const p = dt / RIPPLE_MS;
        const r = 14 + p * 36;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x - r,
              top: c.y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `2.5px solid ${brand.colors.brand}`,
              opacity: 0.8 * (1 - p),
            }}
          />
        );
      })}
      {/* pointer */}
      <svg
        viewBox="0 0 24 24"
        width={34}
        height={34}
        style={{
          position: 'absolute',
          left: x - 4,
          top: y - 3,
          transform: `scale(${press ? 0.85 : 1})`,
          transformOrigin: '4px 3px',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))',
        }}
      >
        <path
          d="M5 2.5v16.7l4.2-3.9 2.5 5.9 2.9-1.2-2.5-5.9h5.8L5 2.5z"
          fill={brand.colors.ink}
          stroke={brand.colors.bg}
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
};
