# Magnetic Wrap Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 2 of the Magnetic integration: a "Marketing Handoff" export in Magnetic (MP4 + SRT/VTT + segments.json from `clip:` markers) and a WrapClip pipeline in the animations studio that turns each segment into branded social clips, validated by a DashClaw walkthrough round-trip.

**Architecture:** Contract-first. Task 1 pins the segments.json contract and SRT cue tooling in the animations repo with inline-string tests, so Tasks 2–4 (WrapClip comp, props builder, matrix/postkit fan-out) build against fixtures before Magnetic changes. Tasks 5–7 implement Magnetic's export (pure `deriveSegments` → dialog/IPC → E2E). Task 8 runs the pilot round-trip.

**Tech Stack:** Remotion 4 + zod (studio/), plain-node builder scripts with `node --test` (scripts/), Electron + zod IPC + Playwright `_electron` (final-cut-pro).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-magnetic-wrap-pipeline-design.md` — the segments.json contract and marker convention there are verbatim law: `{version: 1, video, captions, fps, exportedAt, segments: [{id, title, startSec, endSec}]}`; marker named `clip: <title>` starts a segment; ends at first of next `end` marker / next `clip:` marker / start+90s / sequence end; invisible markers excluded; zero `clip:` markers disables the export option in the dialog with a hint.
- All segment times are in the exported video's own timeline (post-Rough-Cut). No timecode remapping anywhere downstream.
- Animations repo rules: builders own generated props (lint-copy gates every emitted props file); comps do no file I/O (captions arrive as cue objects in props); every comp registers with nullable/placeholder defaults so `node scripts/smoke.mjs` stays green on a clean clone; budgets hard-gate.
- final-cut-pro rules: every IPC handler zod-validates; follow DESIGN.md tokens and dialog patterns; commit messages use that repo's `Prefix: sentence` style; run `npm run typecheck && npm run lint && npm test` there before claiming done.
- Magnetic timeline kernel is NOT modified (markers stay point markers; parsing lives in the export layer).
- Commits: animations-repo work commits here on a feature branch; final-cut-pro work commits there on main (its convention).

---

### Task 1: Wrap contract library (animations repo)

**Files:**
- Create: `scripts/lib/wrap-contract.mjs`
- Test: `scripts/lib/wrap-contract.test.mjs` (run via `node --test scripts/lib/wrap-contract.test.mjs`, same convention as `scripts/build-magnetic-demo-media.test.mjs`)

**Interfaces:**
- Produces (exact exports Tasks 3 uses):
  - `validateManifest(json) -> manifest` — throws with a field-naming message on any violation of the contract above (version !== 1, missing fields, non-finite/negative times, endSec <= startSec, duplicate ids)
  - `parseSrt(text) -> [{startSec, endSec, text}]` — parses SRT cue blocks; tolerates \r\n; joins multi-line cue text with a space
  - `windowCues(cues, startSec, endSec) -> [{startSec, endSec, text}]` — cues overlapping the window, clamped to it, times re-based so the window starts at 0

- [ ] **Step 1: Write the failing tests** — cover: a valid manifest passes and is returned; version 2 throws naming `version`; endSec <= startSec throws naming the segment id; duplicate segment ids throw; `parseSrt` on a 3-cue inline string (with \r\n and a two-line cue) yields exact cue objects; `windowCues` clamps a cue straddling the window edge and re-bases times (cue 10–14s windowed 12–20s → {0, 2}); a cue outside the window is dropped.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManifest, parseSrt, windowCues} from './wrap-contract.mjs';

const good = {version: 1, video: 'video.mp4', captions: 'captions.srt', fps: 30,
  exportedAt: '2026-07-12T20:00:00Z',
  segments: [{id: 'guard', title: 'Guard decisions', startSec: 12.5, endSec: 41}]};

test('valid manifest passes', () => { assert.deepEqual(validateManifest(good), good); });
test('wrong version throws naming version', () => {
  assert.throws(() => validateManifest({...good, version: 2}), /version/);
});
test('endSec <= startSec throws naming the segment id', () => {
  assert.throws(() => validateManifest({...good,
    segments: [{id: 'bad', title: 'x', startSec: 5, endSec: 5}]}), /bad/);
});
test('duplicate ids throw', () => {
  assert.throws(() => validateManifest({...good, segments: [
    {id: 'a', title: 'x', startSec: 0, endSec: 1},
    {id: 'a', title: 'y', startSec: 2, endSec: 3}]}), /duplicate/i);
});
test('parseSrt parses cues incl multi-line and CRLF', () => {
  const srt = '1\r\n00:00:10,000 --> 00:00:14,000\r\nhello\r\nworld\r\n\r\n2\r\n00:00:20,500 --> 00:00:21,000\r\nbye\r\n';
  assert.deepEqual(parseSrt(srt), [
    {startSec: 10, endSec: 14, text: 'hello world'},
    {startSec: 20.5, endSec: 21, text: 'bye'},
  ]);
});
test('windowCues clamps and re-bases', () => {
  const cues = [{startSec: 10, endSec: 14, text: 'a'}, {startSec: 30, endSec: 31, text: 'b'}];
  assert.deepEqual(windowCues(cues, 12, 20), [{startSec: 0, endSec: 2, text: 'a'}]);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test scripts/lib/wrap-contract.test.mjs` → FAIL (module not found).
