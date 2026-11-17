// Filmstrip of one demo at chosen timestamps (frozen clock, headless browser).
//
//   node tests/film.mjs <demo-id> 0,200,400,800 [--clip x,y,w,h] [--cols 2] [--width 600]
//        [--size 1280x800] [--out dir] [--pre "js to eval after mount"] [--at "t:js;t:js"]
//
// Prints the path of the stitched sheet.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const clip = flag('clip', null);
const cols = flag('cols', '2');
const width = flag('width', '600');
const size = flag('size', '1280x800');
const out = flag('out', process.env.SF_SHOTS || join(tmpdir(), 'sf-shots'));
const pre = flag('pre', null);
const at = flag('at', '');
const [id, timesArg = '0,300,800,1600'] = argv;
const [W, H] = size.split('x').map(Number);
const times = timesArg.split(',').map(Number);
const actions = Object.fromEntries(
  at.split(';').filter(Boolean).map((p) => {
    const k = p.indexOf(':');
    return [Number(p.slice(0, k)), p.slice(k + 1)];
  })
);
mkdirSync(out, { recursive: true });

const steps = [
  { goto: `http://localhost:4173/view.html?fx=${id}` },
  { wait: 1200 },
  { eval: `__view.frame('${id}', 0)` },
];
if (pre) steps.push({ eval: pre });
let t = 0;
const shots = [];
for (const target of times) {
  for (const k of Object.keys(actions).map(Number).sort((a, b) => a - b)) {
    if (k > t && k <= target) {
      steps.push({ eval: `__view.step(${k - t})` });
      steps.push({ eval: actions[k] });
      t = k;
    }
  }
  if (target > t) steps.push({ eval: `__view.step(${target - t})` });
  t = Math.max(t, target);
  const name = `${id}-${String(target).padStart(5, '0')}.png`;
  const shot = { shot: name };
  if (clip) shot.clip = clip.split(',').map(Number);
  steps.push(shot);
  shots.push(join(out, name));
}
const planPath = join(out, `${id}-plan.json`);
writeFileSync(planPath, JSON.stringify({ width: W, height: H, out, steps }, null, 1));
const cap = spawnSync('node', [join(here, 'capture.mjs'), planPath], { encoding: 'utf8' });
const log = (cap.stdout || '') + (cap.stderr || '');
const issues = log.split('\n').filter((l) => /exception|error|console\.(error|warn)/i.test(l));
if (issues.length) console.log(issues.join('\n'));
const sheet = join(out, `sheet-${id}.png`);
const py = spawnSync('python', [join(here, 'sheet.py'), sheet, ...shots, '--cols', cols, '--width', width], { encoding: 'utf8' });
if (py.status !== 0) console.log(py.stderr);
console.log(sheet);
