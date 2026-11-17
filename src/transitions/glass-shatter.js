/**
 * Glass Shatter
 * The element fractures from an impact point the way tempered glass does —
 * radial spokes crossed by concentric rings. Cracks race outward first,
 * the frame holds a beat, then each shard tumbles away in 3D under gravity
 * with a glint that catches as it turns. assemble() rewinds time: shards
 * fly in, lock together and the cracks heal.
 *
 *   await glassShatter(scene, { origin: { x: 320, y: 180 } }).shatter();
 */
import { tick, wait } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { svg, clamp, lerp, smoothstep, prefersReducedMotion } from '../core/utils.js';
import { outCubic, cinematic } from '../core/ease.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-shatter',
  `.sf-shatter-layer{position:absolute;inset:0;pointer-events:none;perspective:1400px;z-index:40}
.sf-shard{position:absolute;overflow:hidden;will-change:transform,opacity;backface-visibility:visible}
.sf-shard>.sf-shard-glint{position:absolute;inset:0;opacity:0;pointer-events:none;
  background:linear-gradient(125deg,rgba(255,255,255,.55),rgba(255,255,255,0) 45%,rgba(255,255,255,.18) 70%,rgba(255,255,255,0))}
.sf-cracks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:41;overflow:visible}
.sf-impact{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;pointer-events:none;z-index:42;
  background:radial-gradient(circle,#fff,rgba(255,236,210,.6) 30%,rgba(255,200,150,0) 70%);opacity:0}`
);

const DEFAULTS = {
  origin: null, // {x, y} relative to the element; default slightly off-centre
  spokes: 11,
  rings: 5,
  crack: 260, // ms for cracks to propagate
  hold: 140,
  duration: 1500, // shard flight
  gravity: 2600, // px/s²
  force: 1,
  seed: 4,
};

