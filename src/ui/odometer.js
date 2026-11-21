/**
 * Rolling Odometer
 * Numbers that travel. Every digit is a reel that spins through the values
 * in between — further reels spin longer, each with a velocity smear — and
 * settles with a soft mechanical overshoot. Width changes (99 → 100) open
 * and close smoothly; separators and prefixes stay put.
 *
 *   const odo = odometer('.price', { value: 1290, format: (n) => n.toLocaleString() });
 *   odo.set(48210);
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, prefersReducedMotion } from '../core/utils.js';
import { cubicBezier } from '../core/ease.js';

injectStyle(
  'sf-odo',
  `.sf-odo{display:inline-flex;align-items:flex-start;font-variant-numeric:tabular-nums;line-height:1}
:where(.sf-odo-reel){position:relative}.sf-odo-reel{display:inline-block;height:1em;overflow:hidden;width:var(--sf-odo-w,.62em);transition:width .6s cubic-bezier(.16,1,.3,1)}
.sf-odo-reel.is-entering,.sf-odo-reel.is-leaving{width:0}
.sf-odo-strip{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:center;will-change:transform,filter}
.sf-odo-strip>span{display:block;height:1em;line-height:1}
.sf-odo-static{display:inline-block;height:1em;line-height:1}
.sf-odo .sf-odo-reel,.sf-odo .sf-odo-strip,.sf-odo .sf-odo-strip>span,.sf-odo .sf-odo-static,.sf-odo .sf-odo-probe{
  font:inherit;font-size:inherit;letter-spacing:inherit;text-transform:none;color:inherit;opacity:1;margin:0;padding:0}`
);

const settle = cubicBezier(0.2, 0.9, 0.25, 1.06); // gentle mechanical overshoot

const DEFAULTS = {
  value: 0,
  format: (n) => Math.round(n).toLocaleString('en-US'),
  duration: 1600,
  stagger: 70, // ms between reels, right to left
  blur: true,
};

export function odometer(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-odo');
  el.setAttribute('role', 'text');
  el.innerHTML = '';
  const fs = parseFloat(getComputedStyle(el).fontSize);
  let reels = []; // { el, strip, digit }
  let value = o.value;
  let off = null;

  const digitW = (() => {
    const probe = document.createElement('span');
    probe.className = 'sf-odo-probe';
    probe.textContent = '0';
    probe.style.cssText = 'position:absolute;visibility:hidden';
    el.appendChild(probe);
    const w = probe.getBoundingClientRect().width / fs;
    probe.remove();
    return w || 0.62;
  })();
  el.style.setProperty('--sf-odo-w', `${digitW}em`);

  function makeReel(d) {
    const reel = document.createElement('span');
    reel.className = 'sf-odo-reel';
    reel.setAttribute('aria-hidden', 'true');
    const strip = document.createElement('span');
    strip.className = 'sf-odo-strip';
    reel.appendChild(strip);
    const r = { el: reel, strip, digit: d, from: d, to: d, spins: 0 };
    fillStrip(r, d, d, 0);
    return r;
  }

  // Strip lists every digit the reel passes through: from → (spins × 10) → to.
  function fillStrip(r, from, to, spins) {
    const seq = [];
    let steps = (to - from + 10) % 10 + spins * 10;
    for (let i = 0; i <= steps; i++) seq.push((from + i) % 10);
    r.strip.innerHTML = seq.map((d) => `<span>${d}</span>`).join('');
    r.steps = steps;
  }

  function render(text, animate) {
    el.setAttribute('aria-label', text);
    const chars = Array.from(text);
    const digitsNeeded = chars.filter((c) => /\d/.test(c)).length;
    // Build a fresh token list, reusing reels from the right.
    const oldReels = reels.slice();
    const fresh = [];
    const frag = document.createDocumentFragment();
    let reelIdx = 0;
    const oldCount = oldReels.length;
    chars.forEach((c) => {
      if (/\d/.test(c)) {
        const fromRight = digitsNeeded - 1 - reelIdx;
        const reuse = oldReels[oldCount - 1 - fromRight];
        const d = Number(c);
        let r;
        if (reuse && animate) {
          r = reuse;
          r.from = r.digit;
          r.to = d;
        } else {
          r = makeReel(d);
          r.from = animate ? 0 : d;
          r.to = d;
          if (animate) r.el.classList.add('is-entering');
        }
        r.fromRight = fromRight;
        r.digit = d;
        fresh.push(r);
        frag.appendChild(r.el);
        reelIdx++;
      } else {
        const s = document.createElement('span');
        s.className = 'sf-odo-static';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = c;
        frag.appendChild(s);
      }
    });
    // Reels that no longer exist fold away on the left.
    const leaving = oldReels.filter((r) => !fresh.includes(r));
    el.innerHTML = '';
    leaving.forEach((r) => { el.appendChild(r.el); });
    el.appendChild(frag);
    if (animate) {
      requestAnimationFrame(() => {
        fresh.forEach((r) => r.el.classList.remove('is-entering'));
        leaving.forEach((r) => r.el.classList.add('is-leaving'));
      });
      setTimeout(() => leaving.forEach((r) => r.el.remove()), 700);
    }
    reels = fresh;
  }

  function set(next) {
    const prev = value;
    value = next;
    const text = o.format(next);
    if (prefersReducedMotion()) {
      render(text, false);
      return Promise.resolve(true);
    }
    render(text, true);
    // Spin count grows with place value so big jumps feel big.
    const delta = Math.abs(Math.round(next) - Math.round(prev));
    reels.forEach((r) => {
      // Lower places pass through more full turns (capped) — like a real counter.
      const spins = Math.min(Math.floor(delta / Math.pow(10, r.fromRight + 1)), 2);
      fillStrip(r, r.from, r.to, spins);
      r.delay = r.fromRight * o.stagger;
      r.strip.style.transform = 'translate3d(0,0,0)';
    });
    if (off) off();
    return new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        let busy = false;
        for (const r of reels) {
          if (!r.steps) { r.strip.style.transform = ''; r.strip.style.filter = ''; continue; }
          const local = clamp((t - r.delay) / o.duration);
          const e = settle(local);
          const y = -e * r.steps;
          r.strip.style.transform = `translate3d(0, ${y.toFixed(4)}em, 0)`;
          if (o.blur) {
            // Velocity smear from the derivative of the eased curve (digits / unit time).
            const v = Math.abs(settle(clamp(local + 0.01)) - e) * r.steps * 100;
            r.strip.style.filter = v > 1.2 ? `blur(${Math.min((v - 1.2) * 0.006, 0.028).toFixed(3)}em)` : '';
          }
          if (local < 1) busy = true;
        }
        if (!busy) {
          off(); off = null;
          reels.forEach((r) => {
            fillStrip(r, r.to, r.to, 0);
            r.strip.style.transform = '';
            r.strip.style.filter = '';
          });
          done(true);
        }
      });
    });
  }

  render(o.format(value), false);

  return {
    el,
    set,
    get value() { return value; },
    destroy() {
      if (off) off();
      el.innerHTML = o.format(value);
      el.classList.remove('sf-odo');
    },
  };
}

export default odometer;
