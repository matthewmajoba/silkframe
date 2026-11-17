/**
 * Diorama Depth
 * Turns a flat card into a shadow-box. Children tagged with data-depth
 * (0 = back wall, 1 = glass) shift in parallax against the tilt, so the
 * scene inside appears to have real distance — while the card's own clip
 * and radius stay perfect (no 3D flattening artefacts).
 *
 *   <div class="card">
 *     <img data-depth="0" …> <div data-depth="0.6" …> <h3 data-depth="1" …>
 *   </div>
 *   depthCard('.card', { maxTilt: 9, depth: 26 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-depth',
  `.sf-depth{transform:perspective(var(--sf-depth-perspective,1000px)) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));will-change:transform}
.sf-depth [data-depth]{will-change:transform}
.sf-depth-shine{position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:soft-light;
  background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.55),transparent 55%);opacity:var(--h,0)}`
);

const DEFAULTS = {
  maxTilt: 9,
  depth: 26, // px of travel for a depth-1 layer
  scale: 0.06, // extra overscan per depth so layers never reveal edges
  shine: true,
  idle: true,
};

export function depthCard(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-depth');
  const layers = Array.from(el.querySelectorAll('[data-depth]')).map((node) => ({
    node,
    d: parseFloat(node.dataset.depth) || 0,
    base: node.style.transform,
  }));
  let shine = null;
  if (o.shine) {
    shine = document.createElement('div');
    shine.className = 'sf-depth-shine';
    shine.setAttribute('aria-hidden', 'true');
    el.appendChild(shine);
  }
  const cfg = { stiffness: 120, damping: 17, precision: 0.0005 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg), h = new Spring(0, { stiffness: 80, damping: 16, precision: 0.001 });
  let inside = false;
  let rect = null;
  let off = null;
  let t = 0;

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    if (!inside && o.idle) {
      x.to(Math.sin(t * 0.6) * 0.45);
      y.to(Math.sin(t * 0.9 + 1) * 0.3);
    }
    x.step(s); y.step(s); h.step(s);
    el.style.setProperty('--rx', `${(-y.value * o.maxTilt).toFixed(3)}deg`);
    el.style.setProperty('--ry', `${(x.value * o.maxTilt).toFixed(3)}deg`);
    el.style.setProperty('--gx', `${(50 + x.value * 50).toFixed(2)}%`);
    el.style.setProperty('--gy', `${(50 + y.value * 50).toFixed(2)}%`);
    el.style.setProperty('--h', clamp(h.value).toFixed(3));
    for (const l of layers) {
      // Far layers move with the pointer, near layers against it.
      const k = (l.d - 0.35) * o.depth;
      const sc = 1 + Math.abs(l.d - 0.35) * o.scale * 2;
      l.node.style.transform = `${l.base} translate3d(${(-x.value * k).toFixed(2)}px, ${(-y.value * k).toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
    }
    if (!o.idle && !inside && x.resting && y.resting && h.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onEnter = () => { inside = true; rect = null; h.to(1); wake(); };
  const onMove = (e) => {
    if (!rect) {
      const prev = el.style.transform;
      el.style.transform = 'none';
      rect = el.getBoundingClientRect();
      el.style.transform = prev;
    }
    x.to(clamp((e.clientX - rect.left) / rect.width) * 2 - 1);
    y.to(clamp((e.clientY - rect.top) / rect.height) * 2 - 1);
    wake();
  };
  const onLeave = () => { inside = false; x.to(0); y.to(0); h.to(0); wake(); };
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  wake();

  return {
    el,
    destroy() {
      if (off) off();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      layers.forEach((l) => (l.node.style.transform = l.base));
      shine?.remove();
      el.classList.remove('sf-depth');
    },
  };
}

export default depthCard;
