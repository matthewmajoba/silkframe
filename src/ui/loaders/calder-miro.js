/**
 * Loader — Calder × Miró
 * A Calder mobile hung with Miró's shapes. Each arm is a damped pendulum
 * that seeks the balance of the weights below it, nudged by a soft breeze;
 * the plates turn slowly on their threads. As progress arrives, a new shape
 * is hung — and the whole mobile swings to find its new balance. On
 * completion a gust sends it turning, and it settles, level.
 *
 *   const l = calderMiro(container);  await l.run();
 */
import { artLoader, grainTile, ease } from './art-loader.js';
import { createNoise } from '../../core/noise.js';
import { clamp, lerp } from '../../core/utils.js';

const BG = '#efe6d2';
const INK = '#1a1714';
const { noise2 } = createNoise(17);

// Shapes hung at progress thresholds.
const SHAPES = [
  { kind: 'disc', color: '#c8321e', size: 0.075, at: 0 },
  { kind: 'crescent', color: INK, size: 0.07, at: 0.22 },
  { kind: 'star', color: '#e8b21f', size: 0.06, at: 0.45 },
  { kind: 'blob', color: '#24508c', size: 0.07, at: 0.68 },
  { kind: 'eye', color: INK, size: 0.045, at: 0.9 },
];

/** Mobile structure: arms with a left and right child (shape index or arm). */
function build() {
  const arm = (a, b, left, right, h) => ({ a, b, left, right, h, th: 0, w: 0 });
  // root ── left: arm1, right: disc ; arm1 ── left: crescent, right: arm2 ; arm2 ── left: star, right: arm3 ; arm3 ── blob / eye
  const arm3 = arm(0.09, 0.11, { shape: 3 }, { shape: 4 }, 0.12);
  const arm2 = arm(0.12, 0.13, { shape: 2 }, { arm: arm3 }, 0.12);
  const arm1 = arm(0.14, 0.17, { shape: 1 }, { arm: arm2 }, 0.13);
  return arm(0.24, 0.16, { arm: arm1 }, { shape: 0 }, 0.14);
}

const scene = {
  outro: 2200,
  setup(s) {
    s.data = { root: build(), born: SHAPES.map(() => -1), grain: s.data.grain || grainTile(160, 4, 0.55), gusted: false };
  },
  draw(ctx, s) {
    const { W, H, t, dt, p, done } = s;
    const d = s.data;
    const S = Math.min(W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    const light = ctx.createRadialGradient(W * 0.3, H * 0.1, 0, W * 0.5, H * 0.5, Math.max(W, H));
    light.addColorStop(0, 'rgba(255,253,246,.7)');
    light.addColorStop(1, 'rgba(180,160,130,.25)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);

    // Hang shapes as progress passes their thresholds.
    SHAPES.forEach((sh, i) => {
      if (d.born[i] < 0 && p >= sh.at) d.born[i] = t;
    });
    const mass = (node) => {
      if (node.shape !== undefined) return d.born[node.shape] >= 0 ? 1 + SHAPES[node.shape].size * 6 : 0;
      return weight(node.arm);
    };
    const weight = (arm) => 0.15 + mass(arm.left) + mass(arm.right);

    // Physics: each arm swings toward the angle that balances its torques.
    const gust = done > 0 && !d.gusted;
    if (gust) d.gusted = true;
    const stepArm = (arm, depth) => {
      const mL = mass(arm.left), mR = mass(arm.right);
      const eq = clamp(Math.atan2(mR * arm.b - mL * arm.a, 0.22), -0.6, 0.6) * (1 - ease.smooth(clamp(done * 1.4 - 0.4)));
      const breeze = noise2(t * 0.35 + depth * 7, depth * 3.1) * 0.9;
      arm.w += (-(arm.th - eq) * 11 - arm.w * 1.25 + breeze) * dt;
      if (gust) arm.w += (depth % 2 ? -1 : 1) * (3.2 - depth * 0.4);
      arm.th += arm.w * dt;
      if (arm.left.arm) stepArm(arm.left.arm, depth + 1);
      if (arm.right.arm) stepArm(arm.right.arm, depth + 1);
    };
    stepArm(d.root, 0);

    ctx.lineCap = 'round';
    const top = { x: W * 0.52, y: 0 };
    const drawShape = (i, x, y) => {
      const sh = SHAPES[i];
      const age = d.born[i] < 0 ? -1 : t - d.born[i];
      if (age < 0) return;
      const pop = ease.back(clamp(age / 0.55));
      const r = Math.max(0.01, sh.size * S * pop);
      // the plate turns on its thread: foreshorten horizontally
      const turn = Math.cos(t * (0.4 + i * 0.13) + i * 1.7) * (1 - ease.smooth(clamp(done * 1.5 - 0.5)));
      const fx = 0.35 + 0.65 * Math.abs(turn);
      ctx.save();
      ctx.translate(x, y + r);
      ctx.scale(fx, 1);
      ctx.fillStyle = sh.color;
      ctx.shadowColor = 'rgba(60,40,20,.25)';
      ctx.shadowBlur = S * 0.02;
      ctx.shadowOffsetY = S * 0.012;
      ctx.beginPath();
      if (sh.kind === 'disc') ctx.arc(0, 0, r, 0, Math.PI * 2);
      else if (sh.kind === 'crescent') { ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 1.85); ctx.arc(r * 0.42, 0, r * 0.78, Math.PI * 1.75, Math.PI * 0.25, true); }
      else if (sh.kind === 'star') {
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const rr = k % 2 ? r * 0.45 : r;
          k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
      } else if (sh.kind === 'blob') {
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r, -r * 1.1, r * 0.6, -r * 1.2, r, -r * 0.2);
        ctx.bezierCurveTo(r * 1.3, r * 0.7, -r * 0.2, r * 1.1, -r, 0);
      } else if (sh.kind === 'eye') {
        ctx.ellipse(0, 0, r * 1.3, r * 0.7, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowColor = 'transparent';
      if (sh.kind === 'eye') {
        ctx.fillStyle = BG;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8321e';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    const drawArm = (arm, px, py) => {
      const ca = Math.cos(arm.th), sa = Math.sin(arm.th);
      const lx = px - arm.a * S * ca, ly = py - arm.a * S * sa;
      const rx = px + arm.b * S * ca, ry = py + arm.b * S * sa;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.6, S * 0.0055);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      // tiny hooked ends, like bent wire
      ctx.lineWidth = Math.max(1, S * 0.003);
      [[lx, ly, arm.left], [rx, ry, arm.right]].forEach(([x, y, child]) => {
        if (child.shape !== undefined && d.born[child.shape] < 0) return;
        const h = arm.h * S;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
        if (child.arm) drawArm(child.arm, x, y + h);
        else drawShape(child.shape, x, y + h);
      });
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.6, S * 0.005), 0, Math.PI * 2); ctx.fill();
    };
    const rootY = H * 0.17;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, S * 0.003);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(top.x, rootY); ctx.stroke();
    drawArm(d.root, top.x, rootY);

    // Progress: a hand-inked line and number in the corner.
    const pct = Math.round(p * 100);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(S * 0.07)}px "Instrument Serif", Georgia, serif`;
    ctx.fillText(String(pct), W * 0.07, H * 0.9);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(W * 0.07, H * 0.92);
    ctx.lineTo(lerp(W * 0.07, W * 0.32, p), H * 0.92 + Math.sin(t * 2) * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ctx.createPattern(d.grain, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

export function calderMiro(container, options = {}) {
  return artLoader(container, scene, options);
}

export default calderMiro;
