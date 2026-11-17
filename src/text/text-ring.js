/**
 * Orbit Ring
 * Text wrapped around a true 3D cylinder, spaced by measured glyph widths
 * so kerning survives the curve. Glyphs dim as they turn away, giving
 * the ring depth like engraved glass. Drag to spin — release and it coasts
 * back to its cruising speed with inertia.
 *
 *   textRing('.ring', { tilt: -14, speed: 20 });
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion, clamp } from '../core/utils.js';

injectStyle(
  'sf-ring',
  `.sf-ring{perspective:var(--sf-ring-perspective,1100px);touch-action:pan-y;cursor:grab;user-select:none}
.sf-ring-center{position:absolute;left:0;top:0;transform-style:preserve-3d}
.sf-ring.is-dragging{cursor:grabbing}
.sf-ring-scene,.sf-ring-spin{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
.sf-ring-glyph{position:absolute;left:0;top:0;transform-origin:0 0;white-space:pre;backface-visibility:visible;will-change:opacity}`
);

const DEFAULTS = {
  tilt: -14, // degrees, negative = view from above
  speed: 18, // cruising degrees per second
  separator: '  ✦  ',
  minRadius: 0, // px; repeats the text until the ring is at least this large
  fade: 0.1, // opacity of glyphs on the far side
  drag: true,
  center: null, // optional element placed at the ring's core, depth-sorted inside the 3D scene
};

export function textRing(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const text = el.textContent.trim();
  const original = el.innerHTML;
  el.classList.add('sf-ring');
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.setAttribute('aria-label', text);
  el.innerHTML = '';

  const scene = document.createElement('div');
  scene.className = 'sf-ring-scene';
  scene.setAttribute('aria-hidden', 'true');
  const spin = document.createElement('div');
  spin.className = 'sf-ring-spin';
  scene.appendChild(spin);
  el.appendChild(scene);
  let center = null;
  if (o.center) {
    // Billboard at z = 0: back glyphs pass behind it, front glyphs in front.
    center = document.createElement('div');
    center.className = 'sf-ring-center';
    center.appendChild(o.center);
    scene.appendChild(center);
  }

  // Measure glyph advances in-context.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  el.appendChild(probe);
  const unit = Array.from(text + o.separator);
  const widths = unit.map((ch) => {
    probe.textContent = ch;
    return probe.getBoundingClientRect().width;
  });
  probe.remove();
  const unitWidth = widths.reduce((a, b) => a + b, 0) || 1;
  let repeats = 1;
  while ((unitWidth * repeats) / (Math.PI * 2) < o.minRadius) repeats++;
  if (repeats === 1 && unitWidth / (Math.PI * 2) < 60) repeats = 2;
  const C = unitWidth * repeats;
  const R = C / (Math.PI * 2);

  const glyphs = [];
  let acc = 0;
  for (let r = 0; r < repeats; r++) {
    unit.forEach((ch, i) => {
      const w = widths[i];
      const theta = ((acc + w / 2) / C) * 360;
      acc += w;
      if (ch.trim() === '') return;
      const g = document.createElement('span');
      g.className = 'sf-ring-glyph';
      g.textContent = ch;
      g.style.transform = `rotateY(${theta.toFixed(3)}deg) translateZ(${R.toFixed(2)}px) translate(-50%, -50%)`;
      spin.appendChild(g);
      glyphs.push({ node: g, theta, last: -1 });
    });
  }
  scene.style.transform = `rotateX(${o.tilt}deg)`;
  if (center) center.style.transform = `rotateX(${-o.tilt}deg) translate(-50%, -50%)`;
  el.style.setProperty('--sf-ring-radius', `${R}px`);

  let angle = 0;
  let velocity = o.speed;
  let dragging = false;
  let lastX = 0, lastT = 0, dragV = 0;
  let off = null;
  let t = 0;

  function render() {
    spin.style.transform = `rotateY(${(-angle).toFixed(3)}deg)`;
    for (const g of glyphs) {
      const facing = Math.cos(((g.theta - angle) * Math.PI) / 180);
      const k = Math.pow((facing + 1) / 2, 1.6);
      const op = Math.round((o.fade + (1 - o.fade) * k) * 100) / 100;
      if (op !== g.last) {
        g.node.style.opacity = op;
        g.last = op;
      }
    }
  }

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    if (!dragging) {
      velocity += (o.speed - velocity) * (1 - Math.exp(-s * 1.6));
      angle += velocity * s;
    }
    const tilt = o.tilt + Math.sin(t * 0.8) * 1.5;
    scene.style.transform = `rotateX(${tilt.toFixed(3)}deg)`;
    if (center) center.style.transform = `rotateX(${(-tilt).toFixed(3)}deg) translate(-50%, -50%)`;
    render();
  }

  const onDown = (e) => {
    if (!o.drag) return;
    dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture?.(e.pointerId);
    lastX = e.clientX;
    lastT = performance.now();
    dragV = 0;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const deg = (dx / R) * (180 / Math.PI) * -1;
    angle += deg;
    const dts = Math.max(now - lastT, 8) / 1000;
    dragV = dragV * 0.5 + (deg / dts) * 0.5;
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    velocity = clamp(dragV, -900, 900);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  render();

  function play() {
    if (!off && !prefersReducedMotion()) {
      // Spin-up: launch fast and decay to cruising speed.
      velocity = o.speed * 9;
      off = tick(frame);
    }
    return Promise.resolve(true);
  }

  return {
    el,
    radius: R,
    play,
    pause() { if (off) off(); off = null; },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.innerHTML = original;
      el.classList.remove('sf-ring', 'is-dragging');
      el.removeAttribute('aria-label');
    },
  };
}

export default textRing;
