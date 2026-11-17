/**
 * Silkframe — shared frame loop.
 * One requestAnimationFrame drives every effect so frames stay in lock-step
 * and the loop sleeps entirely when nothing is animating.
 * Callbacks receive (now, dt) where dt is milliseconds, clamped so that a
 * backgrounded tab resumes gracefully instead of teleporting.
 *
 * Capture mode: setManualClock(true) detaches the loop from the display and
 * advance(ms, fps) steps every effect deterministically — use it to render
 * frame-perfect video exports or visual regression snapshots.
 */

const subs = new Set();
let raf = 0;
let last = 0;
let manual = false;
let virtualNow = 0;

function loop(now) {
  const dt = Math.min(Math.max(now - last, 0), 50);
  last = now;
  subs.forEach((fn) => fn(now, dt));
  raf = subs.size && !manual ? requestAnimationFrame(loop) : 0;
}

/** Subscribe to the frame loop. Returns an unsubscribe function. */
export function tick(fn) {
  subs.add(fn);
  if (!raf && !manual) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  return () => subs.delete(fn);
}

/** Resolve on the next animation frame. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Promise-based delay that cooperates with the frame loop (and capture mode). */
export function wait(ms) {
  return new Promise((resolve) => {
    let t = 0;
    const off = tick((_, dt) => {
      t += dt;
      if (t >= ms) { off(); resolve(); }
    });
  });
}

/** Detach from (or re-attach to) the display's refresh. */
export function setManualClock(on) {
  manual = !!on;
  if (manual && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else if (!manual && subs.size && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  virtualNow = performance.now();
}

/** Step every subscriber by `ms`, in fixed increments of 1000/fps. */
export function advance(ms, fps = 60) {
  const step = 1000 / fps;
  for (let t = 0; t < ms - 1e-6; t += step) {
    const dt = Math.min(step, ms - t);
    virtualNow += dt;
    subs.forEach((fn) => fn(virtualNow, dt));
  }
}

export const isManualClock = () => manual;
