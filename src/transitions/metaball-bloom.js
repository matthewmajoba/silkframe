/**
 * Metaball Bloom — liquid drops
 * Drops of glossy liquid fall into the frame, stretching under gravity. The
 * first one splashes where you touched, flinging droplets that arc and fall
 * back; more drops rain in and merge until the pool seals the frame. After
 * the swap the liquid drains: the surface slides away downward, leaving
 * drips that hang, stretch and let go.
 *
 * The surface is an implicit field evaluated at reduced resolution; its
 * gradient doubles as a height map, so every drop is lit — a specular
 * highlight, a darker belly and a fresnel rim — like ink or oil.
 *
 *   const goo = metaballBloom(container, { color: '#0d0d10' });
 *   await goo.run(() => swap(), { x: 120, y: 340 });
 */
import { tick, wait } from '../core/ticker.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, smoothstep, lerp, prefersReducedMotion } from '../core/utils.js';
import { ensurePositioned } from '../core/snapshot.js';

const DEFAULTS = {
  color: [11, 10, 14], // liquid body
  specular: [255, 236, 205], // highlight tint
  rim: [255, 170, 80], // fresnel rim tint
  drops: 6,
  cover: 1300,
  hold: 120,
  drain: 1350,
  gravity: 3200, // px/s²
  resolution: 0.3, // field resolution (fraction of CSS px)
  seed: 6,
};

const rgb = (c) => (Array.isArray(c) ? c : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);

