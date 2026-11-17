/**
 * Scroll Scrub
 * A paragraph that is read into existence by scrolling. Each word wakes
 * in sequence — rising out of blur, warming from dim to full colour — with
 * a travelling highlight on the word currently "being read". Scroll input
 * is smoothed by a critically-damped follower, so wheel steps never judder.
 *
 *   scrollScrub('.manifesto', { start: 0.85, end: 0.25 });
 *   scrollScrub('.copy', { scroller: panelEl });   // inside a scroll container
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, smoothstep, prefersReducedMotion } from '../core/utils.js';

injectStyle('sf-scrub', `.sf-scrub .sf-word{will-change:opacity,filter,transform}`);

const DEFAULTS = {
  scroller: null, // element with its own scroll; default = the window
  start: 0.9, // progress 0 when the element's top reaches this viewport fraction
  end: 0.3, // progress 1 when the element's bottom reaches this fraction
  window: 3.5, // how many words are "in transition" at once
  dim: 0.14,
  blur: 6, // px
  highlight: '#ffb547',
  follow: 9, // smoothing (higher = snappier)
};

const parseRGB = (s) => (s.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(Number);

export function scrollScrub(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-scrub');
  const parts = split(el, { chars: false, words: true });
  const words = parts.words;
  const base = parseRGB(getComputedStyle(el).color);
  const hi = parseRGB(o.highlight.startsWith('#')
    ? `${parseInt(o.highlight.slice(1, 3), 16)},${parseInt(o.highlight.slice(3, 5), 16)},${parseInt(o.highlight.slice(5, 7), 16)}`
    : o.highlight);
  let shown = 0;
  let off = null;
  let visible = true;

  function target01() {
    const r = el.getBoundingClientRect();
    let top = 0, height = innerHeight;
    if (o.scroller) {
      const s = o.scroller.getBoundingClientRect();
      top = s.top; height = s.height;
    }
    const startY = top + height * o.start;
    const endY = top + height * o.end;
    // 0 when el.top hits startY, 1 when el.bottom hits endY
    const total = r.height + (startY - endY);
    return clamp((startY - r.top) / Math.max(total, 1));
  }

  function paint(p) {
    const n = words.length;
    const head = p * (n + o.window);
    words.forEach((w, i) => {
      const k = smoothstep(0, 1, clamp((head - i) / o.window));
      const glow = Math.max(0, 1 - Math.abs(head - o.window * 0.5 - i) / 1.4) * (k > 0 && k < 1 ? 1 : 0);
      w.style.opacity = (o.dim + (1 - o.dim) * k).toFixed(3);
      w.style.filter = k < 0.995 ? `blur(${((1 - k) * o.blur).toFixed(2)}px)` : '';
      w.style.transform = k < 0.995 ? `translate3d(0, ${((1 - k) * 0.18).toFixed(3)}em, 0)` : '';
      const c = base.map((v, j) => Math.round(v + (hi[j] - v) * glow));
      w.style.color = glow > 0.01 ? `rgb(${c.join(',')})` : '';
    });
  }

  function frame(_, dt) {
    if (!visible) return;
    const t = target01();
    shown += (t - shown) * (1 - Math.exp(-(dt / 1000) * o.follow));
    if (Math.abs(t - shown) < 0.0005) shown = t;
    paint(shown);
  }

  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { root: o.scroller || null });
  io.observe(el);

  if (prefersReducedMotion()) paint(1);
  else {
    shown = target01();
    paint(shown);
    off = tick(frame);
  }

  return {
    el,
    get progress() { return shown; },
    destroy() {
      off?.();
      io.disconnect();
      parts.revert();
      el.classList.remove('sf-scrub');
    },
  };
}

export default scrollScrub;
