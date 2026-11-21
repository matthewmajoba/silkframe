/**
 * Art Loader — the shared engine behind the artist loaders.
 * A scene is a pair of canvas functions; the engine handles DPR, resize,
 * the frame loop, a spring-smoothed progress value (so jumpy network
 * progress still reads as fluid motion), an idle clock that keeps looping
 * while loading, and a completion phase that plays the scene's outro.
 *
 *   const l = bauhausGoya(container);
 *   l.progress(0.4);          // feed real progress…
 *   await l.complete();       // …then play the outro
 *   await l.run(3200);        // or simulate a lumpy load end-to-end
 *
 * Scene contract:
 *   { outro: ms, setup(state), draw(ctx, state) }
 *   state = { W, H, t (s), dt (s), p (0–1 smoothed), done (0–1 outro), rand, data }
 */
import { tick, wait } from '../../core/ticker.js';
import { Spring } from '../../core/spring.js';
import { mulberry32 } from '../../core/noise.js';
import { clamp, dpr, prefersReducedMotion } from '../../core/utils.js';
import { ensurePositioned } from '../../core/snapshot.js';

export function artLoader(container, scene, options = {}) {
  const o = { seed: 7, label: 'Loading', ...options };
  ensurePositioned(container);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'progressbar');
  canvas.setAttribute('aria-label', o.label);
  canvas.setAttribute('aria-valuemin', '0');
  canvas.setAttribute('aria-valuemax', '100');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const state = { W: 0, H: 0, t: 0, dt: 0, p: 0, done: 0, rand: mulberry32(o.seed), data: {} };
  const prog = new Spring(0, { stiffness: 38, damping: 13, precision: 0.0005 });
  let ratio = 1;
  let finishing = null;
  let finishT = 0;
  let off = null;

  function size() {
    ratio = dpr();
    state.W = container.clientWidth;
    state.H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(state.W * ratio));
    canvas.height = Math.max(1, Math.round(state.H * ratio));
    scene.resize?.(state);
  }
  size();
  scene.setup?.(state);
  const ro = new ResizeObserver(size);
  ro.observe(container);

  function frame(_, dtMs) {
    const dt = Math.min(dtMs / 1000, 1 / 20);
    state.dt = dt;
    state.t += dt;
    prog.step(dt);
    state.p = clamp(prog.value);
    if (finishing) {
      finishT += dtMs;
      state.done = clamp(finishT / (scene.outro || 1200));
      if (state.done >= 1 && !finishing.resolved) { finishing.resolved = true; finishing.resolve(true); }
    }
    canvas.setAttribute('aria-valuenow', String(Math.round(state.p * 100)));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    scene.draw(ctx, state);
  }
  off = tick(frame);

  function progress(p) {
    prog.to(clamp(p));
  }

  let completing = null;
  /** Let progress arrive at 100%, then play the scene's outro. */
  function complete() {
    if (completing) return completing;
    prog.to(1);
    completing = new Promise((resolve) => {
      const start = () => {
        if (prog.value > 0.985 || prefersReducedMotion()) {
          finishing = { resolve, resolved: false };
          finishT = 0;
        } else wait(50).then(start);
      };
      start();
    });
    return completing;
  }

  /** Simulated, organically uneven load; resolves after the outro. */
  async function run(ms = 3200) {
    const steps = [];
    let acc = 0;
    while (acc < 1) {
      acc = Math.min(1, acc + 0.06 + state.rand() * 0.22);
      steps.push(acc);
    }
    for (const v of steps) {
      progress(v);
      await wait((ms / steps.length) * (0.5 + state.rand()));
    }
    return complete();
  }

  function reset() {
    finishing = null;
    completing = null;
    finishT = 0;
    state.done = 0;
    state.t = 0;
    prog.set(0);
    state.p = 0;
    scene.setup?.(state);
  }

  return {
    el: canvas,
    progress,
    complete,
    run,
    reset,
    get value() { return state.p; },
    destroy() {
      off?.();
      ro.disconnect();
      canvas.remove();
    },
  };
}

/** A small pre-rendered film-grain tile for paint-like texture. */
export function grainTile(size = 160, seed = 3, contrast = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const r = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (r() - 0.5) * 255 * contrast;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export const ease = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  smooth: (x) => x * x * (3 - 2 * x),
  back: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
};
