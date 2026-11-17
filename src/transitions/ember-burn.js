/**
 * Ember Burn
 * The scene burns away like film catching in a projector gate. A fractal
 * burn field (pre-baked once from simplex noise, swept by a directional
 * gradient) drives two cheap layers:
 *   1. a minimal SVG filter on the live element that cuts the burnt hole
 *      (feImage → colour matrix → transfer → composite — no blurs), and
 *   2. a canvas overlay that paints the scorched char band and the molten
 *      ember rim with bloom, computed from the same field at half resolution.
 * Works on any DOM content and stays smooth at large sizes.
 *
 *   await emberBurn(sceneA, { angle: 35 }).burn();
 */
import { tick } from '../core/ticker.js';
import { createNoise, noiseWorkerSource } from '../core/noise.js';
import { svg, uniqueId, clamp, lerp, prefersReducedMotion } from '../core/utils.js';
import { inOutSine } from '../core/ease.js';
import { injectStyle } from '../core/style.js';
import { boxIn, ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-burn',
  `.sf-burn-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}
.sf-burn-glow{position:absolute;pointer-events:none;z-index:45}`
);

const DEFAULTS = {
  duration: 2100,
  angle: 30, // burn direction in degrees (0 = left → right)
  directional: 0.5, // 0 = pure noise holes, 1 = clean sweep
  scale: 0.9, // noise scale (higher = finer detail)
  ember: [255, 96, 22],
  core: [255, 220, 150],
  char: [22, 9, 4],
  edge: 0.032, // ember / char band width (field units)
  bloom: 7, // px
  seed: 3,
};

/* ---------- burn-field baking (off the main thread, cached) ---------- */

function computeField(createNoiseFn, w, h, angle, directional, scale, seed) {
  const cw = Math.max(8, Math.round(w * 0.5)), ch = Math.max(8, Math.round(h * 0.5));
  const { noise2 } = createNoiseFn(seed);
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const vals = new Float32Array(cw * ch);
  let min = Infinity, max = -Infinity;
  const f = (scale * 3.2) / Math.max(cw, ch);
  const corners = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => x * dx + y * dy);
  const pmin = Math.min(...corners), pmax = Math.max(...corners);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let n = 0, amp = 1, fr = f, norm = 0;
      for (let k = 0; k < 4; k++) {
        n += noise2(x * fr, y * fr) * amp;
        norm += amp;
        amp *= 0.5;
        fr *= 2.1;
      }
      n = (n / norm) * 0.5 + 0.5;
      const ramp = (x * dx + y * dy - pmin) / (pmax - pmin);
      const v = n + (ramp - n) * directional;
      vals[y * cw + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < vals.length; i++) vals[i] = (vals[i] - min) / (max - min);
  return { vals, cw, ch };
}

