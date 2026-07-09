import {describe, expect, it} from 'vitest';
import {cameraAt} from './camera';

const VP = {width: 1600, height: 1000};
const FOCUSES = [
  {type: 'focus' as const, t: 4000, x: 900, y: 500, w: 1100, h: 700},
  {type: 'focus' as const, t: 9000, x: 400, y: 300, w: 800, h: 500},
];
// focus 1 camera: scale = 0.92 * min(1600/1100, 1000/700) = 0.92 * 1.42857 = 1.31428
// focus 2 camera: scale = min(1.6, 0.92 * min(2, 2)) = 1.6, origin clamped

describe('cameraAt', () => {
  it('is at rest before the first focus', () => {
    expect(cameraAt(FOCUSES, 1000, VP)).toEqual({scale: 1, originX: 800, originY: 500});
  });

  it('is mid-transition shortly after a focus lands', () => {
    const cam = cameraAt(FOCUSES, 4450, VP);
    expect(cam.scale).toBeGreaterThan(1);
    expect(cam.scale).toBeLessThan(1.31428);
  });

  it('holds the focus framing after the transition, until the next focus', () => {
    const cam = cameraAt(FOCUSES, 6000, VP);
    expect(cam.scale).toBeCloseTo(1.31428, 4);
    expect(cam.originX).toBe(900);
    expect(cam.originY).toBe(500);
  });

  it('caps the zoom and clamps the origin for small edge regions', () => {
    const cam = cameraAt(FOCUSES, 11000, VP);
    expect(cam.scale).toBe(1.6);
    expect(cam.originX).toBe(500); // clamped: half = 1600/1.6/2
    expect(cam.originY).toBeCloseTo(312.5, 4); // clamped: half = 1000/1.6/2
  });

  it('transitions between consecutive focuses without returning to rest', () => {
    const cam = cameraAt(FOCUSES, 9450, VP);
    expect(cam.scale).toBeGreaterThan(1.31428);
    expect(cam.scale).toBeLessThan(1.6);
  });

  it('never zooms below 1 for regions larger than the viewport', () => {
    const wide = [{type: 'focus' as const, t: 1000, x: 800, y: 500, w: 2000, h: 1400}];
    expect(cameraAt(wide, 3000, VP).scale).toBe(1);
  });

  it('returns rest camera for an empty focus list', () => {
    expect(cameraAt([], 1000, VP)).toEqual({scale: 1, originX: 800, originY: 500});
  });
});
