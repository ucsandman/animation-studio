import type {FocusEvent} from './telemetry';
import {easeInOutCubic} from './telemetry';

const TRANSITION_MS = 900; // one eased move per focus, then hold until the next
const MAX_SCALE = 1.6;
const FILL = 0.92; // fraction of the viewport the focus region should fill

type Camera = {scale: number; originX: number; originY: number};

const clampOrigin = (v: number, span: number, scale: number): number => {
  const half = span / scale / 2;
  return Math.min(Math.max(v, half), span - half);
};

const focusCamera = (f: FocusEvent, viewport: {width: number; height: number}): Camera => {
  const scale = Math.min(
    MAX_SCALE,
    Math.max(1, FILL * Math.min(viewport.width / f.w, viewport.height / f.h)),
  );
  return {
    scale,
    originX: clampOrigin(f.x, viewport.width, scale),
    originY: clampOrigin(f.y, viewport.height, scale),
  };
};

export const cameraAt = (
  focusList: FocusEvent[],
  tMs: number,
  viewport: {width: number; height: number},
): Camera => {
  const rest: Camera = {scale: 1, originX: viewport.width / 2, originY: viewport.height / 2};
  // index of the last focus at or before tMs (-1 if before all focuses)
  let i = -1;
  while (i + 1 < focusList.length && focusList[i + 1].t <= tMs) i++;
  if (i < 0) return rest;

  const target = focusCamera(focusList[i], viewport);
  const from = i === 0 ? rest : focusCamera(focusList[i - 1], viewport);
  const p = easeInOutCubic(Math.min((tMs - focusList[i].t) / TRANSITION_MS, 1));
  return {
    scale: from.scale + (target.scale - from.scale) * p,
    originX: from.originX + (target.originX - from.originX) * p,
    originY: from.originY + (target.originY - from.originY) * p,
  };
};
