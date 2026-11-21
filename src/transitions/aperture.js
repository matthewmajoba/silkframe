/**
 * Iris Aperture
 * A camera iris: straight-edged blades sweep in on a rotating pinwheel,
 * leaf seams radiating from every vertex of the shrinking polygon. It
 * closes on a weighty in-out curve, holds a beat in darkness while your
 * content swaps, then opens on a long exponential release.
 *
 *   const iris = aperture(container, { blades: 7 });
 *   await iris.run(() => showNextScene());
 */
import { tick, wait } from '../core/ticker.js';
import { svg, lerp, clamp, uniqueId, prefersReducedMotion } from '../core/utils.js';
import { silk, cinematic } from '../core/ease.js';
import { ensurePositioned } from '../core/snapshot.js';

const DEFAULTS = {
  blades: 7,
  close: 950, // ms
  hold: 160,
  open: 1250,
  rotation: 62, // degrees the pinwheel turns while closing
  tone: [24, 13, 16], // blade base colour (rgb) — lit per-leaf by a key light
  light: -2.2, // key light angle (radians, -2.2 ≈ upper left)
  seam: 'rgba(255,255,255,0.14)',
  origin: null, // {x, y} in container px — defaults to centre
};

export function aperture(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const gid = uniqueId('sf-iris');
  const root = svg('svg', { 'aria-hidden': 'true', focusable: 'false' });
  root.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;overflow:visible;visibility:hidden';
  const defs = svg('defs');
  const sheen = svg('radialGradient', { id: `${gid}-s`, cx: '50%', cy: '50%', r: '60%' });
  sheen.append(
    svg('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0.10' }),
    svg('stop', { offset: '0.5', 'stop-color': '#fff', 'stop-opacity': '0.02' }),
    svg('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0.35' })
  );
  defs.append(sheen);
  root.appendChild(defs);
  // The sheen is clipped to the blades themselves — it must never darken
  // the open scene (an unclipped overlay pops on/off with the iris).
  const clip = svg('clipPath', { id: `${gid}-c` });
  defs.appendChild(clip);
  const blades = Array.from({ length: o.blades }, (_, i) => {
    const p = svg('polygon', { id: `${gid}-b${i}`, fill: `rgb(${o.tone.join(',')})` });
    root.appendChild(p);
    clip.appendChild(svg('use', { href: `#${gid}-b${i}` }));
    return p;
  });
  const glow = svg('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: `url(#${gid}-s)`, 'clip-path': `url(#${gid}-c)` });
  root.appendChild(glow);
  // Fine light catching the aperture's inner edge.
  const rim = svg('polygon', { fill: 'none', stroke: 'rgba(255,240,220,0.22)', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
  root.appendChild(rim);
  const seams = Array.from({ length: o.blades }, () => {
    const l = svg('line', { stroke: o.seam, 'stroke-width': 1.25, 'stroke-linecap': 'round' });
    root.appendChild(l);
    return l;
  });
  container.appendChild(root);

  let off = null;

  function frame(r, spin, cx, cy, far) {
    const N = o.blades;
    const half = Math.tan(Math.PI / N) * r;
    const L = far * 3;
    const rimPts = [];
    for (let i = 0; i < N; i++) {
      const a = spin + (i * Math.PI * 2) / N;
      const nx = Math.cos(a), ny = Math.sin(a);
      const tx = -ny, ty = nx;
      const Tx = cx + nx * r, Ty = cy + ny * r;
      // Blade = half-plane beyond the tangent line, starting at its vertex.
      const p1x = Tx - tx * half, p1y = Ty - ty * half;
      const p2x = Tx + tx * L, p2y = Ty + ty * L;
      const p3x = p2x + nx * L, p3y = p2y + ny * L;
      const p4x = p1x + nx * L - tx * L * 0.25, p4y = p1y + ny * L - ty * L * 0.25;
      blades[i].setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`);
      // Each leaf catches the key light differently as the pinwheel turns.
      const lit = 0.5 + 0.5 * Math.cos(a - o.light);
      const k = 0.72 + lit * 0.75;
      blades[i].setAttribute('fill', `rgb(${o.tone.map((c) => Math.round(c * k)).join(',')})`);
      // Seam: from the leading vertex outward along the blade edge.
      const vx = Tx + tx * half, vy = Ty + ty * half;
      rimPts.push(`${vx},${vy}`);
      seams[i].setAttribute('x1', vx);
      seams[i].setAttribute('y1', vy);
      seams[i].setAttribute('x2', vx + tx * far * 1.5);
      seams[i].setAttribute('y2', vy + ty * far * 1.5);
    }
    rim.setAttribute('points', rimPts.join(' '));
    rim.setAttribute('stroke-opacity', String(Math.min(1, r / 40)));
  }

  function phase(from, to, duration, ease, spinFrom, spinTo, geom) {
    return new Promise((done) => {
      let t = 0;
      const step = () => {
        const p = clamp(t / duration);
        const e = ease(p);
        frame(lerp(from, to, e), lerp(spinFrom, spinTo, e), geom.cx, geom.cy, geom.far);
        return p;
      };
      step();
      off = tick((_, dt) => {
        t += dt;
        if (step() >= 1) { off(); off = null; done(); }
      });
    });
  }

  async function run(swap = () => {}) {
    if (off) off();
    const w = container.clientWidth, h = container.clientHeight;
    const cx = o.origin ? o.origin.x : w / 2;
    const cy = o.origin ? o.origin.y : h / 2;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
    const openR = far * 1.04;
    const geom = { cx, cy, far };
    if (prefersReducedMotion()) { await swap(); return true; }
    const spin = (o.rotation * Math.PI) / 180;
    root.style.visibility = 'visible';
    await phase(openR, 0, o.close, silk, 0, spin, geom);
    await swap();
    await wait(o.hold);
    await phase(0, openR, o.open, cinematic, spin, spin * 2, geom);
    root.style.visibility = 'hidden';
    return true;
  }

  return {
    run,
    destroy() {
      if (off) off();
      root.remove();
    },
  };
}

export default aperture;
