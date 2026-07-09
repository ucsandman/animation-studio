// Renders the AnimatedOG static-plus exports. If the ComfyUI hero exists it is
// staged and used; otherwise the procedural loop is the backdrop (documented
// fallback, logged below).
import {copyFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hero = join(root, 'assets', 'noban', 'comfy', 'hero.png');
const staged = join(root, 'studio', 'public', 'noban', 'hero.png');

let heroImage = null;
if (existsSync(hero)) {
  mkdirSync(dirname(staged), {recursive: true});
  copyFileSync(hero, staged);
  heroImage = 'noban/hero.png';
  console.log('using ComfyUI hero backdrop');
} else {
  console.log('comfy hero missing; procedural background fallback (documented). Run: node feeders/comfy/client.mjs hero');
}

const props = {
  brandId: 'noban',
  tagline: 'CS2 skin arbitrage with guardrails',
  cta: 'Simulate free at noban.gg',
  heroImage,
  loopSequence: 'noban/background-loop',
  loopFrames: 240,
};
const propsPath = join(root, 'out', 'noban', 'og-props.json');
mkdirSync(dirname(propsPath), {recursive: true});
writeFileSync(propsPath, JSON.stringify(props));

const render = (args, out) => {
  console.log(`render: ${out}`);
  execSync(`npx remotion render AnimatedOG "${join(root, 'out', 'noban', out)}" --props="${propsPath}" ${args}`, {
    cwd: join(root, 'studio'),
    stdio: 'inherit',
  });
};

render('', 'og.mp4');
render('--codec=gif --every-nth-frame=2', 'og.gif');
render('--codec=gif --every-nth-frame=2 --scale=0.5', 'readme.gif');
console.log('statics OK: og.mp4, og.gif, readme.gif in out/noban/');
