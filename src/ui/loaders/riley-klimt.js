/**
 * Loader — Riley × Klimt
 * Bridget Riley's op-art current laid over Klimt's gold leaf. Black bands
 * ripple across a field of beaten gold and mosaic tesserae, their waves
 * swelling and pinching so the surface seems to flow. As progress grows
 * the turbulence calms — order emerging from vibration — and on completion
 * the bands draw perfectly straight, part like a curtain and a shimmer of
 * light runs across the gold.
 *
 *   const l = rileyKlimt(container);  await l.run();
 */
import { artLoader, ease } from './art-loader.js';
import { mulberry32 } from '../../core/noise.js';
import { clamp, lerp } from '../../core/utils.js';

function goldLeaf(W, H, ratio) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * ratio));
  c.height = Math.max(1, Math.round(H * ratio));
  const g = c.getContext('2d');
  g.scale(ratio, ratio);
  const base = g.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#8a6115');
  base.addColorStop(0.35, '#d4a63c');
  base.addColorStop(0.6, '#b3852a');
  base.addColorStop(1, '#e9c766');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const r = mulberry32(21);
  // Gold leaf is laid in square sheets: a slightly irregular grid, each sheet
  // its own tone, edges overlapping in faint darker seams.
  const leaf = Math.max(W, H) / 11;
  for (let y = -leaf * 0.5; y < H + leaf; y += leaf) {
    for (let x = -leaf * 0.5 + (Math.round(y / leaf) % 2) * leaf * 0.18; x < W + leaf; x += leaf) {
      const jx = (r() - 0.5) * leaf * 0.08, jy = (r() - 0.5) * leaf * 0.08;
      const tone = r();
      const sheet = g.createLinearGradient(x, y, x + leaf, y + leaf);
      sheet.addColorStop(0, tone < 0.5 ? 'rgba(246,214,120,.28)' : 'rgba(120,80,20,.16)');
      sheet.addColorStop(1, tone < 0.5 ? 'rgba(200,150,50,.08)' : 'rgba(250,222,140,.18)');
      g.fillStyle = sheet;
      g.fillRect(x + jx, y + jy, leaf * 1.02, leaf * 1.02);
      g.strokeStyle = 'rgba(90,60,15,.18)';
      g.lineWidth = 0.8;
      g.strokeRect(x + jx + 0.5, y + jy + 0.5, leaf * 1.02, leaf * 1.02);
    }
  }
  // Fine burnish: a few long, soft strokes of light.
  for (let i = 0; i < 9; i++) {
    const y = r() * H;
    const band = g.createLinearGradient(0, y - 40, 0, y + 40);
    band.addColorStop(0, 'rgba(255,240,190,0)');
    band.addColorStop(0.5, 'rgba(255,240,190,.12)');
    band.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = band;
    g.fillRect(0, y - 40, W, 80);
  }
  // Klimt mosaic: tesserae gathered in a few patches, not scattered noise.
  const patches = Array.from({ length: 5 }, () => [r() * W, r() * H, 40 + r() * 70]);
  for (const [px, py, pr] of patches) {
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * pr;
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      const s = 3 + r() * 5;
      const pick = r();
      g.globalAlpha = 0.78;
      g.fillStyle = pick < 0.45 ? '#1c140a' : pick < 0.72 ? '#f6ecd0' : pick < 0.88 ? '#7a2f1c' : '#2f4f6f';
      g.fillRect(Math.round(x), Math.round(y), s, s);
    }
    // a spiral at the heart of each patch
    g.globalAlpha = 0.55;
    g.strokeStyle = '#3b2a0f';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.15) {
      const rr = (pr * 0.32 * a) / (Math.PI * 6);
      g.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

const scene = {
  outro: 1900,
  resize(s) { s.data.leaf = null; },
  setup(s) { s.data = { leaf: null }; },
  draw(ctx, s) {
    const { W, H, t, p, done } = s;
    const d = s.data;
    const ratio = ctx.getTransform().a;
    if (!d.leaf) d.leaf = goldLeaf(W, H, ratio);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(d.leaf, 0, 0);
    ctx.restore();

    const N = 15;
    const band = H / N;
    const calm = ease.inOut(clamp(p * 0.75 + ease.inOut(clamp(done / 0.45)) * 0.4));
    const part = ease.inOut(clamp((done - 0.45) / 0.4));
    const A = band * 0.62 * (1 - calm);
    ctx.fillStyle = '#120c05';
    for (let i = 0; i < N; i++) {
      const yc = (i + 0.5) * band;
      const dir = i % 2 ? 1 : -1;
      const shift = dir * part * W * 1.05;
      const top = [], bot = [];
      const steps = 64;
      for (let k = 0; k <= steps; k++) {
        const x = (k / steps) * W;
        const u = x / W;
        // waves travel and swell; the envelope pinches across the width (Riley)
        const env = 0.55 + 0.45 * Math.sin(u * Math.PI * 1.6 + t * 0.6 + i * 0.35);
        const y = yc + A * env * Math.sin(u * Math.PI * 4.2 - t * 1.7 + i * 0.55);
        const thick = band * (0.24 + 0.16 * (1 - calm) * Math.sin(u * Math.PI * 3 - t * 1.1 + i));
        top.push([x + shift, y - thick]);
        bot.push([x + shift, y + thick]);
      }
      ctx.beginPath();
      top.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(bot[k][0], bot[k][1]);
      ctx.closePath();
      ctx.fill();
    }

    // Light runs across the gold (always faintly; strongly at completion).
    const sweepPos = ((t * 0.18) % 1.6) - 0.3;
    const sx = lerp(-0.3, 1.3, done > 0 ? ease.inOut(clamp(done / 0.9)) : sweepPos) * W;
    const sh = ctx.createLinearGradient(sx - W * 0.18, 0, sx + W * 0.18, 0);
    const k = done > 0 ? 0.55 : 0.16;
    sh.addColorStop(0, 'rgba(255,240,190,0)');
    sh.addColorStop(0.5, `rgba(255,244,205,${k})`);
    sh.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Progress plaque.
    const pct = Math.round(p * 100);
    const pw = Math.min(W, H) * 0.2, ph = pw * 0.42;
    const px = W - pw - W * 0.05, py = H - ph - H * 0.07;
    ctx.fillStyle = 'rgba(18,12,5,.88)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#e2bf62';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 3.5, py + 3.5, pw - 7, ph - 7);
    ctx.fillStyle = '#ecd08a';
    ctx.font = `500 ${Math.round(ph * 0.5)}px "Instrument Serif", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, px + pw / 2, py + ph / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },
};

export function rileyKlimt(container, options = {}) {
  return artLoader(container, scene, options);
}

export default rileyKlimt;
