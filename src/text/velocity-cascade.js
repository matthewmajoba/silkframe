/**
 * Velocity Cascade
 * Glyphs drop in under real spring physics. Their velocity drives a
 * volume-preserving smear and a motion blur, so fast frames read like
 * film exposure and the landing settles with a tactile bounce.
 *
 *   const fx = velocityCascade('.headline', { order: 'center' });
 *   await fx.play();     // enter
 *   await fx.reverse();  // hop + gravity exit
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, resolve, prefersReducedMotion } from '../core/utils.js';

const DEFAULTS = {
  stagger: 34, // ms between glyphs
  distance: 1.15, // drop distance in em
  stiffness: 150,
  damping: 14,
  rotate: 16, // max starting tilt in degrees
  smear: 1, // 0 disables velocity stretch
  blur: 1, // 0 disables motion blur
  order: 'start', // 'start' | 'end' | 'center' | 'edges' | 'random'
  seed: 3,
};

export function velocityCascade(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const parts = split(el, { chars: true, words: true });
  const rand = mulberry32(o.seed);
  const n = parts.chars.length;

  const glyphs = parts.chars.map((node) => ({
    node,
    y: new Spring(0, { stiffness: o.stiffness, damping: o.damping, precision: 0.05 }),
    r: new Spring(0, { stiffness: o.stiffness * 0.7, damping: o.damping * 1.15, precision: 0.05 }),
    jitter: rand(),
    tilt: (rand() * 2 - 1) * o.rotate,
    spin: (rand() * 2 - 1) * 110,
    delay: 0,
    opacity: 1,
    started: false,
  }));

  let off = null;
  let settle = null;

  const rank = (i) => {
    switch (o.order) {
      case 'end': return n - 1 - i;
      case 'center': return Math.abs(i - (n - 1) / 2);
      case 'edges': return (n - 1) / 2 - Math.abs(i - (n - 1) / 2);
      case 'random': return rand() * n;
      default: return i;
    }
  };

  function render(g) {
    const v = g.y.velocity;
    const stretch = 1 + clamp(Math.abs(v) / 1500, 0, 0.75) * o.smear;
    const squeeze = 1 / Math.sqrt(stretch);
    g.node.style.transform =
      `translate3d(0, ${g.y.value.toFixed(2)}px, 0) rotate(${g.r.value.toFixed(2)}deg) scale(${squeeze.toFixed(3)}, ${stretch.toFixed(3)})`;
    g.node.style.opacity = g.opacity.toFixed(3);
    const b = clamp(Math.abs(v) / 900, 0, 3) * o.blur;
    g.node.style.filter = b > 0.2 ? `blur(${b.toFixed(2)}px)` : '';
  }

  function clean(g, hidden = false) {
    g.node.style.transform = hidden ? g.node.style.transform : '';
    g.node.style.filter = '';
    g.node.style.willChange = '';
    g.node.style.opacity = hidden ? '0' : '';
  }

  function stop() {
    if (off) off();
    off = null;
    if (settle) settle(false);
    settle = null;
  }

  function play() {
    stop();
    const D = parseFloat(getComputedStyle(el).fontSize) * o.distance;
    if (prefersReducedMotion()) {
      glyphs.forEach((g) => clean(g));
      return Promise.resolve(true);
    }
    glyphs.forEach((g, i) => {
      g.delay = rank(i) * o.stagger + g.jitter * o.stagger * 0.8;
      g.y.set(-D);
      g.r.set(g.tilt);
      g.opacity = 0;
      g.started = false;
      g.node.style.willChange = 'transform, opacity, filter';
      render(g);
    });
    return new Promise((done) => {
      settle = done;
      let elapsed = 0;
      off = tick((_, dt) => {
        elapsed += dt;
        const s = dt / 1000;
        let busy = false;
        for (const g of glyphs) {
          if (elapsed < g.delay) { busy = true; continue; }
          if (!g.started) {
            g.started = true;
            g.y.target = 0;
            g.y.velocity = D * 4;
            g.r.target = 0;
          }
          g.y.step(s);
          g.r.step(s);
          g.opacity = clamp((elapsed - g.delay) / 180);
          if (!g.y.resting || !g.r.resting || g.opacity < 1) {
            busy = true;
            render(g);
          } else if (g.node.style.willChange) {
            clean(g);
          }
        }
        if (!busy) {
          off(); off = null; settle = null;
          glyphs.forEach((g) => clean(g));
          done(true);
        }
      });
    });
  }

  /** Exit: each glyph hops, then falls away under gravity while fading. */
  function reverse() {
    stop();
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (prefersReducedMotion()) {
      glyphs.forEach((g) => clean(g, true));
      return Promise.resolve(true);
    }
    const gravity = fs * 46;
    glyphs.forEach((g, i) => {
      g.delay = rank(i) * o.stagger * 0.55 + g.jitter * o.stagger * 0.6;
      g.started = false;
      g.y.set(0);
      g.r.set(0);
      g.opacity = 1;
      g.node.style.willChange = 'transform, opacity, filter';
    });
    return new Promise((done) => {
      settle = done;
      let elapsed = 0;
      off = tick((_, dt) => {
        elapsed += dt;
        const s = Math.min(dt / 1000, 0.05);
        let busy = false;
        for (const g of glyphs) {
          if (elapsed < g.delay) { busy = true; continue; }
          if (!g.started) {
            g.started = true;
            g.y.velocity = -fs * (5 + g.jitter * 3);
          }
          if (g.opacity <= 0) continue;
          busy = true;
          g.y.velocity += gravity * s;
          g.y.value += g.y.velocity * s;
          g.r.value += g.spin * s;
          g.opacity = clamp(1 - (elapsed - g.delay - 120) / 420);
          render(g);
        }
        if (!busy) {
          off(); off = null; settle = null;
          glyphs.forEach((g) => clean(g, true));
          done(true);
        }
      });
    });
  }

  function destroy() {
    stop();
    parts.revert();
  }

  return { el, play, reverse, destroy, chars: parts.chars };
}

export default velocityCascade;
