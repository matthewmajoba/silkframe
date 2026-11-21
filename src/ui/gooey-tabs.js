/**
 * Gooey Tabs
 * The active-tab marker is a bead of liquid. Switching tabs, it pinches off
 * a droplet that races to the new tab while the old bead drains; the two
 * merge through a surface-tension filter into a fresh bead. Labels invert
 * automatically where the liquid passes beneath them.
 *
 *   const tabs = gooeyTabs(nav, { items: ['Overview', 'Motion', 'Pricing'] });
 *   tabs.select(2);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { svg, uniqueId, resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-gooey',
  `:where(.sf-gt){position:relative}.sf-gt{display:inline-flex;padding:.35em;border-radius:99px;background:var(--sf-gt-bg,rgba(255,255,255,.05));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);isolation:isolate}
.sf-gt-goo{position:absolute;inset:0;pointer-events:none}
.sf-gt-goo>i{position:absolute;left:0;top:.35em;height:calc(100% - .7em);border-radius:99px;background:var(--sf-gt-blob,#f1ebe1);will-change:transform,width}
:where(.sf-gt-tab){position:relative}.sf-gt-tab{z-index:1;background:none;border:0;font:inherit;padding:.62em 1.25em;border-radius:99px;cursor:pointer;
  color:#fff;mix-blend-mode:difference;white-space:nowrap}
.sf-gt-defs{position:absolute;width:0;height:0;overflow:hidden}`
);

const DEFAULTS = {
  items: [],
  index: 0,
  onChange: null,
};

export function gooeyTabs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-gt');
  nav.setAttribute('role', 'tablist');
  nav.innerHTML = '';
  const id = uniqueId('sf-goo');
  const defs = svg('svg', { class: 'sf-gt-defs', 'aria-hidden': 'true' });
  const f = svg('filter', { id, x: '-10%', y: '-40%', width: '120%', height: '180%' });
  f.append(
    svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 7, result: 'b' }),
    svg('feColorMatrix', { in: 'b', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10', result: 'g' }),
    svg('feComposite', { in: 'SourceGraphic', in2: 'g', operator: 'atop' })
  );
  defs.appendChild(f);
  const goo = document.createElement('div');
  goo.className = 'sf-gt-goo';
  goo.style.filter = `url(#${id})`;
  const beads = [0, 1, 2].map(() => {
    const b = document.createElement('i');
    goo.appendChild(b);
    return b;
  });
  nav.append(defs, goo);
  const tabs = o.items.map((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-gt-tab';
    b.setAttribute('role', 'tab');
    b.textContent = label;
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); select((current + 1) % tabs.length); tabs[current].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); select((current - 1 + tabs.length) % tabs.length); tabs[current].focus(); }
    });
    nav.appendChild(b);
    return b;
  });
  let current = o.index;
  const cfg = { stiffness: 210, damping: 24, precision: 0.05 };
  // bead 0: old (drains), bead 1: new (fills), bead 2: travelling droplet
  const S = {
    ox: new Spring(0, cfg), ow: new Spring(0, cfg),
    nx: new Spring(0, cfg), nw: new Spring(0, cfg),
    dx: new Spring(0, { stiffness: 120, damping: 16, precision: 0.05 }),
  };
  let travel = 0; // 0 → 1 progress of a switch
  let from = current;
  let off = null;

  const slot = (i) => ({ x: tabs[i].offsetLeft, w: tabs[i].offsetWidth });

  function frame(_, dt) {
    const s = dt / 1000;
    travel = clamp(travel + s * 1.9);
    const a = slot(from), b = slot(current);
    // old bead drains in place, new bead grows, droplet races between them
    S.ow.to(from === current ? b.w : a.w * (1 - clamp(travel * 1.6)));
    S.ox.to(a.x + (a.w - S.ow.value) / 2);
    S.nw.to(b.w * clamp((travel - 0.25) / 0.6));
    S.nx.to(b.x + (b.w - S.nw.value) / 2);
    S.dx.to(b.x + b.w / 2);
    for (const k in S) S[k].step(s);
    const dW = Math.max(0, Math.min(a.w, b.w) * 0.55 * Math.sin(Math.PI * clamp(travel)));
    beads[0].style.transform = `translate3d(${S.ox.value.toFixed(2)}px,0,0)`;
    beads[0].style.width = `${Math.max(0, S.ow.value).toFixed(2)}px`;
    beads[1].style.transform = `translate3d(${S.nx.value.toFixed(2)}px,0,0)`;
    beads[1].style.width = `${Math.max(0, S.nw.value).toFixed(2)}px`;
    beads[2].style.transform = `translate3d(${(S.dx.value - dW / 2).toFixed(2)}px,0,0) scaleY(${(0.6 + 0.4 * (1 - Math.sin(Math.PI * travel))).toFixed(3)})`;
    beads[2].style.width = `${dW.toFixed(2)}px`;
    let busy = travel < 1;
    for (const k in S) if (!S[k].resting) busy = true;
    if (!busy) {
      from = current;
      off?.(); off = null;
    }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function select(i) {
    if (i === current) return;
    from = current;
    current = i;
    travel = 0;
    S.dx.set(slot(from).x + slot(from).w / 2);
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === current)));
    tabs.forEach((t, k) => (t.tabIndex = k === current ? 0 : -1));
    o.onChange?.(i);
    wake();
  }

  // Initial placement happens synchronously (never deferred, so an early
  // select() can't be clobbered), and again whenever layout changes at rest.
  function place() {
    const b = slot(current);
    from = current;
    S.nx.set(b.x); S.nw.set(b.w); S.ox.set(b.x); S.ow.set(b.w); S.dx.set(b.x + b.w / 2);
    travel = 1;
    frame(0, 0);
  }
  tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === current)); t.tabIndex = k === current ? 0 : -1; });
  place();
  const ro = new ResizeObserver(() => { if (!off) place(); });
  ro.observe(nav);

  return {
    el: nav,
    select,
    get index() { return current; },
    destroy() {
      if (off) off();
      ro.disconnect();
      nav.innerHTML = '';
      nav.classList.remove('sf-gt');
    },
  };
}

export default gooeyTabs;
