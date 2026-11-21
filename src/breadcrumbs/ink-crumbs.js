/**
 * Ink Underline
 * A breadcrumb annotated by hand. The current level is underlined with a
 * procedurally drawn ink stroke — slight wobble, pressure taper, a flick at
 * the end — that is written in when you arrive and lifted (erased) when
 * you leave. Hovering an ancestor sketches a faint pencil preview.
 *
 *   const crumbs = inkCrumbs(nav, { items: ['Atelier', 'Archive'] });
 *   crumbs.push('Sketches');   crumbs.go(0);
 */
import { tick, wait } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { svg, resolve, clamp, prefersReducedMotion } from '../core/utils.js';
import { inOutCubic, outCubic } from '../core/ease.js';

injectStyle(
  'sf-ink-crumbs',
  `:where(.sf-ic){position:relative}.sf-ic{display:inline-flex;align-items:center}
.sf-ic ol{display:flex;align-items:center;margin:0;padding:0;list-style:none}
.sf-ic li{display:flex;align-items:center;white-space:nowrap}
.sf-ic-link{background:none;border:0;font:inherit;color:var(--sf-ic-fg,rgba(255,255,255,.6));padding:.45em .3em;cursor:pointer;transition:color .3s}
.sf-ic-link:hover{color:#fff}
.sf-ic-link[aria-current="page"]{color:var(--sf-ic-active,#fff);cursor:default}
.sf-ic-sep{display:inline-block;width:.32em;height:.32em;margin:0 .55em;border-radius:50% 45% 55% 50%;background:var(--sf-ic-ink,#ffb547);opacity:.7}
.sf-ic svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}`
);

const DEFAULTS = {
  items: [],
  ink: '#ffb547',
  width: 2.4, // stroke weight px
  draw: 520, // ms to write a stroke
  onNavigate: null,
  seed: 3,
};

export function inkCrumbs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-ic');
  nav.style.setProperty('--sf-ic-ink', o.ink);
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = '';
  const ol = document.createElement('ol');
  const board = svg('svg', { 'aria-hidden': 'true' });
  const pencil = svg('path', { fill: 'none', stroke: o.ink, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0 });
  board.appendChild(pencil);
  nav.append(ol, board);
  const rand = mulberry32(o.seed);
  let items = [];
  let strokes = []; // live ink paths { path, len, from, to, t, dir }
  let off = null;

  /** A hand-made underline: wobbly baseline, end flick, as a stroked path. */
  function scribble(x0, x1, y) {
    const n = 7;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (rand() - 0.5) * 2, y + Math.sin(t * Math.PI * (1.2 + rand() * 0.6)) * 1.6 + (rand() - 0.5) * 1.4 - t * 1.2]);
    }
    // flick: curl back slightly up and left
    pts.push([x1 + 4, y - 5], [x1 - 6, y - 8]);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    return d;
  }

  function geom(link) {
    const nr = nav.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    return { x0: r.left - nr.left + 4, x1: r.right - nr.left - 4, y: r.bottom - nr.top - 3 };
  }

  function write(link) {
    const g = geom(link);
    const path = svg('path', { d: scribble(g.x0, g.x1, g.y), fill: 'none', stroke: o.ink, 'stroke-width': o.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    board.appendChild(path);
    const len = path.getTotalLength();
    path.setAttribute('stroke-dasharray', `${len} ${len}`);
    path.setAttribute('stroke-dashoffset', len);
    const s = { path, len, t: 0, dir: 1, link };
    strokes.push(s);
    wake();
    return s;
  }

  function lift(s) { s.dir = -1; s.t = Math.min(s.t, 1); wake(); }

  function frame(_, dt) {
    let busy = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      s.t = clamp(s.t + (s.dir * dt) / (s.dir > 0 ? o.draw : o.draw * 0.55));
      const e = s.dir > 0 ? inOutCubic(s.t) : outCubic(s.t);
      // Erase from the start of the stroke, like lifting ink off the page.
      if (s.dir > 0) s.path.setAttribute('stroke-dashoffset', (s.len * (1 - e)).toFixed(2));
      else s.path.setAttribute('stroke-dashoffset', (-s.len * (1 - e)).toFixed(2));
      s.path.setAttribute('stroke-width', (o.width * (s.dir > 0 ? 1 : 0.6 + 0.4 * e)).toFixed(2));
      if ((s.dir > 0 && s.t < 1) || (s.dir < 0 && s.t > 0)) busy = true;
      if (s.dir < 0 && s.t <= 0) { s.path.remove(); strokes.splice(i, 1); }
    }
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function make(label, index) {
    const li = document.createElement('li');
    if (index > 0) {
      const dot = document.createElement('span');
      dot.className = 'sf-ic-sep';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.transform = `rotate(${Math.round(rand() * 90)}deg)`;
      li.appendChild(dot);
    }
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'sf-ic-link';
    a.textContent = label;
    a.addEventListener('click', () => {
      const i = items.findIndex((it) => it.link === a);
      if (i >= 0 && i < items.length - 1) { go(i); o.onNavigate?.(i, items.map((it) => it.label)); }
    });
    a.addEventListener('pointerenter', () => {
      const i = items.findIndex((it) => it.link === a);
      if (i < 0 || i === items.length - 1) return;
      const g = geom(a);
      pencil.setAttribute('d', scribble(g.x0, g.x1, g.y + 1));
      pencil.animate([{ opacity: 0 }, { opacity: 0.35 }], { duration: 260, fill: 'forwards' });
    });
    a.addEventListener('pointerleave', () => pencil.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }));
    li.appendChild(a);
    ol.appendChild(li);
    return { li, link: a, label };
  }

  function current() {
    items.forEach((it, i) => {
      if (i === items.length - 1) it.link.setAttribute('aria-current', 'page');
      else it.link.removeAttribute('aria-current');
    });
  }

  function underline() {
    strokes.forEach(lift);
    const cur = items[items.length - 1];
    if (!cur) return;
    const s = write(cur.link);
    if (prefersReducedMotion()) { s.t = 1; s.path.setAttribute('stroke-dashoffset', 0); }
  }

  function push(label) {
    const it = make(label, items.length);
    items.push(it);
    current();
    if (!prefersReducedMotion()) {
      it.li.animate([{ opacity: 0, transform: 'translate3d(0,.4em,0)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
    underline();
    return Promise.resolve(true);
  }

  function go(index) {
    if (index >= items.length - 1) return Promise.resolve(true);
    const removed = items.splice(index + 1);
    current();
    removed.reverse().forEach((it, k) => {
      const a = it.li.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(5px)', transform: 'translate3d(.3em,0,0)' }], {
        duration: 380, delay: k * 60, easing: 'ease-in', fill: 'forwards',
      });
      a.finished.then(() => { it.li.remove(); }, () => it.li.remove());
    });
    strokes.forEach(lift);
    wait(380 + removed.length * 60).then(() => underline());
    return Promise.resolve(true);
  }

  function set(labels) {
    ol.innerHTML = '';
    strokes.forEach((s) => s.path.remove());
    strokes = [];
    items = labels.map((l, i) => make(l, i));
    current();
    requestAnimationFrame(underline);
  }

  set(o.items);

  return {
    el: nav,
    push,
    go,
    pop: () => go(items.length - 2),
    set,
    get items() { return items.map((it) => it.label); },
    destroy() {
      if (off) off();
      nav.innerHTML = '';
      nav.classList.remove('sf-ic');
    },
  };
}

export default inkCrumbs;
