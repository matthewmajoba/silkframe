/**
 * Image Trail
 * The pointer leaves a trail of images — each one drops in where you have
 * been, oriented along your direction of travel, sized by your speed, then
 * sinks and dissolves. A portfolio staple, tuned to feel weighty: frames
 * overshoot slightly as they land and fall away under ease-in gravity.
 *
 *   imageTrail(section, { images: ['/a.jpg', '/b.jpg'], spacing: 90 });
 */
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-trail',
  `.sf-trail-item{position:absolute;left:0;top:0;pointer-events:none;border-radius:var(--sf-trail-r,10px);overflow:hidden;
  background-size:cover;background-position:center;box-shadow:0 1.2em 2.4em -1em rgba(0,0,0,.65);will-change:transform,opacity}`
);

const DEFAULTS = {
  images: [], // URLs or CSS backgrounds (e.g. gradients)
  spacing: 90, // px of travel between images
  size: [150, 190], // base width, height
  life: 900, // ms an image stays before falling away
  max: 14,
};

export function imageTrail(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(el);
  let last = null;
  let travel = 0;
  let index = 0;
  const live = [];

  const bg = (src) => (/gradient\(|^url\(/.test(src) ? src : `url("${src}")`);

  function spawn(x, y, vx, vy) {
    const speed = Math.hypot(vx, vy);
    const k = clamp(speed / 1600, 0, 1);
    const w = o.size[0] * (0.85 + k * 0.4), h = o.size[1] * (0.85 + k * 0.4);
    const node = document.createElement('div');
    node.className = 'sf-trail-item';
    node.setAttribute('aria-hidden', 'true');
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    node.style.background = bg(o.images[index++ % Math.max(o.images.length, 1)] || '#333');
    node.style.backgroundSize = 'cover';
    el.appendChild(node);
    const ang = clamp(Math.atan2(vy, vx) * (180 / Math.PI) * 0.08, -10, 10) + (Math.random() - 0.5) * 6;
    const at = `translate3d(${x - w / 2}px, ${y - h / 2}px, 0)`;
    const drift = `translate3d(${x - w / 2 + vx * 0.06}px, ${y - h / 2 + vy * 0.06 + 40}px, 0)`;
    const anim = node.animate(
      [
        // Land (ease-out) -> settle -> hold -> fall away (ease-in).
        { transform: `${at} rotate(${ang * 2}deg) scale(0.4)`, opacity: 0, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        { transform: `${at} rotate(${ang}deg) scale(1.04)`, opacity: 1, offset: 0.16, easing: 'ease-out' },
        { transform: `${at} rotate(${ang}deg) scale(1)`, opacity: 1, offset: 0.26 },
        { transform: `${at} rotate(${ang}deg) scale(1)`, opacity: 1, offset: 0.62, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
        { transform: `${drift} rotate(${ang * 1.6}deg) scale(0.82)`, opacity: 0 },
      ],
      { duration: o.life + 600, easing: 'linear', fill: 'forwards' }
    );
    anim.finished.then(() => node.remove(), () => node.remove());
    live.push({ node, anim });
    while (live.length > o.max) {
      const old = live.shift();
      old.anim.cancel();
      old.node.remove();
    }
  }

  function feed(x, y, now = performance.now()) {
    if (!last) { last = { x, y, t: now }; return; }
    const dx = x - last.x, dy = y - last.y;
    const dt = Math.max(now - last.t, 8) / 1000;
    travel += Math.hypot(dx, dy);
    if (travel >= o.spacing) {
      travel = 0;
      spawn(x, y, dx / dt, dy / dt);
    }
    last = { x, y, t: now };
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    feed(e.clientX - r.left, e.clientY - r.top);
  };
  const onLeave = () => { last = null; travel = 0; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  return {
    el,
    /** Feed synthetic pointer positions (element-local px). */
    feed,
    reset: onLeave,
    destroy() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      live.forEach((l) => { l.anim.cancel(); l.node.remove(); });
    },
  };
}

export default imageTrail;
