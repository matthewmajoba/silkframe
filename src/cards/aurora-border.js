/**
 * Aurora Edge
 * A living border: a comet of light circles the card's edge on a conic
 * gradient, trailing an aurora glow that bleeds softly outside the card.
 * As the pointer approaches, the card "wakes" — the ring brightens, the
 * comet accelerates, and a hotspot on the edge tracks the pointer.
 *
 *   auroraBorder('.card', { colors: ['#ffb547', '#ff5fa2', '#7ea6ff'] });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';

injectStyle(
  'sf-aurora',
  `.sf-aurora{position:relative;isolation:isolate}
.sf-aurora-ring,.sf-aurora-glow,.sf-aurora-spot{position:absolute;inset:calc(var(--sf-aw,1.5px) * -1);border-radius:inherit;pointer-events:none}
.sf-aurora-ring,.sf-aurora-spot{padding:var(--sf-aw,1.5px);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.sf-aurora-ring{background:conic-gradient(from var(--sf-a,0deg),var(--sf-aurora));opacity:calc(.55 + var(--sf-w,0) * .45)}
.sf-aurora-spot{background:radial-gradient(160px circle at var(--sf-mx,50%) var(--sf-my,50%),rgba(255,255,255,.95),transparent 60%);opacity:var(--sf-w,0)}
.sf-aurora-glow{inset:-70px;padding:70px;border-radius:calc(var(--sf-ar,22px) + 70px);
  filter:blur(calc(10px + var(--sf-w,0) * 9px));opacity:calc(.35 + var(--sf-w,0) * .55);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.sf-aurora-glow>i{position:absolute;inset:60px;padding:10px;border-radius:calc(var(--sf-ar,22px) + 10px);
  background:conic-gradient(from var(--sf-a,0deg),var(--sf-aurora));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}`
);

const DEFAULTS = {
  colors: ['#ffb547', '#ff6a5c', '#ff5fa2', '#8a7dff', '#7ea6ff'],
  width: 1.5,
  speed: 40, // degrees per second at rest
  boost: 3.2, // speed multiplier when awake
  reach: 140, // px around the card that wakes it
  tail: 0.55, // portion of the ring that is dark (0–1)
};

export function auroraBorder(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-aurora');
  el.style.setProperty('--sf-aw', `${o.width}px`);
  // Glow is masked to the outside of the card, so it never tints the surface.
  el.style.setProperty('--sf-ar', getComputedStyle(el).borderTopLeftRadius);
  // Comet: dark tail → colours → bright head, then dark again.
  const stops = o.colors.map((c, i) => `${c} ${((o.tail + ((1 - o.tail) * i) / (o.colors.length - 1)) * 100 - 2).toFixed(1)}%`);
  el.style.setProperty('--sf-aurora', `transparent 0%, transparent ${(o.tail * 100 - 12).toFixed(1)}%, ${stops.join(', ')}, #fff 99%, transparent 100%`);
  const layers = ['glow', 'ring', 'spot'].map((n) => {
    const d = document.createElement('div');
    d.className = `sf-aurora-${n}`;
    d.setAttribute('aria-hidden', 'true');
    // Glow: a thin painted ring, blurred inside a far larger masked box so
    // the bloom fades naturally instead of hitting the box edge.
    if (n === 'glow') d.appendChild(document.createElement('i'));
    el.appendChild(d);
    return d;
  });
  const wake = new Spring(0, { stiffness: 70, damping: 15, precision: 0.001 });
  const mx = new Spring(50, { stiffness: 160, damping: 22 }), my = new Spring(50, { stiffness: 160, damping: 22 });
  let angle = Math.random() * 360;
  let off = null;

  function frame(_, dt) {
    const s = dt / 1000;
    wake.step(s); mx.step(s); my.step(s);
    angle = (angle + o.speed * (1 + wake.value * (o.boost - 1)) * s) % 360;
    el.style.setProperty('--sf-a', `${angle.toFixed(2)}deg`);
    el.style.setProperty('--sf-w', Math.max(0, wake.value).toFixed(3));
    el.style.setProperty('--sf-mx', `${mx.value.toFixed(2)}%`);
    el.style.setProperty('--sf-my', `${my.value.toFixed(2)}%`);
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    const d = Math.hypot(dx, dy);
    wake.to(Math.max(0, 1 - d / o.reach));
    mx.to(((e.clientX - r.left) / r.width) * 100);
    my.to(((e.clientY - r.top) / r.height) * 100);
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  function play() { if (!off) off = tick(frame); return Promise.resolve(true); }
  play();

  return {
    el,
    play,
    pause() { if (off) off(); off = null; },
    /** Programmatic wake level 0–1 (e.g. for focus states). */
    setWake(v) { wake.to(v); },
    destroy() {
      if (off) off();
      window.removeEventListener('pointermove', onMove);
      layers.forEach((l) => l.remove());
      el.classList.remove('sf-aurora');
    },
  };
}

export default auroraBorder;
