import {Easing, interpolate, spring} from 'remotion';
import type {Brand} from './brand';

// The single place brand "motion personality" math lives. Templates route their
// entrance choreography (springs, eased reveals, inter-element stagger) through
// these helpers passing `brand.motion`, so one knob per brand retunes the FEEL of
// every animation without ever moving a rest position.
//
// Design invariants (see motion.test.ts):
//   - f(0) == 0 and every helper settles to 1 (rest positions never change).
//   - exuberance 0  -> overdamped, NO overshoot (mechanical).
//   - exuberance 1  -> underdamped, visible overshoot (bouncy).
//   - tempo 2       -> an entrance completes in half the frames.

export type Motion = Brand['motion'];

// Mirrors the zod defaults in brand.ts; exported so tests and the few pure callers
// that need a baseline don't re-declare the numbers.
export const DEFAULT_MOTION: Motion = {
  tempo: 1,
  exuberance: 0.35,
  stagger: 0.5,
  overshoot: 0.25,
  parallax: 0,
  settle: 0,
  textReveal: 'spring',
};

// Stiffness/mass are held at Remotion's legacy spring defaults (what every
// `spring({config:{damping:200}})` call in the repo already used); personality
// rides entirely on the damping RATIO, so the natural frequency and the rest
// point stay familiar and only the bounce/settle character changes.
const STIFFNESS = 100;
const MASS = 1;
const CRITICAL = 2 * Math.sqrt(STIFFNESS * MASS); // damping at zeta == 1  (= 20)

// exuberance 0 -> overdamped (zeta > 1, no overshoot); exuberance 1 -> underdamped
// (zeta < 1, bounce). Log-lerp between the two keeps the sweep smooth and crosses
// critical (zeta == 1) around exuberance ~0.55, so the low/default band stays
// bounce-free (matching the prior damping:200 feel) and overshoot only emerges as a
// brand deliberately dials exuberance up. `overshoot` nudges the ratio lower still,
// trimming or extending how far a lively entrance travels past its rest point.
const ZETA_STIFF = 4; // damping ratio at exuberance 0
const ZETA_LOOSE = 0.3; // damping ratio at exuberance 1

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const dampingRatio = (exuberance: number, overshoot: number): number => {
  const e = clamp01(exuberance);
  const base = Math.pow(ZETA_STIFF, 1 - e) * Math.pow(ZETA_LOOSE, e);
  return base * (1 - 0.35 * clamp01(overshoot));
};

/**
 * Brand-tuned entrance spring. Drop-in for `spring({frame, fps, config})`: returns
 * 0 at its start frame and settles to 1, overshooting past 1 when the brand is
 * exuberant. `tempo` scales evolution speed; `delayFrames` shifts the start.
 */
export const brandSpring = (
  frame: number,
  fps: number,
  motion: Motion,
  opts: {delayFrames?: number} = {},
): number => {
  const {delayFrames = 0} = opts;
  const zeta = dampingRatio(motion.exuberance, motion.overshoot);
  return spring({
    frame: (frame - delayFrames) * motion.tempo,
    fps,
    config: {damping: zeta * CRITICAL, stiffness: STIFFNESS, mass: MASS},
  });
};

/**
 * Tempo-scaled eased progress 0..1 for interpolate-style reveals (kickers, CTAs).
 * At tempo 1 it reproduces `interpolate(frame - delayFrames, [0, durFrames], ...)`;
 * tempo 2 reaches 1 in half the real frames. `fps` is part of the shared helper
 * signature for symmetry with brandSpring even though the eased ramp is fps-free.
 */
export const entrance = (
  frame: number,
  fps: number,
  motion: Motion,
  opts: {delayFrames?: number; durFrames: number; easing?: (t: number) => number},
): number => {
  void fps;
  const {delayFrames = 0, durFrames, easing = Easing.linear} = opts;
  const local = (frame - delayFrames) * motion.tempo;
  return interpolate(local, [0, durFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
};

/**
 * Frame delay for the index-th element in a staggered group. `stagger` scales the
 * base gap; at the default (0.5) it is an identity multiplier, so existing
 * `i * baseFrames` cadence is preserved unchanged.
 */
export const staggerDelay = (index: number, baseFrames: number, motion: Motion): number =>
  index * baseFrames * (motion.stagger / DEFAULT_MOTION.stagger);
