/**
 * Folder Tabs
 * Breadcrumbs as the tabs of nested folders. Each level is a real tab with
 * flared bottom corners, overlapping the one before it; the deepest folder
 * is in front and joins seamlessly with the page beneath it. Going deeper,
 * the new folder's tab slides into place in front; going back, the deeper
 * tabs tuck away behind the one you chose and it comes to the front.
 * Positions run on springs, colours cross-fade, everything stays keyboard
 * accessible.
 *
 *   const tabs = folderTabs(nav, { items: ['Home', 'Projects'] });
 *   tabs.push('Silkframe');   tabs.go(0);
 *   --sf-ft-front: colour of the front tab (match your page surface)
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-ft',
  `:where(.sf-ft){position:relative}
.sf-ft{display:block;height:2.6em}
.sf-ft-tab{position:absolute;left:0;bottom:0;height:2.3em;display:flex;align-items:center;padding:0 1.25em;border:0;font:inherit;cursor:pointer;
  white-space:nowrap;color:var(--sf-ft-fg,rgba(255,255,255,.5));background:var(--tab);border-radius:.62em .62em 0 0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),-.5em 0 1em -.6em rgba(0,0,0,.6);
  --tab:var(--sf-ft-back,#1b1c21);transition:color .35s,background-color .35s;will-change:transform}
.sf-ft-tab:not([aria-current]):hover{color:var(--sf-ft-hover,#fff);background:color-mix(in oklab,var(--tab) 88%,white)}
.sf-ft-tab::before,.sf-ft-tab::after{content:"";position:absolute;bottom:0;width:.62em;height:.62em;pointer-events:none}
.sf-ft-tab::before{left:-.62em;background:radial-gradient(circle at 0 0,transparent .62em,var(--tab) calc(.62em + .5px))}
.sf-ft-tab::after{right:-.62em;background:radial-gradient(circle at 100% 0,transparent .62em,var(--tab) calc(.62em + .5px))}
.sf-ft-tab:hover{color:var(--sf-ft-hover,#fff)}
.sf-ft-tab[aria-current="page"]{--tab:var(--sf-ft-front,#2a2b31);color:var(--sf-ft-active,#fff);cursor:default}
.sf-ft-tab .sf-ft-ico{width:.9em;height:.9em;margin-right:.55em;opacity:.65;flex:none}
.sf-ft-tab:focus-visible{outline:2px solid var(--sf-ft-ring,#ffb547);outline-offset:-3px}`
);

const FOLDER = '<svg class="sf-ft-ico" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.6 1.6H13A1.5 1.5 0 0 1 14.5 5.1v7.4A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z"/></svg>';

const DEFAULTS = {
  items: [],
  overlap: 0.9, // em each tab tucks under the next
  onNavigate: null,
};

export function folderTabs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-ft');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = '';
  let tabs = [];
  const leaving = [];
  let off = null;

  const em = () => parseFloat(getComputedStyle(nav).fontSize) || 16;

  function make(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-ft-tab';
    b.innerHTML = FOLDER;
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', () => {
      const i = tabs.findIndex((t) => t.node === b);
      if (i >= 0 && i < tabs.length - 1) { go(i); o.onNavigate?.(i, tabs.map((t) => t.label)); }
    });
    nav.appendChild(b);
    return {
      node: b, label,
      x: new Spring(0, { stiffness: 210, damping: 25, precision: 0.05 }),
      a: new Spring(1, { stiffness: 260, damping: 32, precision: 0.002 }),
    };
  }

  function layout(snap = false) {
    const ov = o.overlap * em();
    let x = 0.62 * em(); // room for the first tab's flared corner
    tabs.forEach((t, i) => {
      t.x.to(x);
      if (snap) t.x.set(x);
      t.a.to(1);
      x += t.node.offsetWidth - ov;
      t.node.style.zIndex = String(i + 1);
      const current = i === tabs.length - 1;
      if (current) t.node.setAttribute('aria-current', 'page');
      else t.node.removeAttribute('aria-current');
      // ancestors darken the further back they sit
      const depth = tabs.length - 1 - i;
      t.node.style.setProperty('--sf-ft-back', `color-mix(in oklab, var(--sf-ft-base, #1b1c21) ${Math.max(55, 100 - depth * 12)}%, black)`);
    });
    wake();
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = false;
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      t.x.step(s); t.a.step(s);
      if (!t.x.resting || !t.a.resting) busy = true;

      t.node.style.transform = `translate3d(${t.x.value.toFixed(2)}px,0,0)`;
      t.node.style.opacity = Math.max(0, Math.min(1, t.a.value)).toFixed(3);
    }
    for (let i = leaving.length - 1; i >= 0; i--) {
      const t = leaving[i];
      t.x.step(s); t.a.step(s);
      t.node.style.transform = `translate3d(${t.x.value.toFixed(2)}px,0,0)`;
      t.node.style.opacity = Math.max(0, Math.min(1, t.a.value)).toFixed(3);
      if (t.x.resting && t.a.value < 0.02) { t.node.remove(); leaving.splice(i, 1); }
      else busy = true;
    }
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function push(label) {
    const prev = tabs[tabs.length - 1];
    const t = make(label);
    tabs.push(t);
    layout(prefersReducedMotion() || !prev);
    if (prev && !prefersReducedMotion()) {
      // slide into place from just beyond its slot, in front
      const slot = t.x.target;
      t.x.set(slot + 1.6 * em());
      t.x.to(slot);
      t.a.set(0);
      t.a.to(1);
      wake();
    }
    return Promise.resolve(true);
  }

  function go(index) {
    if (index >= tabs.length - 1 || index < 0) return Promise.resolve(true);
    const home = tabs[index];
    const removed = tabs.splice(index + 1);
    removed.forEach((t, k) => {
      t.node.style.zIndex = String(index - k); // slide home *behind* the chosen tab
      t.node.removeAttribute('aria-current');
      t.node.tabIndex = -1;
      t.x.to(t.x.value - 0.8 * em());
      t.a.stiffness = 900; t.a.damping = 60; // gone in ~140ms, before it can read as a ghost
      t.a.to(0);
      leaving.push(t);
    });
    layout(prefersReducedMotion());
    return Promise.resolve(true);
  }

  function set(labels) {
    tabs.forEach((t) => t.node.remove());
    tabs = labels.map((l) => make(l));
    layout(true);
  }

  set(o.items);
  const ro = new ResizeObserver(() => layout(true));
  ro.observe(nav);

  return {
    el: nav,
    push,
    go,
    pop: () => go(tabs.length - 2),
    set,
    get items() { return tabs.map((t) => t.label); },
    destroy() {
      if (off) off();
      ro.disconnect();
      nav.innerHTML = '';
      nav.classList.remove('sf-ft');
    },
  };
}

export default folderTabs;
