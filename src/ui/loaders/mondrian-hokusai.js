/**
 * Loader — Mondrian × Hokusai
 * A Mondrian grid on washi paper. As progress arrives, each cell is flooded
 * by a Hokusai wave: a Prussian-blue front with a curling crest and claws of
 * white foam sweeps across it, leaving a field of seigaiha wave-scales that
 * shimmer. Mondrian's red and yellow cells are washed the same way. On
 * completion one great wave rolls across the whole composition.
 *
 *   const l = mondrianHokusai(container);  await l.run();
 */
import { artLoader, grainTile, ease } from './art-loader.js';
import { clamp, smoothstep } from '../../core/utils.js';

const PAPER = '#efe7d6';
const INK = '#151412';
// x, y, w, h in unit space + fill
const CELLS = [
  [0, 0, 0.38, 0.42, 'blue'],
  [0.38, 0, 0.62, 0.18, 'pale'],
  [0.38, 0.18, 0.36, 0.24, 'red'],
  [0.74, 0.18, 0.26, 0.24, 'blue'],
  [0, 0.42, 0.22, 0.58, 'yellow'],
  [0.22, 0.42, 0.52, 0.36, 'blue'],
  [0.74, 0.42, 0.26, 0.36, 'pale'],
  [0.22, 0.78, 0.3, 0.22, 'blue'],
  [0.52, 0.78, 0.48, 0.22, 'deep'],
];
const FILL = {
  blue: ['#2a4a78', '#8fb0d2'],
  deep: ['#1a2f52', '#6f8fb8'],
  pale: ['#c9d6e3', '#f6f2e8'],
  red: ['#c23a22', '#f0a183'],
  yellow: ['#e2ae2a', '#f7dc8f'],
};
const ORDER = [5, 0, 2, 7, 3, 4, 1, 8, 6];

const scene = {
  outro: 1700,
  setup(s) {
    s.data = { start: new Array(CELLS.length).fill(-1), grain: s.data.grain || grainTile(160, 5, 0.6) };
  },
  draw(ctx, s) {
    const { W, H, t, p, done } = s;
    const d = s.data;
    const S = Math.min(W * 0.78, H * 0.8);
    const ox = (W - S) / 2, oy = (H - S) / 2;
    const line = Math.max(2, S * 0.016);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // Which cells has progress reached?
    const reached = Math.floor(p * CELLS.length + 1e-6);
    ORDER.forEach((ci, k) => {
      if (k < reached && d.start[ci] < 0) d.start[ci] = t;
    });

    CELLS.forEach(([x, y, w, h, kind], i) => {
      const X = ox + x * S, Y = oy + y * S, Wd = w * S, Hd = h * S;
      const st = d.start[i];
      if (st < 0) return;
      const u = clamp((t - st) / 1.1);
      const [col, foam] = FILL[kind];
      ctx.save();
      ctx.beginPath();
      ctx.rect(X, Y, Wd, Hd);
      ctx.clip();
      // Wave front: sweeps left → right with a curling crest at the top.
      const e = ease.out(u);
      const front = (yy) => {
        const k = (yy - Y) / Hd; // 0 top → 1 bottom
        const curl = Math.pow(1 - k, 3) * Wd * 0.22; // crest leans forward
        const swell = Math.sin(k * Math.PI * 2.2 + t * 3) * Hd * 0.04;
        return X - Wd * 0.3 + e * Wd * 1.6 + curl * (1 - e) + swell * (1 - e);
      };
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      const N = 18;
      for (let j = 0; j <= N; j++) {
        const yy = Y + (Hd * j) / N;
        ctx.lineTo(Math.min(X + Wd, front(yy)), yy);
      }
      ctx.lineTo(X, Y + Hd);
      ctx.closePath();
      ctx.fill();
      // Seigaiha scales behind the front, shimmering.
      ctx.strokeStyle = foam;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(0.8, S * 0.0035);
      const rr = S * 0.035;
      for (let gy = Y + rr * 0.5; gy < Y + Hd + rr; gy += rr * 0.5) {
        const row = Math.round((gy - Y) / (rr * 0.5));
        for (let gx = X + (row % 2 ? rr : 0); gx < X + Wd + rr; gx += rr * 2) {
          if (gx > front(gy) - rr) continue;
          const sh = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + gx * 0.05 + gy * 0.08));
          ctx.globalAlpha = 0.22 * sh;
          for (const k of [1, 0.66, 0.33]) {
            ctx.beginPath();
            ctx.arc(gx, gy, rr * k, Math.PI, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      // Foam claws along the crest while the wave is moving.
      if (u < 1) {
        ctx.fillStyle = '#fbf8f0';
        for (let j = 0; j < 22; j++) {
          const k = j / 21;
          const yy = Y + Hd * k * 0.75;
          const fx = front(yy);
          const r = S * 0.012 * (1 - k * 0.7) * (1 - u * 0.6);
          ctx.globalAlpha = 0.9 * (1 - u);
          ctx.beginPath();
          ctx.arc(fx - r * 0.4 + Math.sin(j * 2.1 + t * 6) * r, yy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });

    // The great wave on completion: one crest across everything.
    if (done > 0) {
      const g = ease.inOut(clamp(done / 0.8));
      const fx = ox - S * 0.3 + g * S * 1.6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, S, S);
      ctx.clip();
      const grad = ctx.createLinearGradient(fx - S * 0.25, 0, fx, 0);
      grad.addColorStop(0, 'rgba(251,248,240,0)');
      grad.addColorStop(0.75, 'rgba(251,248,240,.55)');
      grad.addColorStop(1, 'rgba(251,248,240,.95)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx - S * 0.25, oy);
      for (let j = 0; j <= 20; j++) {
        const k = j / 20;
        const yy = oy + S * k;
        ctx.lineTo(fx + Math.pow(1 - k, 3) * S * 0.12 + Math.sin(k * 9 + t * 5) * S * 0.01, yy);
      }
      ctx.lineTo(fx - S * 0.25, oy + S);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Mondrian's black lines, drawn in at the start.
    const draw = clamp(t / 0.9);
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.lineCap = 'square';
    const seen = new Set();
    CELLS.forEach(([x, y, w, h]) => {
      [[x, y, x + w, y], [x + w, y, x + w, y + h], [x, y + h, x + w, y + h], [x, y, x, y + h]].forEach(([a, b, c, e]) => {
        const key = [a, b, c, e].map((v) => v.toFixed(2)).join();
        if (seen.has(key)) return;
        seen.add(key);
        const k = smoothstep(0, 1, clamp(draw * 1.4 - (a + b) * 0.3));
        ctx.beginPath();
        ctx.moveTo(ox + a * S, oy + b * S);
        ctx.lineTo(ox + (a + (c - a) * k) * S, oy + (b + (e - b) * k) * S);
        ctx.stroke();
      });
    });

    // Percentage, set like a seal stamp.
    const pct = Math.round(p * 100);
    ctx.fillStyle = '#b8321e';
    const st = S * 0.11;
    ctx.fillRect(ox + S + S * 0.03, oy + S - st, st, st);
    ctx.fillStyle = '#fbf6ea';
    ctx.font = `600 ${Math.round(st * 0.36)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pct), ox + S + S * 0.03 + st / 2, oy + S - st / 2);
    ctx.textAlign = 'left';

    // Washi texture.
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ctx.createPattern(d.grain, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

export function mondrianHokusai(container, options = {}) {
  return artLoader(container, scene, options);
}

export default mondrianHokusai;
