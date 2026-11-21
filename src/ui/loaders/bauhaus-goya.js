/**
 * Loader — Bauhaus × Goya
 * Bauhaus primaries balanced on a seesaw, painted in the dark of Goya's
 * Black Paintings: one warm candle light from the upper left, deep umber
 * shadows, a rough grain. The bar rocks slowly while the red circle rolls
 * along it under real gravity, lagging the tilt; a thin ochre ring around
 * the composition fills with progress. On completion everything settles
 * into perfect balance and the light swells.
 *
 *   const l = bauhausGoya(container);  await l.run();
 */
import { artLoader, grainTile, ease } from './art-loader.js';
import { createNoise } from '../../core/noise.js';
import { clamp } from '../../core/utils.js';

const C = {
  ground: '#0b0806',
  umber: '#2c1e12',
  red: [156, 46, 28],
  ochre: [201, 152, 46],
  blue: [38, 52, 66],
  bone: '#e9dcc3',
};
const { noise2 } = createNoise(31);
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;

const scene = {
  outro: 1600,
  setup(s) {
    s.data = { theta: 0, sc: -0.25, vc: 0, grain: s.data.grain || grainTile(180, 11, 0.9) };
  },
  draw(ctx, s) {
    const { W, H, t, dt, p, done } = s;
    const d = s.data;
    const S = Math.min(W, H) * 0.62;
    const cx = W / 2, cy = H * 0.52;
    const L = S * 0.9, thick = S * 0.034;
    const P = { x: cx, y: cy + S * 0.08 }; // fulcrum apex
    const lightX = W * 0.16, lightY = H * 0.08;
    const flicker = 1 + noise2(t * 2.2, 1.7) * 0.06 + noise2(t * 7, 4.1) * 0.025;
    const swell = Math.sin(Math.PI * clamp(done * 1.2)) * 0.6;

    // Physics: the bar rocks like a slow pendulum; the ball rolls along it.
    const settle = ease.inOut(done);
    d.theta = 0.15 * Math.sin(t * 1.9) * (1 - settle);
    let acc = -2.4 * Math.sin(d.theta) - 0.9 * d.vc;
    if (done > 0) acc = -26 * d.sc - 8 * d.vc; // roll to the centre of balance
    d.vc += acc * dt;
    d.sc += d.vc * dt;
    if (d.sc < -0.44) { d.sc = -0.44; d.vc *= -0.35; }
    if (d.sc > 0.3) { d.sc = 0.3; d.vc *= -0.35; }

    // Ground and darkness.
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, Math.max(W, H) * 1.05);
    glow.addColorStop(0, `rgba(122,84,44,${0.55 * flicker + swell * 0.4})`);
    glow.addColorStop(0.35, `rgba(64,42,22,${0.5 * flicker})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const floorY = P.y + S * 0.21;
    const floor = ctx.createLinearGradient(0, floorY, 0, H);
    floor.addColorStop(0, 'rgba(40,27,16,.95)');
    floor.addColorStop(1, 'rgba(8,6,4,1)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, W, H - floorY);

    // Progress ring (Bauhaus), drawn behind the figures.
    const R = S * 0.52;
    ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.strokeStyle = 'rgba(233,220,195,.08)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * p;
    ctx.strokeStyle = rgb(C.ochre, 1.05 + swell, 0.9);
    ctx.lineWidth = Math.max(1.5, S * 0.01);
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    ctx.fillStyle = rgb(C.red, 1.3);
    ctx.beginPath(); ctx.arc(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, S * 0.016, 0, Math.PI * 2); ctx.fill();

    // Chiaroscuro helper: lit toward the light, umber shadow cast away from it.
    const lit = (x, y, r, col) => {
      const g = ctx.createLinearGradient(x - r * 0.9, y - r * 0.9, x + r, y + r);
      g.addColorStop(0, rgb(col, 1.35 * flicker + swell));
      g.addColorStop(0.55, rgb(col, 0.85));
      g.addColorStop(1, rgb(col, 0.28));
      return g;
    };
    const shadow = (blur) => {
      ctx.shadowColor = 'rgba(0,0,0,.75)';
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = S * 0.05;
      ctx.shadowOffsetY = S * 0.06;
    };
    const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0; };

    // Fulcrum (blue-black triangle).
    shadow(S * 0.05);
    ctx.fillStyle = lit(P.x, P.y + S * 0.1, S * 0.14, C.blue);
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + S * 0.13, floorY);
    ctx.lineTo(P.x - S * 0.13, floorY);
    ctx.closePath();
    ctx.fill();

    // Bar, square and ball live in the bar's rotating frame.
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(d.theta);
    ctx.fillStyle = lit(0, -thick, L * 0.5, C.ochre);
    ctx.fillRect(-L / 2, -thick, L, thick);
    const sq = S * 0.12;
    ctx.fillStyle = lit(L * 0.4, -thick - sq / 2, sq * 0.7, C.ochre.map((v, i) => [200, 170, 70][i]));
    ctx.fillRect(L * 0.4 - sq / 2, -thick - sq, sq, sq);
    const r = S * 0.068;
    const bx = d.sc * L, by = -thick - r;
    ctx.fillStyle = lit(bx, by, r, C.red);
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    noShadow();
    // rim light on the ball, on the side facing the candle (in world space)
    ctx.rotate(-d.theta);
    const wx = bx * Math.cos(d.theta) - by * Math.sin(d.theta);
    const wy = bx * Math.sin(d.theta) + by * Math.cos(d.theta);
    const la = Math.atan2(lightY - (P.y + wy), lightX - (P.x + wx));
    ctx.strokeStyle = `rgba(255,214,160,${0.45 * flicker})`;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.arc(wx, wy, r * 0.94, la - 0.9, la + 0.9); ctx.stroke();
    ctx.restore();

    // Percentage, in bone white.
    ctx.fillStyle = C.bone;
    ctx.globalAlpha = 0.86;
    ctx.font = `600 ${Math.round(S * 0.1)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    const pct = Math.round(p * 100);
    ctx.fillText(String(pct), W * 0.07, H * 0.9);
    const nw = ctx.measureText(String(pct)).width;
    ctx.font = `500 ${Math.round(S * 0.035)}px Inter, system-ui, sans-serif`;
    ctx.fillText('%', W * 0.07 + nw + S * 0.01, H * 0.9 - S * 0.055);
    ctx.globalAlpha = 1;

    // Grain + vignette — the paint surface.
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16;
    ctx.save();
    ctx.translate((t * 977) % 37, (t * 613) % 41);
    ctx.fillStyle = ctx.createPattern(d.grain, 'repeat');
    ctx.fillRect(-50, -50, W + 100, H + 100);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(cx, cy, S * 0.4, cx, cy, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.75 - swell * 0.3})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  },
};

export function bauhausGoya(container, options = {}) {
  return artLoader(container, scene, { label: 'Loading', ...options });
}

export default bauhausGoya;
