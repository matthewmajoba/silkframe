/**
 * Magnetic Button
 * The button leans toward the pointer inside a capture radius, its label
 * travelling further than the shell for a sense of depth. The hover fill is
 * direction-aware: it floods in from where you entered and drains out
 * toward where you left.
 *
 *   magneticButton('.cta', { strength: 0.35, radius: 120 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-magnetic',
  `.sf-mag{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.sf-mag-label{position:relative;z-index:2;display:inline-block;will-change:transform;transition:color .45s cubic-bezier(.16,1,.3,1)}
.sf-mag-fill{position:absolute;z-index:1;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;
  background:var(--sf-mag-fill,#ffb547);transform:scale(0);pointer-events:none}
.sf-mag.is-filled .sf-mag-label{color:var(--sf-mag-fill-fg,#0b0b0e)}`
);

const DEFAULTS = {
  radius: 110, // px beyond the button edge that attracts
  strength: 0.32, // fraction of the offset the shell travels
  labelStrength: 0.55, // label travels further (parallax)
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
  const cfg = { stiffness: 160, damping: 14, precision: 0.02 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg);
  const lx = new Spring(0, { stiffness: 140, damping: 12, precision: 0.02 }), ly = new Spring(0, { stiffness: 140, damping: 12, precision: 0.02 });
  let off = null;
  let rect = null;
  let fillAnim = null;

  function frame(_, dt) {
    const s = dt / 1000;
    x.step(s); y.step(s); lx.step(s); ly.step(s);
    el.style.transform = `translate3d(${x.value.toFixed(2)}px, ${y.value.toFixed(2)}px, 0)`;
    label.style.transform = `translate3d(${lx.value.toFixed(2)}px, ${ly.value.toFixed(2)}px, 0)`;
    if (x.resting && y.resting && lx.resting && ly.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onMove = (e) => {
    if (!rect) {
      const prev = el.style.transform;
      el.style.transform = 'none';
      rect = el.getBoundingClientRect();
      el.style.transform = prev;
    }
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const reachX = rect.width / 2 + o.radius, reachY = rect.height / 2 + o.radius;
    const inside = Math.abs(dx) < reachX && Math.abs(dy) < reachY;
    if (inside) {
      // Pull eases off toward the edge of the field for a soft capture.
      const fx = 1 - Math.pow(Math.abs(dx) / reachX, 3), fy = 1 - Math.pow(Math.abs(dy) / reachY, 3);
      const f = Math.min(fx, fy);
      x.to(dx * o.strength * f); y.to(dy * o.strength * f);
      lx.to(dx * o.labelStrength * o.strength * f); ly.to(dy * o.labelStrength * o.strength * f);
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
      { duration: enter ? 650 : 520, easing: enter ? css.cinematic : css.inOutQuart, fill: 'forwards' }
    );
  };
  const onEnter = (e) => flood(e, true);
  const onLeave = (e) => flood(e, false);
  const reset = () => (rect = null);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', reset, { passive: true });
  window.addEventListener('resize', reset);
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointerleave', onLeave);

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
      fill?.remove();
      while (label.firstChild) el.appendChild(label.firstChild);
      label.remove();
      el.style.transform = '';
      el.classList.remove('sf-mag', 'is-filled');
    },
  };
}

export default magneticButton;
