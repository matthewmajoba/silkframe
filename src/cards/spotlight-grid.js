/**
 * Spotlight Grid
 * One light, many surfaces. A single soft spotlight follows the pointer
 * across a whole grid: every card's border catches it where it passes, the
 * nearest card's surface glows from within, and the light lingers with a
 * spring so it glides rather than jumps between cards.
 *
 *   spotlightGrid('.features', { radius: 260, color: '255,181,71' });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';

injectStyle(
  'sf-spot',
  `.sf-spot>*{position:relative;isolation:isolate}
.sf-spot-edge,.sf-spot-fill{position:absolute;inset:0;border-radius:inherit;pointer-events:none}
.sf-spot-edge{padding:1px;z-index:2;
  background:radial-gradient(var(--sf-spot-r,260px) circle at var(--sf-x,-999px) var(--sf-y,-999px),rgba(var(--sf-spot-c,255,255,255),.85),rgba(var(--sf-spot-c,255,255,255),.12) 40%,transparent 70%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);opacity:var(--sf-spot-on,0)}
.sf-spot-fill{z-index:-1;opacity:var(--sf-spot-on,0);
  background:radial-gradient(calc(var(--sf-spot-r,260px) * .9) circle at var(--sf-x,-999px) var(--sf-y,-999px),rgba(var(--sf-spot-c,255,255,255),.09),transparent 65%)}`
);

const DEFAULTS = {
  radius: 260,
  color: '255,255,255', // r,g,b
  idle: true,
};

export function spotlightGrid(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-spot');
  el.style.setProperty('--sf-spot-r', `${o.radius}px`);
  el.style.setProperty('--sf-spot-c', o.color);
  const cards = Array.from(el.children).map((node) => {
    const edge = document.createElement('span');
    edge.className = 'sf-spot-edge';
    const fill = document.createElement('span');
    fill.className = 'sf-spot-fill';
    edge.setAttribute('aria-hidden', 'true');
    fill.setAttribute('aria-hidden', 'true');
    node.append(edge, fill);
    return { node, edge, fill };
  });
  const x = new Spring(0, { stiffness: 140, damping: 20 }), y = new Spring(0, { stiffness: 140, damping: 20 });
  const on = new Spring(0, { stiffness: 80, damping: 16, precision: 0.001 });
  let inside = false;
  let t = 0;
  let off = null;

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    const host = el.getBoundingClientRect();
    if (!inside && o.idle) {
      x.to(host.width * (0.5 + Math.sin(t * 0.5) * 0.42));
      y.to(host.height * (0.5 + Math.sin(t * 0.83 + 1) * 0.4));
      on.to(0.75);
    }
    x.step(s); y.step(s); on.step(s);
    el.style.setProperty('--sf-spot-on', Math.max(0, on.value).toFixed(3));
    for (const c of cards) {
      const r = c.node.getBoundingClientRect();
      const lx = host.left + x.value - r.left, ly = host.top + y.value - r.top;
      c.node.style.setProperty('--sf-x', `${lx.toFixed(1)}px`);
      c.node.style.setProperty('--sf-y', `${ly.toFixed(1)}px`);
    }
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    if (!inside) { inside = true; }
    x.to(e.clientX - r.left);
    y.to(e.clientY - r.top);
    on.to(1);
  };
  const onLeave = () => { inside = false; if (!o.idle) on.to(0); };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  off = tick(frame);

  return {
    el,
    destroy() {
      off?.();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cards.forEach((c) => { c.edge.remove(); c.fill.remove(); });
      el.classList.remove('sf-spot');
    },
  };
}

export default spotlightGrid;
