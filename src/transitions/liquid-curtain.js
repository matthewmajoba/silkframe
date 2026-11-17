/**
 * Liquid Curtain
 * Stacked layers of colour pour across the frame. Each leading edge bows
 * like a liquid surface under momentum — the bulge peaks mid-travel and
 * flattens as it lands — and every layer trails the one before, so the
 * accent colours flash at the edges before the final layer seals the frame.
 *
 *   const curtain = liquidCurtain(container, { colors: ['#ffb547', '#ff7a59', '#0b0b0e'] });
 *   await curtain.run(() => showNextScene());
 */
import { tick, wait } from '../core/ticker.js';
import { svg, clamp, prefersReducedMotion } from '../core/utils.js';
import { cubicBezier } from '../core/ease.js';
import { ensurePositioned } from '../core/snapshot.js';

const pour = cubicBezier(0.7, 0, 0.25, 1);

const DEFAULTS = {
  colors: ['#ffb547', '#ff7a59', '#0d0d10'],
  direction: 'up', // 'up' | 'down' | 'left' | 'right'
  duration: 900, // per phase (cover / reveal), per layer
  lag: 72, // ms between layers
  hold: 120,
  bulge: 0.15, // fraction of travel the surface bows
};

export function liquidCurtain(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const root = svg('svg', { 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
  root.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;visibility:hidden';
  const paths = o.colors.map((c) => {
    const p = svg('path', { fill: c });
    root.appendChild(p);
    return p;
  });
  container.appendChild(root);
  let off = null;

  // Build a band between a trailing edge (a) and a leading edge (b), both
  // measured as travel 0→1 along the pour direction, each with its bulge.
  function band(a, ba, b, bb, W, H) {
    const horiz = o.direction === 'left' || o.direction === 'right';
    const span = horiz ? W : H;
    const cross = horiz ? H : W;
    const at = (v) => (o.direction === 'up' || o.direction === 'left' ? span * (1 - v) : span * v);
    const sign = o.direction === 'up' || o.direction === 'left' ? -1 : 1;
    const ya = at(a), yb = at(b);
    const ca = ya + sign * ba * span * 2, cb = yb + sign * bb * span * 2;
    const P = (u, v) => (horiz ? `${v},${u}` : `${u},${v}`);
    return `M${P(0, ya)} Q${P(cross / 2, ca)} ${P(cross, ya)} L${P(cross, yb)} Q${P(cross / 2, cb)} ${P(0, yb)} Z`;
  }

  async function run(swap = () => {}) {
    if (off) off();
    if (prefersReducedMotion()) { await swap(); return true; }
    const W = container.clientWidth, H = container.clientHeight;
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    root.style.visibility = 'visible';
    const n = paths.length;
    const D = o.duration;
    const coverEnd = D + (n - 1) * o.lag; // the last (sealing) layer lands here
    let swapped = false;
    let resumeAt = Infinity;
    let t = 0;
    let finishPhase;
    const finished = new Promise((r) => (finishPhase = r));

    const draw = () => {
      for (let i = 0; i < n; i++) {
        const start = i * o.lag;
        // Cover phase: leading edge travels 0 → 1.
        const pc = clamp((t - start) / D);
        const lead = pour(pc);
        const leadBulge = Math.sin(Math.PI * pc) * o.bulge;
        // Reveal phase: trailing edge travels 0 → 1, top layer leaves first.
        const rs = resumeAt + (n - 1 - i) * o.lag * 0.8;
        const pr = clamp((t - rs) / D);
        const trail = pour(pr);
        const trailBulge = Math.sin(Math.PI * pr) * o.bulge;
        paths[i].setAttribute('d', pc <= 0 || pr >= 1 ? 'M0,0' : band(trail, trailBulge, lead, leadBulge, W, H));
      }
    };
    draw();
    off = tick((_, dt) => {
      t += dt;
      draw();
      if (!swapped && t >= coverEnd) {
        swapped = true;
        Promise.resolve(swap()).then(() => wait(o.hold)).then(() => (resumeAt = t));
      }
      if (t >= resumeAt + D + (n - 1) * o.lag * 0.8) {
        off(); off = null;
        root.style.visibility = 'hidden';
        finishPhase();
      }
    });
    await finished;
    return true;
  }

  return {
    run,
    destroy() {
      if (off) off();
      root.remove();
    },
  };
}

export default liquidCurtain;
