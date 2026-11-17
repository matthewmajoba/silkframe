/**
 * Particle Assembly
 * The text is rasterised from its real DOM layout (fonts, wrapping, letter-
 * spacing), sampled into thousands of particles which spiral in from a
 * nebula along decaying vortex paths and lock into the glyph shapes. Once
 * assembled the field is live: the pointer parts it like a hand through
 * sand and spring forces knit it back. reverse() exhales it as smoke.
 *
 *   const fx = particleText('.hero-title', { colors: ['#fff', '#ffb547'] });
 *   fx.play();
 */
import { tick } from '../core/ticker.js';
import { mulberry32, createNoise } from '../core/noise.js';
import { clamp, resolve, dpr, smoothstep, prefersReducedMotion, debounce } from '../core/utils.js';
import { cubicBezier } from '../core/ease.js';

// Slow lift-off, long luxurious landing — keeps the vortex visible.
const flight = cubicBezier(0.45, 0, 0.12, 1);

const DEFAULTS = {
  gap: 2.6, // sampling step in CSS px (smaller = denser)
  size: 1.9, // particle size in CSS px
  duration: 2600,
  spread: 0.85, // starting nebula radius relative to text width
  swirl: 2.4, // radians of vortex rotation on approach
  colors: null, // array of CSS colours swept left→right, default = text colour
  glow: true, // additive blending
  trail: 0.3, // 0–1, motion trail decay per frame (higher = shorter)
  interactive: true,
  radius: 80, // pointer influence radius (px)
  force: 1,
  shimmer: true, // idle twinkle (cached base layer + a few hundred motes)
  seed: 5,
};

