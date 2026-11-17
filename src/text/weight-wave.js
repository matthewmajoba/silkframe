/**
 * Weight Wave
 * Drives variable-font axes per glyph. With no pointer, a slow swell rolls
 * through the line like light across embossed type; when the pointer
 * arrives the swell smoothly hands over to a lens that follows it.
 * Requires a variable font (e.g. Fraunces, Inter, Roboto Flex).
 *
 *   weightWave('.title', { axes: { wght: [200, 900], opsz: [9, 144] } });
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { resolve, debounce, prefersReducedMotion } from '../core/utils.js';

const DEFAULTS = {
  axes: { wght: [180, 900] },
  radius: 0.22, // pointer lens width as a fraction of element width
  wavelength: 0.55, // idle swell width (fraction of element width)
  speed: 0.32, // idle swell speed (cycles/second)
  sharpness: 2.2, // falloff exponent
};

export function weightWave(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const parts = split(el, { chars: true, words: true });
  const axes = Object.entries(o.axes);
  const glyphs = parts.chars.map((node) => ({ node, x: 0, value: new Spring(0, { stiffness: 140, damping: 20, precision: 0.001 }), last: '' }));
  const presence = new Spring(0, { stiffness: 60, damping: 16, precision: 0.001 });
  const px = new Spring(0.5, { stiffness: 110, damping: 20, precision: 0.0005 });
  let width = 1;
  let t = 0;
  let off = null;

  function measure() {
    const base = el.getBoundingClientRect();
    width = base.width || 1;
    glyphs.forEach((g) => {
      const r = g.node.getBoundingClientRect();
      g.x = (r.left + r.width / 2 - base.left) / width;
    });
  }
  measure();

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    presence.step(s);
    px.step(s);
    const p = presence.value;
    for (const g of glyphs) {
      // Idle swell: travelling raised-cosine pulse.
      const phase = (g.x / o.wavelength - t * o.speed) % 1;
      const wrapped = phase < 0 ? phase + 1 : phase;
      const swell = Math.pow(0.5 + 0.5 * Math.cos(wrapped * Math.PI * 2), o.sharpness * 1.4);
      // Pointer lens: gaussian around the pointer.
      const d = (g.x - px.value) / o.radius;
      const lens = Math.exp(-d * d * o.sharpness);
      g.value.to(swell * (1 - p) + lens * p);
      g.value.step(s);
      const v = Math.max(0, Math.min(1, g.value.value));
      const settings = axes
        .map(([axis, [lo, hi]]) => `'${axis}' ${(lo + (hi - lo) * v).toFixed(1)}`)
        .join(', ');
      if (settings !== g.last) {
        g.node.style.fontVariationSettings = settings;
        g.last = settings;
      }
    }
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const inside = e.clientX > r.left - 60 && e.clientX < r.right + 60 && e.clientY > r.top - 80 && e.clientY < r.bottom + 80;
    presence.to(inside ? 1 : 0);
    if (inside) px.to((e.clientX - r.left) / Math.max(r.width, 1));
  };
  const onLeave = () => presence.to(0);
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  const remeasure = debounce(measure, 150);
  const ro = new ResizeObserver(remeasure);
  ro.observe(el);

  function play() {
    if (!off && !prefersReducedMotion()) off = tick(frame);
    return Promise.resolve(true);
  }
  function pause() { if (off) off(); off = null; }

  return {
    el,
    play,
    pause,
    destroy() {
      pause();
      remeasure.cancel();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      parts.revert();
    },
  };
}

export default weightWave;
