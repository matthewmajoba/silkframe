/**
 * Departure Board
 * A mechanically faithful split-flap display. Each flip is two hinged
 * leaves: the upper leaf falls under gravity (ease-in) while its shadow
 * darkens the card below, then the lower leaf lands with a small rebound.
 * Flips overlap like a real drum and decelerate onto the final character.
 *
 *   const board = splitFlap('.board', { length: 12 });
 *   board.set('LONDON 09:45');
 */
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { wait } from '../core/ticker.js';

injectStyle(
  'sf-flap',
  `.sf-board{display:inline-flex;gap:var(--sf-flap-gap,.07em);font-variant-numeric:tabular-nums}
:where(.sf-cell){position:relative}.sf-cell{width:var(--sf-flap-w,.78em);height:var(--sf-flap-h,1.16em);perspective:3.2em;
  line-height:var(--sf-flap-h,1.16em);text-align:center;border-radius:var(--sf-flap-r,.09em);
  box-shadow:0 .06em .12em rgba(0,0,0,.55),0 .02em 0 rgba(255,255,255,.04) inset}
.sf-half{position:absolute;left:0;right:0;height:50%;overflow:hidden;background:var(--sf-flap-bg,#17171c);
  color:var(--sf-flap-fg,#f2eee6);backface-visibility:hidden}
.sf-half>span{position:absolute;left:0;right:0;height:200%;display:block}
.sf-top{top:0;border-radius:var(--sf-flap-r,.09em) var(--sf-flap-r,.09em) 0 0;transform-origin:50% 100%;
  background:linear-gradient(to bottom,var(--sf-flap-bg-hi,#202027),var(--sf-flap-bg,#17171c))}
.sf-top>span{top:0}
.sf-bottom{bottom:0;border-radius:0 0 var(--sf-flap-r,.09em) var(--sf-flap-r,.09em);transform-origin:50% 0%}
.sf-bottom>span{top:-100%}
.sf-top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(0,0,0,.65)}
.sf-bottom::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:rgba(255,255,255,.05);z-index:1}
.sf-shade{position:absolute;inset:0;pointer-events:none;opacity:0}
.sf-top .sf-shade{background:linear-gradient(to bottom,rgba(0,0,0,.15),rgba(0,0,0,.65))}
.sf-bottom .sf-shade{background:linear-gradient(to bottom,rgba(0,0,0,.7),rgba(0,0,0,.2))}
.sf-leaf{z-index:2;will-change:transform}
.sf-cell::after{content:"";position:absolute;left:-.02em;right:-.02em;top:50%;height:.05em;transform:translateY(-50%);
  background:linear-gradient(to right,#000 0 8%,rgba(0,0,0,.55) 8% 92%,#000 92%);z-index:3;pointer-events:none}`
);

const DEFAULTS = {
  charset: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/→',
  length: null, // number of cells (defaults to text length)
  flip: 74, // ms per flip at full speed
  settle: 3, // final flips that decelerate
  stagger: 42, // ms between columns starting
  maxFlips: 18, // cap travel so long jumps still feel snappy
};