export function particleText(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const style = getComputedStyle(el);
  if (style.position === 'static') el.style.position = 'relative';
  const textColor = style.color;
  const prevColor = el.style.color;
  const rand = mulberry32(o.seed);
  const { noise3 } = createNoise(o.seed);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;pointer-events:none;';
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, pad = 0, ratio = 1, count = 0;
  let hx, hy, px, py, vx, vy, sx, sy, delay, delayIn, ang, alpha, bucket, seedA;
  let buckets = [];
  let mode = 'hidden';
  let t = 0;
  let off = null;
  let settle = null;
  const pointer = { x: -1e4, y: -1e4, inside: false };

  function rasterise() {
    const rect = el.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    pad = Math.round(Math.max(W, H) * 0.3 + 60);
    ratio = dpr();
    canvas.style.left = `${-pad - el.clientLeft}px`;
    canvas.style.top = `${-pad - el.clientTop}px`;
    canvas.style.width = `${W + pad * 2}px`;
    canvas.style.height = `${H + pad * 2}px`;
    canvas.width = Math.ceil((W + pad * 2) * ratio);
    canvas.height = Math.ceil((H + pad * 2) * ratio);

    const src = document.createElement('canvas');
    src.width = Math.max(1, Math.ceil(W));
    src.height = Math.max(1, Math.ceil(H));
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.fillStyle = '#fff';
    sctx.textBaseline = 'alphabetic';

    // Draw every word exactly where the browser laid it out.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest('canvas,svg,.sf-sr')) continue;
      const ps = getComputedStyle(parent);
      sctx.font = `${ps.fontStyle} ${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}`;
      if ('letterSpacing' in sctx) sctx.letterSpacing = ps.letterSpacing === 'normal' ? '0px' : ps.letterSpacing;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(node.textContent))) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const r = range.getClientRects()[0];
        if (!r) continue;
        const mt = sctx.measureText(m[0]);
        const asc = mt.fontBoundingBoxAscent ?? parseFloat(ps.fontSize) * 0.8;
        const desc = mt.fontBoundingBoxDescent ?? parseFloat(ps.fontSize) * 0.2;
        const baseline = r.top - rect.top + (r.height - (asc + desc)) / 2 + asc;
        sctx.fillText(m[0], r.left - rect.left, baseline);
      }
    }

    const data = sctx.getImageData(0, 0, src.width, src.height).data;
    const pts = [];
    for (let y = 0; y < src.height; y += o.gap) {
      for (let x = 0; x < src.width; x += o.gap) {
        if (data[((y | 0) * src.width + (x | 0)) * 4 + 3] > 110) pts.push(x + (rand() - 0.5) * 0.8, y + (rand() - 0.5) * 0.8);
      }
    }
    count = pts.length / 2;
    hx = new Float32Array(count); hy = new Float32Array(count);
    px = new Float32Array(count); py = new Float32Array(count);
    vx = new Float32Array(count); vy = new Float32Array(count);
    sx = new Float32Array(count); sy = new Float32Array(count);
    delay = new Float32Array(count); ang = new Float32Array(count);
    alpha = new Float32Array(count); seedA = new Float32Array(count);
    bucket = new Uint8Array(count);

    const colors = o.colors && o.colors.length ? o.colors : [textColor];
    buckets = colors.map((c) => ({ color: c, idx: [] }));
    const R = Math.max(W, 200) * o.spread;
    for (let i = 0; i < count; i++) {
      const x = pts[i * 2] + pad;
      const y = pts[i * 2 + 1] + pad;
      hx[i] = px[i] = x;
      hy[i] = py[i] = y;
      // Nebula start: gaussian-ish ring around the text centre.
      const a = rand() * Math.PI * 2;
      const r = R * (0.35 + Math.pow(rand(), 0.6) * 0.9);
      sx[i] = pad + W / 2 + Math.cos(a) * r;
      sy[i] = pad + H / 2 + Math.sin(a) * r * 0.55;
      ang[i] = o.swirl * (0.6 + rand() * 0.8) * (rand() < 0.5 ? -1 : 1) * 0.5 + o.swirl * 0.5;
      delay[i] = ((x - pad) / Math.max(W, 1)) * 0.28 + rand() * 0.22;
      seedA[i] = rand();
      const b = Math.min(colors.length - 1, Math.floor(clamp((x - pad) / Math.max(W, 1) + (rand() - 0.5) * 0.15) * colors.length));
      bucket[i] = b;
      buckets[b].idx.push(i);
    }
    delayIn = delay.slice();
  }

  function draw(fade) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cw = W + pad * 2, ch = H + pad * 2;
    if (fade > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.globalCompositeOperation = o.glow ? 'lighter' : 'source-over';
    const s = o.size;
    const hs = s / 2;
    for (const b of buckets) {
      ctx.fillStyle = b.color;
      const idx = b.idx;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        const a = alpha[i];
        if (a <= 0.01) continue;
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillRect(px[i] - hs, py[i] - hs, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Idle shimmer: the settled field is cached once, then only a sparse set of
  // motes is redrawn per frame — a few hundred rects instead of thousands.
  let base = null;
  let baseReady = false;
  let motes = null;
  let shimmerT = 0;
  function shimmer(dt) {
    const cw = W + pad * 2, ch = H + pad * 2;
    if (!baseReady) {
      alpha.fill(1);
      for (let i = 0; i < count; i++) alpha[i] = 0.72 + seedA[i] * 0.28;
      draw(0);
      base = base || document.createElement('canvas');
      base.width = canvas.width;
      base.height = canvas.height;
      base.getContext('2d').drawImage(canvas, 0, 0);
      baseReady = true;
      const n = Math.min(count, 420);
      motes = new Uint32Array(n);
      for (let k = 0; k < n; k++) motes[k] = Math.floor(rand() * count);
    }
    shimmerT += dt / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const s = o.size * 1.25;
    for (let k = 0; k < motes.length; k++) {
      const i = motes[k];
      const tw = Math.sin(shimmerT * (1.3 + seedA[i] * 2.4) + seedA[i] * 40);
      if (tw <= 0.2) {
        // Re-seed dark motes so the sparkle wanders across the word.
        if (rand() < 0.015) motes[k] = Math.floor(rand() * count);
        continue;
      }
      ctx.globalAlpha = (tw - 0.2) * 0.9;
      ctx.fillStyle = '#fff';
      ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function step(dt) {
    t += dt;
    const s = Math.min(dt / 1000, 1 / 30);
    let active = false;

    if (mode === 'assemble') {
      const L = o.duration * 0.62;
      const D = o.duration;
      for (let i = 0; i < count; i++) {
        const local = clamp((t - delay[i] * D) / L);
        const e = flight(local);
        const inv = 1 - e;
        const theta = ang[i] * inv * inv;
        const dx = (sx[i] - hx[i]) * inv;
        const dy = (sy[i] - hy[i]) * inv;
        const c = Math.cos(theta), sn = Math.sin(theta);
        px[i] = hx[i] + dx * c - dy * sn;
        py[i] = hy[i] + dx * sn + dy * c;
        alpha[i] = smoothstep(0, 0.1, local) * (0.7 + seedA[i] * 0.3);
        if (local < 1) active = true;
      }
      if (!active) {
        mode = 'idle';
        for (let i = 0; i < count; i++) alpha[i] = 0.72 + seedA[i] * 0.28;
        vx.fill(0); vy.fill(0);
        baseReady = false;
      }
      // Additive trails make resting particles over-expose (~1/trail ×).
      // Ramp the decay to a full clear as the word lands, so the molten
      // glow cools continuously into the settled colours — no pop.
      const g = t / (D * 1.12);
      draw(o.trail + (1 - o.trail) * smoothstep(0.5, 0.97, g));
      return active || true; // one extra frame to clear trails
    }

    if (mode === 'idle') {
      // Spring every particle home; pointer pushes them aside.
      const R = o.radius;
      const R2 = R * R;
      const k = 70, c = 10.5;
      const strength = 14000 * o.force;
      let energy = 0;
      for (let i = 0; i < count; i++) {
        let ax = (hx[i] - px[i]) * k - vx[i] * c;
        let ay = (hy[i] - py[i]) * k - vy[i] * c;
        if (pointer.inside) {
          const dx = px[i] - pointer.x;
          const dy = py[i] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R);
            const fs = f * f * strength;
            ax += (dx / d) * fs;
            ay += (dy / d) * fs;
          }
        }
        vx[i] += ax * s;
        vy[i] += ay * s;
        px[i] += vx[i] * s;
        py[i] += vy[i] * s;
        energy += Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(hx[i] - px[i]) + Math.abs(hy[i] - py[i]);
      }
      const moving = energy / Math.max(count, 1) > 0.02;
      if (moving || pointer.inside) {
        baseReady = false;
        draw(moving ? 0.45 : 0);
        return true;
      }
      for (let i = 0; i < count; i++) { px[i] = hx[i]; py[i] = hy[i]; vx[i] = vy[i] = 0; }
      if (!o.shimmer) { draw(0); return false; }
      shimmer(dt);
      return true;
    }

    if (mode === 'dissolve') {
      const D = o.duration * 0.9;
      const z = t * 0.00035;
      for (let i = 0; i < count; i++) {
        const local = clamp((t - delay[i] * D * 0.9) / (D * 0.55));
        if (local <= 0) { active = true; continue; }
        if (alpha[i] <= 0) continue;
        const n = noise3(px[i] * 0.0065, py[i] * 0.0065, z) * Math.PI * 2;
        vx[i] += (Math.cos(n) * 260 + 120) * s;
        vy[i] += (Math.sin(n) * 260 - 210) * s;
        vx[i] *= 0.985; vy[i] *= 0.985;
        px[i] += vx[i] * s;
        py[i] += vy[i] * s;
        alpha[i] = 1 - smoothstep(0.05, 1, local);
        active = true;
      }
      draw(0.22);
      if (!active) { mode = 'hidden'; draw(0); }
      return active;
    }
    return false;
  }

  function run() {
    if (off) return;
    off = tick((_, dt) => {
      const keep = step(dt);
      if (!keep && !(mode === 'assemble')) {
        off(); off = null;
        if (settle) { const s = settle; settle = null; s(true); }
      }
    });
  }

  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    rasterise();
    el.style.color = 'transparent';
  });

  async function play() {
    await ready;
    if (settle) settle(false);
    if (prefersReducedMotion()) {
      mode = 'idle';
      for (let i = 0; i < count; i++) { px[i] = hx[i]; py[i] = hy[i]; alpha[i] = 1; }
      draw(0);
      return true;
    }
    t = 0;
    mode = 'assemble';
    delay.set(delayIn);
    for (let i = 0; i < count; i++) { px[i] = sx[i]; py[i] = sy[i]; alpha[i] = 0; vx[i] = vy[i] = 0; }
    return new Promise((done) => {
      settle = done;
      // Resolve when assembly finishes even if interaction keeps the loop alive.
      const check = tick(() => {
        if (mode !== 'assemble') { check(); if (settle === done) { settle = null; done(true); } }
      });
      run();
    });
  }

  async function reverse() {
    await ready;
    if (settle) settle(false);
    if (prefersReducedMotion()) { mode = 'hidden'; draw(0); alpha.fill(0); return true; }
    t = 0;
    mode = 'dissolve';
    baseReady = false;
    for (let i = 0; i < count; i++) {
      delay[i] = ((px[i] - pad) / Math.max(W, 1)) * 0.5 + seedA[i] * 0.25;
      vx[i] *= 0.2; vy[i] *= 0.2;
    }
    return new Promise((done) => { settle = done; run(); });
  }

  const onMove = (e) => {
    if (mode !== 'idle') return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left + pad;
    const y = e.clientY - r.top + pad;
    const inside = x > pad - o.radius && x < pad + W + o.radius && y > pad - o.radius && y < pad + H + o.radius;
    pointer.x = x;
    pointer.y = y;
    pointer.inside = inside;
    if (inside) run();
  };
  const onLeave = () => { pointer.inside = false; };
  if (o.interactive) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
  }

  const onResize = debounce(() => {
    const was = mode;
    rasterise();
    if (was === 'idle' || was === 'assemble') {
      mode = 'idle';
      baseReady = false;
      for (let i = 0; i < count; i++) alpha[i] = 0.72 + seedA[i] * 0.28;
      draw(0);
      run();
    }
  }, 200);
  // Only genuine size changes re-rasterise (observe() fires once immediately).
  const ro = new ResizeObserver(() => {
    if (!count) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) onResize();
  });
  ready.then(() => ro.observe(el));

  return {
    el,
    play,
    reverse,
    ready,
    destroy() {
      mode = 'hidden';
      if (off) off();
      off = null;
      if (settle) settle(false);
      settle = null;
      onResize.cancel();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      canvas.remove();
      el.style.color = prevColor;
    },
  };
}

export default particleText;
