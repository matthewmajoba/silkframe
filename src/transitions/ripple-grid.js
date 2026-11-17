/**
 * Ripple Grid
 * A wavefront of tiles radiates from the point you touch. Each tile blooms
 * from a glowing dot into a square that seals the frame; once covered the
 * content swaps and the same wave keeps travelling outward, dissolving the
 * tiles back to points. The crest carries an accent colour like a shockwave.
 *
 *   const ripple = rippleGrid(container);
 *   await ripple.run(() => next(), { x: e.offsetX, y: e.offsetY });
 */
import { injectStyle } from '../core/style.js';
import { wait } from '../core/ticker.js';
import { prefersReducedMotion } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-ripple',
  `.sf-ripple{position:absolute;inset:0;pointer-events:none;z-index:50;display:grid;visibility:hidden}
.sf-ripple>i{display:block;width:100%;height:100%;transform:scale(0);border-radius:50%;will-change:transform}`
);

const DEFAULTS = {
  size: 64, // target tile size in px
  speed: 1.9, // px per ms wave speed
  grow: 480, // ms for each tile to bloom
  hold: 80,
  color: '#0c0c10',
  crest: '#ffb547',
};

export function rippleGrid(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const grid = document.createElement('div');
  grid.className = 'sf-ripple';
  grid.setAttribute('aria-hidden', 'true');
  container.appendChild(grid);
  let tiles = [];
  let cols = 0, rows = 0;
  let anims = [];

  function layout() {
    const W = container.clientWidth, H = container.clientHeight;
    cols = Math.max(4, Math.round(W / o.size));
    rows = Math.max(3, Math.round(H / o.size));
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.innerHTML = '';
    tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = document.createElement('i');
        grid.appendChild(t);
        tiles.push({ el: t, cx: ((c + 0.5) / cols) * W, cy: ((r + 0.5) / rows) * H });
      }
    }
  }

  async function run(swap = () => {}, origin) {
    anims.forEach((a) => a.cancel());
    anims = [];
    if (prefersReducedMotion()) { await swap(); return true; }
    layout();
    const W = container.clientWidth, H = container.clientHeight;
    const ox = origin ? origin.x : W / 2, oy = origin ? origin.y : H / 2;
    grid.style.visibility = 'visible';
    let maxDelay = 0;
    const timing = tiles.map((t) => {
      const d = Math.hypot(t.cx - ox, t.cy - oy) / o.speed;
      maxDelay = Math.max(maxDelay, d);
      return d;
    });
    // Cover: dot → glowing crest → sealed square (slight overscale hides seams).
    tiles.forEach((t, i) => {
      anims.push(
        t.el.animate(
          [
            { transform: 'scale(0)', borderRadius: '50%', backgroundColor: o.crest },
            { transform: 'scale(0.75)', borderRadius: '40%', backgroundColor: o.crest, offset: 0.35 },
            { transform: 'scale(1.06)', borderRadius: '0%', backgroundColor: o.color },
          ],
          { duration: o.grow, delay: timing[i], easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'both' }
        )
      );
    });
    await wait(maxDelay + o.grow);
    await swap();
    await wait(o.hold);
    const out = tiles.map((t, i) =>
      t.el.animate(
        [
          { transform: 'scale(1.06)', borderRadius: '0%', backgroundColor: o.color },
          { transform: 'scale(0.6)', borderRadius: '45%', backgroundColor: o.color, offset: 0.55 },
          { transform: 'scale(0)', borderRadius: '50%', backgroundColor: o.crest },
        ],
        { duration: o.grow * 0.9, delay: timing[i], easing: 'cubic-bezier(0.6, 0, 0.4, 1)', fill: 'both' }
      )
    );
    anims.forEach((a) => a.cancel());
    anims = out;
    await wait(maxDelay + o.grow * 0.9);
    grid.style.visibility = 'hidden';
    anims.forEach((a) => a.cancel());
    anims = [];
    return true;
  }

  return {
    run,
    destroy() {
      anims.forEach((a) => a.cancel());
      grid.remove();
    },
  };
}

export default rippleGrid;
