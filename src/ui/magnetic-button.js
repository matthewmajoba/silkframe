/**
 * Magnetic Button
 * A quiet magnet. Within a small field the button leans toward the pointer —
 * never more than a fraction of its own height, softly limited so it can't
 * be dragged around — with the label drifting a touch further for depth.
 * Springs are critically damped (no wobble). On hover the fill floods in
 * from where you entered and drains toward where you leave; pressing gives
 * a small, physical squeeze.
 *
 *   magneticButton('.cta', { pull: 0.22, radius: 70 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-magnetic',
  `:where(.sf-mag){position:relative}
.sf-mag{overflow:hidden;isolation:isolate;will-change:transform}
.sf-mag-label{position:relative;z-index:2;display:inline-block;will-change:transform;transition:color .5s cubic-bezier(.16,1,.3,1)}
.sf-mag-fill{position:absolute;z-index:1;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;
  background:var(--sf-mag-fill,#ffb547);transform:scale(0);pointer-events:none}
.sf-mag.is-filled .sf-mag-label{color:var(--sf-mag-fill-fg,#0b0b0e)}`
);

const DEFAULTS = {
  radius: 70, // px beyond the button edge where the field begins
  pull: 0.22, // max travel as a fraction of the button's height
  label: 0.45, // extra drift of the label relative to the shell
  fill: true,
};

export function magneticButton(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-mag');
  const label = document.createElement('span');
  label.className = 'sf-mag-label';
  while (el.firstChild) label.appendChild(el.firstChild);
  el.appendChild(label);
  let fill = null;
  if (o.fill) {
    fill = document.createElement('span');
    fill.className = 'sf-mag-fill';
    fill.setAttribute('aria-hidden', 'true');
    el.insertBefore(fill, label);
  }
  // Critically damped: it arrives, it doesn't wobble.
  const cfg = { stiffness: 170, damping: 26, precision: 0.02 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg);
  const lx = new Spring(0, cfg), ly = new Spring(0, cfg);
  const sc = new Spring(1, { stiffness: 420, damping: 30, precision: 0.0005 });
  let off = null;
  let rect = null;
  let fillAnim = null;
  let hovering = false;

  function frame(_, dt) {
    const s = dt / 1000;
    x.step(s); y.step(s); lx.step(s); ly.step(s); sc.step(s);
    el.style.transform = `translate3d(${x.value.toFixed(2)}px, ${y.value.toFixed(2)}px, 0) scale(${sc.value.toFixed(4)})`;
    label.style.transform = `translate3d(${lx.value.toFixed(2)}px, ${ly.value.toFixed(2)}px, 0)`;
    if (x.resting && y.resting && lx.resting && ly.resting && sc.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const measure = () => {
    const prev = el.style.transform;
    el.style.transform = 'none';
    rect = el.getBoundingClientRect();
    el.style.transform = prev;
  };

  const onMove = (e) => {
    if (!rect) measure();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    // distance from the button's edge (0 inside)
    const ex = Math.max(0, Math.abs(dx) - rect.width / 2), ey = Math.max(0, Math.abs(dy) - rect.height / 2);
    const edge = Math.hypot(ex, ey);
    if (edge < o.radius) {
      const f = 1 - edge / o.radius; // 1 on/inside the button, 0 at the field's rim
      const ease = f * f * (3 - 2 * f);
      const max = rect.height * o.pull;
      // soft limit: grows with distance from centre but saturates
      const tx = Math.tanh(dx / (rect.width * 0.75)) * max * ease;
      const ty = Math.tanh(dy / (rect.height * 0.9)) * max * ease;
      x.to(tx); y.to(ty);
      lx.to(tx * o.label); ly.to(ty * o.label);
    } else {
      x.to(0); y.to(0); lx.to(0); ly.to(0);
    }
    wake();
  };

  const flood = (e, enter) => {
    if (!fill) return;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const far = Math.hypot(Math.max(px, r.width - px), Math.max(py, r.height - py));
    const scale = (far * 2) / 10 + 1;
    fill.style.left = `${px}px`;
    fill.style.top = `${py}px`;
    fillAnim?.cancel();
    el.classList.toggle('is-filled', enter);
    fillAnim = fill.animate(
      enter ? [{ transform: 'scale(0)' }, { transform: `scale(${scale})` }] : [{ transform: `scale(${scale})` }, { transform: 'scale(0)' }],
      { duration: enter ? 700 : 560, easing: enter ? css.cinematic : css.inOutQuart, fill: 'forwards' }
    );
  };
  const onEnter = (e) => { hovering = true; flood(e, true); };
  const onLeave = (e) => { hovering = false; sc.to(1); wake(); flood(e, false); };
  const onDown = () => { sc.to(0.965); wake(); };
  const onUp = () => { sc.to(hovering ? 1 : 1); wake(); };
  const reset = () => (rect = null);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', reset, { passive: true });
  window.addEventListener('resize', reset);
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);

  return {
    el,
    /** Drive the magnet programmatically (client coordinates). */
    point(clientX, clientY) { onMove({ clientX, clientY }); },
    destroy() {
      if (off) off();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', reset);
      window.removeEventListener('resize', reset);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      fill?.remove();
      while (label.firstChild) el.appendChild(label.firstChild);
      label.remove();
      el.style.transform = '';
      el.classList.remove('sf-mag', 'is-filled');
    },
  };
}

export default magneticButton;
