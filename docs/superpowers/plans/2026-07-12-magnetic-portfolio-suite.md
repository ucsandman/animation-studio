# Magnetic Portfolio Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Magnetic (the video editor at `C:\projects\final-cut-pro`) a portfolio-ready identity: brand onboarding, a designed mark + app icon, studio-rendered demo footage, a recorded product demo, logo reveal, README GIF, and OG assets — all staged in `out/magnetic/`, handed off to the product repo only at the final gate.

**Architecture:** Standard brand-onboarding flow per `docs/PLAYBOOK.md` (brand JSON → mark registry → footage → renders), plus one new capture script that drives the built Magnetic app via Playwright `_electron` using its own E2E test bridge (`window.api.__test.importPaths`). All copy flows through brief.json → lint-copy → storyboard approval.

**Tech Stack:** Remotion 4 (studio/), Playwright (feeders/capture), Blender headless bpy (feeders/blender), ElevenLabs feeder (optional VO), png2icons via npx.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-magnetic-integration-design.md` (phase 1).
- **Stage-and-handoff:** NOTHING is written into `C:\projects\final-cut-pro` until Task 11's user gate — another Claude session works there. Launching its already-built app (`out/main/index.js`) read-only is allowed; running `npm run build` there is NOT (ask the user first if the build is missing/stale).
- Brand color rules (goes in `voice`, enforced by judges): `#0a84ff` blue is the ONLY accent (selected/active/focus); yellow `#ffd60a` = marks/keyframes only; green `#4ca47c` = audio waveforms only; red `#ff6961` = destructive only. No gradients, badges, emoji, or hype copy. `effects.wash` = 0, `grade.bloom` = 0 (nothing decorative — footage is the hero).
- Copy: agent-synthesized `out/magnetic/marketing/brief.json`, gated by `node scripts/lint-copy.mjs` and storyboard approval. Builders overlay brief copy; never hand-edit generated props JSON.
- Rendered proof: inspect stills at act boundaries BEFORE full renders; the user must see every final asset.
- Verification before "done": `node scripts/smoke.mjs`, `cd studio && npm test`, `node scripts/check-budgets.mjs magnetic`.
- User gates (stop and wait): Task 2 storyboard, Task 3 mark pick, Task 10 final assets + handoff go-ahead.
- All commits happen in `C:\Projects\animations` (this repo).

---

### Task 1: Brand onboarding — `brands/magnetic.json` + registry

**Files:**
- Create: `brands/magnetic.json`
- Modify: `studio/src/lib/brand.ts` (import + registry entry, lines 2–4 and 110)
- No fonts.ts change needed: `Inter` and `JetBrains Mono` loaders already exist in `studio/src/lib/fonts.ts`.

**Interfaces:**
- Produces: `getBrand('magnetic')` returns a valid `Brand`; every later task passes `brandId: 'magnetic'`.

- [ ] **Step 1: Write `brands/magnetic.json`**

```json
{
  "id": "magnetic",
  "name": "Magnetic",
  "tagline": "A magnetic-timeline video editor for Windows",
  "url": "github.com/ucsandman/magnetic",
  "colors": {
    "bg": "#161617",
    "surface": "#1d1d1f",
    "surface2": "#28282b",
    "line": "#3a3a3c",
    "ink": "#f5f5f7",
    "ink2": "#98989d",
    "ink3": "#6e6e73",
    "brand": "#0a84ff",
    "profit": "#ffd60a",
    "safe": "#4ca47c",
    "loss": "#ff6961",
    "info": "#0a6fe0",
    "rare": "#5e5ce6"
  },
  "fonts": {
    "display": "Inter",
    "body": "Inter",
    "mono": "JetBrains Mono"
  },
  "effects": {"wash": 0, "glow": 0.12},
  "grade": {"grain": 0.08, "vignette": 0.15, "bloom": 0, "aberration": 0, "letterbox": 0},
  "motion": {
    "tempo": 1,
    "exuberance": 0.05,
    "stagger": 0.3,
    "overshoot": 0,
    "parallax": 0.15,
    "settle": 0.1,
    "textReveal": "maskWipe"
  },
  "voice": "Finished Apple pro app: restrained, precise, quiet confidence. The footage is the hero; chrome recedes. Blue #0a84ff means selected/active/focus ONLY and is the single accent - never a decorative wash or glow. Yellow means marks/keyframes only. Green means audio waveforms only. Red means destructive/errors only. No gradients, no badges, no emoji, no hype. Dense, factual, keyboard-first."
}
```