- [ ] **Step 3: Implement `wrap-contract.mjs`** — plain node, no deps. `validateManifest` does explicit checks and throws `Error` with the offending field/id in the message; `parseSrt` splits blocks on blank lines, parses `HH:MM:SS,mmm --> HH:MM:SS,mmm`; `windowCues` filters `cue.endSec > startSec && cue.startSec < endSec`, clamps, subtracts `startSec`.
- [ ] **Step 4: Run to verify pass** — same command, all tests PASS, output pristine.
- [ ] **Step 5: Commit** — `git add scripts/lib/wrap-contract.mjs scripts/lib/wrap-contract.test.mjs && git commit -m "feat(wrap): segments.json contract lib — validate, parseSrt, windowCues"`

---

### Task 2: WrapClip composition (animations repo)

**Files:**
- Create: `studio/src/templates/WrapClip.tsx`
- Modify: `studio/src/Root.tsx` (register, pattern of the existing `<Composition id="ProductDemo" ...>` blocks with schema + nullable defaults + `calculateMetadata` for formatWidth/formatHeight)
- Modify: `scripts/smoke.mjs` ONLY if it enumerates compositions explicitly (probe it; if it discovers comps from Root, no change)

**Interfaces:**
- Consumes: `getBrand(brandId)`, `loadBrandFonts`, existing FloatBar/EndCard/FilmGrade components, `audioMix` ducking constants, `lib/motion.ts` springs (NO raw Easing.in / scale(0) / CSS transitions — judge-motion enforces).
- Produces: `wrapClipSchema` (zod, exported) with EXACTLY:

```ts
export const wrapClipSchema = z.object({
  brandId: z.string(),
  video: z.string().nullable(),            // staged under studio/public/<brand>/, null = placeholder slate
  segment: z.object({startSec: z.number(), endSec: z.number(), title: z.string()}).nullable(),
  captions: z.array(z.object({startSec: z.number(), endSec: z.number(), text: z.string()})),
  cta: z.string(),
  music: z.string().nullable(),            // optional bed, ducked under source audio
  formatWidth: z.number().optional(),
  formatHeight: z.number().optional(),
});
```

- [ ] **Step 1: Study the neighbors** — read `studio/src/templates/ProductDemo.tsx` end to end (OffthreadVideo usage, brand resolution, caption burn pattern, FilmGrade placement) and `SoundTrack.tsx`/`lib/audioMix.ts` (Html5Audio, ducking). WrapClip's structure mirrors ProductDemo's, not invented fresh.
- [ ] **Step 2: Implement WrapClip.tsx** — timeline: hook title card (brand textReveal preset, ~1.5s, segment.title) → source window (`<OffthreadVideo src={staticFile(video)} startFrom={Math.round(segment.startSec*fps)} endAt={Math.round(segment.endSec*fps)} />`, brightness(1.12) contrast(1.03) filter per capture convention) with burned caption cues (brand caption style, cue times offset by the title-card duration) and FloatBar progress → EndCard with cta. Music via the existing ducking helpers under the source's own audio. Null video/segment renders a brand-colored slate with the mark (smoke-safe). Duration via `calculateMetadata`: titleCard + (endSec-startSec) + endCard seconds at fps 30, from props.
- [ ] **Step 3: Register in Root.tsx** — schema + defaultProps `{brandId: 'dashclaw', video: null, segment: null, captions: [], cta: '', music: null}` + the same calculateMetadata width/height override the other comps use (plus the duration calc).
- [ ] **Step 4: Verify** — `cd studio && npm test` (suite green) and `npx remotion still WrapClip ../out/wrap-smoke.png --frame=10` renders the placeholder slate; LOOK at it. Then `node scripts/smoke.mjs` from root (add WrapClip to its comp list if Step 0 probe showed an explicit list) → green.
- [ ] **Step 5: Commit** — `git add studio/src/templates/WrapClip.tsx studio/src/Root.tsx scripts/smoke.mjs && git commit -m "feat(wrap): WrapClip composition — source window + brand chrome"`

