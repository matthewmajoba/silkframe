// Real-time frame-time profile of demos in headless Chrome/Edge.
//   node tests/perf.mjs id1,id2 [ms=4000]
// Reports mean / p95 / worst frame interval and the share of frames over 20ms.
// Headless rendering is CPU-composited, so treat numbers as relative.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const ids = (process.argv[2] || '').split(',').filter(Boolean);
const ms = Number(process.argv[3] || 4000);
const out = join(tmpdir(), 'sf-perf');
mkdirSync(out, { recursive: true });
const probe = `new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  const f = (now) => { d.push(now - last); last = now; if (now - t0 < ${ms}) requestAnimationFrame(f); else {
    d.shift(); d.sort((a, b) => a - b);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    res({ frames: d.length, mean: +mean.toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), worst: +d[d.length - 1].toFixed(2), over20: +(d.filter((x) => x > 20).length / d.length * 100).toFixed(1) });
  } };
  requestAnimationFrame(f);
})`;
const steps = [];
for (const id of ids) {
  steps.push({ goto: `http://localhost:4180/view.html?fx=${id}` }, { wait: 900 }, { eval: probe });
}
const planPath = join(out, 'perf-plan.json');
writeFileSync(planPath, JSON.stringify({ width: 1280, height: 800, out, steps }));
const r = spawnSync('node', [join(here, 'capture.mjs'), planPath], { encoding: 'utf8', timeout: 600000 });
const results = [...(r.stdout || '').matchAll(/eval → (\{.*\})/g)].map((m) => JSON.parse(m[1]));
ids.forEach((id, i) => {
  const s = results[i];
  if (!s) return console.log(`${id.padEnd(22)} (no result)`);
  console.log(`${id.padEnd(22)} mean ${String(s.mean).padStart(6)}ms  p95 ${String(s.p95).padStart(6)}ms  worst ${String(s.worst).padStart(7)}ms  >20ms ${String(s.over20).padStart(5)}%  (${s.frames} frames)`);
});
