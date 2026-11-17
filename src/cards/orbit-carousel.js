/**
 * Orbit Carousel
 * Cards stand on a turntable in true 3D. Drag to spin — release and the
 * ring coasts with inertia, then a spring eases the nearest card to the
 * front. Cards dim and soften as they swing away, and a floor reflection
 * grounds the whole carousel.
 *
 *   const ring = orbitCarousel('.carousel', { radius: 340 });
 *   ring.go(2);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-orbit',
  `.sf-orbit{position:relative;perspective:var(--sf-orbit-perspective,1400px);touch-action:pan-y;user-select:none;cursor:grab}
.sf-orbit.is-dragging{cursor:grabbing}
.sf-orbit-stage{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
.sf-orbit-stage>*{position:absolute;transform-style:preserve-3d;will-change:transform,opacity;
  -webkit-box-reflect:below 14px linear-gradient(transparent 62%,rgba(0,0,0,.28))}`
);

const DEFAULTS = {
  radius: null, // px — defaults from card width and count
  tilt: -8,
  autoplay: 3200, // ms between auto-advances (0 = off)
  friction: 2.6,
};

export function orbitCarousel(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-orbit');
  const items = Array.from(el.children);
  const stage = document.createElement('div');
  stage.className = 'sf-orbit-stage';
  items.forEach((n) => stage.appendChild(n));
  el.appendChild(stage);
  const N = items.length;
  const step = 360 / N;
  const cw = items[0]?.offsetWidth || 200, ch = items[0]?.offsetHeight || 280;
  const R = o.radius ?? Math.round((cw * (o.spacing ?? 1.4)) / (2 * Math.tan(Math.PI / N)));
  items.forEach((n) => {
    n.style.left = `${-cw / 2}px`;
    n.style.top = `${-ch / 2}px`;
  });
  stage.style.transform = `translateZ(${-R}px) rotateX(${o.tilt}deg)`;

  const angle = new Spring(0, { stiffness: 60, damping: 14, precision: 0.02 });
  let coasting = false;
  let dragging = false;
  let lastX = 0, lastT = 0, vel = 0;
  let idle = 0;
  let off = null;

  function render() {
    const a = angle.value;
    items.forEach((n, i) => {
      const theta = i * step - a;
      const rad = (theta * Math.PI) / 180;
      const facing = Math.cos(rad);
      n.style.transform = `rotateY(${theta.toFixed(3)}deg) translateZ(${R}px)`;
      n.style.opacity = (0.25 + 0.75 * Math.pow((facing + 1) / 2, 1.4)).toFixed(3);
      n.style.filter = facing < 0.2 ? `blur(${((0.2 - facing) * 3).toFixed(2)}px) brightness(${(0.6 + facing * 0.4).toFixed(3)})` : '';
      n.style.zIndex = String(Math.round(facing * 100) + 100);
      n.setAttribute('aria-hidden', String(Math.abs(theta % 360) > step / 2 && Math.abs(theta % 360) < 360 - step / 2));
    });
  }

  function frame(_, dt) {
    const s = dt / 1000;
    if (!dragging) {
      if (coasting) {
        angle.value += vel * s;
        vel *= Math.exp(-o.friction * s);
        if (Math.abs(vel) < 40) {
          coasting = false;
          angle.velocity = vel;
          angle.to(Math.round(angle.value / step) * step);
        }
      } else {
        angle.step(s);
        idle += dt;
        if (o.autoplay && idle > o.autoplay) {
          idle = 0;
          angle.to(angle.target + step);
        }
      }
    }
    render();
  }

  const onDown = (e) => {
    dragging = true;
    coasting = false;
    el.classList.add('is-dragging');
    el.setPointerCapture?.(e.pointerId);
    lastX = e.clientX;
    lastT = performance.now();
    vel = 0;
    idle = 0;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const now = performance.now();
    const deg = -((e.clientX - lastX) / R) * (180 / Math.PI);
    angle.value += deg;
    angle.velocity = 0;
    vel = vel * 0.5 + (deg / Math.max((now - lastT) / 1000, 0.008)) * 0.5;
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    vel = clamp(vel, -1400, 1400);
    coasting = true;
    idle = 0;
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  render();
  off = tick(frame);

  return {
    el,
    go(index) { idle = 0; coasting = false; angle.to(Math.round(angle.value / 360) * 360 + index * step); },
    next() { idle = 0; angle.to(angle.target + step); },
    prev() { idle = 0; angle.to(angle.target - step); },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    },
  };
}

export default orbitCarousel;