---

### Task 3: build-wrap-props builder (animations repo)

**Files:**
- Create: `scripts/build-wrap-props.mjs`
- Test: `scripts/build-wrap-props.test.mjs` (pure helpers only)

**Interfaces:**
- Consumes: `validateManifest`, `parseSrt`, `windowCues` from `scripts/lib/wrap-contract.mjs` (Task 1); `wrapClipSchema` prop names (Task 2).
- Produces: CLI `node scripts/build-wrap-props.mjs <brand> <handoffDir>`:
  1. reads + validates `<handoffDir>/segments.json`; reads the SRT it names;
  2. copies `video.mp4` to `studio/public/<brand>/wrap-<basename(handoffDir)>.mp4` (staging, gitignored);
  3. reads `out/<brand>/marketing/brief.json` for `cta` (fail loudly if missing — copy must be brief-sourced);
  4. per segment emits `props/<brand>-wrap-<segmentId>.json` = `{brandId, video, segment, captions: windowCues(...), cta, music: null}`;
  5. runs nothing else — printing the emitted paths is the contract; exits non-zero on any failure.

- [ ] **Step 1: Failing tests for the pure parts** — extract and test `propsForSegment(manifest, cues, segment, brandId, videoRel, cta)` (returns the exact props object; caption cues windowed and offset-free — WrapClip handles the title-card offset) and `stagedVideoName(handoffDir)`.
- [ ] **Step 2: Verify fail, implement, verify pass** — `node --test scripts/build-wrap-props.test.mjs`.
- [ ] **Step 3: Wire the CLI** — argv validation with usage line; `isMain` guard so tests can import (same pattern as build-magnetic-demo-media.mjs); after emitting, run `node scripts/lint-copy.mjs` on EACH emitted props file in-process (spawn) and exit 1 if any fails — segment titles are copy and go through the gate.
- [ ] **Step 4: End-to-end check against a temp fixture** — script a throwaway handoff dir in the scratchpad (tiny manifest + 3-cue SRT + any small mp4, e.g. out/magnetic/demo-media/clip-c.mp4 copied in); run the CLI with brand dashclaw; assert emitted props parse against `wrapClipSchema` via a one-shot vitest run from studio/ (delete the temp test after; verify deletion).
- [ ] **Step 5: Commit** — `git add scripts/build-wrap-props.mjs scripts/build-wrap-props.test.mjs && git commit -m "feat(wrap): handoff ingest builder — segments.json -> WrapClip props"`

---

### Task 4: Matrix + postkit fan-out for WrapClip (animations repo)

**Files:**
- Modify: `scripts/render-matrix.mjs`, `scripts/platforms.json` (probe first: how LaunchVideo/SocialClip are declared — comp names, captioned-variant rules), `scripts/build-postkit.mjs` (+ its `build-postkit.test.mjs` if comp names are baked into tested logic)

**Interfaces:**
- Consumes: WrapClip comp id + props files `props/<brand>-wrap-<segmentId>.json` (Task 3).
- Produces: `node scripts/render-matrix.mjs <brand> --comp WrapClip --props <propsFile>` fans one segment to 16:9/9:16/1:1/4:5 (+ captioned variants for muted-autoplay rows, since caption cues exist in props) into `out/<brand>/matrix/wrap-<segmentId>/`; `build-postkit` packages those per-platform.

- [ ] **Step 1: Probe** — read `scripts/render-matrix.mjs` + `scripts/platforms.json` end to end; note exactly how a comp opts into the fan-out and how captioned variants are triggered; read `build-postkit.mjs` for per-comp assumptions. Record findings in the report BEFORE editing.
- [ ] **Step 2: Extend minimally** — follow the exact declaration pattern found (do not restructure); WrapClip's per-props invocation may need a `--props` passthrough if matrix currently assumes one props file per brand — if so, add the flag following the existing `--comp`/`--stills-only` flag style.
- [ ] **Step 3: Verify with the Task 3 fixture props** — run the matrix for one segment; check `node scripts/check-budgets.mjs <brand>` hard gate and `ls` the four aspect outputs; extract one 9:16 frame and LOOK (chrome scales, captions inside safe area).
- [ ] **Step 4: Run existing tests** — `node --test scripts/build-postkit.test.mjs` plus the full script-test set touched; `node scripts/smoke.mjs`.
- [ ] **Step 5: Commit** — `git add scripts/render-matrix.mjs scripts/platforms.json scripts/build-postkit.mjs scripts/build-postkit.test.mjs && git commit -m "feat(wrap): render-matrix + postkit fan-out for WrapClip segments"`

