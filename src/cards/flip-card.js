/**
 * Physical Flip
 * A card with real thickness. It arcs toward the viewer as it turns, its
 * edge becomes visible at ninety degrees, light rakes across each face, and
 * the floor shadow tightens and softens with height. Drag it — the turn
 * follows your hand, and on release it settles with momentum onto the
 * nearest face.
 *
 *   <div class="card"><div class="front">…</div><div class="back">…</div></div>
 *   const card = flipCard('.card');  card.flip();
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-flip',
  `:where(.sf-flip){position:relative}.sf-flip{perspective:var(--sf-flip-perspective,1400px);touch-action:pan-y;cursor:grab;user-select:none}
.sf-flip.is-dragging{cursor:grabbing}
.sf-flip-shadow{position:absolute;left:8%;right:8%;bottom:-6%;height:14%;border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,rgba(0,0,0,.65),transparent);filter:blur(8px);will-change:transform,opacity}
.sf-flip-inner{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}
.sf-flip-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:inherit;overflow:hidden}
.sf-flip-face.is-back{transform:rotateY(180deg) translateZ(var(--sf-half,1.5px))}
.sf-flip-face.is-front{transform:translateZ(var(--sf-half,1.5px))}
.sf-flip-edge{position:absolute;top:var(--sf-edge-inset,3%);bottom:var(--sf-edge-inset,3%);width:calc(var(--sf-half,1.5px) * 2);
  background:linear-gradient(180deg,#3a3a42,#1c1c21);pointer-events:none}
.sf-flip-sheen{position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;opacity:0;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.9) 48%,transparent 66%);background-size:250% 100%}`
);

const DEFAULTS = {
  thickness: 3, // px
  lift: 90, // px the card rises at mid-turn
  stiffness: 150,
  damping: 15,
  drag: true,
};

export function flipCard(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const front = el.querySelector('.front,[data-face="front"]');
  const back = el.querySelector('.back,[data-face="back"]');
  el.classList.add('sf-flip');
  el.style.setProperty('--sf-half', `${o.thickness / 2}px`);
  const inner = document.createElement('div');
  inner.className = 'sf-flip-inner';
  inner.style.borderRadius = getComputedStyle(el).borderRadius;
  front.classList.add('sf-flip-face', 'is-front');
  back.classList.add('sf-flip-face', 'is-back');
  const sheens = [front, back].map((f) => {
    const s = document.createElement('div');
    s.className = 'sf-flip-sheen';
    s.setAttribute('aria-hidden', 'true');
    f.appendChild(s);
    return s;
  });
  const edges = [0, 1].map((side) => {
    const e = document.createElement('div');
    e.className = 'sf-flip-edge';
    e.style.left = side ? `calc(100% - var(--sf-half))` : 'calc(var(--sf-half) * -1)';
    e.style.transform = 'rotateY(90deg)';
    return e;
  });
  const shadow = document.createElement('div');
  shadow.className = 'sf-flip-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  inner.append(front, back, ...edges);
  el.append(shadow, inner);
  el.setAttribute('role', el.getAttribute('role') || 'button');
  el.tabIndex = el.tabIndex >= 0 ? el.tabIndex : 0;
  el.setAttribute('aria-pressed', 'false');

  const angle = new Spring(0, { stiffness: o.stiffness, damping: o.damping, precision: 0.05 });
  let side = 0; // 0 front, 1 back
  let dragging = false;
  let startX = 0, startAngle = 0, lastX = 0, lastT = 0, vel = 0;
  let off = null;

  function render() {
    const a = angle.value;
    const rad = (a * Math.PI) / 180;
    const height = Math.abs(Math.sin(rad));
    inner.style.transform = `translateZ(${(height * o.lift).toFixed(2)}px) rotateY(${a.toFixed(3)}deg)`;
    shadow.style.transform = `scale(${(1 - height * 0.35).toFixed(4)}, ${(1 - height * 0.2).toFixed(4)})`;
    shadow.style.opacity = (1 - height * 0.55).toFixed(3);
    // Light rakes across: the sheen band travels with the turn.
    const pos = ((a % 360) + 360) % 360;
    const sweep = Math.sin(rad * 2);
    sheens.forEach((s) => {
      s.style.opacity = (Math.abs(sweep) * 0.8).toFixed(3);
      s.style.backgroundPosition = `${(100 - (pos % 180) / 1.8).toFixed(1)}% 0`;
    });
  }

  function frame(_, dt) {
    if (!dragging) angle.step(dt / 1000);
    render();
    if (!dragging && angle.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function flip(to) {
    const next = to === undefined ? 1 - side : to;
    if (next === side) return;
    side = next;
    // Always keep turning the same way round — continuous and physical.
    angle.to(angle.target + 180);
    el.setAttribute('aria-pressed', String(side === 1));
    wake();
  }

  const onDown = (e) => {
    if (!o.drag) return;
    dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture?.(e.pointerId);
    startX = lastX = e.clientX;
    startAngle = angle.value;
    lastT = performance.now();
    vel = 0;
    wake();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const now = performance.now();
    const w = el.offsetWidth || 1;
    const a = startAngle + ((e.clientX - startX) / w) * 180;
    vel = vel * 0.6 + ((a - angle.value) / Math.max((now - lastT) / 1000, 0.008)) * 0.4;
    angle.value = a;
    angle.velocity = 0;
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    const moved = Math.abs(e.clientX - startX) > 4;
    if (!moved) { flip(); return; }
    // Project the release with momentum, snap to the nearest face.
    const projected = angle.value + clamp(vel, -2000, 2000) * 0.18;
    const target = Math.round(projected / 180) * 180;
    angle.velocity = clamp(vel, -2000, 2000);
    angle.to(target);
    side = Math.abs(Math.round(target / 180)) % 2;
    el.setAttribute('aria-pressed', String(side === 1));
    wake();
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('keydown', onKey);
  render();

  return {
    el,
    flip,
    get side() { return side; },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('keydown', onKey);
    },
  };
}

export default flipCard;
