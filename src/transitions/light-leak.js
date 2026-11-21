/**
 * Anamorphic Flare
 * The J.J. Abrams cut. A hard point of light slides across the frame and
 * the anamorphic lens answers: a razor-thin blue streak shoots edge to
 * edge, a chain of ghost reflections (circles and hexagons, tinted cyan,
 * violet and amber) mirrors the source through the optical centre, and as
 * the source crosses the middle the whole frame washes out. The cut happens
 * inside the wash; the new scene emerges as the flare slides off the far
 * side. One canvas, additive blending, drawn at reduced resolution — cheap.
 *
 *   const flare = lightLeak(container, { scene: () => current });
 *   await flare.run(() => showNext());
 */
import { tick } from '../core/ticker.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, smoothstep, lerp, prefersReducedMotion } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';
import { cubicBezier } from '../core/ease.js';

const DEFAULTS = {
  duration: 2100,
  from: 'left', // 'left' | 'right' — direction the source travels
  streak: [120, 185, 255], // anamorphic streak colour
  core: [255, 252, 245],
  scene: null, // getter for the element to over-expose
  seed: 12,
};

// Travel: ease in, linger across the centre, ease out.
const travel = cubicBezier(0.3, 0.1, 0.7, 0.9);

export function lightLeak(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;visibility:hidden;mix-blend-mode:screen';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let off = null;

  // Ghost reflections: position along the source→centre axis (−1.6…1.2),
  // size (fraction of short side), shape, tint, strength.
  const rand = mulberry32(o.seed);
  const tints = [[110, 200, 255], [150, 120, 255], [255, 190, 110], [120, 255, 210], [255, 120, 170]];
  const ghosts = Array.from({ length: 9 }, (_, i) => ({
    at: -1.5 + i * 0.32 + (rand() - 0.5) * 0.12,
    size: 0.03 + rand() * 0.11,
    hex: rand() < 0.45,
    tint: tints[i % tints.length],
    k: 0.08 + rand() * 0.14,
    ring: rand() < 0.35,
  }));

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(4)})`;

  function poly(x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function draw(W, H, sx, sy, power, wash) {
    const cx = W / 2, cy = H / 2;
    const S = Math.min(W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // Veiling glare: the whole frame lifts toward the source.
    const veil = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.9);
    veil.addColorStop(0, rgba([255, 235, 215], 0.16 * power + 0.85 * wash));
    veil.addColorStop(0.4, rgba([150, 170, 255], 0.05 * power + 0.6 * wash));
    veil.addColorStop(1, rgba([40, 60, 120], 0.45 * wash));
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
    // Anamorphic streak: a long horizontal line with a softer halo band.
    const streakLen = W * (1.4 + power * 0.6);
    for (const [h, a] of [[S * 0.09, 0.08], [S * 0.022, 0.22], [Math.max(1.5, S * 0.004), 0.85]]) {
      const g = ctx.createLinearGradient(sx - streakLen / 2, 0, sx + streakLen / 2, 0);
      g.addColorStop(0, rgba(o.streak, 0));
      g.addColorStop(0.42, rgba(o.streak, a * power * 0.7));
      g.addColorStop(0.5, rgba([235, 245, 255], a * power));
      g.addColorStop(0.58, rgba(o.streak, a * power * 0.7));
      g.addColorStop(1, rgba(o.streak, 0));
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(0, sy);
      ctx.scale(1, h / (S * 0.1));
      ctx.beginPath();
      ctx.ellipse(sx, 0, streakLen / 2, S * 0.05, 0, 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
    }
    // Hot core with a short starburst.
    const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, S * 0.16);
    core.addColorStop(0, rgba(o.core, 1 * power));
    core.addColorStop(0.08, rgba(o.core, 0.85 * power));
    core.addColorStop(0.25, rgba([200, 220, 255], 0.28 * power));
    core.addColorStop(1, rgba([120, 150, 255], 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, S * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(o.core, 0.35 * power);
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI + 0.3;
      const r = S * (0.06 + 0.03 * (i % 2));
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(a) * r, sy - Math.sin(a) * r);
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      ctx.stroke();
    }
    // Ghosts along the line through the optical centre.
    const vx = cx - sx, vy = cy - sy;
    for (const gh of ghosts) {
      const gx = cx + vx * gh.at, gy = cy + vy * gh.at;
      const r = S * gh.size;
      const a = gh.k * power;
      const grad = ctx.createRadialGradient(gx, gy, r * (gh.ring ? 0.7 : 0), gx, gy, r);
      grad.addColorStop(0, rgba(gh.tint, gh.ring ? 0 : a * 0.6));
      grad.addColorStop(gh.ring ? 0.85 : 0.7, rgba(gh.tint, a));
      grad.addColorStop(1, rgba(gh.tint, 0));
      ctx.fillStyle = grad;
      if (gh.hex) poly(gx, gy, r, 6, 0.25);
      else { ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  async function run(swap = () => {}) {
    if (off) off();
    if (prefersReducedMotion()) { await swap(); return true; }
    const W = container.clientWidth, H = container.clientHeight;
    const scale = 0.75; // the flare is soft by nature; render under size
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const dir = o.from === 'right' ? -1 : 1;
    const y0 = H * (0.3 + rand() * 0.25);
    const y1 = H * (0.3 + rand() * 0.25);
    canvas.style.visibility = 'visible';
    let scene = o.scene ? o.scene() : null;
    let swapped = false;
    return new Promise((done) => {
      let t = 0;
      off = tick(async (_, dt) => {
        t += dt;
        const p = clamp(t / o.duration);
        const e = travel(p);
        const sx = W * (dir > 0 ? lerp(-0.15, 1.15, e) : lerp(1.15, -0.15, e));
        const sy = lerp(y0, y1, e);
        // Power swells as the source nears the centre; wash peaks at the cut.
        const centred = 1 - Math.min(1, Math.abs(sx - W / 2) / (W * 0.65));
        const power = smoothstep(0, 0.15, p) * (1 - smoothstep(0.85, 1, p)) * (0.55 + 0.45 * centred);
        const wash = Math.exp(-Math.pow((p - 0.5) / 0.085, 2));
        draw(W, H, sx, sy, power, wash);
        if (scene) {
          scene.style.filter = wash > 0.02 ? `brightness(${(1 + wash * 1.1).toFixed(3)}) contrast(${(1 - wash * 0.3).toFixed(3)})` : '';
        }
        if (!swapped && p >= 0.5) {
          swapped = true;
          if (scene) scene.style.filter = '';
          await swap();
          scene = o.scene ? o.scene() : null;
        }
        if (p >= 1) {
          off(); off = null;
          if (scene) scene.style.filter = '';
          ctx.clearRect(0, 0, W, H);
          canvas.style.visibility = 'hidden';
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
    },
  };
}

export default lightLeak;
