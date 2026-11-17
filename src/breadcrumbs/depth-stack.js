/**
 * Depth Stack
 * Wayfinding as physical depth. Every level is a card; ancestors recede
 * behind the current one as tabbed sheets you can see the edge of. Going
 * deeper slides a new sheet up into the front while the others step back;
 * choosing an ancestor drops the sheets in front of it away under gravity.
 *
 *   const stack = depthStack(el, { items: ['Workspace', 'Projects'] });
 *   stack.push('Silkframe');   stack.go(0);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-depthstack',
  `.sf-ds{position:relative;perspective:1200px}
.sf-ds-sheet{position:absolute;left:0;right:0;bottom:0;height:var(--sf-ds-h,8.5em);border-radius:1em;transform-origin:50% 100%;
  background:var(--sf-ds-bg,linear-gradient(180deg,#1d1c23,#121116));color:var(--sf-ds-fg,#efe9df);
  box-shadow:0 -1px 0 rgba(255,255,255,.08) inset,0 1.2em 2.4em -1em rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.06);
  will-change:transform,opacity,filter;display:flex;flex-direction:column;justify-content:space-between;padding:1em 1.3em;
  border:0;font:inherit;text-align:left;cursor:pointer}
.sf-ds-sheet.is-current{cursor:default}
.sf-ds-tab{display:flex;justify-content:space-between;align-items:center;font-size:.78em;letter-spacing:.14em;text-transform:uppercase;opacity:.6}
.sf-ds-title{font-size:1.9em;line-height:1;letter-spacing:-.02em}`
);

const DEFAULTS = {
  items: [],
  peek: 26, // px each ancestor shows above the next
  recede: 0.055, // scale lost per level
  onNavigate: null,
};

export function depthStack(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-ds');
  el.setAttribute('role', 'navigation');
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Breadcrumb');
  el.innerHTML = '';
  const sheets = [];
  const falling = [];
  let off = null;

  function make(label, index) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'sf-ds-sheet';
    node.innerHTML = `<span class="sf-ds-tab"><span>Level ${String(index + 1).padStart(2, '0')}</span><span>↵</span></span><span class="sf-ds-title"></span>`;
    node.querySelector('.sf-ds-title').textContent = label;
    node.addEventListener('click', () => {
      const i = sheets.findIndex((s) => s.node === node);
      if (i >= 0 && i < sheets.length - 1) { go(i); o.onNavigate?.(i, sheets.map((s) => s.label)); }
    });
    el.appendChild(node);
    const cfg = { stiffness: 170, damping: 21, precision: 0.02 };
    return {
      node, label,
      y: new Spring(0, cfg),
      s: new Spring(1, { ...cfg, precision: 0.0003 }),
      a: new Spring(1, { ...cfg, precision: 0.002 }),
      vy: 0, rot: 0, vr: 0,
    };
  }

  function arrange() {
    const n = sheets.length;
    sheets.forEach((sh, i) => {
      const depth = n - 1 - i;
      sh.y.to(-depth * o.peek);
      sh.s.to(1 - depth * o.recede);
      sh.a.to(depth > 4 ? 0 : 1); // sheets stay opaque; depth is shown by light
      sh.node.style.zIndex = String(i + 1);
      sh.node.classList.toggle('is-current', depth === 0);
      if (depth === 0) sh.node.setAttribute('aria-current', 'page');
      else sh.node.removeAttribute('aria-current');
      sh.node.tabIndex = depth === 0 ? -1 : 0;
    });
    wake();
  }

  function render(sh, extra = '') {
    const depth = sheets.length - 1 - sheets.indexOf(sh);
    sh.node.style.transform = `translate3d(0, ${sh.y.value.toFixed(2)}px, 0) scale(${sh.s.value.toFixed(4)})${extra}`;
    sh.node.style.opacity = clamp(sh.a.value).toFixed(3);
    sh.node.style.filter = depth > 0 ? `brightness(${(1 - Math.min(depth, 4) * 0.12).toFixed(3)})` : '';
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = falling.length > 0;
    for (const sh of sheets) {
      sh.y.step(s); sh.s.step(s); sh.a.step(s);
      if (!sh.y.resting || !sh.s.resting || !sh.a.resting) busy = true;
      render(sh);
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 2600 * s;
      f.y.value += f.vy * s;
      f.rot += f.vr * s;
      f.a.value -= s * 2.4;
      f.node.style.transform = `translate3d(0, ${f.y.value.toFixed(1)}px, 0) rotateX(${(-f.rot).toFixed(2)}deg) scale(${f.s.value.toFixed(4)})`;
      f.node.style.opacity = clamp(f.a.value).toFixed(3);
      if (f.a.value <= 0) { f.node.remove(); falling.splice(i, 1); }
    }
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function push(label) {
    const sh = make(label, sheets.length);
    sheets.push(sh);
    if (!prefersReducedMotion()) {
      // Rise in from below the stack.
      sh.y.set(el.clientHeight * 0.55);
      sh.s.set(1.04);
      sh.a.set(0);
    }
    arrange();
    return Promise.resolve(true);
  }

  function go(index) {
    if (index >= sheets.length - 1) return Promise.resolve(true);
    const removed = sheets.splice(index + 1);
    removed.reverse().forEach((f, k) => {
      f.vy = -220 + k * 120;
      f.vr = 40 + k * 14;
      f.node.style.zIndex = String(100 + k);
      f.node.style.pointerEvents = 'none';
      falling.push(f);
    });
    arrange();
    return Promise.resolve(true);
  }

  function set(labels) {
    sheets.splice(0).forEach((s) => s.node.remove());
    labels.forEach((l, i) => sheets.push(make(l, i)));
    arrange();
    sheets.forEach((sh) => { sh.y.set(sh.y.target); sh.s.set(sh.s.target); sh.a.set(sh.a.target); render(sh); });
  }

  set(o.items);

  return {
    el,
    push,
    go,
    pop: () => go(sheets.length - 2),
    set,
    get items() { return sheets.map((s) => s.label); },
    destroy() {
      if (off) off();
      el.innerHTML = '';
      el.classList.remove('sf-ds');
    },
  };
}

export default depthStack;
