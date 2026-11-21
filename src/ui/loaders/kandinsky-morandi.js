/**
 * Loader — Kandinsky × Morandi
 * Kandinsky's "Several Circles" played as music, painted in Morandi's
 * dusty palette. Translucent circles drift on slow orbits and each breathes
 * on its own beat of a 84 bpm bar, like notes in a chord; a few lines and
 * an arc keep time. Progress is a stave across the bottom that fills, a
 * new note landing at each step. On completion the circles gather into
 * concentric rings and strike one final chord.
 *
 *   const l = kandinskyMorandi(container);  await l.run();
 */
import { artLoader, grainTile, ease } from './art-loader.js';
import { mulberry32 } from '../../core/noise.js';
import { clamp, lerp } from '../../core/utils.js';

const BG = '#e7e0d4';
const PALETTE = ['#8c9ba1', '#c2a093', '#a3ad97', '#6d6762', '#c9b48a', '#b7a6b4', '#d8cfbf'];
const CHARCOAL = '#3e3a37';
const BEAT = 60 / 84;

const scene = {
  outro: 1800,
  setup(s) {
    const r = mulberry32(13);
    s.data = {
      grain: s.data.grain || grainTile(160, 9, 0.5),
      circles: Array.from({ length: 10 }, (_, i) => ({
        orbit: 0.08 + r() * 0.3,
        ecc: 0.55 + r() * 0.4,
        speed: (0.08 + r() * 0.16) * (r() < 0.5 ? -1 : 1),
        phase: r() * Math.PI * 2,
        size: i === 0 ? 0.16 : 0.03 + Math.pow(r(), 1.6) * 0.11,
        color: i === 0 ? CHARCOAL : PALETTE[i % PALETTE.length],
        beat: [1, 2, 0.5, 1, 2, 0.5, 1, 4, 2, 1][i],
        offset: r(),
        pulse: 0,
      })),
      notes: [],
      lastPct: -1,
    };
  },
  draw(ctx, s) {
    const { W, H, t, dt, p, done } = s;
    const d = s.data;
    const S = Math.min(W, H);
    const cx = W / 2, cy = H * 0.46;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    // soft studio light
    const glow = ctx.createRadialGradient(cx - S * 0.2, cy - S * 0.3, 0, cx, cy, S);
    glow.addColorStop(0, 'rgba(255,252,244,.6)');
    glow.addColorStop(1, 'rgba(160,148,132,.25)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const gather = ease.inOut(clamp(done / 0.7));
    // Lines and an arc keeping time.
    ctx.strokeStyle = CHARCOAL;
    ctx.globalAlpha = 0.55 * (1 - gather);
    ctx.lineWidth = Math.max(1, S * 0.004);
    const swing = Math.sin(t * Math.PI / (BEAT * 2)) * 0.06;
    for (const [x0, y0, len, ang] of [[0.18, 0.2, 0.42, -0.5], [0.6, 0.62, 0.3, 0.9], [0.3, 0.72, 0.22, 0.15]]) {
      const a = ang + swing;
      ctx.beginPath();
      ctx.moveTo(W * x0, H * y0);
      ctx.lineTo(W * x0 + Math.cos(a) * len * S, H * y0 + Math.sin(a) * len * S);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx + S * 0.18, cy - S * 0.05, S * 0.24, -2.4 + swing, -0.9 + swing);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Circles: orbit, breathe on their beat, gather on completion.
    const sorted = [...d.circles].sort((a, b) => b.size - a.size);
    for (const c of d.circles) {
      const period = BEAT * c.beat;
      const ph = ((t + c.offset * period) % period) / period;
      if (ph < c.lastPh) c.pulse = 1; // a new beat
      c.lastPh = ph;
      c.pulse *= Math.exp(-dt * 7);
    }
    sorted.forEach((c, rank) => {
      const a = c.phase + t * c.speed;
      let x = cx + Math.cos(a) * c.orbit * S;
      let y = cy + Math.sin(a) * c.orbit * S * c.ecc;
      // gathered: concentric, largest at the back
      x = lerp(x, cx, gather);
      y = lerp(y, cy, gather);
      const finalR = (0.24 - rank * 0.021) * S;
      let r = lerp(c.size * S, finalR, gather);
      const chord = done > 0.7 ? Math.sin(Math.PI * clamp((done - 0.7) / 0.3)) * 0.06 : 0;
      r *= 1 + c.pulse * 0.07 + chord;
      // halo, then a translucent multiply disc
      const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.45);
      halo.addColorStop(0, 'rgba(255,250,240,0)');
      halo.addColorStop(0.6, `rgba(255,250,240,${0.22 + c.pulse * 0.2})`);
      halo.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = c.color === CHARCOAL ? 0.92 : 0.78;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });

    // Stave: progress as a line of notes.
    const x0 = W * 0.14, x1 = W * 0.86, sy = H * 0.86;
    ctx.strokeStyle = CHARCOAL;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(x0, sy + k * S * 0.012); ctx.lineTo(x1, sy + k * S * 0.012); ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.5, S * 0.005);
    ctx.beginPath(); ctx.moveTo(x0, sy); ctx.lineTo(lerp(x0, x1, p), sy); ctx.stroke();
    const pct = Math.round(p * 100);
    const step = Math.floor(pct / 8);
    while (d.notes.length < step) {
      const k = d.notes.length;
      d.notes.push({ x: (k + 0.5) / 12.5, y: [-2, 0, 1, -1, 2, 0, -2, 1, -1, 0, 2, -1, 0][k % 13], born: t, c: PALETTE[k % PALETTE.length] });
    }
    for (const n of d.notes) {
      const age = clamp((t - n.born) / 0.5);
      const pop = ease.back(age);
      const nx = lerp(x0, x1, n.x), ny = sy + n.y * S * 0.012;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = n.c;
      ctx.beginPath(); ctx.ellipse(nx, ny, Math.max(0.01, S * 0.011 * pop), Math.max(0.01, S * 0.008 * pop), -0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = CHARCOAL;
    ctx.font = `500 ${Math.round(S * 0.032)}px "Instrument Serif", Georgia, serif`;
    ctx.fillText(`${pct}`, x1 + S * 0.02, sy + S * 0.01);
    ctx.globalAlpha = 1;

    // Canvas tooth.
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(d.grain, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

export function kandinskyMorandi(container, options = {}) {
  return artLoader(container, scene, options);
}

export default kandinskyMorandi;