---

### Task 5: deriveSegments in Magnetic (final-cut-pro repo)

**Files:**
- Create: `C:\projects\final-cut-pro\src\shared\timeline\segments.ts`
- Test: `C:\projects\final-cut-pro\src\shared\timeline\segments.test.ts` (vitest, colocated like `markers.test.ts`)

**Interfaces:**
- Consumes: `Marker`/`VisibleMarker` model + the existing visible-marker projection in `src/shared/timeline/model.ts:168-260` (markers are POINT markers anchored in MEDIA time; the projection to sequence time already exists — study `markerIsVisible`/`VisibleMarker` and reuse, do not reimplement). `FLICKS_PER_SECOND = 705_600_000`.
- Produces: `deriveSegments(sequence: Sequence): Segment[]` where `Segment = {id: string; title: string; startSec: number; endSec: number}` — the exact objects serialized into segments.json (Task 6).

- [ ] **Step 1: Study** — read the markers section of `model.ts` and `markers.test.ts` for how tests construct sequences with markers (reuse their helpers/fixtures).
- [ ] **Step 2: Failing tests (TDD)** — cases: one `clip: Hook` marker + later `end` marker → one segment with exact seconds; two `clip:` markers with no `end` → first segment ends at second's start; `clip:` with nothing after → ends at min(start+90, sequence end); cap case (next marker 120s later → endSec = start+90); marker whose asset was removed (invisible) → excluded; non-`clip:` named markers ignored as starts; title slugging (`clip: Guard decisions!` → id `guard-decisions`) and duplicate-title collision → `-2` suffix; segments sorted by startSec.
- [ ] **Step 3: Verify FAIL, implement, verify PASS** — `npx vitest run src/shared/timeline/segments.test.ts`. Implementation: project visible markers to sequence seconds, filter names matching `/^clip:\s*(.+)$/i` (trimmed title; `end` matcher `/^end$/i`), walk sorted starts applying the four-way end rule, slugify (`lowercase, non-alnum → '-', collapse, trim '-'`), suffix collisions deterministically.
- [ ] **Step 4: Repo gates** — `npm run typecheck && npm run lint && npm test` in final-cut-pro.
- [ ] **Step 5: Commit (in final-cut-pro, its style)** — `git add src/shared/timeline/segments.ts src/shared/timeline/segments.test.ts && git commit -m "Marketing handoff: deriveSegments — clip: marker convention to segment list"`

---

### Task 6: Marketing Handoff export (final-cut-pro repo)

**Files:**
- Modify: `src/renderer/export/ExportDialog.tsx` (new option), `src/shared/ipc.ts` + `src/shared/channels.ts` (new channel + zod payload), `src/main/index.ts` (handler wiring — follow where the existing export handler is registered)
- Create: `src/main/export/marketing-handoff.ts`

**Interfaces:**
- Consumes: `deriveSegments` (Task 5); existing movie-export path incl. smart-render planner (`src/main/export/smart-render.ts` — probe its entry function and reuse the same call the normal export makes); existing SRT/VTT writers in `src/main/captions.ts` (probe exported functions and reuse).
- Produces: IPC `marketing-handoff-export` taking zod-validated `{destDir: string}` (plus whatever the existing export payload carries — mirror it); writes `<destDir>/{video.mp4, captions.srt, captions.vtt, segments.json}`; returns `{segments: number}` or a structured error. segments.json serialized EXACTLY per the Global Constraints contract, `fps` from the sequence settings, `exportedAt` ISO from the main process clock.

