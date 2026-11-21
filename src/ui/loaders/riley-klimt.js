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
  // beaten leaf: soft overlapping squares of slightly different gold
  for (let i = 0; i < 260; i++) {
    const s = 18 + r() * 60;
    g.globalAlpha = 0.12 + r() * 0.16;
    g.fillStyle = r() < 0.5 ? '#f3d683' : '#8f6418';
    g.fillRect(r() * W - s / 2, r() * H - s / 2, s, s);
  }
  // Klimt tesserae: tiny squares and spirals
  g.globalAlpha = 1;
  for (let i = 0; i < 140; i++) {
    const s = 3 + r() * 6;
    const x = r() * W, y = r() * H;
    const pick = r();
    g.fillStyle = pick < 0.5 ? '#1c140a' : pick < 0.75 ? '#f6ecd0' : '#7a2f1c';
    g.globalAlpha = 0.55;
    g.fillRect(x, y, s, s);
  }
  g.strokeStyle = '#3b2a0f';
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, R = 6 + r() * 10;
    g.globalAlpha = 0.4;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const rr = (R * a) / (Math.PI * 5);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
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
