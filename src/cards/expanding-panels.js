/**
 * Expanding Panels
 * A row of tall panels that behaves like a curtain of glass. Hover or focus
 * a panel and it widens on a spring while its siblings compress; its copy
 * rises in once there is room, and the artwork inside parallaxes so the
 * opening feels like moving a window across a larger scene.
 *
 *   expandingPanels('.panels', { grow: 3.6 });   // children are panels
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-panels',
  `.sf-panels{display:flex;gap:var(--sf-panels-gap,10px)}
.sf-panels>*{position:relative;flex:1 1 0;min-width:0;overflow:hidden;cursor:pointer;outline-offset:3px}
.sf-panels [data-panel-art]{position:absolute;inset:0 -30%;will-change:transform}
.sf-panels [data-panel-copy]{will-change:transform,opacity}`
);

const DEFAULTS = {
  grow: 3.4, // flex-grow of the open panel (others are 1)
  start: 0, // initially open panel (-1 = none)
  stiffness: 170,
  damping: 22,
};

export function expandingPanels(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-panels');
  const cfg = { stiffness: o.stiffness, damping: o.damping, precision: 0.001 };
  const panels = Array.from(el.children).map((node, i) => {
    node.tabIndex = node.tabIndex >= 0 ? node.tabIndex : 0;
    return {
      node, i,
      g: new Spring(1, cfg),
      art: node.querySelector('[data-panel-art]'),
      copy: node.querySelector('[data-panel-copy]'),
    };
  });
  let open = o.start;
  let off = null;

  function aim() {
    panels.forEach((p) => {
      p.g.to(p.i === open ? o.grow : 1);
      p.node.setAttribute('aria-expanded', String(p.i === open));
    });
    wake();
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = false;
    panels.forEach((p) => {
      p.g.step(s);
      if (!p.g.resting) busy = true;
      p.node.style.flexGrow = p.g.value.toFixed(4);
      const k = clamp((p.g.value - 1) / (o.grow - 1)); // 0 closed → 1 open
      if (p.art) {
        // Parallax: the art slides opposite to the panel's position in the row.
        const centre = (p.i + 0.5) / panels.length - 0.5;
        p.art.style.transform = `translate3d(${(-centre * 40 * (1 - k)).toFixed(2)}%, 0, 0) scale(${(1.08 - k * 0.08).toFixed(4)})`;
      }
      if (p.copy) {
        const c = clamp((k - 0.55) / 0.45);
        p.copy.style.opacity = c.toFixed(3);
        p.copy.style.transform = `translate3d(0, ${((1 - c) * 16).toFixed(2)}px, 0)`;
      }
    });
    if (!busy) { off?.(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const onEnter = (e) => {
    const p = panels.find((x) => x.node.contains(e.target));
    if (p && p.i !== open) { open = p.i; aim(); }
  };
  el.addEventListener('pointerover', onEnter);
  el.addEventListener('focusin', onEnter);
  if (open >= 0) {
    panels.forEach((p) => p.g.set(p.i === open ? o.grow : 1));
  }
  aim();
  frame(0, 16);

  return {
    el,
    open(i) { open = i; aim(); },
    get current() { return open; },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerover', onEnter);
      el.removeEventListener('focusin', onEnter);
      el.classList.remove('sf-panels');
    },
  };
}

export default expandingPanels;
