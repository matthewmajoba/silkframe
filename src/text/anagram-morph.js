/**
 * Anagram Morph
 * Words rearrange themselves. Letters shared by the outgoing and incoming
 * word physically travel to their new places on arcing paths (alternating
 * over and under the line), letters that are no longer needed drop away,
 * and new ones condense out of blur. The container width glides between
 * the two words. LISTEN → SILENT is pure choreography.
 *
 *   const fx = anagramMorph('.word', { words: ['listen', 'silent', 'enlist'] });
 *   fx.play();
 */
import { injectStyle } from '../core/style.js';
import { wait } from '../core/ticker.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { graphemes } from '../core/split.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-anagram',
  `:where(.sf-anagram){position:relative}.sf-anagram{display:inline-block;vertical-align:bottom;white-space:nowrap;height:1.2em;line-height:1.2em}
.sf-anagram-g{position:absolute;left:0;top:0;white-space:pre;will-change:transform,opacity,filter}
.sf-anagram-probe{position:absolute;visibility:hidden;white-space:pre;left:0;top:0}`
);

const DEFAULTS = {
  words: null,
  duration: 1150,
  hold: 1600,
  stagger: 28,
  arc: 0.55, // arc height in em
  caseSensitive: false,
  loop: true,
};

export function anagramMorph(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const words = o.words && o.words.length ? o.words : [el.textContent.trim()];
  const original = el.innerHTML;
  el.classList.add('sf-anagram');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '';
  const sr = document.createElement('span');
  sr.className = 'sf-sr';
  el.appendChild(sr);
  const probe = document.createElement('span');
  probe.className = 'sf-anagram-probe';
  probe.setAttribute('aria-hidden', 'true');
  el.appendChild(probe);

  let glyphs = []; // { node, ch, x }
  let width = 0;
  let index = 0;
  let running = false;
  let token = 0;
  let anims = [];

  /** Measure the x offset of each grapheme of `word` as rendered in this font. */
  function layout(word) {
    const chars = graphemes(word);
    probe.innerHTML = chars.map((c) => `<span>${c === ' ' ? '&nbsp;' : c.replace(/</g, '&lt;')}</span>`).join('');
    const base = probe.getBoundingClientRect().left;
    const xs = Array.from(probe.children).map((s) => s.getBoundingClientRect().left - base);
    const w = probe.getBoundingClientRect().width;
    return { chars, xs, w };
  }

  function make(ch, x) {
    const node = document.createElement('span');
    node.className = 'sf-anagram-g';
    node.setAttribute('aria-hidden', 'true');
    node.textContent = ch;
    node.style.transform = `translate3d(${x}px,0,0)`;
    el.appendChild(node);
    return { node, ch, x };
  }

  function set(word) {
    glyphs.forEach((g) => g.node.remove());
    const L = layout(word);
    glyphs = L.chars.map((c, i) => make(c, L.xs[i]));
    width = L.w;
    el.style.width = `${width}px`;
    sr.textContent = word;
  }

  const norm = (c) => (o.caseSensitive ? c : c.toLowerCase());

  async function to(word) {
    const my = ++token;
    anims.forEach((a) => a.cancel());
    anims = [];
    if (prefersReducedMotion()) { set(word); return true; }
    const L = layout(word);
    sr.textContent = word;
    // Greedy matching: each target letter claims the nearest unused source letter.
    const used = new Set();
    const plan = L.chars.map((c, i) => {
      let best = -1, bestD = Infinity;
      glyphs.forEach((g, j) => {
        if (used.has(j) || norm(g.ch) !== norm(c) || c === ' ') return;
        const d = Math.abs(g.x - L.xs[i]);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best >= 0) used.add(best);
      return { i, from: best };
    });
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const D = o.duration;
    const next = [];
    // Width glides between words.
    anims.push(el.animate([{ width: `${width}px` }, { width: `${L.w}px` }], { duration: D, easing: css.cinematic, fill: 'forwards' }));
    let order = 0;
    plan.forEach(({ i, from }) => {
      const x1 = L.xs[i];
      if (from >= 0) {
        const g = glyphs[from];
        const x0 = g.x;
        const dir = order % 2 ? 1 : -1;
        const lift = Math.min(1, Math.abs(x1 - x0) / (fs * 2)) * o.arc * fs * dir;
        const delay = order++ * o.stagger;
        if (g.ch !== L.chars[i]) g.node.textContent = L.chars[i]; // case changes
        anims.push(g.node.animate(
          [
            { transform: `translate3d(${x0}px,0,0) rotate(0deg)` },
            { transform: `translate3d(${(x0 + x1) / 2}px,${lift}px,0) rotate(${dir * 8}deg)`, offset: 0.5 },
            { transform: `translate3d(${x1}px,0,0) rotate(0deg)` },
          ],
          { duration: D, delay, easing: css.inOutQuart, fill: 'both' }
        ));
        next.push({ node: g.node, ch: L.chars[i], x: x1 });
      } else {
        const g = make(L.chars[i], x1);
        anims.push(g.node.animate(
          [
            { transform: `translate3d(${x1}px,${-0.6 * fs}px,0) scale(.7)`, opacity: 0, filter: 'blur(6px)' },
            { transform: `translate3d(${x1}px,0,0) scale(1)`, opacity: 1, filter: 'blur(0px)' },
          ],
          { duration: D * 0.8, delay: D * 0.35 + order++ * o.stagger, easing: css.cinematic, fill: 'both' }
        ));
        next.push(g);
      }
    });
    // Letters that are no longer needed drop away.
    glyphs.forEach((g, j) => {
      if (used.has(j)) return;
      anims.push(g.node.animate(
        [
          { transform: `translate3d(${g.x}px,0,0) rotate(0deg)`, opacity: 1, filter: 'blur(0px)' },
          { transform: `translate3d(${g.x}px,${0.7 * fs}px,0) rotate(${(j % 2 ? 1 : -1) * 14}deg)`, opacity: 0, filter: 'blur(5px)' },
        ],
        { duration: D * 0.6, delay: j * 18, easing: css.inQuart, fill: 'forwards' }
      ));
    });
    const leaving = glyphs.filter((_, j) => !used.has(j));
    glyphs = next;
    width = L.w;
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    if (my !== token) return false;
    leaving.forEach((g) => g.node.remove());
    // Commit final poses and release animations.
    glyphs.forEach((g) => (g.node.style.transform = `translate3d(${g.x}px,0,0)`));
    el.style.width = `${width}px`;
    anims.forEach((a) => a.cancel());
    anims = [];
    return true;
  }

  async function cycle() {
    while (running) {
      await wait(o.hold);
      if (!running) return;
      index = (index + 1) % words.length;
      await to(words[index]);
      if (!o.loop && index === words.length - 1) running = false;
    }
  }

  set(words[0]);

  return {
    el,
    to,
    play() { if (!running) { running = true; cycle(); } return Promise.resolve(true); },
    pause() { running = false; },
    destroy() {
      running = false;
      token++;
      anims.forEach((a) => a.cancel());
      el.innerHTML = original;
      el.style.width = '';
      el.classList.remove('sf-anagram');
      el.removeAttribute('aria-live');
    },
  };
}

export default anagramMorph;
