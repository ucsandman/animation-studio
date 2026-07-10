// node --test scripts/judge-av-sync.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  FPS,
  VO_LEAD,
  voFrameLen,
  actFor,
  checkVoOverruns,
  checkVoLead,
  checkCaptionDwell,
  checkFeatureCoverage,
  checkUnknownActs,
} from './judge-av-sync.mjs';

// A hand-built timing table (no dependency on launchTiming.ts internals).
const timing = {
  logo: {from: 0, len: 150},
  hook: {from: 150, len: 186},
  demo: {from: 336, len: 200},
  features: [
    {from: 536, len: 180},
    {from: 716, len: 180},
  ],
  end: {from: 896, len: 150},
};

test('voFrameLen mirrors ceil(durationMs/1000*FPS)', () => {
  assert.equal(voFrameLen(1000), FPS);
  assert.equal(voFrameLen(1001), FPS + 1); // ceil rounds up
  assert.equal(voFrameLen(7970), 240);
});

test('actFor resolves named and feature-N acts, null for unknown', () => {
  assert.equal(actFor('logo', timing), timing.logo);
  assert.equal(actFor('feature-1', timing), timing.features[1]);
  assert.equal(actFor('feature-9', timing), null);
  assert.equal(actFor('bogus', timing), null);
});

test('checkVoOverruns: clean line produces no finding', () => {
  // logo act = 150f, available = 138f. 3000ms -> 90f < 138f.
  const findings = checkVoOverruns([{act: 'logo', durationMs: 3000, text: 'a b c'}], timing);
  assert.equal(findings.length, 0);
});

test('checkVoOverruns: overrun reports ms + words to cut', () => {
  // hook act = 186f, available = 174f. Need vf > 174 -> durationMs > 5800ms.
  // 8 words at 7000ms. vf = ceil(210) = 210. overrun = 210-174 = 36f = 1200ms.
  const line = {act: 'hook', durationMs: 7000, text: 'one two three four five six seven eight'};
  const findings = checkVoOverruns([line], timing);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.check, 'vo-overrun');
  assert.equal(f.level, 'FAIL');
  assert.equal(f.overrunMs, 1200);
  // msPerWord = 7000/8 = 875 -> ceil(1200/875) = 2 words.
  assert.equal(f.wordsToCut, 2);
  assert.match(f.message, /trim the copy/);
});

test('checkVoOverruns: exact fit (vf == available) is not an overrun', () => {
  // available for logo = 138f. durationMs that yields exactly 138f: 138/30*1000 = 4600ms.
  const findings = checkVoOverruns([{act: 'logo', durationMs: 4600, text: 'x y'}], timing);
  assert.equal(voFrameLen(4600), 138);
  assert.equal(findings.length, 0);
});

test('checkVoLead: act shorter than the lead-in fails', () => {
  const tiny = {...timing, logo: {from: 0, len: VO_LEAD}};
  const findings = checkVoLead([{act: 'logo', durationMs: 100, text: 'x'}], tiny);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].check, 'vo-lead');
});

test('checkCaptionDwell: flags steps closer than 700ms, ignores clicks/focus', () => {
  const events = [
    {type: 'step', t: 0, label: 'A'},
    {type: 'click', t: 100, x: 0, y: 0},
    {type: 'step', t: 500, label: 'B'}, // 500ms after A -> too fast
    {type: 'step', t: 1500, label: 'C'}, // 1000ms after B -> ok
  ];
  const findings = checkCaptionDwell(events);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].gapMs, 500);
  assert.equal(findings[0].from, 'A');
  assert.equal(findings[0].to, 'B');
});

test('checkCaptionDwell: all-spaced steps are clean', () => {
  const events = [
    {type: 'step', t: 0, label: 'A'},
    {type: 'step', t: 800, label: 'B'},
    {type: 'step', t: 1600, label: 'C'},
  ];
  assert.equal(checkCaptionDwell(events).length, 0);
});

test('checkFeatureCoverage: feature with copy but no VO line fails', () => {
  const features = [
    {heading: 'Guardrails', lines: ['a']},
    {heading: 'Ledger', lines: ['b']},
  ];
  const lines = [{act: 'feature-0', durationMs: 1000, text: 'x'}]; // feature-1 missing
  const findings = checkFeatureCoverage(features, lines);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].act, 'feature-1');
});

test('checkFeatureCoverage: full coverage is clean', () => {
  const features = [{heading: 'A', lines: ['x']}];
  const lines = [{act: 'feature-0', durationMs: 1000, text: 'x'}];
  assert.equal(checkFeatureCoverage(features, lines).length, 0);
});

test('checkUnknownActs: bad act reference is caught', () => {
  const findings = checkUnknownActs([{act: 'feature-99', durationMs: 1000, text: 'x'}], timing);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].check, 'unknown-act');
});
