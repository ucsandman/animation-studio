import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {getBrand} from '../lib/brand';
import {loadBrandFonts} from '../lib/fonts';
import {NobanMark} from '../brands/NobanMark';
import {FloatBar} from '../components/FloatBar';

export const ComponentGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const brand = getBrand('noban');
  const fonts = loadBrandFonts();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.colors.bg,
        color: brand.colors.ink,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 48,
      }}
    >
      <NobanMark size={96} color={brand.colors.brand} />
      <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 72}}>
        {brand.name}
      </div>
      <div style={{fontFamily: fonts.body, fontSize: 32, color: brand.colors.ink2}}>
        {brand.tagline}
      </div>
      <div style={{fontFamily: fonts.mono, fontSize: 24, color: brand.colors.profit}}>
        +$12.40 net spread
      </div>
      <FloatBar progress={progress} brand={brand} width={800} />
    </AbsoluteFill>
  );
};