export function metaballBloom(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const color = rgb(o.color), spec = rgb(o.specular), rim = rgb(o.rim);
  ensurePositioned(container);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;visibility:hidden';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const field = document.createElement('canvas');
  const fctx = field.getContext('2d');
  let off = null;
  // light: upper-left, slightly in front
  const Lx = -0.45, Ly = -0.62, Lz = 0.64;
  const hx0 = Lx, hy0 = Ly, hz0 = Lz + 1;
  const hl = Math.hypot(hx0, hy0, hz0);
  const Hx = hx0 / hl, Hy = hy0 / hl, Hz = hz0 / hl;

  /**
   * Balls are { x, y, r, sy } — sy stretches a drop vertically while it falls.
   * Field f = Σ r² / (dx² + (dy / sy)²); the surface is f = 1.
   */
  function render(balls, W, H, fw, fh, img, buf) {
    const sx = W / fw, sy = H / fh;
    let big = 1;
    for (const b of balls) if (b.r > big) big = b.r;
    // Edge softness in field units, constant on screen (~1.5 field px).
    const aa = Math.min(0.3, (2 * 1.5 * sx) / big);
    for (let y = 0, j = 0; y < fh; y++) {
      const py = (y + 0.5) * sy;
      for (let x = 0; x < fw; x++, j++) {
        const px = (x + 0.5) * sx;
        let f = 0;
        for (let k = 0; k < balls.length; k++) {
          const b = balls[k];
          if (b.r <= 0.5) continue;
          const dx = px - b.x, dy = (py - b.y) / b.sy;
          f += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        buf[j] = f;
      }
    }
    const d = img.data;
    // Surface normals from a distance estimate: dist ≈ (f − 1) / |∇f| (px).
    // Within `men` px of the edge the surface curves down (a meniscus);
    // deeper inside it is flat glass — the same profile for a tiny drop and
    // for a pool that fills the frame.
    const men = Math.min(Math.min(W, H) * 0.06, 42);
    for (let y = 0, j = 0, q = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++, j++, q += 4) {
        const f = buf[j];
        const a = smoothstep(1 - aa, 1 + aa, f);
        if (a <= 0) { d[q + 3] = 0; continue; }
        const gx = (buf[x < fw - 1 ? j + 1 : j] - buf[x > 0 ? j - 1 : j]) / (2 * sx);
        const gy = (buf[y < fh - 1 ? j + fw : j] - buf[y > 0 ? j - fw : j]) / (2 * sy);
        const gl = Math.hypot(gx, gy) || 1e-6;
        const dist = Math.max(0, (f - 1) / gl);
        const slope = (1 - smoothstep(0, men, dist)) * 1.9;
        let nx = (-gx / gl) * slope, ny = (-gy / gl) * slope, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        const ndh = Math.max(0, nx * Hx + ny * Hy + nz * Hz);
        const s = Math.pow(ndh, 60) * 1.25 + Math.pow(ndh, 12) * 0.1;
        const fres = Math.pow(1 - nz, 2.4);
        const env = 0.07 * (1 - y / fh); // faint sky reflection on the flat surface
        const shade = 0.5 + 0.5 * diff;
        d[q] = Math.min(255, color[0] * shade + spec[0] * (s + env) + rim[0] * fres * 0.45);
        d[q + 1] = Math.min(255, color[1] * shade + spec[1] * (s + env) + rim[1] * fres * 0.45);
        d[q + 2] = Math.min(255, color[2] * shade + spec[2] * (s + env) + rim[2] * fres * 0.45);
        d[q + 3] = a * 255;
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
    const buf = new Float32Array(fw * fh);
    const ox = origin ? origin.x : W / 2, oy = origin ? origin.y : H * 0.6;
    const far = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
    const rand = mulberry32(o.seed + Math.floor(Math.random() * 9999));
    const g = o.gravity;
    const unit = Math.min(W, H);

    // The pool that grows where drops land.
    const pool = { x: ox, y: oy, r: 0, sy: 1 };
    // Falling drops: the lead drop hits the origin; the rest rain in nearby.
    const drops = Array.from({ length: o.drops }, (_, i) => {
      const lead = i === 0;
      const tx = lead ? ox : clamp(ox + (rand() - 0.5) * W * 0.9, W * 0.05, W * 0.95);
      const ty = lead ? oy : clamp(oy + (rand() - 0.4) * H * 0.5, H * 0.15, H * 0.95);
      const r = unit * (lead ? 0.075 : 0.035 + rand() * 0.035);
      const delay = lead ? 0 : 0.12 + i * 0.07 + rand() * 0.08; // seconds
      // fall time from above the frame to the target under gravity
      const startY = -r * 3;
      const T = Math.sqrt((2 * (ty - startY)) / g);
      return { x: tx, y: startY, ty, startY, r, r0: r, sy: 1, delay, T, landed: false };
    });
    const splash = []; // droplets flung on impact
    const balls = () => [pool, ...drops, ...splash];
    canvas.style.visibility = 'visible';

    // Phase 1 — rain and splash
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        const s = Math.min(dt / 1000, 1 / 30);
        t += s;
        let landed = 0;
        for (const d of drops) {
          const lt = t - d.delay;
          if (lt < 0) { d.r = 0; continue; }
          if (!d.landed) {
            const k = Math.min(1, lt / d.T);
            d.y = d.startY + 0.5 * g * (k * d.T) ** 2;
            d.r = d.r0;
            const v = g * k * d.T;
            d.sy = 1 + Math.min(0.9, v / 2400); // teardrop stretch while falling
            if (k >= 1) {
              d.landed = true;
              d.y = d.ty;
              d.hit = t;
              // impact: fling a crown of droplets
              const n = d === drops[0] ? 9 : 3;
              for (let i = 0; i < n; i++) {
                const a = -Math.PI * (0.1 + 0.8 * rand());
                const sp = (d === drops[0] ? 900 : 520) * (0.5 + rand());
                splash.push({ x: d.x, y: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: d.r0 * (0.25 + rand() * 0.25), sy: 1, life: 0 });
              }
            }
          } else {
            // spread and settle: the drop flattens into a puddle
            const k = clamp((t - d.hit) / 0.35);
            d.sy = lerp(0.7, 1, k);
            d.r = d.r0 * (1 + 0.8 * Math.sin(Math.PI * Math.min(1, k)) * 0.5 + k * 0.6);
            landed++;
          }
        }
        for (const sp of splash) {
          sp.life += s;
          sp.vy += g * s;
          sp.x += sp.vx * s;
          sp.y += sp.vy * s;
          sp.sy = 1 + Math.min(0.6, Math.abs(sp.vy) / 3000);
          if (sp.y > H + sp.r * 2) sp.r = 0;
        }
        // The pool swells once the lead drop lands.
        const lead = drops[0];
        if (lead.landed) {
          const k = clamp((t - lead.hit) / (o.cover / 1000 - lead.T));
          pool.r = far * 1.1 * (k * k * (3 - 2 * k)); // ≥ 1.08·far seals every corner
          pool.sy = 1 - 0.18 * Math.sin(Math.PI * k);
        }
        render(balls(), W, H, fw, fh, img, buf);
        if (lead.landed && pool.r >= far * 1.099) { off(); off = null; done(); }
      });
    });
    await swap();
    await wait(o.hold);
    splash.length = 0;
    drops.forEach((d) => (d.r = 0));

    // Phase 2 — drain: the surface slides down and off, leaving drips.
    const drips = Array.from({ length: 4 }, () => ({
      x: W * (0.12 + rand() * 0.76), y: 0, r: 0, sy: 1, at: 0.25 + rand() * 0.35, r0: unit * (0.02 + rand() * 0.02), vy: 0, freed: false,
    }));
    await new Promise((done) => {
      let t = 0;
      const D = o.drain / 1000;
      off = tick((_, dt) => {
        const s = Math.min(dt / 1000, 1 / 30);
        t += s;
        const p = clamp(t / D);
        const e = p * p * (3 - 2 * p);
        // Pool falls away: its top edge travels from above the frame to below it.
        pool.r = far * 1.1 * (1 - 0.35 * e);
        pool.x = lerp(pool.x, W / 2, 0.04);
        const topEdge = lerp(-H * 0.2, H * 1.25, e);
        pool.y = topEdge + pool.r * pool.sy;
        pool.sy = 1;
        for (const d of drips) {
          if (p < d.at) { d.r = 0; continue; }
          if (!d.freed) {
            // hangs from the receding surface and stretches
            const k = clamp((p - d.at) / 0.25);
            d.r = d.r0 * (0.6 + 0.6 * k);
            d.sy = 1 + k * 1.6;
            d.y = topEdge - d.r * 0.4 - k * d.r * 1.2;
            if (k >= 1) { d.freed = true; d.vy = 0; }
          } else {
            d.vy += g * 0.55 * s;
            d.y += d.vy * s;
            d.sy = 1 + Math.min(1.2, d.vy / 1500);
            d.r = Math.max(0, d.r - s * d.r0 * 0.4);
          }
        }
        render([pool, ...drips], W, H, fw, fh, img, buf);
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
