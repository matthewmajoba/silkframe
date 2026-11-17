/**
 * Holographic Foil
 * A collectible-card surface: spring-driven tilt, an iridescent foil band
 * that slides with the viewing angle, a fine diffraction-line texture, a
 * glitter layer that only sparkles near the light, and a glare hotspot that
 * tracks the pointer. Shadows fall opposite the tilt.
 *
 *   holoCard('.card', { maxTilt: 14 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-holo',
  `.sf-holo{--rx:0deg;--ry:0deg;--px:50%;--py:50%;--h:0;--lift:0px;position:relative;isolation:isolate;
  transform:perspective(var(--sf-holo-perspective,900px)) rotateX(var(--rx)) rotateY(var(--ry)) translateZ(var(--lift));
  transform-style:preserve-3d;will-change:transform;
  box-shadow:calc(var(--sx,0) * 1px) calc(var(--sy,0) * 1px + 24px) 50px -12px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06)}
.sf-holo-layer{position:absolute;inset:0;border-radius:inherit;pointer-events:none;overflow:hidden}
.sf-holo-foil{mix-blend-mode:color-dodge;opacity:calc(.08 + var(--h) * .48);
  background:
    repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 3px),
    repeating-linear-gradient(118deg,#ff6fa5 0%,#ffcf6a 7%,#78ffd0 14%,#62a6ff 21%,#c67bff 28%,#ff6fa5 35%);
  background-size:100% 100%,320% 320%;
  background-position:0 0,var(--px) var(--py);filter:saturate(1.15) brightness(.85) contrast(1.1)}
.sf-holo-glitter{mix-blend-mode:color-dodge;opacity:calc(var(--h) * .9);
  background-image:radial-gradient(circle at 20% 30%,#fff 0 .6px,transparent 1.2px),radial-gradient(circle at 70% 80%,#fff 0 .5px,transparent 1px),radial-gradient(circle at 45% 60%,#fff 0 .7px,transparent 1.3px);
  background-size:23px 19px,31px 27px,17px 29px;background-position:calc(var(--px) * .3) calc(var(--py) * .3);
  -webkit-mask:radial-gradient(circle at var(--px) var(--py),#000 0,rgba(0,0,0,.5) 18%,transparent 45%);
  mask:radial-gradient(circle at var(--px) var(--py),#000 0,rgba(0,0,0,.5) 18%,transparent 45%)}
.sf-holo-glare{mix-blend-mode:overlay;opacity:calc(var(--h) * .95);
  background:radial-gradient(farthest-corner circle at var(--px) var(--py),rgba(255,255,255,.85) 0%,rgba(255,255,255,.28) 22%,rgba(0,0,0,.42) 95%)}`
);

const DEFAULTS = {
  maxTilt: 14,
  lift: 24,
  stiffness: 170,
  damping: 19,
  idle: true, // gentle autonomous drift while untouched
};

export function holoCard(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-holo');
  const layers = ['foil', 'glitter', 'glare'].map((name) => {
    const d = document.createElement('div');
    d.className = `sf-holo-layer sf-holo-${name}`;
    d.setAttribute('aria-hidden', 'true');
    el.appendChild(d);
    return d;
  });
  const cfg = { stiffness: o.stiffness, damping: o.damping, precision: 0.001 };
  const s = {
    rx: new Spring(0, cfg), ry: new Spring(0, cfg),
    px: new Spring(0.5, cfg), py: new Spring(0.5, cfg),
    h: new Spring(0, { stiffness: 90, damping: 16, precision: 0.001 }),
  };
  let rect = null;
  let inside = false;
  let off = null;
  let t = 0;

  function measure() {
    const prev = el.style.transform;
    el.style.transform = 'none';
    rect = el.getBoundingClientRect();
    el.style.transform = prev;
  }

  function aim(nx, ny, hover) {
    s.px.to(nx); s.py.to(ny);
    s.rx.to((0.5 - ny) * 2 * o.maxTilt);
    s.ry.to((nx - 0.5) * 2 * o.maxTilt);
    s.h.to(hover);
  }

  function frame(_, dt) {
    const sec = dt / 1000;
    t += sec;
    if (!inside && o.idle) {
      // Slow figure-eight drift keeps the foil alive at rest.
      aim(0.5 + Math.sin(t * 0.7) * 0.22, 0.5 + Math.sin(t * 1.1) * 0.16, 0.35);
    }
    let resting = true;
    for (const k in s) { s[k].step(sec); if (!s[k].resting) resting = false; }
    el.style.setProperty('--rx', `${s.rx.value.toFixed(3)}deg`);
    el.style.setProperty('--ry', `${s.ry.value.toFixed(3)}deg`);
    el.style.setProperty('--px', `${(s.px.value * 100).toFixed(2)}%`);
    el.style.setProperty('--py', `${(s.py.value * 100).toFixed(2)}%`);
    el.style.setProperty('--h', clamp(s.h.value, 0, 1.2).toFixed(3));
    el.style.setProperty('--lift', `${(clamp(s.h.value) * o.lift).toFixed(2)}px`);
    el.style.setProperty('--sx', (-s.ry.value * 1.4).toFixed(2));
    el.style.setProperty('--sy', (s.rx.value * 1.4).toFixed(2));
    if (resting && !inside && !o.idle) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onEnter = () => { inside = true; measure(); wake(); };
  const onMove = (e) => {
    if (!rect) measure();
    aim(clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height), 1);
    wake();
  };
  const onLeave = () => { inside = false; aim(0.5, 0.5, 0); wake(); };
  const onScroll = () => (rect = null);
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  wake();

  return {
    el,
    /** Drive the tilt programmatically (0–1 normalised point). */
    aim: (x, y, hover = 1) => { inside = true; aim(x, y, hover); wake(); },
    release: () => onLeave(),
    destroy() {
      if (off) off();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      layers.forEach((l) => l.remove());
      el.classList.remove('sf-holo');
      ['--rx', '--ry', '--px', '--py', '--h', '--lift', '--sx', '--sy'].forEach((p) => el.style.removeProperty(p));
    },
  };
}

export default holoCard;
