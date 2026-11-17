/**
 * Dust Dissolve
 * The card disintegrates into drifting flakes. A jittered lattice (shared
 * vertices, so there are no gaps) cuts the live element into fragments; a
 * dissolve front sweeps across with noisy edges while each flake is caught
 * by a turbulent wind, curling, shrinking and tumbling away like ash.
 * restore() plays the wind backwards and the card re-forms.
 *
 * Fragments are built in small idle-time chunks (prepare()), so even large
 * lattices never block a frame.
 *
 *   const fx = dustCard(card, { wind: -20 });
 *   fx.prepare();             // optional: pre-build while idle
 *   await fx.dissolve();  await fx.restore();
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32, createNoise } from '../core/noise.js';
import { clamp, smoothstep, prefersReducedMotion } from '../core/utils.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { cinematic } from '../core/ease.js';

injectStyle(
  'sf-dust',
  `.sf-dust-layer{position:absolute;pointer-events:none;z-index:30}
.sf-flake{position:absolute;overflow:hidden;will-change:transform,opacity;backface-visibility:visible}
.sf-flake>.sf-flake-copy{position:absolute;margin:0}`
);

const DEFAULTS = {
  cols: 14,
  rows: 10,
  duration: 2300,
  wind: -25, // degrees (0 = blow right, negative = up-right)
  strength: 1,
  sweep: 0.55, // fraction of duration the dissolve front takes to cross
  chunk: 24, // flakes built per idle slice
  seed: 8,
};

const idle = () =>
  new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 100 }) : setTimeout(r, 16)));

export function dustCard(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const parent = el.parentElement;
  ensurePositioned(parent);
  const { noise3 } = createNoise(o.seed);
  let off = null;
  let prepared = null; // Promise<{ layer, flakes, wx, wy, box }>
  let current = null;

  function prepare() {
    if (prepared) return prepared;
    prepared = (async () => {
      const box = boxIn(el, parent);
      const rand = mulberry32(o.seed);
      const C = o.cols, R = o.rows;
      const cw = box.w / C, ch = box.h / R;
      // Shared jittered vertices → fragments tile perfectly.
      const V = [];
      for (let j = 0; j <= R; j++) {
        V[j] = [];
        for (let i = 0; i <= C; i++) {
          const edge = i === 0 || j === 0 || i === C || j === R;
          V[j][i] = [i * cw + (edge ? 0 : (rand() - 0.5) * cw * 0.7), j * ch + (edge ? 0 : (rand() - 0.5) * ch * 0.7)];
        }
      }
      const layer = document.createElement('div');
      layer.className = 'sf-dust-layer';
      layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;visibility:hidden`;
      parent.appendChild(layer);
      const a = (o.wind * Math.PI) / 180;
      const wx = Math.cos(a), wy = Math.sin(a);
      const src = snapshot(el);
      src.style.visibility = 'visible';
      const flakes = [];
      let made = 0;
      for (let j = 0; j < R; j++) {
        for (let i = 0; i < C; i++) {
          const poly = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
          const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
          const minX = Math.min(...xs) - 0.5, minY = Math.min(...ys) - 0.5;
          const w = Math.max(...xs) - minX + 0.5, h = Math.max(...ys) - minY + 0.5;
          // Grow each polygon ~0.6px about its centroid so shared edges never
          // show anti-aliased seams while the card is still intact.
          const gx = xs.reduce((s, v) => s + v) / 4, gy = ys.reduce((s, v) => s + v) / 4;
          const grown = poly.map(([px, py]) => {
            const d = Math.hypot(px - gx, py - gy) || 1;
            return [px + ((px - gx) / d) * 0.6, py + ((py - gy) / d) * 0.6];
          });
          const node = document.createElement('div');
          node.className = 'sf-flake';
          node.style.cssText = `left:${minX}px;top:${minY}px;width:${w}px;height:${h}px;` +
            `clip-path:polygon(${grown.map((p) => `${(p[0] - minX).toFixed(1)}px ${(p[1] - minY).toFixed(1)}px`).join(',')})`;
          const copy = src.cloneNode(true);
          copy.classList.add('sf-flake-copy');
          copy.style.left = `${-minX}px`;
          copy.style.top = `${-minY}px`;
          copy.style.width = `${box.w}px`;
          copy.style.height = `${box.h}px`;
          node.appendChild(copy);
          layer.appendChild(node);
          // Dissolve order follows the wind, roughened by randomness.
          const along = (((i + 0.5) / C) * wx + ((j + 0.5) / R) * wy + 1) / 2;
          flakes.push({
            node,
            at: clamp(along * 0.85 + rand() * 0.25),
            seed: rand() * 100,
            spin: (rand() - 0.5) * 520,
            axis: [rand() - 0.5, rand() - 0.5, rand() * 0.4].map((v) => v.toFixed(3)).join(','),
            tumble: 240 + rand() * 520,
            lift: 0.6 + rand() * 0.8,
            px: (i + 0.5) * cw, py: (j + 0.5) * ch,
          });
          if (++made % o.chunk === 0) await idle();
        }
      }
      return { layer, flakes, wx, wy, box };
    })();
    return prepared;
  }

  async function animate(forward) {
    if (off) { off(); off = null; }
    current?.layer.remove();
    if (prefersReducedMotion()) {
      el.style.visibility = forward ? 'hidden' : '';
      return true;
    }
    const job = await prepare();
    prepared = null; // consumed — the next run builds a fresh snapshot
    current = job;
    const { layer, flakes, wx, wy, box } = job;
    const D = o.duration;
    const travel = Math.max(box.w, box.h) * 0.9 * o.strength;
    const life = 1 - o.sweep;
    const pose = (f, k) => {
      // k: 0 = intact, 1 = fully blown away
      if (k <= 0) { f.node.style.transform = ''; f.node.style.opacity = ''; return; }
      const e = k * k;
      const n1 = noise3(f.px * 0.01, f.py * 0.01, f.seed + k * 1.6);
      const n2 = noise3(f.py * 0.01, f.seed, f.px * 0.01 + k * 1.6);
      const dx = (wx * travel * f.lift + n1 * travel * 0.35) * e;
      const dy = (wy * travel * f.lift + n2 * travel * 0.35 - travel * 0.25 * f.lift) * e;
      // Ash flutters: shrink fast and tumble in 3D.
      const sc = 1 - smoothstep(0.02, 0.7, k) * 0.82;
      f.node.style.transform = `perspective(600px) translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) rotate3d(${f.axis},${(f.tumble * k).toFixed(1)}deg) rotate(${(f.spin * e).toFixed(1)}deg) scale(${sc.toFixed(3)})`;
      f.node.style.opacity = (1 - smoothstep(0.2, 0.85, k)).toFixed(3);
    };
    let t = 0;
    const step = () => {
      const p = clamp(t / D);
      for (const f of flakes) {
        const k = forward
          ? clamp((p - f.at * o.sweep) / life)
          : clamp(1 - cinematic(clamp((p - (1 - f.at) * o.sweep) / life)));
        pose(f, k);
      }
      return p;
    };
    step();
    // Swap the live card for its fragments in the same frame.
    layer.style.visibility = 'visible';
    el.style.visibility = 'hidden';
    return new Promise((done) => {
      off = tick((_, dt) => {
        t += dt;
        if (step() >= 1) {
          off(); off = null;
          if (!forward) el.style.visibility = '';
          layer.remove();
          current = null;
          done(true);
        }
      });
    });
  }

  return {
    prepare: () => prepare().then(() => true),
    dissolve: () => animate(true),
    restore: () => animate(false),
    destroy() {
      if (off) { off(); off = null; el.style.visibility = ''; }
      current?.layer.remove();
      prepared?.then((j) => j.layer.remove());
    },
  };
}

export default dustCard;
