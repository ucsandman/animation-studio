import {describe, expect, it} from 'vitest';
import {brandSpring, staggerDelay, DEFAULT_MOTION} from './motion';
import {
  revealFragment,
  revealUnit,
  TEXT_REVEALS,
  CHAR_STAGGER_CAP,
  type RevealArgs,
} from './textReveal';

const FPS = 30;

const args = (over: Partial<RevealArgs> = {}): RevealArgs => ({
  frame: 12,
  fps: FPS,
  motion: DEFAULT_MOTION,
  index: 0,
  total: 5,
  scale: 1,
  ...over,
});

describe('spring preset (legacy word math)', () => {
  it('reproduces the exact brandSpring word opacity + rise for sample inputs', () => {
    for (const {frame, index, scale} of [
      {frame: 8, index: 0, scale: 1},
      {frame: 14, index: 2, scale: 1},
      {frame: 30, index: 3, scale: 0.5},
      {frame: 5, index: 1, scale: 2},
    ]) {
      // The legacy Headline computed exactly this per word.
      const s = brandSpring(frame, FPS, DEFAULT_MOTION, {
        delayFrames: 8 + staggerDelay(index, 4, DEFAULT_MOTION),
      });
      const frag = revealFragment('spring', args({frame, index, scale}));
      expect(frag.opacity).toBe(s);
      expect(frag.transform).toBe(`translateY(${(1 - s) * 40 * scale}px)`);
      expect(frag.filter).toBeUndefined();
      expect(frag.clipPath).toBeUndefined();
    }
  });
});

describe('every preset is identity at rest (frame >> in)', () => {
  for (const preset of TEXT_REVEALS) {
    it(`${preset} settles to fully visible with no residual displacement`, () => {
      const frag = revealFragment(preset, args({frame: 240, index: 0, total: 20}));
      expect(frag.opacity).toBeCloseTo(1, 3);
      // no residual vertical offset
      if (frag.transform) {
        const m = /translateY\(([-+0-9.eE]+)px\)/.exec(frag.transform);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeCloseTo(0, 3);
      }
      // no residual blur
      if (frag.filter) {
        const m = /blur\(([-+0-9.eE]+)px\)/.exec(frag.filter);
        expect(Number(m![1])).toBeCloseTo(0, 3);
      }
      // clip fully open (right inset 0)
      if (frag.clipPath) {
        const m = /inset\(0 ([-+0-9.eE]+)% 0 0\)/.exec(frag.clipPath);
        expect(Number(m![1])).toBeCloseTo(0, 3);
      }
    });
  }
});

describe('preset signatures at mid-reveal', () => {
  it('maskWipe stays fully opaque and drives a shrinking clip inset', () => {
    const frag = revealFragment('maskWipe', args({frame: 12, index: 0}));
    expect(frag.opacity).toBe(1);
    const inset = Number(/inset\(0 ([-+0-9.eE]+)% 0 0\)/.exec(frag.clipPath as string)![1]);
    expect(inset).toBeGreaterThan(0); // partially clipped
    expect(inset).toBeLessThanOrEqual(100);
  });

  it('blurIn carries a positive blur before it settles', () => {
    const frag = revealFragment('blurIn', args({frame: 10, index: 0}));
    const blur = Number(/blur\(([-+0-9.eE]+)px\)/.exec(frag.filter as string)![1]);
    expect(blur).toBeGreaterThan(0);
    expect(blur).toBeLessThanOrEqual(8);
  });
});

describe('revealUnit (charStagger cap)', () => {
  it('splits charStagger into chars under the cap', () => {
    expect(revealUnit('charStagger', 'Governance runtime')).toBe('char');
  });

  it('falls back to word units above the cap', () => {
    const long = 'a'.repeat(CHAR_STAGGER_CAP + 1);
    expect(revealUnit('charStagger', long)).toBe('word');
  });

  it('counts non-space characters only against the cap', () => {
    // exactly CHAR_STAGGER_CAP non-space chars, spread across words with spaces
    const words = Array.from({length: CHAR_STAGGER_CAP}, () => 'a').join(' ');
    expect(words.replace(/ /g, '').length).toBe(CHAR_STAGGER_CAP);
    expect(revealUnit('charStagger', words)).toBe('char');
  });

  it('always uses word units for the non-char presets', () => {
    for (const preset of ['spring', 'maskWipe', 'blurIn'] as const) {
      expect(revealUnit(preset, 'Governance runtime')).toBe('word');
    }
  });
});
