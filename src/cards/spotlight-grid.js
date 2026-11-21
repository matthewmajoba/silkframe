/**
 * Spotlight Grid — "in the dark"
 * A grid lit by a single searching light, in the spirit of Playdead's
 * worlds: everything outside the beam falls into fog and darkness, so the
 * light is the only way to read anything. Content marked [data-lit] is
 * invisible until the beam finds it; every card throws a soft shadow away
 * from the light (shadows swing as it moves); dust and fog drift through
 * the beam and nowhere else. Untouched, the light searches the cards by
 * itself — lingering, trembling slightly, moving on.
 *
 *   spotlightGrid('.notes', { radius: 240 });
 *   <article>… <p data-lit>Only visible in the light</p></article>
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { createNoise, mulberry32 } from '../core/noise.js';
import { resolve, clamp, smoothstep, dpr, debounce } from '../core/utils.js';

injectStyle(
  'sf-pd',
  `.sf-pd{overflow:hidden;isolation:isolate;--lit:0}
.sf-pd>.sf-pd-item{position:relative;z-index:1;
  box-shadow:calc(var(--sx,0) * 1px) calc(var(--sy,0) * 1px) calc(14px + var(--sb,0) * 1px) rgba(0,0,0,calc(.2 + var(--lit) * .55))}
.sf-pd>.sf-pd-item::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:radial-gradient(circle at var(--lx,-999px) var(--ly,-999px),rgba(255,248,232,calc(var(--lit) * .13)),transparent 70%)}
.sf-pd [data-lit]{opacity:calc(.03 + var(--lit) * .97);filter:blur(calc((1 - var(--lit)) * 2px))}
.sf-pd-dark{position:absolute;left:0;top:0;z-index:3;pointer-events:none;will-change:transform}
.sf-pd-air{position:absolute;inset:0;z-index:4;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}
.sf-pd-grain{position:absolute;inset:-50%;z-index:5;pointer-events:none;opacity:.09;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  animation:sf-pd-grain .7s steps(5) infinite}
@keyframes sf-pd-grain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-2%)}100%{transform:translate(0,0)}}`
);

const DEFAULTS = {
  radius: null, // px; default 34% of the shorter side
  light: [255, 246, 228], // beam tint (r,g,b)
  darkness: 0.93,
  fog: true,
  motes: 90,
  idle: true, // search on its own until touched
  seed: 7,
};

export function spotlightGrid(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-pd');
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const items = Array.from(el.children).map((node) => {
    node.classList.add('sf-pd-item');
    return { node, cx: 0, cy: 0, x: 0, y: 0, w: 0, h: 0 };
  });
  const dark = document.createElement('div');
  dark.className = 'sf-pd-dark';
  const air = document.createElement('canvas');
  air.className = 'sf-pd-air';
  const grain = document.createElement('div');
  grain.className = 'sf-pd-grain';
  [dark, air, grain].forEach((n) => n.setAttribute('aria-hidden', 'true'));
  el.append(dark, air, grain);
  const actx = air.getContext('2d');
  const { noise2, noise3 } = createNoise(o.seed);
  const rand = mulberry32(o.seed);

  let W = 0, H = 0, R = 0, scale = 1;
  let fogTex = null;
  const motes = Array.from({ length: o.motes }, () => ({ x: rand(), y: rand(), z: rand(), s: 0.6 + rand() * 1.6, p: rand() * 100 }));

  function measure() {
    W = el.clientWidth;
    H = el.clientHeight;
    R = o.radius || Math.min(W, H) * 0.34;
    const base = el.getBoundingClientRect();
    items.forEach((it) => {
      const r = it.node.getBoundingClientRect();
      it.x = r.left - base.left; it.y = r.top - base.top; it.w = r.width; it.h = r.height;
      it.cx = it.x + it.w / 2; it.cy = it.y + it.h / 2;
    });
    // Darkness: a big pre-painted vignette moved with transforms only.
    const D = Math.max(W, H) * 3;
    dark.style.width = dark.style.height = `${D}px`;
    const a = o.darkness;
    dark.style.background = `radial-gradient(circle at 50% 50%, rgba(4,5,6,0) 0px, rgba(4,5,6,${(a * 0.18).toFixed(3)}) ${R * 0.45}px, rgba(4,5,6,${(a * 0.7).toFixed(3)}) ${R * 0.95}px, rgba(4,5,6,${a}) ${R * 1.5}px)`;
    scale = Math.min(dpr(), 1) * 0.5;
    air.width = Math.max(1, Math.round(W * scale));
    air.height = Math.max(1, Math.round(H * scale));
    if (o.fog && !fogTex) fogTex = makeFog();
  }

  function makeFog() {
    const n = 192;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // tileable fbm: sample a torus
        const ax = (x / n) * Math.PI * 2, ay = (y / n) * Math.PI * 2;
        let v = 0, amp = 0.5, f = 1;
        for (let k = 0; k < 4; k++) {
          v += amp * noise3(Math.cos(ax) * f, Math.sin(ax) * f, Math.cos(ay) * f + Math.sin(ay) * f * 0.7 + k * 9);
          amp *= 0.5; f *= 2;
        }
        const g = Math.max(0, Math.min(255, (v * 0.5 + 0.5) * 255));
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.pow(g / 255, 1.8) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const lx = new Spring(0, { stiffness: 22, damping: 8.5, precision: 0.1 });
  const ly = new Spring(0, { stiffness: 22, damping: 8.5, precision: 0.1 });
  let inside = false;
  let t = 0;
  let searchAt = 0, dwell = 0, order = [], idx = 0;

  function nextTarget() {
    if (!order.length || idx >= order.length) {
      order = items.map((_, i) => i).sort(() => rand() - 0.5);
      idx = 0;
    }
    const it = items[order[idx++]];
    if (!it) return;
    lx.to(it.cx + (rand() - 0.5) * it.w * 0.3);
    ly.to(it.cy + (rand() - 0.5) * it.h * 0.3);
    dwell = 1.3 + rand() * 1.2;
  }

  function frame(_, dt) {
    const s = Math.min(dt / 1000, 1 / 30);
    t += s;
    if (!inside && o.idle && t >= searchAt) {
      nextTarget();
      searchAt = t + dwell + 0.9;
    }
    lx.step(s); ly.step(s);
    // A hand holding the light trembles a little.
    const jx = noise2(t * 0.9, 3.1) * 5, jy = noise2(t * 0.9, 7.7) * 5;
    const x = lx.value + jx, y = ly.value + jy;
    const D = Math.max(W, H) * 3;
    dark.style.transform = `translate3d(${(x - D / 2).toFixed(1)}px, ${(y - D / 2).toFixed(1)}px, 0)`;

    // Cards: light level, shadow thrown away from the light, surface sheen.
    for (const it of items) {
      const dx = Math.max(it.x - x, 0, x - (it.x + it.w));
      const dy = Math.max(it.y - y, 0, y - (it.y + it.h));
      const near = Math.hypot(dx, dy);
      const lit = 1 - smoothstep(R * 0.15, R * 1.05, near);
      const vx = it.cx - x, vy = it.cy - y;
      const vl = Math.hypot(vx, vy) || 1;
      const reach = 10 + 26 * lit;
      const st = it.node.style;
      st.setProperty('--lit', lit.toFixed(3));
      st.setProperty('--sx', ((vx / vl) * reach).toFixed(1));
      st.setProperty('--sy', ((vy / vl) * reach + 6).toFixed(1));
      st.setProperty('--sb', (lit * 22).toFixed(1));
      st.setProperty('--lx', `${(x - it.x).toFixed(1)}px`);
      st.setProperty('--ly', `${(y - it.y).toFixed(1)}px`);
    }

    // Air: drifting fog and dust motes, visible only inside the beam.
    const aw = air.width, ah = air.height;
    const sx = x * scale, sy = y * scale, sr = R * scale;
    actx.globalCompositeOperation = 'source-over';
    actx.clearRect(0, 0, aw, ah);
    if (fogTex) {
      const tile = 300 * scale * 2;
      actx.globalAlpha = 0.55;
      for (const [sp, k] of [[9, 1], [-14, 0.6]]) {
        const ox = ((t * sp) % tile + tile) % tile, oy = ((t * sp * 0.35) % tile + tile) % tile;
        for (let gx = -tile; gx < aw + tile; gx += tile) {
          for (let gy = -tile; gy < ah + tile; gy += tile) {
            actx.globalAlpha = 0.5 * k;
            actx.drawImage(fogTex, gx + ox, gy + oy, tile, tile);
          }
        }
      }
      actx.globalAlpha = 1;
    }
    for (const m of motes) {
      m.x += (noise2(m.p, t * 0.15) * 0.012 + 0.002) * s;
      m.y += (noise2(m.p + 40, t * 0.15) * 0.012 - 0.004) * s;
      if (m.x < 0) m.x += 1; if (m.x > 1) m.x -= 1;
      if (m.y < 0) m.y += 1; if (m.y > 1) m.y -= 1;
      const px = m.x * aw, py = m.y * ah;
      const d = Math.hypot(px - sx, py - sy) / sr;
      if (d > 1.1) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * (1 + m.z * 2) + m.p);
      actx.globalAlpha = (1 - smoothstep(0.2, 1.1, d)) * tw * (0.35 + m.z * 0.65);
      actx.fillStyle = '#fff';
      actx.beginPath();
      actx.arc(px, py, m.s * scale * (0.6 + m.z), 0, Math.PI * 2);
      actx.fill();
    }
    actx.globalAlpha = 1;
    // Keep only what is inside the beam, tinted by the light.
    actx.globalCompositeOperation = 'destination-in';
    const g = actx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.15);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    actx.fillStyle = g;
    actx.fillRect(0, 0, aw, ah);
    actx.globalCompositeOperation = 'source-atop';
    actx.fillStyle = `rgba(${o.light.join(',')},0.55)`;
    actx.fillRect(0, 0, aw, ah);
    actx.globalCompositeOperation = 'source-over';
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    inside = true;
    lx.to(e.clientX - r.left);
    ly.to(e.clientY - r.top);
  };
  const onLeave = () => { inside = false; searchAt = t + 0.8; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  measure();
  lx.set(W * 0.5); ly.set(H * 0.5);
  const remeasure = debounce(measure, 120);
  const ro = new ResizeObserver(remeasure);
  ro.observe(el);
  const off = tick(frame);

  return {
    el,
    /** Aim the light (element-local px). */
    aim(px, py) { inside = true; lx.to(px); ly.to(py); },
    release: onLeave,
    destroy() {
      off();
      remeasure.cancel();
      ro.disconnect();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      dark.remove(); air.remove(); grain.remove();
      items.forEach((it) => {
        it.node.classList.remove('sf-pd-item');
        ['--lit', '--sx', '--sy', '--sb', '--lx', '--ly'].forEach((p) => it.node.style.removeProperty(p));
      });
      el.classList.remove('sf-pd');
    },
  };
}

export default spotlightGrid;