- [ ] **Step 1: Probe** — read ExportDialog.tsx fully (how the existing export option renders, progress, folder/file picker via main-process dialog), the export IPC round-trip in ipc.ts/channels.ts/main index, captions.ts exports, smart-render entry. Record the exact function names in the report before writing code.
- [ ] **Step 2: Implement main-process `marketing-handoff.ts`** — orchestrates: deriveSegments (reject with the zero-segments error if empty — the renderer disables the option, but the handler must also fail loud), movie export to `<destDir>/video.mp4` via the existing export/smart-render call, SRT+VTT via existing writers, then segments.json (`JSON.stringify(manifest, null, 2)`).
- [ ] **Step 3: Wire IPC + dialog UI** — new channel with zod payload; ExportDialog gains a "Marketing Handoff" choice: disabled with hint text "Add clip: markers to define segments" when `deriveSegments(sequence).length === 0` (renderer computes from its state — the kernel fn is shared code, importable in the renderer), destination folder picker, reuses the dialog's existing progress/cancel affordances for the movie-export stage. Match DESIGN.md control states; 11–13px type; no new colors.
- [ ] **Step 4: Verify manually rendered** — `npm run dev`, build a small sequence from fixtures, add `clip:` markers via the marker UI, run the export, open the folder: four files; spot-check segments.json math against the timeline ruler; captions.srt non-empty when a transcribed asset is on the timeline (acceptable to verify SRT wiring with the voiceover fixture from `npm run fixtures`).
- [ ] **Step 5: Repo gates + commit** — typecheck/lint/test; `git commit -m "Marketing handoff: one-click export — smart-render MP4 + sidecars + segments.json"`

---

### Task 7: Handoff E2E spec (final-cut-pro repo)

**Files:**
- Create: `e2e/marketing-handoff.spec.ts`

**Interfaces:**
- Consumes: the e2e launch/import pattern (`e2e/timeline.spec.ts` `launchApp`/`importFixtures` — `window.api.__test.importPaths`), marker creation (probe `src/shared/timeline/ops.ts` for the marker op and whether `window.api.__test` or the store exposes it; `markers.test.ts` and `TimelinePanel.tsx` show the paths), the new IPC from Task 6.
- Produces: a spec that builds a sequence (2 fixture clips), adds `clip: First look` + `end` markers, invokes the handoff export to a temp dir, and asserts: 4 files exist; segments.json parses; exactly one segment with `id: 'first-look'`; startSec/endSec match the marker positions within one frame; zero-marker case → handler rejects with the zero-segments error.

- [ ] **Step 1: Write the spec** (structure mirrors timeline.spec.ts: temp .mglib, launchApp, importFixtures, waitForTimeline).
- [ ] **Step 2: Run** — `npm run build && npx playwright test e2e/marketing-handoff.spec.ts` → PASS.
- [ ] **Step 3: Full suite sanity** — `npm test` + typecheck/lint still green.
- [ ] **Step 4: Commit** — `git commit -m "Marketing handoff: E2E round-trip spec"`

---

### Task 8: DashClaw pilot round-trip — USER GATES

**Files:**
- Create (staged only): `out/dashclaw/wrap/` renders + postkit; no repo files beyond possible `docs/PLAYBOOK.md` gotcha lines.

- [ ] **Step 1: USER GATE — recording choice.** Ask the user: record a narrated DashClaw walkthrough themselves (OBS, most authentic) or have it scripted (capture feeder drive of the DashClaw app + ElevenLabs VO, like phase 1). STOP until answered.
- [ ] **Step 2: Produce the recording** per the choice (if scripted: reuse `feeders/capture/record-dashclaw-demo.mjs` conventions; the recording should be 3–5 minutes with natural dead air so Rough Cut has work).
- [ ] **Step 3: Magnetic pass** — import, Rough Cut, drop 2–3 `clip:` markers on real moments, Marketing Handoff export. Scriptable via the `__test` bridge (Task 7 patterns) if the user doesn't want to drive it by hand; ask in the same Step 1 gate.
- [ ] **Step 4: Pipeline** — `node scripts/build-wrap-props.mjs dashclaw <handoffDir>` (lint gate), stills of one segment at act boundaries (LOOK), full `render-matrix` fan-out, `build-postkit`, `check-budgets` + judges (advisories verbatim in report).
- [ ] **Step 5: USER GATE — review.** Send the wrapped clips (one per segment, hero aspect) + a 9:16 sample to the user. Phase 2's definition of done is their approval. Record any PLAYBOOK-worthy gotchas discovered en route in `docs/PLAYBOOK.md` (same commit style as phase 1's additions).

---

## Execution notes

- Order: 1 → 2 → 3 → 4 (animations, all testable via fixtures) then 5 → 6 → 7 (Magnetic) then 8 (pilot). Tasks 2–4 never block on Magnetic.
- Two repos: animations work on a feature branch here; Magnetic work commits to its main per that repo's convention. The final whole-branch review covers BOTH diffs (two review packages).
- The contract lives in two places by design (scripts/lib/wrap-contract.mjs validation + Magnetic's serializer); Task 7's E2E asserting Task 1's exact shape is the drift guard.