export function splitFlap(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const initial = (o.text ?? el.textContent).toUpperCase();
  const len = o.length || initial.length;
  const chars = Array.from(o.charset);
  el.textContent = '';
  el.classList.add('sf-board');
  el.setAttribute('role', 'img');

  const cells = Array.from({ length: len }, () => {
    const cell = document.createElement('span');
    cell.className = 'sf-cell';
    cell.setAttribute('aria-hidden', 'true');
    const top = half('sf-top');
    const bottom = half('sf-bottom');
    cell.append(top.el, bottom.el);
    el.appendChild(cell);
    return { cell, top, bottom, value: ' ', queue: Promise.resolve(), token: 0 };
  });

  function half(cls, leaf = false) {
    const h = document.createElement('span');
    h.className = `sf-half ${cls}${leaf ? ' sf-leaf' : ''}`;
    const t = document.createElement('span');
    const shade = document.createElement('span');
    shade.className = 'sf-shade';
    h.append(t, shade);
    return { el: h, text: t, shade, set(v) { t.textContent = v; } };
  }

  /** Animate one mechanical flip from `from` to `to`; resolves when the next flip may begin. */
  function flipOnce(c, from, to, d) {
    c.top.set(to); // revealed behind the falling leaf
    const leafTop = half('sf-top', true);
    leafTop.set(from);
    const leafBottom = half('sf-bottom', true);
    leafBottom.set(to);
    leafBottom.el.style.transform = 'rotateX(90deg)';
    c.cell.append(leafTop.el, leafBottom.el);

    const fall = d * 0.5;
    const land = d * 0.85;
    leafTop.el.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], {
      duration: fall, easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)', fill: 'forwards',
    });
    // Scheduling runs on the shared frame clock (deterministic in capture mode).
    wait(fall).then(() => leafTop.el.remove());
    leafTop.shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fall, easing: 'ease-in', fill: 'forwards' });
    c.bottom.shade.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], {
      duration: fall + land, easing: 'linear',
    });
    leafBottom.shade.animate([{ opacity: 1 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], {
      duration: land, delay: fall, easing: 'ease-out', fill: 'both',
    });
    leafBottom.el.animate(
        [
          { transform: 'rotateX(90deg)' },
          { transform: 'rotateX(0deg)', offset: 0.62 },
          { transform: 'rotateX(16deg)', offset: 0.8 },
          { transform: 'rotateX(0deg)' },
        ],
        { duration: land, delay: fall, easing: 'cubic-bezier(0.3, 0, 0.4, 1)', fill: 'both' }
      );
    wait(fall + land).then(() => {
      c.bottom.set(to);
      leafBottom.el.remove();
    });
    return wait(fall);
  }

  function path(fromChar, toChar) {
    let i = chars.indexOf(fromChar);
    const j = chars.indexOf(toChar);
    if (i < 0) i = 0;
    if (j < 0) return [toChar];
    const out = [];
    let steps = (j - i + chars.length) % chars.length;
    if (steps > o.maxFlips) {
      // Skip ahead — real boards have fast drums; we keep the tail visible.
      i = (j - o.maxFlips + chars.length) % chars.length;
      steps = o.maxFlips;
    }
    for (let k = 1; k <= steps; k++) out.push(chars[(i + k) % chars.length]);
    return out;
  }

  async function run(c, target, delay, token) {
    await wait(delay);
    const seq = path(c.value, target);
    for (let k = 0; k < seq.length; k++) {
      if (token !== c.token) return;
      const fromEnd = seq.length - 1 - k;
      const slow = fromEnd < o.settle ? 1 + (o.settle - fromEnd) * 0.45 : 1;
      const d = o.flip * 2 * slow;
      const from = c.value;
      c.value = seq[k];
      await flipOnce(c, from, seq[k], d);
    }
  }

  function set(text, { instant = false } = {}) {
    const t = String(text).toUpperCase().padEnd(len, ' ').slice(0, len);
    el.setAttribute('aria-label', t.trim());
    if (instant || prefersReducedMotion()) {
      cells.forEach((c, i) => {
        c.token++;
        c.value = t[i];
        c.top.set(t[i]);
        c.bottom.set(t[i]);
      });
      return Promise.resolve(true);
    }
    return Promise.all(
      cells.map((c, i) => {
        c.token++;
        return run(c, t[i], i * o.stagger, c.token);
      })
    ).then(() => wait(o.flip * 2)).then(() => true);
  }

  set(' '.repeat(len), { instant: true });

  return {
    el,
    set,
    play: () => set(initial),
    reverse: () => set(' '.repeat(len)),
    destroy() {
      cells.forEach((c) => c.token++);
      el.textContent = initial;
      el.classList.remove('sf-board');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    },
  };
}

export default splitFlap;
