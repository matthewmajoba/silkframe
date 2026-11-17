/**
 * Liquid Morph
 * Words melt into one another through a surface-tension threshold: the
 * outgoing word dissolves into blurred liquid while the incoming word
 * condenses out of it, and the container width glides between them on a
 * spring so surrounding text reflows gracefully.
 *
 *   const fx = liquidMorph('.word', { words: ['motion', 'emotion', 'cinema'] });
 *   fx.play();   // starts cycling
 */
import { tick, wait } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { Spring } from '../core/spring.js';
import { clamp, lerp, smoothstep, resolve, svg, uniqueId, prefersReducedMotion } from '../core/utils.js';
import { inOutSine } from '../core/ease.js';

injectStyle(
  'sf-morph',
  `.sf-morph{display:inline-block;position:relative;vertical-align:bottom;white-space:nowrap}
.sf-morph-word{position:absolute;left:0;top:0;white-space:nowrap;will-change:filter,opacity,transform}
.sf-morph-sizer{visibility:hidden;white-space:nowrap}
.sf-morph-defs{position:absolute;width:0;height:0;overflow:hidden}`
);

const DEFAULTS = {
  words: null,
  duration: 1300, // morph time
  hold: 2000, // time each word rests
  blur: 8, // max blur in px as words dissolve
  align: 'left', // 'left' | 'center'
  loop: true,
};

export function liquidMorph(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const words = o.words && o.words.length ? o.words : [el.textContent.trim()];
  const id = uniqueId('sf-goo');
  el.classList.add('sf-morph');
  el.setAttribute('aria-live', 'polite');
  const original = el.innerHTML;

  const defs = svg('svg', { class: 'sf-morph-defs', 'aria-hidden': 'true' });
  const filter = svg('filter', { id, 'color-interpolation-filters': 'sRGB', x: '-10%', y: '-30%', width: '120%', height: '160%' });
  const matrix = svg('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0' });
  filter.appendChild(matrix);
  defs.appendChild(filter);

  const sizer = document.createElement('span');
  sizer.className = 'sf-morph-sizer';
  sizer.setAttribute('aria-hidden', 'true');
  const a = document.createElement('span');
  const b = document.createElement('span');
  a.className = b.className = 'sf-morph-word';
  b.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('span');
  stage.style.cssText = 'position:absolute;inset:0;';
  stage.append(a, b);
  el.innerHTML = '';
  el.append(sizer, stage, defs);

  let index = 0;
  a.textContent = words[0];
  sizer.textContent = words[0];
  b.textContent = '';
  const width = new Spring(0, { stiffness: 140, damping: 22, precision: 0.1 });
  const measure = (text) => {
    sizer.textContent = text;
    return sizer.getBoundingClientRect().width;
  };
  width.set(measure(words[0]));
  el.style.width = `${width.value}px`;

  let off = null;
  let running = false;
  let morph = null; // { t, from, to, target }

  function place(node, w) {
    if (o.align === 'center') node.style.left = `${(width.value - w) / 2}px`;
  }

  function frame(_, dt) {
    const s = dt / 1000;
    width.step(s);
    el.style.width = `${width.value.toFixed(2)}px`;
    if (morph) {
      morph.t += dt;
      const p = clamp(morph.t / o.duration);
      const f = inOutSine(p);
      // Ease the surface-tension threshold in and out of identity so the
      // resting words never thicken when the filter attaches or detaches.
      const k = smoothstep(0, 0.2, p) * (1 - smoothstep(0.8, 1, p));
      matrix.setAttribute('values', `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${lerp(1, 26, k).toFixed(2)} ${lerp(0, -9, k).toFixed(2)}`);
      const inv = 1 - f;
      // Classic surface-tension morph: blur grows as opacity falls.
      b.style.filter = `blur(${Math.min(o.blur / Math.max(f, 0.001) - o.blur, 100).toFixed(2)}px)`;
      b.style.opacity = Math.pow(f, 0.4).toFixed(3);
      a.style.filter = `blur(${Math.min(o.blur / Math.max(inv, 0.001) - o.blur, 100).toFixed(2)}px)`;
      a.style.opacity = Math.pow(inv, 0.4).toFixed(3);
      const lift = 0.08;
      a.style.transform = `translate3d(0, ${(-f * lift).toFixed(3)}em, 0)`;
      b.style.transform = `translate3d(0, ${(inv * lift).toFixed(3)}em, 0)`;
      place(a, morph.wa);
      place(b, morph.wb);
      if (p >= 1) {
        // Swap roles; drop the filter for crisp anti-aliased resting text.
        a.textContent = b.textContent;
        b.textContent = '';
        for (const n of [a, b]) { n.style.filter = ''; n.style.transform = ''; }
        a.style.opacity = '';
        b.style.opacity = '0';
        place(a, morph.wb);
        stage.style.filter = '';
        morph = null;
        if (running && o.loop) schedule();
      }
    } else {
      place(a, measureCache.get(a.textContent) ?? width.target);
    }
    if (!morph && width.resting) { off(); off = null; }
  }
  const measureCache = new Map();
  const wake = () => { if (!off) off = tick(frame); };

  function to(word) {
    if (prefersReducedMotion()) {
      a.textContent = word;
      width.set(measure(word));
      el.style.width = `${width.value}px`;
      return;
    }
    const wa = measure(a.textContent);
    const wb = measure(word);
    measureCache.set(a.textContent, wa).set(word, wb);
    b.textContent = word;
    b.style.opacity = '0';
    width.to(wb);
    matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
    stage.style.filter = `url(#${id})`;
    morph = { t: 0, wa, wb };
    wake();
  }

  // Hold timing runs on the shared frame clock (pauses with the tab).
  let token = 0;
  function schedule() {
    const my = ++token;
    wait(o.hold).then(() => { if (my === token && running) next(); });
  }

  function next() {
    token++;
    index = (index + 1) % words.length;
    to(words[index]);
  }

  return {
    el,
    play() {
      running = true;
      schedule();
      return Promise.resolve(true);
    },
    pause() { running = false; token++; },
    next,
    to,
    destroy() {
      running = false;
      token++;
      if (off) off();
      el.innerHTML = original;
      el.style.width = '';
      el.classList.remove('sf-morph');
      el.removeAttribute('aria-live');
    },
  };
}

export default liquidMorph;
