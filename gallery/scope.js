import { tick } from '../src/core/ticker.js';

/**
 * Demo lifecycle scope — every timer, listener and effect a demo creates is
 * registered here so unmounting a stage leaves nothing running.
 */
export function createScope() {
  const cleanups = [];
  let alive = true;
  const scope = {
    get alive() {
      return alive;
    },
    add(fn) {
      cleanups.push(fn);
      return fn;
    },
    /** Register an effect controller; returns it. */
    use(fx) {
      cleanups.push(() => fx && fx.destroy && fx.destroy());
      return fx;
    },
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    },
    /** Frame-clock delay: pauses with the tab and stays exact in capture mode. */
    wait(ms) {
      return new Promise((resolve) => {
        let t = 0;
        const off = tick((_, dt) => {
          t += dt;
          if (t >= ms) { off(); resolve(); }
        });
        cleanups.push(off);
      });
    },
    interval(fn, ms) {
      const id = setInterval(() => alive && fn(), ms);
      cleanups.push(() => clearInterval(id));
      return id;
    },
    raf(fn) {
      let id = 0;
      const loop = (t) => {
        if (!alive) return;
        fn(t);
        id = requestAnimationFrame(loop);
      };
      id = requestAnimationFrame(loop);
      cleanups.push(() => cancelAnimationFrame(id));
    },
    /** Repeat an async sequence for as long as the stage is mounted. */
    async loop(fn) {
      while (alive) {
        try {
          await fn();
        } catch (err) {
          console.error(err);
          return;
        }
        if (!alive) return;
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
    destroy() {
      alive = false;
      while (cleanups.length) {
        try {
          cleanups.pop()();
        } catch (err) {
          console.error(err);
        }
      }
    },
  };
  return scope;
}

/**
 * Ghost pointer: drives an interactive demo along a Lissajous path until the
 * real pointer enters the stage, then hands control back to the visitor.
 */
export function ghostPointer(scope, stage, onPoint, onRelease, { speed = 1 } = {}) {
  let human = false;
  let idleTimer = 0;
  scope.on(stage, 'pointerenter', () => {
    human = true;
    clearTimeout(idleTimer);
    onRelease?.();
  });
  scope.on(stage, 'pointerleave', () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (human = false), 1600);
  });
  scope.add(() => clearTimeout(idleTimer));
  const start = performance.now();
  scope.raf((now) => {
    if (human) return;
    const t = ((now - start) / 1000) * speed;
    const r = stage.getBoundingClientRect();
    const x = r.width * (0.5 + 0.36 * Math.sin(t * 0.9));
    const y = r.height * (0.5 + 0.22 * Math.sin(t * 1.7 + 0.6));
    onPoint(x, y, r);
  });
}
