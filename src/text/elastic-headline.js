/**
 * Elastic Headline
 * Type made of rubber. Grab any letter and pull: it stretches toward your
 * hand along the pull direction (volume preserved), its neighbours are
 * dragged along with an exponential falloff, and on release the whole word
 * snaps back with a wobbly, underdamped spring.
 *
 *   const fx = elasticHeadline('.title', { reach: 1.4 });
 *   fx.pull(3, 0, -80); fx.release();   // programmatic
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle('sf-elastic', `.sf-elastic .sf-char{cursor:grab;touch-action:none;will-change:transform}.sf-elastic.is-pulling .sf-char{cursor:grabbing}`);

const DEFAULTS = {
  reach: 1.3, // neighbour falloff (in glyphs)
  give: 0.55, // how much of the pull a glyph travels (rest becomes stretch)
  stretch: 0.9, // stretch amount per em pulled
  stiffness: 260,
  damping: 8.5, // low → wobbly snap-back
};

export function elasticHeadline(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-elastic');
  const parts = split(el, { chars: true, words: true });
  const cfg = { stiffness: o.stiffness, damping: o.damping, precision: 0.02 };
  const glyphs = parts.chars.map((node, i) => ({ node, i, x: new Spring(0, cfg), y: new Spring(0, cfg) }));
  let fs = parseFloat(getComputedStyle(el).fontSize);
  let grab = null; // { i, x0, y0, dx, dy }
  let off = null;

  function apply() {
    for (const g of glyphs) {
      const dx = g.x.value, dy = g.y.value;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) { if (g.node.style.transform) g.node.style.transform = ''; continue; }
      // Stretch along the pull vector, squeeze across it (area preserved).
      const s = 1 + (d / fs) * o.stretch;
      const q = 1 / Math.sqrt(s);
      const c = dx / d, sn = dy / d;
      // M = R(θ)·diag(s, q)·R(−θ)
      const a = c * c * s + sn * sn * q;
      const b = c * sn * (s - q);
      const dd = sn * sn * s + c * c * q;
      g.node.style.transform = `translate3d(${(dx * o.give).toFixed(2)}px, ${(dy * o.give).toFixed(2)}px, 0) matrix(${a.toFixed(4)}, ${b.toFixed(4)}, ${b.toFixed(4)}, ${dd.toFixed(4)}, 0, 0)`;
    }
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = !!grab;
    for (const g of glyphs) {
      if (grab) {
        const k = Math.exp(-Math.abs(g.i - grab.i) / o.reach);
        g.x.to(grab.dx * k);
        g.y.to(grab.dy * k);
      } else {
        g.x.to(0);
        g.y.to(0);
      }
      g.x.step(s); g.y.step(s);
      if (!g.x.resting || !g.y.resting) busy = true;
    }
    apply();
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function pull(i, dx, dy) {
    const lim = fs * 2.2;
    const d = Math.hypot(dx, dy);
    // Resistance grows as you pull — rubber, not putty.
    const k = d > 0 ? (lim * Math.tanh(d / lim)) / d : 0;
    grab = { i, dx: dx * k, dy: dy * k };
    el.classList.add('is-pulling');
    wake();
  }
  function release() {
    grab = null;
    el.classList.remove('is-pulling');
    wake();
  }

  let start = null;
  const onDown = (e) => {
    const node = e.target.closest('.sf-char');
    const g = node && glyphs.find((x) => x.node === node);
    if (!g) return;
    fs = parseFloat(getComputedStyle(el).fontSize);
    start = { i: g.i, x: e.clientX, y: e.clientY };
    el.setPointerCapture?.(e.pointerId);
    pull(g.i, 0, 0);
  };
  const onMove = (e) => { if (start) pull(start.i, e.clientX - start.x, e.clientY - start.y); };
  const onUp = () => { if (start) { start = null; release(); } };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  return {
    el,
    pull,
    release,
    get count() { return glyphs.length; },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('sf-elastic', 'is-pulling');
      parts.revert();
    },
  };
}

export default elasticHeadline;