Color provenance (from `C:\projects\final-cut-pro\DESIGN.md`): bg/surface/surface2/line are the app's chrome tokens; ink/ink2 are its text tokens; ink3 is Apple's tertiary-label gray (the app has no third text tier); brand/info are its accent + accent-fill; profit/safe/loss map the app's semantic yellow/green/red; rare is Apple system indigo (unused slot, schema requires it).

- [ ] **Step 2: Register in `studio/src/lib/brand.ts`**

Add after the `paperroute` import (line 4):

```ts
import magnetic from '../../../brands/magnetic.json';
```

Change the registry (line 110):

```ts
const registry: Record<string, unknown> = {noban, dashclaw, paperroute, magnetic};
```

- [ ] **Step 3: Verify schema + suite**

Run: `cd studio && npm test`
Expected: PASS (brand schema tests parse all registered brands; a schema violation in magnetic.json fails here).

- [ ] **Step 4: Commit**

```bash
git add brands/magnetic.json studio/src/lib/brand.ts
git commit -m "feat(brand): onboard magnetic (video editor) brand tokens"
```

---

### Task 2: Content brief + storyboard — USER GATE

**Files:**
- Create (generated): `out/magnetic/marketing/brief-inputs.json`, `out/magnetic/marketing/brief.json`, `out/magnetic/marketing/storyboard.html`

**Interfaces:**
- Produces: `brief.json` (zod: `studio/src/lib/brief.ts`) — headline/hook/CTA/proof-point copy that Tasks 8–9 builders overlay.

- [ ] **Step 1: Gather grounding**

Run: `node scripts/derive-brief.mjs magnetic C:\projects\final-cut-pro`
Expected: `out/magnetic/marketing/brief-inputs.json` written (README, package.json, docs; read-only on the product repo).

- [ ] **Step 2: Synthesize `brief.json`**

Agent-written against the `brief.ts` zod schema, grounded ONLY in brief-inputs.json facts. Positioning notes: portfolio audience (engineers, potential users); differentiators = magnetic timeline on Windows, long-form flat-memory playback (10.85 GB / 4.2 h clip at ~87 MB heap — sourced from README), Rough Cut ghost-diff, edit-by-transcript, MCP agent access with human Accept gate, smart-render export. Voice rules from Task 1 apply; no superlatives without a source.

- [ ] **Step 3: Lint gate**

Run: `node scripts/lint-copy.mjs out/magnetic/marketing/brief.json`
Expected: exit 0, no ERROR violations. Fix copy (not the linter) on failure.

- [ ] **Step 4: Storyboard + USER GATE**

Run: `node scripts/build-storyboard.mjs magnetic`
Send `out/magnetic/marketing/storyboard.html` to the user (SendUserFile). **STOP — do not render anything until the user approves the storyboard.**

- [ ] **Step 5: Commit** (brief synthesis notes only if any repo file changed; out/ is gitignored — if nothing tracked changed, skip the commit)

---

### Task 3: Mark concepts — USER GATE

**Files:**
- Create: `out/magnetic/marketing/mark-concepts.html` (staged, gitignored)

