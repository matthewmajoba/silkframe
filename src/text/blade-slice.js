/**
 * Blade Slice
 * The headline arrives in two halves cut along a diagonal. They glide in
 * from opposite ends of the cut and meet; at the moment of contact a
 * filament of light races along the seam. reverse() draws the blade first,
 * then lets the halves shear apart.
 *
 *   const fx = bladeSlice('.title', { angle: -8 });
 *   fx.play();
 */
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';
import { wait } from '../core/ticker.js';

injectStyle(
  'sf-blade',
  `.sf-blade{position:relative}
.sf-blade-half{display:block}
.sf-blade-b{position:absolute;inset:0}
.sf-blade-line{position:absolute;left:50%;top:50%;height:2px;pointer-events:none;opacity:0}
.sf-blade-line>i{position:absolute;inset:0;border-radius:2px;transform-origin:0 50%;transform:scaleX(0);
  background:linear-gradient(90deg,transparent,var(--sf-blade,#fff3dc) 18%,#fff 50%,var(--sf-blade,#fff3dc) 82%,transparent);
  box-shadow:0 0 12px 2px var(--sf-blade-glow,rgba(255,176,90,.85)),0 0 42px 6px var(--sf-blade-glow-2,rgba(255,140,60,.35))}`
);

const DEFAULTS = {
  angle: -9, // cut angle in degrees
  distance: 0.9, // travel in em along the cut
  gap: 0.18, // perpendicular separation in em
  duration: 1400,
};

export function bladeSlice(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const original = el.innerHTML;
  el.classList.add('sf-blade');
  const a = document.createElement('span');
  a.className = 'sf-blade-half';
  a.innerHTML = original;
  const b = a.cloneNode(true);
  b.classList.add('sf-blade-b');
  b.setAttribute('aria-hidden', 'true');
  const blade = document.createElement('span');
  blade.className = 'sf-blade-line';
  blade.setAttribute('aria-hidden', 'true');
  const filament = document.createElement('i');
  blade.appendChild(filament);
  el.innerHTML = '';
  el.append(a, b, blade);
  b.style.visibility = 'hidden';

  let anims = [];
  const rad = (o.angle * Math.PI) / 180;

  function cut() {
    const w = el.clientWidth, h = el.clientHeight;
    const tan = Math.tan(rad);
    const cx = w / 2, cy = h / 2;
    const ext = Math.max(w, h) * 2;
    const yAt = (x) => cy + (x - cx) * tan;
    const L = -ext, R = w + ext;
    a.style.clipPath = `polygon(${L}px ${-ext}px, ${R}px ${-ext}px, ${R}px ${yAt(R)}px, ${L}px ${yAt(L)}px)`;
    b.style.clipPath = `polygon(${L}px ${yAt(L)}px, ${R}px ${yAt(R)}px, ${R}px ${h + ext}px, ${L}px ${h + ext}px)`;
    b.style.visibility = '';
    blade.style.width = `${Math.hypot(w, w * tan) * 1.15}px`;
    blade.style.transform = `translate(-50%, -50%) rotate(${o.angle}deg)`;
  }

  function heal() {
    a.style.clipPath = '';
    b.style.clipPath = '';
    b.style.visibility = 'hidden';
  }

  function cancel() {
    anims.forEach((x) => x.cancel());
    anims = [];
  }

  const vec = () => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const d = o.distance * fs, g = o.gap * fs;
    const dx = Math.cos(rad) * d, dy = Math.sin(rad) * d;
    const nx = -Math.sin(rad) * g, ny = Math.cos(rad) * g;
    return { dx, dy, nx, ny };
  };

  function flash(delay) {
    // Holder is positioned + rotated once (in cut()); only the filament scales,
    // so its pivot never drifts off the seam.
    anims.push(
      filament.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 280, delay, easing: css.outQuart, fill: 'both',
      }),
      blade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], {
        duration: 900, delay, easing: 'ease-out', fill: 'both',
      })
    );
  }

  function play() {
    cancel();
    if (prefersReducedMotion()) { heal(); a.style.opacity = ''; return Promise.resolve(true); }
    cut();
    const { dx, dy, nx, ny } = vec();
    const D = o.duration;
    const moveA = a.animate(
      [{ transform: `translate3d(${-dx - nx}px, ${-dy - ny}px, 0)` }, { transform: 'translate3d(0,0,0)' }],
      { duration: D, easing: css.cinematic, fill: 'both' }
    );
    const moveB = b.animate(
      [{ transform: `translate3d(${dx + nx}px, ${dy + ny}px, 0)` }, { transform: 'translate3d(0,0,0)' }],
      { duration: D, easing: css.cinematic, fill: 'both' }
    );
    const fadeA = a.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: D * 0.4, easing: 'ease-out', fill: 'both' });
    const fadeB = b.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: D * 0.4, easing: 'ease-out', fill: 'both' });
    anims.push(moveA, moveB, fadeA, fadeB);
    flash(D * 0.42);
    // Seam is invisible once the halves meet — heal the clip for crisp text.
    const healed = wait(D * 0.75);
    return Promise.all([moveA.finished, healed])
      .then(() => {
        heal();
        [moveA, moveB, fadeA, fadeB].forEach((x) => x.cancel());
        return true;
      })
      .catch(() => false);
  }

  function reverse() {
    cancel();
    if (prefersReducedMotion()) { a.style.opacity = '0'; return Promise.resolve(true); }
    cut();
    const { dx, dy, nx, ny } = vec();
    flash(0);
    const opts = { duration: 900, delay: 220, easing: css.inQuart, fill: 'both' };
    const outA = a.animate(
      [{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: `translate3d(${-dx * 1.4 - nx}px, ${-dy * 1.4 - ny}px, 0) rotate(${o.angle * 0.15}deg)`, opacity: 0 }],
      opts
    );
    const outB = b.animate(
      [{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: `translate3d(${dx * 1.4 + nx}px, ${dy * 1.4 + ny}px, 0) rotate(${o.angle * 0.15}deg)`, opacity: 0 }],
      opts
    );
    anims.push(outA, outB);
    return Promise.all([outA.finished, outB.finished]).then(() => true).catch(() => false);
  }

  return {
    el,
    play,
    reverse,
    destroy() {
      cancel();
      el.innerHTML = original;
      el.classList.remove('sf-blade');
    },
  };
}

export default bladeSlice;
