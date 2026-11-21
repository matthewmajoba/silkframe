/**
 * Velocity Marquee
 * An endless ticker that feels the page. Scroll or drag and it surges in
 * that direction, skewing with the speed like type printed on a spinning
 * drum, then eases back to its cruising pace. Seamless at any width — it
 * clones its content as many times as the viewport needs.
 *
 *   velocityMarquee('.ticker', { speed: 60, skew: 12 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, debounce, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-marquee',
  `:where(.sf-mq){position:relative}.sf-mq{overflow:hidden;white-space:nowrap;user-select:none;touch-action:pan-y;cursor:grab}
.sf-mq.is-dragging{cursor:grabbing}
.sf-mq-track{display:inline-flex;will-change:transform}
.sf-mq-unit{display:inline-flex;flex:none}`
);

const DEFAULTS = {
  speed: 60, // px/s cruising
  direction: -1, // -1 = leftwards
  skew: 10, // max degrees
  sensitivity: 1, // scroll/drag influence
  listen: 'window', // 'window' (scroll + wheel) or 'self' (wheel over the element only)
};

export function velocityMarquee(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-mq');
  const original = el.innerHTML;
  const unit = document.createElement('div');
  unit.className = 'sf-mq-unit';
  unit.innerHTML = original;
  const track = document.createElement('div');
  track.className = 'sf-mq-track';
  el.innerHTML = '';
  el.appendChild(track);
  track.appendChild(unit);
  let unitW = 1;

  function fill() {
    track.querySelectorAll('.sf-mq-unit:not(:first-child)').forEach((n) => n.remove());
    unitW = unit.getBoundingClientRect().width || 1;
    const copies = Math.ceil(el.clientWidth / unitW) + 2;
    for (let i = 1; i < copies; i++) {
      const c = unit.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
  }
  fill();

  let x = 0;
  let boost = 0; // extra px/s from scroll / drag
  const skew = new Spring(0, { stiffness: 120, damping: 16 });
  let dir = o.direction;
  let dragging = false;
  let lastX = 0, lastT = 0, dragV = 0;
  let lastScroll = window.scrollY;

  function frame(_, dt) {
    const s = dt / 1000;
    boost *= Math.exp(-s * 2.6);
    const v = dragging ? dragV : dir * o.speed + boost;
    if (!dragging) x += v * s;
    // wrap seamlessly
    x = ((x % unitW) + unitW) % unitW - unitW;
    skew.to(clamp(-v / 120, -o.skew, o.skew));
    skew.step(s);
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${skew.value.toFixed(3)}deg)`;
  }

  const onScroll = () => {
    const y = window.scrollY;
    const d = y - lastScroll;
    lastScroll = y;
    boost = clamp(boost - d * 18 * o.sensitivity, -3200, 3200);
    if (Math.abs(d) > 2) dir = d > 0 ? -1 : 1;
  };
  const onWheel = (e) => {
    boost = clamp(boost - e.deltaY * 9 * o.sensitivity - e.deltaX * 9 * o.sensitivity, -3200, 3200);
    if (Math.abs(e.deltaY) > 2) dir = e.deltaY > 0 ? -1 : 1;
  };
  const onDown = (e) => {
    dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture?.(e.pointerId);
    lastX = e.clientX; lastT = performance.now(); dragV = 0;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    x += dx;
    dragV = dragV * 0.5 + (dx / Math.max((now - lastT) / 1000, 0.008)) * 0.5;
    lastX = e.clientX; lastT = now;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    boost = clamp(dragV - dir * o.speed, -3200, 3200);
    if (Math.abs(dragV) > 30) dir = Math.sign(dragV);
  };
  const wheelTarget = o.listen === 'self' ? el : window;
  wheelTarget.addEventListener('wheel', onWheel, { passive: true });
  if (o.listen !== 'self') window.addEventListener('scroll', onScroll, { passive: true });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  const refill = debounce(fill, 200);
  const ro = new ResizeObserver(refill);
  ro.observe(el);
  const off = prefersReducedMotion() ? null : tick(frame);

  return {
    el,
    /** Kick the marquee programmatically (px/s). */
    impulse(v) { boost = clamp(boost + v, -3200, 3200); if (Math.abs(v) > 0) dir = Math.sign(v); },
    destroy() {
      off?.();
      refill.cancel();
      ro.disconnect();
      wheelTarget.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.innerHTML = original;
      el.classList.remove('sf-mq');
    },
  };
}

export default velocityMarquee;