**Interfaces:**
- Produces: one approved SVG concept (geometry copied into Task 4's component).

- [ ] **Step 1: Build three concepts as inline SVG in one dark contact sheet**

All: 24×24 viewBox, stroke-based, `#0a84ff` on `#161617`, restrained enough for Apple pro-app iconography. Directions (refine freely, keep three distinct):

1. **Field lines** — two facing arcs (magnet pole field lines) whose gap implies an M; a small filled dot where they'd snap together.
2. **Snap** — a horizontal spine bar with one clip-rect above it, pulled in mid-snap; short motion ticks marking the magnetic pull (the timeline IS the brand).
3. **Monogram** — an M whose two outer strokes bow like field lines toward a center point, the apex a playhead notch.

`mark-concepts.html`: `#161617` page, each concept shown at 512 px, 64 px, and 24 px (icon, UI, favicon scale), labeled A/B/C, plus a row showing each inside a rounded-square app-icon tile.

- [ ] **Step 2: USER GATE — send the sheet, user picks**

SendUserFile `out/magnetic/marketing/mark-concepts.html`. **STOP until the user picks a concept (or requests iteration — iterate in this task).**

---

### Task 4: `MagneticMark.tsx` + registration + rendered proof

**Files:**
- Create: `studio/src/brands/MagneticMark.tsx`
- Modify: `studio/src/brands/marks.ts` (import + registry entry)

**Interfaces:**
- Consumes: approved SVG geometry from Task 3.
- Produces: `getMark('magnetic')` → `React.FC<{size: number; color: string}>` (used by every composition).

- [ ] **Step 1: Write the component** (pattern: `studio/src/brands/PaperRouteMark.tsx` — viewBox-normalized, `{size, color}` props, `currentColor` strokes, a short comment on the motif's provenance)

```tsx
import React from 'react';

/**
 * Magnetic's mark: [approved concept description]. Derives from the product's
 * one idea — clips snap magnetically to the timeline spine. Single-accent
 * discipline: the mark renders in whatever `color` the template passes.
 */
export const MagneticMark: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={{color}}>
    {/* approved concept geometry from Task 3 goes here, stroke="currentColor" */}
  </svg>
);
```

(The geometry block is the approved Task 3 SVG paths verbatim — Task 3's output is the source of truth; this component may not deviate from what the user approved.)

- [ ] **Step 2: Register in `studio/src/brands/marks.ts`**

```ts
import {MagneticMark} from './MagneticMark';
// in registry:
  magnetic: MagneticMark,
```

- [ ] **Step 3: Rendered proof**

Run: `cd studio && npx remotion still LogoReveal ../out/magnetic/proof-mark.png --props='{"brandId":"magnetic"}' --frame=45`
Inspect the PNG (Read tool): mark renders, blue on near-black, no wash. Then `node scripts/smoke.mjs` — all comps still green.

- [ ] **Step 4: Commit**

```bash
git add studio/src/brands/MagneticMark.tsx studio/src/brands/marks.ts
git commit -m "feat(brand): magnetic mark component"
```

---

### Task 5: App icon set (staged for handoff)

**Files:**
- Create: `scripts/build-magnetic-icon.mjs`
- Create (staged): `out/magnetic/handoff/icon.png` (512), `out/magnetic/handoff/icon@2x.png` (1024), `out/magnetic/handoff/icon.ico`, `out/magnetic/handoff/icon.icns`

**Interfaces:**
- Consumes: the approved SVG geometry (inline in the script — same source as Task 4).
- Produces: icon files Task 10's manifest maps to `final-cut-pro/resources/icon.png` and `build/icon.{ico,png,icns}`.

- [ ] **Step 1: Write `scripts/build-magnetic-icon.mjs`**

Node script, no new repo dependencies: writes a temp HTML file (approved mark SVG centered on a `#161617` rounded-square tile, macOS-style 22.5% corner radius), screenshots it at 512 and 1024 px with Playwright from `feeders/capture/node_modules` (`import {chromium} from 'playwright'` with that package root; `page.setViewportSize`, `omitBackground: true` for the transparent outside-corner pixels), then packs `icon.ico` + `icon.icns` via `npx png2icons out/magnetic/handoff/icon@2x.png out/magnetic/handoff/icon -allwe` (one-shot npx, not a dependency).

- [ ] **Step 2: Run + visual proof**

Run: `node scripts/build-magnetic-icon.mjs`
Read `out/magnetic/handoff/icon.png`: tile + mark crisp, corners transparent. Verify `icon.ico` and `icon.icns` exist and are non-trivially sized (`ls out/magnetic/handoff`).

- [ ] **Step 3: Commit**

```bash
git add scripts/build-magnetic-icon.mjs
git commit -m "feat(magnetic): app icon builder (staged handoff assets)"
```

---

### Task 6: Demo footage clips

**Files:**
- Create: `scripts/build-magnetic-demo-media.mjs`
- Create (staged): `out/magnetic/demo-media/clip-{a,b,c}.mp4`, `out/magnetic/demo-media/voiceover-take.mp4`

**Interfaces:**
- Produces: 4 H.264/yuv420p MP4s (Magnetic's WebCodecs path needs H.264) that Task 7 imports on camera: three cinematic silent clips + one speech clip with deliberate dead air (Rough Cut's demo subject).

- [ ] **Step 1: Probe the Blender scene's CLI**

Read the argparse block of `feeders/blender/scenes/background_loop.py` (flags, palette source). Run one single-frame proof first per PLAYBOOK: `python feeders/blender/render.py background_loop --out assets/magnetic/footage --frame 1`, inspect the PNG (colors from brand JSON if supported; otherwise pass the magnetic palette per the scene's actual flags).

- [ ] **Step 2: Render three clip variants + encode**

`--animation` renders PNG sequences (`frame_%04d.png`, 1-indexed); encode each via `cd studio && npx remotion ffmpeg -framerate 30 -i <seq> -c:v libx264 -pix_fmt yuv420p -movflags +faststart <out>.mp4`. Vary the three clips by the scene's available knobs (seed/phase/palette emphasis) so the filmstrip browser shows visibly distinct thumbnails.

- [ ] **Step 3: Build the speech clip**

VO via `node feeders/audio/client.mjs vo` (script text written for the ear, with two scripted 2–3 s pauses of dead air mid-take; exit 2 → fallback to Windows SAPI PowerShell TTS like Magnetic's own `scripts/make-fixtures.mjs` does). Mux over clip-a: `npx remotion ffmpeg -i clip-a.mp4 -i take.mp3 -c:v copy -c:a aac -shortest voiceover-take.mp4`.

- [ ] **Step 4: Wrap as builder script + commit**

All of the above lives in `scripts/build-magnetic-demo-media.mjs` (idempotent, consults `scripts/lib/cache.mjs` conventions where applicable). Run end-to-end once clean.

```bash
git add scripts/build-magnetic-demo-media.mjs
git commit -m "feat(magnetic): demo footage builder (blender clips + VO take)"
```

---

### Task 7: Record the Magnetic demo (Playwright `_electron`)

**Files:**
- Create: `feeders/capture/record-magnetic-demo.mjs`
- Create (staged): `assets/magnetic/demo/demo.webm`, `assets/magnetic/demo/telemetry.json`

**Interfaces:**
- Consumes: Task 6 MP4s; Magnetic's built app at `C:\projects\final-cut-pro\out\main\index.js` (READ-ONLY — do not build; if missing/stale, stop and ask the user).
- Produces: `demo.webm` + `telemetry.json` (`{steps: [{t, label}], clicks: [{t, x, y}], focus: [{t, rect}]}`, t relative to recording start — the contract `recorder.mjs`-based demos feed ProductDemo with).

- [ ] **Step 1: Probe the launch + test-bridge pattern**

Read `C:\projects\final-cut-pro\e2e\timeline.spec.ts` `launchApp()` (lines 28–35) for the exact `electron.launch` args/env (including whatever env gates `window.api.__test`). Copy it verbatim into the recording script, pointing `libraryPath` at a temp `.mglib`.

- [ ] **Step 2: Probe video capture**

Try `electron.launch({..., recordVideo: {dir, size: {width: 1920, height: 1080}}})` and check `page.video()`. If Electron recordVideo is unsupported in this Playwright version, fall back to ffmpeg screen capture: `npx remotion ffmpeg -f gdigrab -framerate 30 -i title="Magnetic" out.mkv` started/stopped around the scripted session. Record which path worked in the script's header comment.

- [ ] **Step 3: Script the edit session (the demo beats)**

Window 1920×1080. Import Task 6's four MP4s via `page.evaluate((p) => window.api.__test.importPaths(p), paths)`; wait for filmstrips (background jobs) before going on camera. Beats, ~8–10 s each, telemetry `steps[]` label per beat, `focus[]` rects on the region each beat happens in:
1. Filmstrip browser — hover-skim two clips.
2. `E` append three clips to the spine; playhead `L` plays.
3. `B` blade a clip; select + `Delete` ripples the gap shut (the magnetic moment — focus rect on the closing gap).
4. `Ctrl+T` cross dissolve at the nearest edit point.
5. Select the voiceover clip → Rough Cut → ghost-diff preview (red strikethrough + green strip) → Accept.
6. `Ctrl+E` export dialog open (don't run the export), 2 s hold, close.

Cursor movements via `page.mouse.move` easing into each click (~700 ms approach, per PLAYBOOK). Camera zooms are NOT baked in — they come from `focus[]` rects at composite time. Measure focus rects from extracted frames after the first take (`npx remotion ffmpeg -ss <t> -i demo.webm -frames:v 1 out.png`), never from click points.

- [ ] **Step 4: Record, verify first frame, stage**

Run the script; extract frame 1 and the frame at each step boundary; check: no dev-tools chrome, filmstrips painted, window fully in frame. Copy `demo.webm` + `telemetry.json` into `studio/public/magnetic/` (gitignored staging, `fetch-noban-assets.mjs` pattern — fold the copy into the recording script's last step).

- [ ] **Step 5: Commit**

```bash
git add feeders/capture/record-magnetic-demo.mjs
git commit -m "feat(magnetic): electron demo recording via e2e test bridge"
```

---

### Task 8: ProductDemo render

**Files:**
- Create: `scripts/build-magnetic-demo-props.mjs`
- Create (generated): `props/magnetic-demo.json`
- Create (staged): `out/magnetic/product-demo.mp4`

**Interfaces:**
- Consumes: `studio/public/magnetic/demo.webm` + telemetry; brief.json captions (builder overlays brief copy — captions never hand-written into props).
- Produces: the ~45–60 s demo video; Task 9's README GIF source.

- [ ] **Step 1: Write the props builder** (source of truth for `props/magnetic-demo.json`; pattern: `scripts/build-launch-props.mjs` — reads telemetry.json + brief.json, emits ProductDemo's schema with `brandId: 'magnetic'`)

- [ ] **Step 2: Lint + stills proof**

Run: `node scripts/build-magnetic-demo-props.mjs && node scripts/lint-copy.mjs props/magnetic-demo.json`
Then stills at each step boundary (`npx remotion still ProductDemo ... --frame=<act boundaries>`); inspect: zooms center MEASURED regions (scale/translate about default origin — `transformOrigin` pins, it does not center), captions readable, `brightness(1.12) contrast(1.03)` on the footage layer.

- [ ] **Step 3: Render + judges**

Run: `cd studio && npx remotion render ProductDemo ../out/magnetic/product-demo.mp4 --props=../props/magnetic-demo.json`
Then `node scripts/judge-demo-pacing.mjs` and `node scripts/judge-motion.mjs magnetic` — read verdicts; fix ERRORs, note advisories.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-magnetic-demo-props.mjs
git commit -m "feat(magnetic): product demo props builder + render"
```

---

### Task 9: Logo reveal, README GIF, OG statics

**Files:**
- Create: `scripts/render-magnetic-statics.mjs` (pattern: `scripts/render-dashclaw-statics.mjs`, shown below)
- Create (staged): `out/magnetic/logo-reveal.mp4`, `out/magnetic/readme.gif`, `out/magnetic/og-image.png`, `out/magnetic/github-social-preview.png`, `out/magnetic/og.mp4`

**Interfaces:**
- Consumes: magnetic brand + mark; brief.json tagline/CTA; Task 8's demo render (GIF source).

- [ ] **Step 1: Logo reveal**

Stills at act boundaries first, inspect; then:
`cd studio && npx remotion render LogoReveal ../out/magnetic/logo-reveal.mp4 --props='{"brandId":"magnetic"}'`

- [ ] **Step 2: Write + run `scripts/render-magnetic-statics.mjs`**

```js
// Magnetic OG statics: AnimatedOG crops + 8s loop. effects.wash is 0 (single-
// accent voice rule) so the flat near-black backdrop is the spec-compliant look.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'out', 'magnetic');
mkdirSync(outDir, {recursive: true});

const brief = JSON.parse(readFileSync(join(outDir, 'marketing', 'brief.json'), 'utf8'));
const props = {
  brandId: 'magnetic',
  tagline: brief.tagline ?? 'A magnetic-timeline video editor for Windows',
  cta: brief.cta ?? 'github.com/ucsandman/magnetic',
  heroImage: null,
  loopSequence: null,
  loopFrames: 1,
};
const propsPath = join(outDir, 'og-props.json');
writeFileSync(propsPath, JSON.stringify(props));
const studioDir = join(root, 'studio');
const still = (out, width, height) =>
  execSync(
    `npx remotion still AnimatedOG "${join(outDir, out)}" --props="${propsPath}" --width=${width} --height=${height}`,
    {cwd: studioDir, stdio: 'inherit'},
  );
still('og-image.png', 1200, 630);
still('github-social-preview.png', 1280, 640);
execSync(`npx remotion render AnimatedOG "${join(outDir, 'og.mp4')}" --props="${propsPath}"`, {
  cwd: studioDir,
  stdio: 'inherit',
});
console.log('statics OK');
```

(Adjust the brief field names to `studio/src/lib/brief.ts`'s actual schema when implementing — the builder reads brief.json, it does not hand-write copy.)

- [ ] **Step 3: README GIF**

From the demo render's strongest ~8 s (the blade/ripple beat): `npx remotion ffmpeg -ss <t> -t 8 -i out/magnetic/product-demo.mp4` trim, then GIF at half scale (GIFs are heavy; scale down for READMEs). Verify seam/size.

- [ ] **Step 4: Budgets + palette judge**

Run: `node scripts/check-budgets.mjs magnetic` (hard gate) and `node scripts/judge-palette.mjs magnetic` — no forbidden-color washes.

- [ ] **Step 5: Commit**

```bash
git add scripts/render-magnetic-statics.mjs
git commit -m "feat(magnetic): og statics + readme gif pipeline"
```

---

### Task 10: Verification sweep + handoff manifest — USER GATE

**Files:**
- Create (staged): `out/magnetic/handoff/MANIFEST.md`

- [ ] **Step 1: Full sweep**

Run: `node scripts/smoke.mjs && cd studio && npm test && npm run lint` (from repo root, adjust to the repo's actual lint entry). All green; read the output.

- [ ] **Step 2: Write `out/magnetic/handoff/MANIFEST.md`**

Table: staged file → destination in `C:\projects\final-cut-pro` → why. Rows: `icon.png`/`icon@2x.png` → `resources/icon.png` (+`build/icon.png`); `icon.ico` → `build/icon.ico`; `icon.icns` → `build/icon.icns`; `readme.gif` → `docs/screenshots/readme.gif` + README hero embed (patch snippet included in the manifest); `og-image.png`/`github-social-preview.png` → repo social preview (uploaded in GitHub settings — note, not a file copy); `product-demo.mp4`, `logo-reveal.mp4` → `docs/media/`.

- [ ] **Step 3: USER GATE — deliver everything**

SendUserFile: product-demo.mp4, logo-reveal.mp4, readme.gif, og-image.png, icon.png, MANIFEST.md. **STOP. Two approvals requested: (a) assets themselves, (b) go-ahead to execute the handoff — only valid once the user confirms the other Claude session in final-cut-pro is done or non-overlapping.**

---

### Task 11: Handoff execution (gated on Task 10 approval)

**Files:**
- Modify (in `C:\projects\final-cut-pro`, ONLY now): `resources/icon.png`, `build/icon.{ico,png,icns}`, `README.md` (hero GIF embed near the top), `docs/media/*` (new), `docs/screenshots/readme.gif` (new)

- [ ] **Step 1: Copy per MANIFEST.md** (exact copies of staged files; README edit is the minimal hero-GIF embed from the manifest's patch snippet)
- [ ] **Step 2: Verify in place** — README renders locally (view the raw markdown image paths resolve), icon files replace the Electron defaults (`Read` the new `resources/icon.png` to confirm it is the Magnetic mark).
- [ ] **Step 3: Leave the commit to the user/that repo's session** unless the user asks this session to commit there. Report what was copied.

---

## Execution notes

- Tasks 1→4 are strictly sequential (registry → gate → mark). Task 5 depends on 3; Task 6 is independent of 3–5; Task 7 needs 6; 8 needs 7 + 2; 9 needs 4 + 8 + 2; 10 needs all; 11 needs 10's gate.
- Subagent visual-tuning loops (Tasks 7–9) keep stills out of the main context per PLAYBOOK token discipline.
- Blender renders: single-frame proofs with alpha check before any `--animation` run.
