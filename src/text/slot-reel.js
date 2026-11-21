/**
 * Slot Reel
 * Every letter is a reel in a slot machine. The reels spin up left to
 * right, later reels spinning longer, each strip smeared by its own speed;
 * they land one after another with a mechanical kick-back and a brief gilt
 * flash, so the word "clicks" into place.
 *
 *   const fx = slotReel('.headline', { spins: 2 });
 *   fx.play();
 *   fx.setText('JACKPOT');
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { resolve, clamp, prefersReducedMotion } from '../core/utils.js';
import { cubicBezier } from '../core/ease.js';
import { graphemes } from '../core/split.js';

injectStyle(
  'sf-slot',
  `.sf-slot{display:inline-flex;white-space:pre}
:where(.sf-slot-reel){position:relative}.sf-slot-reel{display:inline-block;height:1.08em;line-height:1.08em;overflow:hidden;vertical-align:bottom;
  -webkit-mask:linear-gradient(transparent,#000 22%,#000 78%,transparent);mask:linear-gradient(transparent,#000 22%,#000 78%,transparent)}
.sf-slot-reel.is-still{-webkit-mask:none;mask:none}
.sf-slot-strip{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:center;will-change:transform,filter}
.sf-slot-strip>span{display:block;height:1.08em}
.sf-slot-sizer{visibility:hidden}`
);

// Fast spin, long settle, small kick-back past the stop.
const land = cubicBezier(0.3, 0.05, 0.25, 1.12);

const DEFAULTS = {
  pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  spins: 2, // base strip length multiplier
  duration: 1500,
  stagger: 90,
  flash: '#ffd27a',
  seed: 5,
};

export function slotReel(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const pool = Array.from(o.pool);
  const rand = mulberry32(o.seed);
  el.classList.add('sf-slot');
  let text = el.textContent;
  let reels = [];
  let off = null;
  let settle = null;

  function build(str) {
    text = str;
    el.innerHTML = '';
    el.setAttribute('aria-label', str);
    reels = graphemes(str).map((ch, i) => {
      const reel = document.createElement('span');
      reel.className = 'sf-slot-reel is-still';
      reel.setAttribute('aria-hidden', 'true');
      const sizer = document.createElement('span');
      sizer.className = 'sf-slot-sizer';
      sizer.textContent = ch;
      const strip = document.createElement('span');
      strip.className = 'sf-slot-strip';
      strip.innerHTML = `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`;
      reel.append(sizer, strip);
      el.appendChild(reel);
      return { reel, strip, ch, i, steps: 0 };
    });
  }
  build(text.trim() || text);

  function fill(r) {
    if (r.ch === ' ') { r.steps = 0; return; }
    const n = Math.round(6 + o.spins * 6 + r.i * 2 + rand() * 4);
    const seq = Array.from({ length: n }, () => pool[Math.floor(rand() * pool.length)]);
    seq.push(r.ch);
    r.strip.innerHTML = seq.map((c) => `<span>${c}</span>`).join('');
    r.steps = n;
  }

  function play() {
    if (off) off();
    if (settle) settle(false);
    if (prefersReducedMotion()) return Promise.resolve(true);
    reels.forEach((r) => { fill(r); r.reel.classList.remove('is-still'); });
    const D = o.duration;
    return new Promise((done) => {
      settle = done;
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        let busy = false;
        for (const r of reels) {
          if (!r.steps) continue;
          const local = clamp((t - r.i * o.stagger) / (D + r.i * 40));
          const e = land(local);
          r.strip.style.transform = `translate3d(0, ${(-e * r.steps * 1.08).toFixed(4)}em, 0)`;
          const v = Math.abs(land(clamp(local + 0.01)) - e) * r.steps * 100;
          r.strip.style.filter = v > 2 ? `blur(${Math.min((v - 2) * 0.004, 0.05).toFixed(3)}em)` : '';
          if (local < 1) busy = true;
          else if (!r.done) {
            r.done = true;
            r.reel.classList.add('is-still');
            r.strip.innerHTML = `<span>${r.ch}</span>`;
            r.strip.style.transform = '';
            r.strip.style.filter = '';
            r.strip.firstChild.animate(
              [{ color: o.flash, textShadow: `0 0 .4em ${o.flash}` }, { color: 'inherit', textShadow: '0 0 0 transparent' }],
              { duration: 700, easing: 'ease-out' }
            );
          }
        }
        if (!busy) {
          off(); off = null; settle = null;
          reels.forEach((r) => (r.done = false));
          done(true);
        }
      });
    });
  }

  return {
    el,
    play,
    setText(str) { build(str); return play(); },
    destroy() {
      if (off) off();
      el.textContent = text;
      el.classList.remove('sf-slot');
      el.removeAttribute('aria-label');
    },
  };
}

export default slotReel;
