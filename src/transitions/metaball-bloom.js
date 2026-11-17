/**
 * Metaball Bloom
 * A liquid body erupts from the point you touch. Satellite droplets race
 * ahead, stretch on surface tension and are swallowed as the main mass
 * swells to seal the frame; after the swap it pulls back into a single
 * drop that splits and evaporates. The field is evaluated in JS at reduced
 * resolution and smoothly upscaled — no heavy filters.
 *
 *   const goo = metaballBloom(container, { color: '#0d0d10' });
 *   await goo.run(() => swap(), { x: 120, y: 340 });
 */
import { tick, wait } from '../core/ticker.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, smoothstep, lerp, prefersReducedMotion } from '../core/utils.js';
import { inOutCubic, cinematic } from '../core/ease.js';
import { ensurePositioned } from '../core/snapshot.js';

const DEFAULTS = {
  color: [13, 13, 16],
  rim: [255, 181, 71], // accent glow along the liquid surface
  droplets: 9,
  rimWidth: 9, // px of glowing surface
  cover: 1100,
  hold: 120,
  reveal: 1100,
  resolution: 0.28, // field resolution (fraction of CSS px)
  seed: 6,
};

const rgb = (c) => (Array.isArray(c) ? c : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);

export function metaballBloom(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const color = rgb(o.color), rim = rgb(o.rim);
  ensurePositioned(container);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;visibility:hidden';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const field = document.createElement('canvas');
  const fctx = field.getContext('2d');
  let off = null;

  function render(balls, W, H, fw, fh, img) {
    const d = img.data;
    const sx = W / fw, sy = H / fh;
    // For f = r²/d², a band of w px inside the surface spans f ∈ [1, 1 + 2w/r].
    // Scale the threshold by the dominant radius so the anti-aliased edge and
    // the glowing rim keep a constant on-screen width as the blob grows.
    let big = 1;
    for (const b of balls) if (b.r > big) big = b.r;
    const aa = Math.min(0.35, (2 * 1.6 * sx) / big); // ~1.6 field px of softness
    const rimW = Math.min(1.2, (2 * o.rimWidth) / big);
    const a0 = 1 - aa, a1 = 1 + aa, r0 = 1 + aa, r1 = 1 + aa + rimW;
    for (let y = 0, j = 0; y < fh; y++) {
      const py = (y + 0.5) * sy;
      for (let x = 0; x < fw; x++, j += 4) {
        const px = (x + 0.5) * sx;
        let f = 0;
        for (let k = 0; k < balls.length; k++) {
          const b = balls[k];
          if (b.r <= 0) continue;
          const dx = px - b.x, dy = py - b.y;
          f += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        // Soft threshold around f = 1 → anti-aliased liquid surface.
        const a = smoothstep(a0, a1, f);
        const edge = a * (1 - smoothstep(r0, r1, f)); // glowing rim just inside the surface
        d[j] = color[0] + (rim[0] - color[0]) * edge * 0.8;
        d[j + 1] = color[1] + (rim[1] - color[1]) * edge * 0.8;
        d[j + 2] = color[2] + (rim[2] - color[2]) * edge * 0.8;
        d[j + 3] = a * 255;
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, canvas.width, canvas.height);
  }

  async function run(swap = () => {}, origin) {
    if (off) off();
    if (prefersReducedMotion()) { await swap(); return true; }
    const W = container.clientWidth, H = container.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    const fw = Math.max(16, Math.round(W * o.resolution)), fh = Math.max(16, Math.round(H * o.resolution));
    field.width = fw; field.height = fh;
    const img = fctx.createImageData(fw, fh);
    const ox = origin ? origin.x : W / 2, oy = origin ? origin.y : H / 2;
    const far = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
    const rand = mulberry32(o.seed + Math.floor(Math.random() * 999));
    const drops = Array.from({ length: o.droplets }, (_, i) => {
      const a = (i / o.droplets) * Math.PI * 2 + rand() * 0.6;
      return { a, dist: far * (0.35 + rand() * 0.45), size: 0.05 + rand() * 0.07, lag: rand() * 0.25, x: ox, y: oy, r: 0 };
    });
    const core = { x: ox, y: oy, r: 0 };
    const balls = [core, ...drops];
    canvas.style.visibility = 'visible';

    // Phase 1 — eruption & cover
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const p = clamp(t / o.cover);
        // r ≥ 1.08·far guarantees f > 1 at every corner → fully sealed.
        core.r = far * 1.08 * inOutCubic(p);
        for (const d of drops) {
          const q = clamp((p - d.lag * 0.4) / 0.7);
          const out = cinematic(q);
          d.x = ox + Math.cos(d.a) * d.dist * out;
          d.y = oy + Math.sin(d.a) * d.dist * out;
          d.r = far * d.size * Math.sin(Math.PI * Math.min(q * 0.85 + 0.15, 1)) + far * 0.25 * smoothstep(0.6, 1, p);
        }
        render(balls, W, H, fw, fh, img);
        if (p >= 1) { off(); off = null; done(); }
      });
    });
    await swap();
    await wait(o.hold);
    // Phase 2 — retreat to a single drop that splits and evaporates
    const tx = W - ox, ty = H - oy; // retreat toward the opposite side for travel
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const p = clamp(t / o.reveal);
        const e = inOutCubic(p);
        core.r = lerp(far * 1.08, 0, e);
        core.x = lerp(ox, lerp(ox, tx, 0.35), e);
        core.y = lerp(oy, lerp(oy, ty, 0.35), e);
        for (const d of drops) {
          const q = clamp((p - d.lag * 0.5) / 0.75);
          d.r = lerp(far * 0.22, 0, smoothstep(0, 1, q)) * (1 - q * 0.2);
          d.x = lerp(d.x, core.x + Math.cos(d.a) * far * 0.3 * (1 - q), 0.08);
          d.y = lerp(d.y, core.y + Math.sin(d.a) * far * 0.3 * (1 - q), 0.08);
        }
        render(balls, W, H, fw, fh, img);
        if (p >= 1) { off(); off = null; done(); }
      });
    });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.visibility = 'hidden';
    return true;
  }

  return {
    run,
    destroy() {
      if (off) off();
      canvas.remove();
    },
  };
}

export default metaballBloom;
