/**
 * Image Trail — footprints in sand
 * The pointer leaves a trail of frames. Each lands where you have been,
 * angled by your direction and sized by your speed, settles, and then —
 * like a footprint at the waterline — erodes: a grainy front eats it from
 * the edges in, the crumbling rim turns the colour of sand, and loose
 * grains slide away downwind. Older prints are always further gone than
 * newer ones, so the trail reads as time.
 *
 *   imageTrail(section, { images: ['/a.jpg', '/b.jpg'], spacing: 90, sand: '#d9c49e' });
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { resolve, clamp, smoothstep, svg, uniqueId, dpr } from '../core/utils.js';
import { cinematic } from '../core/ease.js';
import { ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-trail',
  `.sf-trail-item{position:absolute;left:0;top:0;pointer-events:none;border-radius:var(--sf-trail-r,10px);
  background-size:cover;background-position:center;will-change:transform,filter}
.sf-trail-defs{position:absolute;width:0;height:0;overflow:hidden}
.sf-trail-grains{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}`
);

const DEFAULTS = {
  images: [], // URLs or CSS backgrounds (e.g. gradients)
  spacing: 90, // px of travel between images
  size: [150, 190], // base width, height
  life: 700, // ms a print rests before it starts to erode
  erode: 1100, // ms to erode away
  max: 16,
  sand: '#d8c29b', // colour of the crumbling rim and loose grains
  wind: [0.35, 1], // grain drift direction (x, y)
  seed: 9,
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function imageTrail(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(el);
  const rand = mulberry32(o.seed);
  const sand = rgb(o.sand);
  const defs = svg('svg', { class: 'sf-trail-defs', 'aria-hidden': 'true' });
  el.appendChild(defs);
  const grainsCanvas = document.createElement('canvas');
  grainsCanvas.className = 'sf-trail-grains';
  grainsCanvas.setAttribute('aria-hidden', 'true');
  el.appendChild(grainsCanvas);
  const gctx = grainsCanvas.getContext('2d');
  let last = null;
  let travel = 0;
  let index = 0;
  const prints = [];
  const grains = [];
  let off = null;
  let W = 0, H = 0, ratio = 1;

  const bg = (src) => (/gradient\(|^url\(/.test(src) ? src : `url("${src}")`);

  /** A per-print erosion filter: noise threshold + a sand-coloured rim. */
  function erosion() {
    const id = uniqueId('sf-sand');
    const f = svg('filter', { id, x: '0', y: '0', width: '1', height: '1', 'color-interpolation-filters': 'sRGB' });
    const turb = svg('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.13, numOctaves: 3, seed: Math.floor(rand() * 999), result: 'n' });
    const toA = svg('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0', result: 'na' });
    const mk = (result) => {
      const ct = svg('feComponentTransfer', { in: 'na', result });
      const fa = svg('feFuncA', { type: 'linear', slope: 1, intercept: 1 });
      ct.appendChild(fa);
      return { ct, fa };
    };
    const keep = mk('keep');
    const rim = mk('rim');
    f.append(
      turb, toA, keep.ct, rim.ct,
      svg('feComposite', { in: 'rim', in2: 'keep', operator: 'out', result: 'band' }),
      svg('feFlood', { 'flood-color': o.sand, result: 'sc' }),
      svg('feComposite', { in: 'sc', in2: 'band', operator: 'in', result: 'sandBand' }),
      svg('feComposite', { in: 'sandBand', in2: 'SourceAlpha', operator: 'in', result: 'sandMasked' }),
      svg('feComposite', { in: 'SourceGraphic', in2: 'keep', operator: 'in', result: 'img' }),
      (() => { const m = svg('feMerge'); m.append(svg('feMergeNode', { in: 'img' }), svg('feMergeNode', { in: 'sandMasked' })); return m; })()
    );
    defs.appendChild(f);
    return { id, f, keepA: keep.fa, rimA: rim.fa };
  }

  function setThreshold(p, thr) {
    // alpha = clamp(S·(noise − thr)); the rim is a band just past the front
    const S = 14;
    p.er.keepA.setAttribute('slope', S);
    p.er.keepA.setAttribute('intercept', (-S * thr).toFixed(3));
    p.er.rimA.setAttribute('slope', S);
    p.er.rimA.setAttribute('intercept', (-S * (thr - 0.09)).toFixed(3));
  }

  function size() {
    W = el.clientWidth; H = el.clientHeight;
    ratio = dpr();
    grainsCanvas.width = Math.max(1, Math.round(W * ratio));
    grainsCanvas.height = Math.max(1, Math.round(H * ratio));
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(el);

  function spawn(x, y, vx, vy) {
    const speed = Math.hypot(vx, vy);
    const k = clamp(speed / 1600, 0, 1);
    const w = o.size[0] * (0.85 + k * 0.4), h = o.size[1] * (0.85 + k * 0.4);
    const node = document.createElement('div');
    node.className = 'sf-trail-item';
    node.setAttribute('aria-hidden', 'true');
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    node.style.background = bg(o.images[index++ % Math.max(o.images.length, 1)] || '#333');
    node.style.backgroundSize = 'cover';
    el.insertBefore(node, grainsCanvas);
    const er = erosion();
    const p = {
      node, er, x, y, w, h, t: 0,
      ang: clamp(Math.atan2(vy, vx) * (180 / Math.PI) * 0.08, -10, 10) + (rand() - 0.5) * 6,
      lastThr: -0.1,
    };
    node.style.filter = `url(#${er.id})`;
    setThreshold(p, -0.1);
    prints.push(p);
    while (prints.length > o.max) retire(prints[0]);
    wake();
  }

  function retire(p) {
    const i = prints.indexOf(p);
    if (i >= 0) prints.splice(i, 1);
    p.node.remove();
    p.er.f.remove();
  }

  function frame(_, dt) {
    const s = Math.min(dt / 1000, 1 / 30);
    for (let i = prints.length - 1; i >= 0; i--) {
      const p = prints[i];
      p.t += dt;
      // Land: grow in with a small overshoot, then settle.
      const land = clamp(p.t / 420);
      const e = cinematic(land);
      const scale = 0.45 + 0.55 * e + 0.04 * Math.sin(Math.PI * land);
      // Erode: the front sweeps through the noise; the print settles into the sand.
      const ep = clamp((p.t - o.life) / o.erode);
      const thr = -0.1 + 1.2 * (ep * ep * (3 - 2 * ep));
      const sink = smoothstep(0, 1, ep) * 6;
      p.node.style.transform = `translate3d(${(p.x - p.w / 2).toFixed(1)}px, ${(p.y - p.h / 2 + sink).toFixed(1)}px, 0) rotate(${(p.ang * (1 + ep * 0.2)).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      p.node.style.opacity = smoothstep(0, 0.25, land).toFixed(3);
      if (ep > 0) {
        setThreshold(p, thr);
        // Loose grains in proportion to how much eroded this frame.
        const eroded = Math.max(0, thr - p.lastThr);
        p.lastThr = thr;
        const n = Math.min(40, Math.round(eroded * 900));
        for (let k = 0; k < n && grains.length < 900; k++) {
          const gx = p.x + (rand() - 0.5) * p.w * 0.9, gy = p.y + (rand() - 0.5) * p.h * 0.9;
          grains.push({ x: gx, y: gy, vx: (o.wind[0] + (rand() - 0.5) * 0.6) * 40, vy: (o.wind[1] * 0.4 + rand() * 0.3) * 40, life: 0.6 + rand() * 0.7, age: 0, r: 0.6 + rand() * 0.9 });
        }
      }
      if (ep >= 1) retire(p);
    }
    // Grains: slide downwind under a little gravity and fade.
    gctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    gctx.clearRect(0, 0, W, H);
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i];
      g.age += s;
      if (g.age >= g.life) { grains.splice(i, 1); continue; }
      g.vy += 90 * s;
      g.x += g.vx * s;
      g.y += g.vy * s;
      const a = (1 - g.age / g.life) * 0.85;
      gctx.fillStyle = `rgba(${sand[0]},${sand[1]},${sand[2]},${a.toFixed(3)})`;
      gctx.fillRect(g.x, g.y, g.r, g.r);
    }
    if (!prints.length && !grains.length) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  function feed(x, y, now = performance.now()) {
    if (!last) { last = { x, y, t: now }; return; }
    const dx = x - last.x, dy = y - last.y;
    const dt = Math.max(now - last.t, 8) / 1000;
    travel += Math.hypot(dx, dy);
    if (travel >= o.spacing) {
      travel = 0;
      spawn(x, y, dx / dt, dy / dt);
    }
    last = { x, y, t: now };
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    feed(e.clientX - r.left, e.clientY - r.top);
  };
  const onLeave = () => { last = null; travel = 0; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  return {
    el,
    /** Feed synthetic pointer positions (element-local px). */
    feed,
    reset: onLeave,
    destroy() {
      if (off) off();
      ro.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      prints.slice().forEach((p) => retire(p));
      defs.remove();
      grainsCanvas.remove();
    },
  };
}

export default imageTrail;
