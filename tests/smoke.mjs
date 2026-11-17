// Headless smoke test: mounts every demo on a frozen clock, steps 3s, reports errors.
//   node tests/smoke.mjs [id,id,...]
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(tmpdir(), 'sf-smoke');
mkdirSync(out, { recursive: true });
const only = process.argv[2] ? `?only=${process.argv[2]}` : '';
const plan = {
  width: 1280, height: 900, out,
  steps: [
    { goto: `http://localhost:4173/tests/smoke.html${only}` },
    { eval: 'new Promise(async (r) => { for (let i = 0; i < 400 && !window.__done; i++) await new Promise((q) => setTimeout(q, 250)); r(window.__done || ["timeout"]); })' },
  ],
};
const planPath = join(out, 'smoke-plan.json');
writeFileSync(planPath, JSON.stringify(plan));
const r = spawnSync('node', [join(here, 'capture.mjs'), planPath], { encoding: 'utf8', timeout: 180000 });
const m = (r.stdout || '').match(/eval → (\[.*\])/);
if (m) console.log(JSON.parse(m[1]).join('\n'));
else console.log(r.stdout, r.stderr);
