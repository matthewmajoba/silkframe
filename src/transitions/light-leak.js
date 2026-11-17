/**
 * Light Leak
 * The film-stock transition: a warm leak of light bleeds in from the edge
 * of the gate, the image over-exposes toward white as the leak blooms, the
 * cut happens inside the flare, and the new scene develops back out of the
 * burn while the leak drifts off the far side. Pure transforms, opacity and
 * a brief exposure filter — very cheap.
 *
 *   const leak = lightLeak(container, { scene: () => current });
 *   await leak.run(() => showNext());
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, smoothstep, lerp, prefersReducedMotion } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-leak',
  `.sf-leak{position:absolute;inset:0;pointer-events:none;z-index:50;overflow:hidden;visibility:hidden}
.sf-leak-blob{position:absolute;border-radius:50%;mix-blend-mode:screen;will-change:transform,opacity;filter:blur(var(--sf-leak-blur,40px))}
.sf-leak-flash{position:absolute;inset:0;mix-blend-mode:screen;opacity:0;will-change:opacity}`
);

const DEFAULTS = {
  duration: 2000,
  palette: ['#ff6a2a', '#ffb547', '#ff3d6e', '#fff1c9'],
  from: 'left', // 'left' | 'right'
  scene: null, // getter for the element to over-expose
  seed: 12,
};

export function lightLeak(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const root = document.createElement('div');
  root.className = 'sf-leak';
  root.setAttribute('aria-hidden', 'true');
  const flash = document.createElement('div');
  flash.className = 'sf-leak-flash';
  flash.style.background = 'radial-gradient(120% 140% at var(--fx,30%) 50%, #fff8ea 0%, #ffd7a1 35%, rgba(255,140,70,.55) 70%, rgba(255,90,60,.2) 100%)';
  const rand = mulberry32(o.seed);
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const b = document.createElement('div');
    b.className = 'sf-leak-blob';
    const c = o.palette[i % o.palette.length];
    b.style.background = `radial-gradient(circle, ${c} 0%, ${c}cc 30%, transparent 70%)`;
    root.appendChild(b);
    return { el: b, y: 0.15 + rand() * 0.7, size: 0.55 + rand() * 0.6, speed: 0.75 + rand() * 0.5, lag: rand() * 0.15 };
  });
  root.appendChild(flash);
  container.appendChild(root);
  let off = null;

  async function run(swap = () => {}) {
    if (off) off();
    if (prefersReducedMotion()) { await swap(); return true; }
    const W = container.clientWidth, H = container.clientHeight;
    const dir = o.from === 'right' ? -1 : 1;
    root.style.setProperty('--sf-leak-blur', `${Math.round(Math.max(W, H) * 0.05)}px`);
    blobs.forEach((b) => {
      const s = Math.max(W, H) * b.size;
      b.el.style.width = b.el.style.height = `${s}px`;
      b.el.style.top = `${b.y * H - s / 2}px`;
      b.el.style.left = `${-s / 2}px`;
    });
    root.style.visibility = 'visible';
    let scene = o.scene ? o.scene() : null;
    let swapped = false;
    return new Promise((done) => {
      let t = 0;
      off = tick(async (_, dt) => {
        t += dt;
        const p = clamp(t / o.duration);
        // Leak drift across the gate.
        blobs.forEach((b) => {
          const q = clamp((p - b.lag) / (1 - b.lag));
          const x = lerp(-0.35, 1.35, Math.pow(q, 0.9) * b.speed + q * (1 - b.speed));
          const px = (dir > 0 ? x : 1 - x) * W;
          const breathe = 1 + Math.sin(q * Math.PI * 2 + b.y * 9) * 0.08;
          b.el.style.transform = `translate3d(${px.toFixed(1)}px, ${(Math.sin(q * 3 + b.y * 5) * H * 0.05).toFixed(1)}px, 0) scale(${breathe.toFixed(3)})`;
          b.el.style.opacity = (smoothstep(0, 0.18, q) * (1 - smoothstep(0.82, 1, q)) * 0.9).toFixed(3);
        });
        // Exposure: blooms to near-white around the cut.
        const ex = Math.exp(-Math.pow((p - 0.48) / 0.11, 2));
        flash.style.setProperty('--fx', `${(dir > 0 ? lerp(20, 80, p) : lerp(80, 20, p)).toFixed(1)}%`);
        flash.style.opacity = (ex * 0.96).toFixed(3);
        if (scene) {
          scene.style.filter = ex > 0.02 ? `brightness(${(1 + ex * 1.4).toFixed(3)}) saturate(${(1 + ex * 0.5).toFixed(3)}) blur(${(ex * 3).toFixed(2)}px)` : '';
        }
        if (!swapped && p >= 0.48) {
          swapped = true;
          if (scene) scene.style.filter = '';
          await swap();
          scene = o.scene ? o.scene() : null;
        }
        if (p >= 1) {
          off(); off = null;
          if (scene) scene.style.filter = '';
          root.style.visibility = 'hidden';
          done(true);
        }
      });
    });
  }

  return {
    run,
    destroy() {
      if (off) off();
      root.remove();
    },
  };
}

export default lightLeak;
