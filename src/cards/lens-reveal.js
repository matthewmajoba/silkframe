/**
 * Lens Reveal
 * A liquid lens glides after the pointer and shows a second layer through
 * it — an x-ray, a night version, the specs behind the photo. The lens
 * swells when it enters, stretches with velocity like a drop of water and
 * carries a refracted rim highlight.
 *
 *   <div class="card"><div class="base">…</div><div class="reveal">…</div></div>
 *   lensReveal('.card', { radius: 110 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-lens',
  `.sf-lens{position:relative;overflow:hidden}
.sf-lens-reveal{position:absolute;inset:0;pointer-events:none;
  -webkit-mask:radial-gradient(var(--sf-lw,0px) var(--sf-lh,0px) at var(--sf-lx,50%) var(--sf-ly,50%),#000 72%,transparent 100%);
  mask:radial-gradient(var(--sf-lw,0px) var(--sf-lh,0px) at var(--sf-lx,50%) var(--sf-ly,50%),#000 72%,transparent 100%)}
.sf-lens-rim{position:absolute;left:0;top:0;pointer-events:none;border-radius:50%;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset 0 0 24px rgba(255,255,255,.12),0 10px 40px rgba(0,0,0,.35);
  background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.22),transparent 38%);will-change:transform,opacity}`
);

const DEFAULTS = {
  radius: 110,
  stretch: 0.0009, // velocity → elongation
  idle: true, // drift autonomously until touched
};

export function lensReveal(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-lens');
  const reveal = el.querySelector('.reveal,[data-lens="reveal"]');
  reveal.classList.add('sf-lens-reveal');
  const rim = document.createElement('div');
  rim.className = 'sf-lens-rim';
  rim.setAttribute('aria-hidden', 'true');
  el.appendChild(rim);
  const cfg = { stiffness: 140, damping: 18, precision: 0.05 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg);
  const size = new Spring(0, { stiffness: 120, damping: 14, precision: 0.05 });
  let inside = false;
  let t = 0;
  let off = null;
  let w = 0, h = 0;

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    w = el.clientWidth; h = el.clientHeight;
    if (!inside && o.idle) {
      x.to(w * (0.5 + Math.sin(t * 0.55) * 0.3));
      y.to(h * (0.5 + Math.sin(t * 0.9 + 0.8) * 0.25));
      size.to(o.radius * 0.85);
    }
    x.step(s); y.step(s); size.step(s);
    // Velocity stretches the lens along its dominant axis (surface tension).
    const sx = 1 + clamp(Math.abs(x.velocity) * o.stretch, 0, 0.45) - clamp(Math.abs(y.velocity) * o.stretch * 0.5, 0, 0.2);
    const sy = 1 + clamp(Math.abs(y.velocity) * o.stretch, 0, 0.45) - clamp(Math.abs(x.velocity) * o.stretch * 0.5, 0, 0.2);
    const r = Math.max(0, size.value);
    el.style.setProperty('--sf-lx', `${x.value.toFixed(1)}px`);
    el.style.setProperty('--sf-ly', `${y.value.toFixed(1)}px`);
    el.style.setProperty('--sf-lw', `${(r * sx).toFixed(1)}px`);
    el.style.setProperty('--sf-lh', `${(r * sy).toFixed(1)}px`);
    const d = r * 2 * 0.86;
    rim.style.width = rim.style.height = `${d}px`;
    rim.style.transform = `translate3d(${(x.value - d / 2).toFixed(1)}px, ${(y.value - d / 2).toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    rim.style.opacity = clamp(r / o.radius).toFixed(3);
    if (!o.idle && !inside && size.resting && x.resting && y.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onEnter = (e) => {
    inside = true;
    const r = el.getBoundingClientRect();
    if (!o.idle) { x.set(e.clientX - r.left); y.set(e.clientY - r.top); }
    size.to(o.radius);
    wake();
  };
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    x.to(e.clientX - r.left);
    y.to(e.clientY - r.top);
    wake();
  };
  const onLeave = () => { inside = false; if (!o.idle) size.to(0); wake(); };
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  x.set(el.clientWidth / 2); y.set(el.clientHeight / 2);
  wake();

  return {
    el,
    destroy() {
      if (off) off();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      rim.remove();
      reveal.classList.remove('sf-lens-reveal');
      el.classList.remove('sf-lens');
    },
  };
}

export default lensReveal;