export function glassShatter(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const parent = el.parentElement;
  ensurePositioned(parent);
  let off = null;

  function geometry(box) {
    const rand = mulberry32(o.seed + Math.floor(Math.random() * 1000));
    const ox = o.origin ? o.origin.x : box.w * (0.42 + rand() * 0.16);
    const oy = o.origin ? o.origin.y : box.h * (0.38 + rand() * 0.2);
    const far = Math.max(Math.hypot(ox, oy), Math.hypot(box.w - ox, oy), Math.hypot(ox, box.h - oy), Math.hypot(box.w - ox, box.h - oy)) * 1.15;
    const S = o.spokes, R = o.rings;
    const base = rand() * Math.PI * 2;
    const angles = Array.from({ length: S }, (_, s) => base + ((s + (rand() - 0.5) * 0.55) / S) * Math.PI * 2);
    // Ring radii grow geometrically — dense near impact, wide at the rim.
    const radii = Array.from({ length: R }, (_, k) => Math.pow((k + 1) / R, 1.7) * far);
    const P = radii.map((r, k) =>
      angles.map((a) => {
        const rr = k === R - 1 ? r : r * (0.82 + rand() * 0.36);
        const aa = a + (rand() - 0.5) * 0.12;
        return [ox + Math.cos(aa) * rr, oy + Math.sin(aa) * rr];
      })
    );
    const shards = [];
    for (let s = 0; s < S; s++) {
      const s2 = (s + 1) % S;
      shards.push([[ox, oy], P[0][s], P[0][s2]]);
      for (let k = 0; k < R - 1; k++) {
        const quad = [P[k][s], P[k][s2], P[k + 1][s2], P[k + 1][s]];
        if (rand() < 0.35) {
          // Diagonal fracture — split into two triangles.
          shards.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]);
        } else shards.push(quad);
      }
    }
    return { ox, oy, far, shards, rand };
  }

  const idle = () =>
    new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 100 }) : setTimeout(r, 16)));

  let prepared = null;
  /** Build shards in idle-time chunks so the impact frame never stalls. */
  function prepare() {
    if (!prepared) prepared = build();
    return prepared;
  }

  async function build() {
    const box = boxIn(el, parent);
    const g = geometry(box);
    const layer = document.createElement('div');
    layer.className = 'sf-shatter-layer';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;inset:auto;visibility:hidden`;
    parent.appendChild(layer);
    const src = snapshot(el);
    src.style.visibility = 'visible';
    const pieces = [];
    for (let n = 0; n < g.shards.length; n++) {
      const piece = makePiece(g.shards[n]);
      if (piece) pieces.push(piece);
      if (n % 18 === 17) await idle();
    }
    function makePiece(poly) {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(box.w, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys)), maxY = Math.min(box.h, Math.max(...ys));
      if (maxX - minX < 1 || maxY - minY < 1) return null;
      const node = document.createElement('div');
      node.className = 'sf-shard';
      node.style.cssText = `left:${minX}px;top:${minY}px;width:${maxX - minX}px;height:${maxY - minY}px;` +
        `clip-path:polygon(${poly.map((p) => `${(p[0] - minX).toFixed(1)}px ${(p[1] - minY).toFixed(1)}px`).join(',')});` +
        `transform-origin:${((xs.reduce((a, b) => a + b) / xs.length) - minX).toFixed(1)}px ${((ys.reduce((a, b) => a + b) / ys.length) - minY).toFixed(1)}px`;
      const copy = src.cloneNode(true);
      copy.style.position = 'absolute';
      copy.style.left = `${-minX}px`;
      copy.style.top = `${-minY}px`;
      copy.style.width = `${box.w}px`;
      copy.style.height = `${box.h}px`;
      copy.style.margin = '0';
      const glint = document.createElement('div');
      glint.className = 'sf-shard-glint';
      node.append(copy, glint);
      layer.appendChild(node);
      const cx = xs.reduce((a, b) => a + b) / xs.length;
      const cy = ys.reduce((a, b) => a + b) / ys.length;
      const dx = cx - g.ox, dy = cy - g.oy;
      const d = Math.hypot(dx, dy) || 1;
      const near = 1 - clamp(d / g.far);
      const speed = (260 + near * 900 + g.rand() * 260) * o.force;
      return {
        node, glint,
        d: d / g.far,
        vx: (dx / d) * speed,
        vy: (dy / d) * speed * 0.8 - 120 * g.rand(),
        vz: (120 + near * 520) * (0.5 + g.rand()) * o.force,
        rx: (g.rand() - 0.5) * 520,
        ry: (g.rand() - 0.5) * 520,
        rz: (g.rand() - 0.5) * 260,
      };
    }

    // Crack network — every shard edge, drawn once.
    const cracks = svg('svg', { class: 'sf-cracks', 'aria-hidden': 'true' });
    cracks.setAttribute('viewBox', `0 0 ${box.w} ${box.h}`);
    const seen = new Set();
    const lines = [];
    g.shards.forEach((poly) => {
      poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length];
        const key = [p, q].map((v) => v.map((n) => n.toFixed(0)).join(':')).sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const dist = Math.min(Math.hypot(p[0] - g.ox, p[1] - g.oy), Math.hypot(q[0] - g.ox, q[1] - g.oy)) / g.far;
        // Draw from the end nearest the impact so cracks propagate outward.
        const [a, b] = Math.hypot(p[0] - g.ox, p[1] - g.oy) < Math.hypot(q[0] - g.ox, q[1] - g.oy) ? [p, q] : [q, p];
        const line = svg('line', {
          x1: a[0], y1: a[1], x2: b[0], y2: b[1],
          stroke: 'rgba(255,255,255,0.75)', 'stroke-width': lerp(1.6, 0.6, dist), 'stroke-linecap': 'round',
          'stroke-dasharray': len, 'stroke-dashoffset': len,
        });
        cracks.appendChild(line);
        lines.push({ line, len, dist });
      });
    });
    layer.appendChild(cracks);
    const impact = document.createElement('div');
    impact.className = 'sf-impact';
    impact.style.left = `${g.ox}px`;
    impact.style.top = `${g.oy}px`;
    layer.appendChild(impact);
    return { layer, pieces, lines, impact };
  }

  function pose(p, t, g) {
    // t in seconds since release (negative = not yet released)
    const s = Math.max(0, t);
    const x = p.vx * s;
    const y = p.vy * s + 0.5 * g * s * s;
    const z = p.vz * s;
    const rx = p.rx * s, ry = p.ry * s, rz = p.rz * s;
    p.node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg)`;
    p.glint.style.opacity = (Math.abs(Math.sin((rx + ry) * 0.012)) * 0.7 * smoothstep(0, 0.05, s)).toFixed(3);
  }

  async function shatter() {
    if (off) off();
    if (prefersReducedMotion()) { el.style.visibility = 'hidden'; return true; }
    const { layer, pieces, lines, impact } = await prepare();
    prepared = null;
    const g = o.gravity;
    pieces.forEach((p) => pose(p, 0, g));
    layer.style.visibility = 'visible';
    el.style.visibility = 'hidden';
    // 1 — cracks propagate from the impact.
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const k = clamp(t / o.crack);
        lines.forEach((l) => {
          const local = clamp((k - l.dist * 0.75) / 0.35);
          l.line.setAttribute('stroke-dashoffset', (l.len * (1 - outCubic(local))).toFixed(1));
        });
        impact.style.opacity = (Math.sin(Math.PI * clamp(t / (o.crack * 1.4))) * 1).toFixed(3);
        impact.style.transform = `scale(${(1 + k * 14).toFixed(2)})`;
        if (k >= 1) { off(); off = null; done(); }
      });
    });
    await wait(o.hold);
    // 2 — shards release, inner ones first, and tumble away.
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const T = o.duration;
        pieces.forEach((p) => {
          const local = (t - p.d * 180) / 1000;
          pose(p, local, g);
          p.node.style.opacity = (1 - smoothstep(T * 0.45, T * 0.95, t - p.d * 180)).toFixed(3);
        });
        const crackFade = 1 - smoothstep(0, 220, t);
        lines.forEach((l) => l.line.setAttribute('stroke-opacity', crackFade.toFixed(3)));
        if (t >= T + 200) { off(); off = null; done(); }
      });
    });
    layer.remove();
    return true;
  }

  /** Rewind: shards fly in from their scattered poses and fuse. */
  async function assemble() {
    if (off) off();
    if (prefersReducedMotion()) { el.style.visibility = ''; return true; }
    const { layer, pieces, lines } = await prepare();
    prepared = null;
    layer.style.visibility = 'visible';
    el.style.visibility = 'hidden';
    const g = o.gravity;
    const T = 1.1; // seconds of rewound flight
    lines.forEach((l) => { l.line.setAttribute('stroke-dashoffset', 0); l.line.setAttribute('stroke-opacity', 0); });
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const D = o.duration * 0.9;
        pieces.forEach((p) => {
          const local = clamp((t - (1 - p.d) * 220) / D);
          const e = cinematic(local);
          pose(p, (1 - e) * T, g * 0.6);
          p.node.style.opacity = smoothstep(0, 0.25, local).toFixed(3);
        });
        const k = t / (D + 220);
        lines.forEach((l) => l.line.setAttribute('stroke-opacity', (smoothstep(0.55, 0.8, k) * (1 - smoothstep(0.85, 1, k)) * 0.6).toFixed(3)));
        if (k >= 1) { off(); off = null; done(); }
      });
    });
    el.style.visibility = '';
    layer.remove();
    return true;
  }

  return {
    prepare: () => prepare().then(() => true),
    shatter,
    assemble,
    destroy() {
      if (off) { off(); off = null; el.style.visibility = ''; }
      parent.querySelectorAll('.sf-shatter-layer').forEach((n) => n.remove());
    },
  };
}

export default glassShatter;
