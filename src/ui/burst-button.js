/**
 * Celebration Burst
 * A success moment with real physics. The button squashes on press, then
 * releases a burst of confetti — ribbons and sparks with drag, gravity,
 * flutter and spin, lit as they turn — while a shock ring expands from the
 * button. Rendered on a single canvas that sleeps when the air is clear.
 *
 *   burstButton('.publish', { colors: ['#ffb547', '#ff5fa2', '#7ea6ff'] });
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { resolve, dpr, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-burst',
  `.sf-burst-canvas{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147482000}
.sf-burst-ring{position:fixed;pointer-events:none;border-radius:999px;border:2px solid var(--sf-burst-ring,#ffd28a);z-index:2147481999}`
);

const DEFAULTS = {
  colors: ['#ffb547', '#ff7a59', '#ff5fa2', '#8a7dff', '#7ee0d0', '#fff3d6'],
  count: 140,
  power: 1,
  seed: 3,
};

let shared = null;
function stage() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.className = 'sf-burst-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const parts = [];
  let off = null;
  const resize = () => {
    const r = dpr();
    canvas.width = innerWidth * r;
    canvas.height = innerHeight * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  function frame(_, dt) {
    const s = Math.min(dt / 1000, 1 / 30);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= s;
      // Air drag + gravity; ribbons flutter sideways as they fall.
      p.vx *= Math.exp(-p.drag * s);
      p.vy *= Math.exp(-p.drag * s);
      p.vy += 980 * p.weight * s;
      p.phase += p.flutter * s;
      p.x += (p.vx + Math.sin(p.phase) * p.sway) * s;
      p.y += p.vy * s;
      p.rot += p.spin * s;
      const fade = Math.min(1, p.life / 0.6);
      if (p.life <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const tilt = Math.cos(p.phase * 1.7); // ribbon turning: width foreshortens
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      if (p.kind === 0) {
        ctx.scale(tilt, 1);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        // highlight when facing the light
        if (tilt > 0.7) { ctx.globalAlpha = fade * (tilt - 0.7) * 2; ctx.fillStyle = '#fff'; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.35); }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (!parts.length) { off(); off = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  shared = {
    add(list) { parts.push(...list); if (!off) off = tick(frame); },
  };
  return shared;
}

export function burstButton(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const rand = mulberry32(o.seed);

  function fire(originX, originY) {
    const r = el.getBoundingClientRect();
    const x = originX ?? r.left + r.width / 2;
    const y = originY ?? r.top + r.height / 2;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.9, 0.84)', offset: 0.18 }, { transform: 'scale(1.06, 1.1)', offset: 0.45 }, { transform: 'scale(1)' }],
      { duration: 620, easing: css.glide }
    );
    if (prefersReducedMotion()) return;
    const ring = document.createElement('div');
    ring.className = 'sf-burst-ring';
    ring.style.cssText += `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    document.body.appendChild(ring);
    ring.animate([{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(1.9, 2.6)', opacity: 0 }], { duration: 700, easing: css.cinematic })
      .finished.then(() => ring.remove());
    const list = [];
    for (let i = 0; i < o.count; i++) {
      // Fan upward with a spread; fastest particles go highest.
      const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.15;
      const sp = (420 + rand() * 820) * o.power;
      const kind = rand() < 0.78 ? 0 : 1;
      list.push({
        kind,
        x: x + (rand() - 0.5) * r.width * 0.6,
        y: y + (rand() - 0.5) * r.height * 0.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        w: kind ? 5 + rand() * 4 : 6 + rand() * 6,
        h: kind ? 0 : 3 + rand() * 4,
        rot: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * 14,
        phase: rand() * Math.PI * 2,
        flutter: 6 + rand() * 9,
        sway: kind ? 0 : 40 + rand() * 60,
        drag: kind ? 1.2 : 2.6 + rand() * 1.4,
        weight: kind ? 0.9 : 0.42 + rand() * 0.2,
        life: 2.2 + rand() * 1.4,
        color: o.colors[Math.floor(rand() * o.colors.length)],
      });
    }
    stage().add(list);
  }

  const onClick = (e) => fire(e.clientX || undefined, e.clientY || undefined);
  el.addEventListener('click', onClick);

  return {
    el,
    fire,
    destroy() { el.removeEventListener('click', onClick); },
  };
}

export default burstButton;
