/**
 * Magnetic Field
 * Every glyph sits in a field around the pointer. Glyphs are pushed (or
 * pulled), tilted and scaled by a smooth falloff, each riding its own
 * spring so the line ripples like iron filings settling. A `--sf-heat`
 * custom property (0–1) is exposed per glyph for colour/weight styling.
 *
 *   magneticText('.title', { mode: 'repel', radius: 180 });
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { resolve, smoothstep, debounce } from '../core/utils.js';

const DEFAULTS = {
  radius: 170, // px
  strength: 0.38, // displacement in em at full influence
  mode: 'repel', // 'repel' | 'attract'
  rotate: 14, // degrees at full influence
  scale: 0.22,
  lift: 0.12, // extra upward push (em) for a buoyant feel
  stiffness: 180,
  damping: 15,
};

export function magneticText(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const parts = split(el, { chars: true, words: true });
  const cfg = { stiffness: o.stiffness, damping: o.damping, precision: 0.01 };
  const glyphs = parts.chars.map((node) => ({
    node,
    cx: 0,
    cy: 0,
    x: new Spring(0, cfg),
    y: new Spring(0, cfg),
    r: new Spring(0, cfg),
    s: new Spring(1, { ...cfg, precision: 0.0005 }),
    h: new Spring(0, { ...cfg, precision: 0.001 }),
  }));
  let fs = 16;
  const pointer = { x: 0, y: 0, active: false };
  let off = null;

  function measure() {
    fs = parseFloat(getComputedStyle(el).fontSize);
    const saved = glyphs.map((g) => g.node.style.transform);
    glyphs.forEach((g) => (g.node.style.transform = ''));
    const base = el.getBoundingClientRect();
    glyphs.forEach((g) => {
      const r = g.node.getBoundingClientRect();
      g.cx = r.left + r.width / 2 - base.left;
      g.cy = r.top + r.height / 2 - base.top;
    });
    glyphs.forEach((g, i) => (g.node.style.transform = saved[i]));
  }
  measure();

  function frame(_, dt) {
    const s = dt / 1000;
    const dir = o.mode === 'attract' ? -1 : 1;
    let busy = pointer.active;
    for (const g of glyphs) {
      let tx = 0, ty = 0, tr = 0, ts = 1, th = 0;
      if (pointer.active) {
        const dx = g.cx - pointer.x;
        const dy = g.cy - pointer.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = smoothstep(o.radius, 0, d);
        if (f > 0) {
          const push = f * o.strength * fs * dir;
          tx = (dx / d) * push;
          ty = (dy / d) * push - f * o.lift * fs;
          tr = (dx / o.radius) * o.rotate * f * dir;
          ts = 1 + o.scale * f;
          th = f;
        }
      }
      g.x.to(tx); g.y.to(ty); g.r.to(tr); g.s.to(ts); g.h.to(th);
      g.x.step(s); g.y.step(s); g.r.step(s); g.s.step(s); g.h.step(s);
      const resting = g.x.resting && g.y.resting && g.r.resting && g.s.resting && g.h.resting;
      if (!resting) busy = true;
      if (resting && g.x.value === 0 && g.y.value === 0 && g.r.value === 0 && g.s.value === 1) {
        if (g.node.style.transform) {
          g.node.style.transform = '';
          g.node.style.removeProperty('--sf-heat');
        }
        continue;
      }
      g.node.style.transform =
        `translate3d(${g.x.value.toFixed(2)}px, ${g.y.value.toFixed(2)}px, 0) rotate(${g.r.value.toFixed(2)}deg) scale(${g.s.value.toFixed(4)})`;
      g.node.style.setProperty('--sf-heat', Math.max(0, g.h.value).toFixed(3));
    }
    if (!busy) { off(); off = null; }
  }

  const wake = () => { if (!off) off = tick(frame); };

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active =
      pointer.x > -o.radius && pointer.y > -o.radius && pointer.x < r.width + o.radius && pointer.y < r.height + o.radius;
    wake();
  };
  const onLeave = () => { pointer.active = false; wake(); };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  const remeasure = debounce(measure, 150);
  const ro = new ResizeObserver(remeasure);
  ro.observe(el);
  window.addEventListener('scroll', remeasure, { passive: true });

  return {
    el,
    /** Programmatically place the field (element-local px), e.g. for demos. */
    point(x, y) { pointer.x = x; pointer.y = y; pointer.active = true; wake(); },
    release() { pointer.active = false; wake(); },
    destroy() {
      if (off) off();
      remeasure.cancel();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', remeasure);
      document.removeEventListener('pointerleave', onLeave);
      parts.revert();
    },
  };
}

export default magneticText;
