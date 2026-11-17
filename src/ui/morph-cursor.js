/**
 * Morph Cursor
 * A two-part cursor: a precise dot plus a ring that follows on a spring,
 * stretching along its velocity like a drop in motion. Over any element
 * marked [data-cursor] the ring lets go of the pointer and wraps the
 * target's own shape — position, size and corner radius — magnetically.
 *
 *   morphCursor({ root: document.body });   // <a data-cursor>…</a>
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-cursor',
  `.sf-cursor-root{cursor:none}
.sf-cursor-root *{cursor:none!important}
.sf-cursor-dot,.sf-cursor-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000;will-change:transform}
.sf-cursor-dot{width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--sf-cursor,#fff);mix-blend-mode:difference}
.sf-cursor-ring{border:1.5px solid var(--sf-cursor,#fff);mix-blend-mode:difference;opacity:.9;transition:opacity .3s}
.sf-cursor-ring.is-hidden,.sf-cursor-dot.is-hidden{opacity:0}`
);

const DEFAULTS = {
  root: null, // element that owns the custom cursor (default: document.body)
  size: 38,
  stretch: 0.0011,
  padding: 8, // px the ring sits outside a hovered target
};

export function morphCursor(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const root = resolve(o.root) || document.body;
  if (matchMedia('(pointer: coarse)').matches) return { destroy() {} };
  root.classList.add('sf-cursor-root');
  const dot = document.createElement('div');
  dot.className = 'sf-cursor-dot is-hidden';
  const ring = document.createElement('div');
  ring.className = 'sf-cursor-ring is-hidden';
  document.body.append(ring, dot);
  const cfg = { stiffness: 260, damping: 26, precision: 0.05 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg);
  const w = new Spring(o.size, { stiffness: 220, damping: 22, precision: 0.05 });
  const h = new Spring(o.size, { stiffness: 220, damping: 22, precision: 0.05 });
  const r = new Spring(o.size / 2, { stiffness: 220, damping: 22, precision: 0.05 });
  const p = { x: 0, y: 0 };
  let target = null;
  let off = null;
  let inside = false;

  function frame(_, dt) {
    const s = dt / 1000;
    if (target) {
      const b = target.getBoundingClientRect();
      const pad = o.padding;
      // Magnetic wrap with a little give toward the pointer.
      const cx = b.left + b.width / 2 + (p.x - (b.left + b.width / 2)) * 0.12;
      const cy = b.top + b.height / 2 + (p.y - (b.top + b.height / 2)) * 0.12;
      x.to(cx); y.to(cy);
      w.to(b.width + pad * 2); h.to(b.height + pad * 2);
      const br = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      r.to(Math.min(br + pad, (b.height + pad * 2) / 2));
    } else {
      x.to(p.x); y.to(p.y);
      w.to(o.size); h.to(o.size); r.to(o.size / 2);
    }
    x.step(s); y.step(s); w.step(s); h.step(s); r.step(s);
    let sx = 1, sy = 1, ang = 0;
    if (!target) {
      const v = Math.hypot(x.velocity, y.velocity);
      const k = clamp(v * o.stretch, 0, 0.6);
      sx = 1 + k; sy = 1 - k * 0.5;
      ang = Math.atan2(y.velocity, x.velocity) * (180 / Math.PI);
    }
    ring.style.width = `${w.value.toFixed(2)}px`;
    ring.style.height = `${h.value.toFixed(2)}px`;
    ring.style.borderRadius = `${r.value.toFixed(2)}px`;
    ring.style.transform = `translate3d(${(x.value - w.value / 2).toFixed(2)}px, ${(y.value - h.value / 2).toFixed(2)}px, 0) rotate(${ang.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${target ? 0 : 1})`;
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onMove = (e) => {
    p.x = e.clientX; p.y = e.clientY;
    if (!inside) { x.set(p.x); y.set(p.y); }
    inside = true;
    dot.classList.remove('is-hidden');
    ring.classList.remove('is-hidden');
    const t = e.target.closest?.('[data-cursor]');
    target = t && root.contains(t) ? t : null;
    wake();
  };
  const onLeave = () => {
    inside = false;
    target = null;
    dot.classList.add('is-hidden');
    ring.classList.add('is-hidden');
  };
  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerleave', onLeave);

  return {
    /** Feed a synthetic pointer (client coords) — for demos and tours. */
    move(clientX, clientY, el = null) {
      onMove({ clientX, clientY, target: el || document.elementFromPoint(clientX, clientY) || root });
    },
    leave: onLeave,
    destroy() {
      if (off) off();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      dot.remove();
      ring.remove();
      root.classList.remove('sf-cursor-root');
    },
  };
}

export default morphCursor;
