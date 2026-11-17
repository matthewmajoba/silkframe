/**
 * Hyperspace
 * A jump to light speed between scenes. Stars accelerate out of a vanishing
 * point and stretch into streaks as velocity climbs exponentially; the
 * outgoing scene is pulled into the tunnel, everything blooms to white,
 * and the new scene drops out of warp as the streaks decelerate to points.
 *
 *   const jump = hyperspace(container, { tint: '#9fc3ff' });
 *   await jump.run(() => showNextScene());
 */
import { tick } from '../core/ticker.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, dpr, smoothstep, lerp, prefersReducedMotion } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';

const DEFAULTS = {
  stars: 650,
  duration: 2300, // full jump
  tint: '#a9c8ff',
  flash: '#fff6e8',
  origin: null, // vanishing point {x, y}; default centre
  scene: null, // optional getter returning the element to pull into the tunnel
  seed: 21,
};

export function hyperspace(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;visibility:hidden';
  const flash = document.createElement('div');
  flash.setAttribute('aria-hidden', 'true');
  flash.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:51;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%),${o.flash},${o.flash} 30%,rgba(255,240,220,.85) 70%)`;
  container.append(canvas, flash);
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(o.seed);
  const N = o.stars;
  const sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N), pz = new Float32Array(N);
  const hue = new Float32Array(N);
  const reset = (i, near = false) => {
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.5) * 1.6 + 0.04;
    sx[i] = Math.cos(a) * r;
    sy[i] = Math.sin(a) * r;
    sz[i] = near ? rand() * 1 + 0.05 : 1;
    pz[i] = sz[i];
    hue[i] = rand();
  };
  for (let i = 0; i < N; i++) reset(i, true);
  let off = null;

  // Speed profile over normalised time: ignition → exponential climb → peak → decay.
  const speedAt = (p) => {
    if (p < 0.5) return 0.04 + Math.pow(p / 0.5, 3.2) * 3.6;
    return 0.04 + Math.pow(1 - (p - 0.5) / 0.5, 2.4) * 3.6;
  };

  async function run(swap = () => {}) {
    if (off) off();
    if (prefersReducedMotion()) { await swap(); return true; }
    const W = container.clientWidth, H = container.clientHeight;
    const ratio = dpr();
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    const cx = o.origin ? o.origin.x : W / 2;
    const cy = o.origin ? o.origin.y : H / 2;
    flash.style.setProperty('--x', `${(cx / W) * 100}%`);
    flash.style.setProperty('--y', `${(cy / H) * 100}%`);
    const focal = Math.max(W, H) * 0.5;
    canvas.style.visibility = 'visible';
    let pulled = o.scene ? o.scene() : null;
    let swapped = false;
    let t = 0;
    for (let i = 0; i < N; i++) reset(i, true);
    return new Promise((done) => {
      off = tick(async (_, dt) => {
        t += dt;
        const p = clamp(t / o.duration);
        const v = speedAt(p) * (dt / 1000);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        // Persistence: brief motion trails at high speed only.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${lerp(0.9, 0.35, smoothstep(0.2, 0.5, p) * (1 - smoothstep(0.55, 0.85, p)))})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const fade = smoothstep(0, 0.12, p) * (1 - smoothstep(0.88, 1, p));
        for (let i = 0; i < N; i++) {
          pz[i] = sz[i];
          sz[i] -= v;
          if (sz[i] <= 0.02) { reset(i); pz[i] = sz[i]; continue; }
          const x1 = cx + (sx[i] / pz[i]) * focal, y1 = cy + (sy[i] / pz[i]) * focal;
          const x2 = cx + (sx[i] / sz[i]) * focal, y2 = cy + (sy[i] / sz[i]) * focal;
          const depth = 1 - sz[i];
          const a = clamp(depth * 1.4) * fade;
          if (a < 0.02) continue;
          ctx.strokeStyle = hue[i] < 0.7 ? `rgba(235,242,255,${a})` : hue[i] < 0.88 ? hexA(o.tint, a) : `rgba(255,214,170,${a})`;
          ctx.lineWidth = 0.6 + depth * 2.2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        // Pull the outgoing scene into the tunnel, push the new one out of it.
        if (pulled) {
          if (!swapped) {
            const k = smoothstep(0.08, 0.5, p);
            pulled.style.transform = `scale(${(1 + k * 0.45).toFixed(4)})`;
            pulled.style.filter = `blur(${(k * 6).toFixed(2)}px) brightness(${(1 + k * 0.8).toFixed(3)})`;
          } else {
            // Drop out of warp: decelerate from zoomed-in to rest (never shows edges).
            const k = 1 - smoothstep(0.5, 0.95, p);
            pulled.style.transform = `scale(${(1 + k * k * 0.3).toFixed(4)})`;
            pulled.style.filter = k > 0.01 ? `blur(${(k * 5).toFixed(2)}px) brightness(${(1 + k * 0.9).toFixed(3)})` : '';
          }
        }
        flash.style.opacity = (Math.pow(Math.sin(Math.PI * clamp((p - 0.38) / 0.3)), 1.6) * (p > 0.38 && p < 0.68 ? 1 : 0)).toFixed(3);
        if (!swapped && p >= 0.52) {
          swapped = true;
          if (pulled) { pulled.style.transform = ''; pulled.style.filter = ''; }
          await swap();
          pulled = o.scene ? o.scene() : null;
        }
        if (p >= 1) {
          off(); off = null;
          ctx.clearRect(0, 0, W, H);
          canvas.style.visibility = 'hidden';
          flash.style.opacity = '0';
          if (pulled) { pulled.style.transform = ''; pulled.style.filter = ''; }
          done(true);
        }
      });
    });
  }

  return {
    run,
    destroy() {
      if (off) off();
      canvas.remove();
      flash.remove();
    },
  };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default hyperspace;