let worker = null;
let jobId = 0;
const jobs = new Map();
function getWorker() {
  if (worker !== null) return worker;
  try {
    const src = `${noiseWorkerSource}
const computeField = ${computeField.toString()};
` +
      `onmessage = (e) => { const { id, args } = e.data; const r = computeField(createNoise, ...args); postMessage({ id, ...r }, [r.vals.buffer]); };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => { jobs.get(e.data.id)?.(e.data); jobs.delete(e.data.id); };
  } catch {
    worker = false; // CSP or no Worker support — bake synchronously
  }
  return worker;
}

const fieldCache = new Map();
/** Resolve { vals, cw, ch, url } for a given field config (cached). */
function bakeField(w, h, o) {
  const key = [w, h, o.angle, o.directional, o.scale, o.seed].join('|');
  if (fieldCache.has(key)) return fieldCache.get(key);
  const args = [w, h, o.angle, o.directional, o.scale, o.seed];
  const p = new Promise((resolve) => {
    const wk = getWorker();
    if (wk) {
      const id = ++jobId;
      jobs.set(id, resolve);
      wk.postMessage({ id, args });
    } else resolve(computeField(createNoise, ...args));
  }).then(({ vals, cw, ch }) => new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    for (let i = 0; i < vals.length; i++) {
      const v = Math.round(vals[i] * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    c.toBlob((blob) => resolve({ vals, cw, ch, url: URL.createObjectURL(blob) }));
  }));
  fieldCache.set(key, p);
  return p;
}

const rgb = (c) => (Array.isArray(c) ? c : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);

export function emberBurn(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const ember = rgb(o.ember), core = rgb(o.core), char = rgb(o.char);
  const id = uniqueId('sf-burn');
  const parent = el.parentElement;
  ensurePositioned(parent);

  // 1 — hole-cutting filter (cheap primitives only)
  const defs = svg('svg', { class: 'sf-burn-defs', 'aria-hidden': 'true' });
  const filter = svg('filter', {
    id, x: '0', y: '0', width: '1', height: '1',
    filterUnits: 'objectBoundingBox', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
  });
  const field = svg('feImage', { result: 'field', preserveAspectRatio: 'none' });
  const toAlpha = svg('feColorMatrix', { in: 'field', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0', result: 'f' });
  const keep = svg('feComponentTransfer', { in: 'f', result: 'keep' });
  const keepA = svg('feFuncA', { type: 'linear', slope: 1, intercept: 0 });
  keep.appendChild(keepA);
  filter.append(field, toAlpha, keep, svg('feComposite', { in: 'SourceGraphic', in2: 'keep', operator: 'in' }));
  defs.appendChild(filter);
  document.body.appendChild(defs);

  // 2 — char + ember overlay
  const glow = document.createElement('canvas');
  glow.className = 'sf-burn-glow';
  glow.setAttribute('aria-hidden', 'true');
  const gctx = glow.getContext('2d');
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');
  const emberBuf = document.createElement('canvas');
  const ectx = emberBuf.getContext('2d');

  let off = null;
  let baked = null; // { key, url, vals, cw, ch }
  let charImg = null, emberImg = null;

  async function prepare() {
    const w = el.offsetWidth, h = el.offsetHeight;
    const key = `${w}x${h}`;
    if (!baked || baked.key !== key) {
      const f = await bakeField(w, h, o);
      baked = { key, ...f };
      buf.width = emberBuf.width = baked.cw;
      buf.height = emberBuf.height = baked.ch;
      charImg = bctx.createImageData(baked.cw, baked.ch);
      emberImg = ectx.createImageData(baked.cw, baked.ch);
    }
    field.setAttribute('href', baked.url);
    field.setAttribute('x', 0);
    field.setAttribute('y', 0);
    field.setAttribute('width', w);
    field.setAttribute('height', h);
    const b = boxIn(el, parent);
    glow.style.left = `${b.x}px`;
    glow.style.top = `${b.y}px`;
    glow.style.width = `${b.w}px`;
    glow.style.height = `${b.h}px`;
    // Overlay at 0.75× resolution — it is soft by nature, and cheaper to blur.
    glow.width = Math.round(b.w * 0.75);
    glow.height = Math.round(b.h * 0.75);
    parent.appendChild(glow);
  }

  const S = 34; // edge steepness — crisp but anti-aliased
  function setThreshold(thr) {
    keepA.setAttribute('slope', S);
    keepA.setAttribute('intercept', (-S * thr).toFixed(4));
    paintGlow(thr);
  }

  function paintGlow(thr) {
    const { vals } = baked;
    const cd = charImg.data, ed = emberImg.data;
    const E = o.edge;
    const charBand = E * 0.9;
    for (let i = 0, j = 3; i < vals.length; i++, j += 4) {
      const d = vals[i] - thr; // > 0 survives, < 0 burnt
      if (d > 0 && d < charBand) {
        const k = 1 - d / charBand;
        cd[j - 3] = char[0]; cd[j - 2] = char[1]; cd[j - 1] = char[2]; cd[j] = k * k * 235;
      } else cd[j] = 0;
      if (d <= 0 && d > -E) {
        const k = 1 + d / E; // 1 at the front → 0 deep in the hole
        const hot = k * k;
        ed[j - 3] = ember[0] + (core[0] - ember[0]) * hot;
        ed[j - 2] = ember[1] + (core[1] - ember[1]) * hot;
        ed[j - 1] = ember[2] + (core[2] - ember[2]) * hot;
        ed[j] = k * 255;
      } else ed[j] = 0;
    }
    bctx.putImageData(charImg, 0, 0);
    ectx.putImageData(emberImg, 0, 0);
    const W = glow.width, H = glow.height;
    gctx.clearRect(0, 0, W, H);
    gctx.imageSmoothingEnabled = true;
    gctx.globalCompositeOperation = 'source-over';
    gctx.drawImage(buf, 0, 0, W, H);
    gctx.globalCompositeOperation = 'lighter';
    gctx.filter = `blur(${(o.bloom * 0.75).toFixed(1)}px)`;
    gctx.drawImage(emberBuf, 0, 0, W, H);
    gctx.filter = 'none';
    gctx.drawImage(emberBuf, 0, 0, W, H);
    gctx.globalCompositeOperation = 'source-over';
  }

  async function run(forward) {
    if (off) off();
    if (prefersReducedMotion()) {
      el.style.visibility = forward ? 'hidden' : '';
      return true;
    }
    await prepare();
    el.style.visibility = '';
    el.style.filter = `url(#${id})`;
    const lo = -o.edge * 2, hi = 1 + o.edge * 2;
    setThreshold(forward ? lo : hi);
    return new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const p = clamp(t / o.duration);
        setThreshold(lerp(forward ? lo : hi, forward ? hi : lo, inOutSine(p)));
        if (p >= 1) {
          off(); off = null;
          el.style.filter = '';
          glow.remove();
          if (forward) el.style.visibility = 'hidden';
          done(true);
        }
      });
    });
  }

  return {
    burn: () => run(true),
    /** Reverse: the scene re-forms out of the embers. */
    ignite: () => run(false),
    /** Pre-bake the burn field (e.g. on idle) so the first frame is instant. */
    async prepare() { await prepare(); glow.remove(); },
    destroy() {
      // Mid-burn teardown restores the element; a finished burn stays hidden.
      if (off) { off(); off = null; el.style.visibility = ''; }
      el.style.filter = '';
      glow.remove();
      defs.remove();
    },
  };
}

export default emberBurn;
