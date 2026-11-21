/**
 * Prism Converge
 * The text is separated into its additive light channels (R, G, B on dark,
 * C, M, Y on light). Each channel's glyphs fly in on their own spring
 * trajectories and recombine into pure white — then the pointer's velocity
 * shears the channels apart like a lens being knocked out of alignment.
 *
 *   const fx = prismConverge('.title', { theme: 'dark' });
 *   fx.play();
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, resolve, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-prism',
  `:where(.sf-prism){position:relative}.sf-prism{isolation:isolate}
.sf-prism-layer{display:block;mix-blend-mode:var(--sf-prism-blend,screen);will-change:transform}
.sf-prism-layer+.sf-prism-layer{position:absolute;inset:0}
.sf-prism-layer .sf-char{will-change:transform}`
);

const CHANNELS = {
  dark: { blend: 'screen', colors: ['#ff2a2a', '#22ff4a', '#2f5bff'] },
  light: { blend: 'multiply', colors: ['#00e5ff', '#ff00d4', '#ffe600'] },
};

const DEFAULTS = {
  theme: 'dark',
  spread: 0.9, // em
  stagger: 28,
  stiffness: 90,
  damping: 13,
  shear: 0.022, // pointer-velocity → channel offset factor
  seed: 9,
};

export function prismConverge(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const theme = CHANNELS[o.theme] || CHANNELS.dark;
  const rand = mulberry32(o.seed);
  const originalHTML = el.innerHTML;
  el.classList.add('sf-prism');
  el.style.setProperty('--sf-prism-blend', theme.blend);

  const layers = theme.colors.map((color, i) => {
    const layer = document.createElement('span');
    layer.className = 'sf-prism-layer';
    layer.innerHTML = originalHTML;
    layer.style.color = color;
    if (i > 0) layer.setAttribute('aria-hidden', 'true');
    return layer;
  });
  el.innerHTML = '';
  layers.forEach((l) => el.appendChild(l));
  const splits = layers.map((l) => split(l, { chars: true, words: true }));

  // Channel direction vectors: R from left/up, G from below, B from right.
  const dirs = [[-1, -0.35], [0.1, 1], [1, -0.25]];
  const cfg = { stiffness: o.stiffness, damping: o.damping, precision: 0.02 };
  const glyphs = [];
  splits.forEach((sp, li) => {
    sp.chars.forEach((node, ci) => {
      glyphs.push({
        node, li, ci,
        x: new Spring(0, cfg),
        y: new Spring(0, cfg),
        jitter: rand(),
        delay: 0,
        started: false,
      });
    });
  });
  const shear = { x: new Spring(0, { stiffness: 120, damping: 14 }), y: new Spring(0, { stiffness: 120, damping: 14 }) };
  let off = null;
  let settle = null;
  let intro = false;
  const pointer = { x: 0, y: 0, t: 0, vx: 0, vy: 0, has: false };

  function frame(now, dt) {
    const s = dt / 1000;
    let busy = false;
    if (intro) {
      introT += dt;
      for (const g of glyphs) {
        if (introT < g.delay) { busy = true; continue; }
        if (!g.started) { g.started = true; g.x.target = 0; g.y.target = 0; }
        g.x.step(s); g.y.step(s);
        const fade = clamp((introT - g.delay) / 260);
        g.node.style.opacity = fade < 1 ? fade.toFixed(3) : '';
        if (!g.x.resting || !g.y.resting || fade < 1) busy = true;
        g.node.style.transform = g.x.resting && g.y.resting ? '' : `translate3d(${g.x.value.toFixed(2)}px, ${g.y.value.toFixed(2)}px, 0)`;
      }
      if (!busy) {
        intro = false;
        if (settle) { const d = settle; settle = null; d(true); }
      }
    }
    // Pointer shear — decays toward zero when the pointer rests.
    pointer.vx *= Math.exp(-s * 9);
    pointer.vy *= Math.exp(-s * 9);
    shear.x.to(clamp(pointer.vx * o.shear, -40, 40));
    shear.y.to(clamp(pointer.vy * o.shear, -40, 40));
    shear.x.step(s); shear.y.step(s);
    const k = [1, 0, -1];
    layers.forEach((l, i) => {
      const x = shear.x.value * k[i], y = shear.y.value * k[i] * 0.6;
      l.style.transform = Math.abs(x) + Math.abs(y) > 0.02 ? `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)` : '';
    });
    if (!shear.x.resting || !shear.y.resting || Math.abs(pointer.vx) > 1 || Math.abs(pointer.vy) > 1) busy = true;
    if (!busy) { off(); off = null; }
  }
  let introT = 0;
  const wake = () => { if (!off) off = tick(frame); };

  function play() {
    if (settle) settle(false);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (prefersReducedMotion()) {
      glyphs.forEach((g) => { g.node.style.transform = ''; g.node.style.opacity = ''; });
      return Promise.resolve(true);
    }
    const n = splits[0].chars.length;
    glyphs.forEach((g) => {
      const [dx, dy] = dirs[g.li];
      const amp = o.spread * fs * (0.6 + g.jitter * 0.9);
      g.x.set(dx * amp + (g.jitter - 0.5) * fs * 0.3);
      g.y.set(dy * amp * 0.8);
      g.started = false;
      g.delay = (g.ci / Math.max(n - 1, 1)) * n * o.stagger * 0.5 + g.li * 60 + g.jitter * 120;
      g.node.style.opacity = '0';
      g.node.style.transform = `translate3d(${g.x.value}px, ${g.y.value}px, 0)`;
    });
    introT = 0;
    intro = true;
    return new Promise((d) => { settle = d; wake(); });
  }

  function reverse() {
    // Channels split apart and evaporate.
    if (settle) settle(false);
    intro = false;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const anims = glyphs.map((g) => {
      const [dx, dy] = dirs[g.li];
      const amp = o.spread * fs * (0.8 + g.jitter);
      return g.node.animate(
        [
          { transform: 'translate3d(0,0,0)', opacity: 1 },
          { transform: `translate3d(${dx * amp}px, ${dy * amp * 0.6}px, 0)`, opacity: 0 },
        ],
        { duration: 700, delay: g.ci * 14 + g.jitter * 120, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }
      );
    });
    return Promise.all(anims.map((a) => a.finished)).then(() => {
      glyphs.forEach((g) => (g.node.style.opacity = '0'));
      anims.forEach((a) => a.cancel());
      return true;
    });
  }

  const onMove = (e) => {
    const now = performance.now();
    if (pointer.has) {
      const dt = Math.max(now - pointer.t, 8) / 1000;
      const r = el.getBoundingClientRect();
      const near = e.clientX > r.left - 120 && e.clientX < r.right + 120 && e.clientY > r.top - 120 && e.clientY < r.bottom + 120;
      if (near) {
        pointer.vx = pointer.vx * 0.6 + ((e.clientX - pointer.x) / dt) * 0.4;
        pointer.vy = pointer.vy * 0.6 + ((e.clientY - pointer.y) / dt) * 0.4;
        wake();
      }
    }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = now; pointer.has = true;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  return {
    el,
    play,
    reverse,
    destroy() {
      if (off) off();
      if (settle) settle(false);
      window.removeEventListener('pointermove', onMove);
      el.innerHTML = originalHTML;
      el.classList.remove('sf-prism');
      el.style.removeProperty('--sf-prism-blend');
    },
  };
}

export default prismConverge;
