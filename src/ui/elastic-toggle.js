/**
 * Elastic Toggle
 * A switch with a body. Pressing squashes the knob in anticipation; on
 * release it launches across, stretching with its velocity (volume kept)
 * and landing with a jelly wobble while the track floods with colour from
 * the knob's side. Fully keyboard and screen-reader accessible.
 *
 *   <button class="switch" role="switch" aria-checked="false"></button>
 *   elasticToggle('.switch', { onChange: (on) => … });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-toggle',
  `:where(.sf-tg){position:relative}.sf-tg{width:var(--sf-tg-w,3.4em);height:var(--sf-tg-h,1.9em);border-radius:99px;border:0;padding:0;cursor:pointer;
  background:var(--sf-tg-off,#2a2a31);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);overflow:hidden;isolation:isolate}
.sf-tg-fill{position:absolute;inset:0;border-radius:inherit;background:var(--sf-tg-on,#ffb547);transform-origin:var(--sf-tg-origin,0% 50%);will-change:transform}
.sf-tg-knob{position:absolute;top:50%;left:0;width:calc(var(--sf-tg-h,1.9em) - .36em);height:calc(var(--sf-tg-h,1.9em) - .36em);
  margin-top:calc((var(--sf-tg-h,1.9em) - .36em) / -2);border-radius:99px;background:#fff;
  box-shadow:0 .12em .35em rgba(0,0,0,.35),inset 0 -.08em .12em rgba(0,0,0,.08);will-change:transform,width;z-index:1}
.sf-tg:focus-visible{outline:2px solid var(--sf-tg-on,#ffb547);outline-offset:3px}`
);

const DEFAULTS = {
  checked: false,
  onChange: null,
};

export function elasticToggle(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-tg');
  el.setAttribute('role', 'switch');
  if (el.tagName !== 'BUTTON') el.tabIndex = 0;
  const fill = document.createElement('span');
  fill.className = 'sf-tg-fill';
  const knob = document.createElement('span');
  knob.className = 'sf-tg-knob';
  el.append(fill, knob);
  let on = !!(o.checked || el.getAttribute('aria-checked') === 'true');
  const pos = new Spring(on ? 1 : 0, { stiffness: 300, damping: 19, precision: 0.0005 });
  const squash = new Spring(0, { stiffness: 420, damping: 16, precision: 0.0005 });
  const flood = new Spring(on ? 1 : 0, { stiffness: 140, damping: 18, precision: 0.0005 });
  let off = null;

  function geometry() {
    const W = el.clientWidth, H = el.clientHeight;
    const pad = (H - knob.offsetHeight) / 2;
    return { travel: W - knob.offsetWidth - pad * 2, pad };
  }

  function frame(_, dt) {
    const s = dt / 1000;
    pos.step(s); squash.step(s); flood.step(s);
    const { travel, pad } = geometry();
    // Velocity → horizontal stretch (volume preserving), press → squash.
    const v = clamp(Math.abs(pos.velocity) / 9, 0, 0.55);
    const sq = clamp(squash.value, -0.3, 0.3);
    const sx = 1 + v + sq * 0.5;
    const sy = 1 / Math.sqrt(1 + v) - sq * 0.35;
    const x = pad + pos.value * travel;
    // Centre origin: flipping origins on overshoot would make the knob jump.
    knob.style.transformOrigin = '50% 50%';
    knob.style.transform = `translate3d(${x.toFixed(2)}px,0,0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    el.style.setProperty('--sf-tg-origin', on ? '0% 50%' : '100% 50%');
    fill.style.transform = `scaleX(${clamp(flood.value, 0, 1.02).toFixed(4)})`;
    fill.style.opacity = clamp(flood.value * 1.5).toFixed(3);
    if (pos.resting && squash.resting && flood.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function set(next, emit = true) {
    if (next === on) return;
    on = next;
    el.setAttribute('aria-checked', String(on));
    pos.to(on ? 1 : 0);
    flood.to(on ? 1 : 0);
    squash.to(0);
    squash.velocity = -6; // release pop
    wake();
    if (emit) o.onChange?.(on);
  }

  const onDown = () => { squash.to(0.22); wake(); };
  const onUp = () => { squash.to(0); wake(); };
  const onClick = () => set(!on);
  const onKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(!on); }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onUp);
  el.addEventListener('click', onClick);
  if (el.tagName !== 'BUTTON') el.addEventListener('keydown', onKey);
  el.setAttribute('aria-checked', String(on));
  requestAnimationFrame(wake);

  return {
    el,
    toggle: () => set(!on),
    set: (v) => set(!!v),
    /** Press-and-release with anticipation (for demos). */
    async press() { onDown(); await new Promise((r) => setTimeout(r, 140)); onUp(); set(!on); },
    get checked() { return on; },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      fill.remove();
      knob.remove();
      el.classList.remove('sf-tg');
    },
  };
}

export default elasticToggle;
