// Headless frame capture over the Chrome DevTools Protocol — no dependencies.
//
//   node tests/capture.mjs plan.json
//
// plan.json: { "width": 1280, "height": 800, "out": "dir", "steps": [
//   { "goto": "http://localhost:4173/view.html?fx=ink-bloom" },
//   { "wait": 800 },
//   { "eval": "__sf.freeze()" },
//   { "shot": "ink-0.png", "clip": [x, y, w, h] }
// ] }
//
// Prints console output, exceptions and eval results as it goes.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const plan = JSON.parse(await readFile(process.argv[2], 'utf8'));
const out = resolve(plan.out || '.');
await mkdir(out, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 400);
const profile = join(tmpdir(), `sf-cdp-${port}`);

const exe = BROWSERS.find((b) => existsSync(b));
const proc = spawn(exe || BROWSERS[0], [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  `--window-size=${plan.width || 1280},${plan.height || 800}`,
  // SF_GPU=1 → hardware compositing (representative real-device timings)
  ...(process.env.SF_GPU ? ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-zero-copy'] : []),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
    if (target) break;
  } catch {}
  await sleep(150);
}
if (!target) { console.error('browser did not start'); proc.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method) {
    (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);

on('Runtime.consoleAPICalled', (p) => {
  const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
  console.log(`  [console.${p.type}] ${text}`);
});
on('Runtime.exceptionThrown', (p) => {
  console.log(`  [exception] ${p.exceptionDetails.exception?.description || p.exceptionDetails.text}`);
});

await send('Page.enable');
await send('Runtime.enable');
await send('Performance.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: plan.width || 1280, height: plan.height || 800, deviceScaleFactor: plan.dpr || 1, mobile: false,
});

for (const step of plan.steps) {
  if (step.goto) {
    const loaded = new Promise((r) => on('Page.loadEventFired', r));
    await send('Page.navigate', { url: step.goto });
    await loaded;
    console.log(`goto ${step.goto}`);
  }
  if (step.wait) await sleep(step.wait);
  if (step.eval) {
    const r = await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) console.log(`  eval error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    else if (r.result && r.result.value !== undefined) console.log(`  eval → ${JSON.stringify(r.result.value)}`);
  }
  if (step.metrics) {
    // Main-thread time breakdown (seconds, cumulative) — diff two snapshots.
    const { metrics } = await send('Performance.getMetrics');
    const pick = Object.fromEntries(metrics.filter((m) => ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'Frames'].includes(m.name)).map((m) => [m.name, +m.value.toFixed(4)]));
    console.log(`  metrics ${step.metrics} ${JSON.stringify(pick)}`);
  }
  if (step.shot) {
    const params = { format: 'png' };
    if (step.clip) params.clip = { x: step.clip[0], y: step.clip[1], width: step.clip[2], height: step.clip[3], scale: step.scale || 1 };
    const { data } = await send('Page.captureScreenshot', params);
    await writeFile(join(out, step.shot), Buffer.from(data, 'base64'));
    console.log(`  shot ${step.shot}`);
  }
}

ws.close();
proc.kill();
await sleep(300);
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(0);
