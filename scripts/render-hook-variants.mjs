// Tournament #24 — hook A/B: renders up to 3 headline variants of LaunchVideo's
// hook act ONLY (via Remotion's --frames range, from launchTiming.ts's hook act
// bounds) and builds a side-by-side review page. Full picture-lock A/B is Mission
// Control's job (radio + selectedVariant, mission-control.mjs) — this script's
// picker.html is a cheap first look before a run is even live.
//
// Headline source, first match wins:
//   1. --headlines '["a","b","c"]'
//   2. out/<brand>/marketing/brief.json: hook.headline + hook.altHeadlines
//   3. the brand's own launch-props headline alone (warns: A/B needs alternatives)
//
// Usage: node scripts/render-hook-variants.mjs <brand> [--headlines '["a","b"]']
// Outputs: out/<brand>/marketing/hooks/hook-<n>.mp4 + hook-<n>.jpg + picker.html
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {posterFor, registerVariants, renderTake} from './lib/takes.mjs';
import {resolveBaseProps} from './lib/matrix-props.mjs';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const brand = argv.find((a) => !a.startsWith('--'));
const headlinesIdx = argv.indexOf('--headlines');
const headlinesFlag = headlinesIdx >= 0 ? argv[headlinesIdx + 1] : null;

if (!brand) {
  console.error('usage: node scripts/render-hook-variants.mjs <brand> [--headlines \'["a","b"]\']');
  process.exit(1);
}

// resolveBaseProps exits the process with a clear error if props/<brand>-launch.json
// is missing (same guard render-matrix.mjs/extract-thumbs.mjs rely on).
const launchPath = resolveBaseProps(root, brand, 'LaunchVideo');
const launch = JSON.parse(readFileSync(launchPath, 'utf8'));

function resolveHeadlines() {
  if (headlinesFlag) {
    let parsed;
    try {
      parsed = JSON.parse(headlinesFlag);
    } catch {
      console.error('render-hook-variants: --headlines must be a JSON array of strings');
      process.exit(1);
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((h) => typeof h === 'string' && h.trim())) {
      console.error('render-hook-variants: --headlines must be a JSON array of non-empty strings');
      process.exit(1);
    }
    return {headlines: parsed.slice(0, 3), source: '--headlines flag'};
  }
  const briefPath = join(root, 'out', brand, 'marketing', 'brief.json');
  if (existsSync(briefPath)) {
    try {
      const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
      const headline = brief?.hook?.headline;
      const alts = Array.isArray(brief?.hook?.altHeadlines) ? brief.hook.altHeadlines : [];
      if (typeof headline === 'string' && headline.trim()) {
        const list = [headline, ...alts.filter((h) => typeof h === 'string' && h.trim())];
        return {headlines: list.slice(0, 3), source: `out/${brand}/marketing/brief.json`};
      }
    } catch {
      // malformed brief.json — fall through to the launch-props fallback below
    }
  }
  console.warn(
    'render-hook-variants: no --headlines and no usable brief.json hook.altHeadlines — ' +
      'falling back to the single launch-props headline; A/B needs at least one alternative.',
  );
  return {headlines: [launch.headline], source: 'props (single headline, no alternatives)'};
}

const {headlines, source} = resolveHeadlines();
console.log(`render-hook-variants: ${headlines.length} headline(s) from ${source}`);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function buildPickerHtml(brandId, rows) {
  const cards = rows
    .map(
      (r) => `
    <div class="card">
      <video controls preload="metadata" poster="${esc(r.posterRel)}" src="${esc(r.videoRel)}"></video>
      <div class="headline">${esc(r.headline)}</div>
    </div>`,
    )
    .join('');
  return `<!doctype html><meta charset="utf-8"><title>Hook A/B · ${esc(brandId)}</title>
<style>
:root{color-scheme:dark;}
*{box-sizing:border-box;}
body{margin:0;background:#0d0f12;color:#e6e8eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:32px;}
h1{font-size:18px;font-weight:650;margin:0 0 22px;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;max-width:1400px;margin:0 auto;}
.card{background:#14171b;border:1px solid #262b31;border-radius:12px;overflow:hidden;}
.card video{display:block;width:100%;background:#000;}
.headline{padding:14px 16px;font-size:14px;line-height:1.4;color:#c9d1d9;}
</style>
<h1>Hook A/B &mdash; ${esc(brandId)}</h1>
<div class="grid">${cards}</div>`;
}

async function main() {
  const timingMod = await import(new URL('../studio/src/lib/launchTiming.ts', import.meta.url));
  const timing = timingMod.launchTiming(launch.demo?.telemetry?.durationMs ?? null, (launch.features ?? []).length);
  const frames = `${timing.hook.from}-${timing.hook.from + timing.hook.len - 1}`;

  const outDir = join(root, 'out', brand, 'marketing', 'hooks');
  const variants = [];
  const rows = [];
  headlines.forEach((headline, i) => {
    const n = i + 1;
    const props = {...launch, headline, formatWidth: 1920, formatHeight: 1080};
    const outPath = join(outDir, `hook-${n}.mp4`);
    const {path, bytes} = renderTake({comp: 'LaunchVideo', outPath, props, frames});
    const posterPath = posterFor(outPath);
    const relPath = relative(root, path).replace(/\\/g, '/');
    const relPoster = relative(root, posterPath).replace(/\\/g, '/');
    variants.push({id: `hook-${n}`, path: relPath, label: headline});
    rows.push({headline, videoRel: `hook-${n}.mp4`, posterRel: `hook-${n}.jpg`});
    console.log(`render-hook-variants: hook-${n} -> ${relPath} (${bytes} bytes); poster ${relPoster}`);
  });

  const pickerPath = join(outDir, 'picker.html');
  writeFileSync(pickerPath, buildPickerHtml(brand, rows));
  console.log(`render-hook-variants: wrote ${relative(root, pickerPath).replace(/\\/g, '/')}`);

  const registered = registerVariants(brand, 'launch-video', variants);
  console.log(
    registered
      ? `render-hook-variants: registered ${variants.length} variant(s) on asset "launch-video" in run.json`
      : `render-hook-variants: no matching "launch-video" asset in run.json — skipped manifest registration`,
  );
}

main();
