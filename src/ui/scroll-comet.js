/**
 * Scroll Comet
 * A reading-progress line with a comet for a head. Progress follows the
 * scroll on a smoothed spring; the comet's tail stretches with scroll
 * velocity, it brightens when you move fast and sheds sparks that drift and
 * fade. At rest it shrinks to a calm glowing bead.
 *
 *   scrollComet(document.body);                 // window scroll, fixed to the top
 *   scrollComet(bar, { scroller: articleEl });  // any scroll container
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, dpr, prefersReducedMotion } from '../core/utils.js';

injectStyle('sf-comet', `.sf-comet{display:block;width:100%;height:var(--sf-comet-h,22px);pointer-events:none}`);

const DEFAULTS = {
  scroller: null, // element; default window
  color: [255, 181, 71],
  head: [255, 246, 226],
  track: 'rgba(255,255,255,0.08)',
  thickness: 2,
  follow: 10,
  sparks: true,
};

export function scrollComet(target, options = {}) {
  const host = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.className = 'sf-comet';
  canvas.setAttribute('role', 'progressbar');
  canvas.setAttribute('aria-label', 'Reading progress');
  canvas.setAttribute('aria-valuemin', '0');
  canvas.setAttribute('aria-valuemax', '100');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let shown = 0, vel = 0, speed = 0;
  const sparks = [];
  let W = 0, H = 0, ratio = 1;

  function size() {
    ratio = dpr();
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(canvas);

  function progress() {
    if (o.scroller) {
      const s = o.scroller;
      const max = s.scrollHeight - s.clientHeight;
      return max > 0 ? s.scrollTop / max : 0;
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? scrollY / max : 0;
  }

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function frame(_, dt) {
    const s = Math.min(dt / 1000, 0.05);
    const p = clamp(progress());
    const prev = shown;
    shown += (p - shown) * (1 - Math.exp(-s * o.follow));
    vel = (shown - prev) / Math.max(s, 0.001); // progress / second
    speed += (Math.min(Math.abs(vel) * 4, 1.6) - speed) * (1 - Math.exp(-s * 6));
    canvas.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const y = H / 2;
    const x = shown * W;
    // track
    ctx.fillStyle = o.track;
    ctx.fillRect(0, y - o.thickness / 2, W, o.thickness);
    // filled line with a hot gradient toward the head
    const g = ctx.createLinearGradient(0, 0, Math.max(x, 1), 0);
    g.addColorStop(0, rgba(o.color, 0.15));
    g.addColorStop(Math.max(0, 1 - 160 / Math.max(x, 1)), rgba(o.color, 0.55));
    g.addColorStop(1, rgba(o.color, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - o.thickness / 2, x, o.thickness);
    // comet tail — length grows with velocity, points against motion
    const dir = vel >= 0 ? -1 : 1;
    const tail = 14 + speed * 120;
    const tg = ctx.createLinearGradient(x, 0, x + dir * tail, 0);
    tg.addColorStop(0, rgba(o.head, 0.95));
    tg.addColorStop(0.25, rgba(o.color, 0.6));
    tg.addColorStop(1, rgba(o.color, 0));
    ctx.fillStyle = tg;
    ctx.beginPath();
    const th = o.thickness * (1.6 + speed * 1.8);
    ctx.moveTo(x, y - th);
    ctx.quadraticCurveTo(x + dir * tail * 0.4, y - th * 0.5, x + dir * tail, y);
    ctx.quadraticCurveTo(x + dir * tail * 0.4, y + th * 0.5, x, y + th);
    ctx.closePath();
    ctx.fill();
    // head glow
    const r = 3 + speed * 3;
    const hg = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    hg.addColorStop(0, rgba(o.head, 1));
    hg.addColorStop(0.25, rgba(o.color, 0.8));
    hg.addColorStop(1, rgba(o.color, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
    // sparks shed at speed
    if (o.sparks && speed > 0.25 && Math.random() < speed * 0.9) {
      sparks.push({ x, y, vx: dir * (40 + Math.random() * 120) * speed, vy: (Math.random() - 0.5) * 90, life: 0.5 + Math.random() * 0.5, age: 0 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const k = sparks[i];
      k.age += s;
      if (k.age > k.life) { sparks.splice(i, 1); continue; }
      k.vx *= 0.96; k.vy *= 0.96;
      k.x += k.vx * s; k.y += k.vy * s;
      const a = 1 - k.age / k.life;
      ctx.fillStyle = rgba(o.color, a);
      ctx.fillRect(k.x - 1, k.y - 1, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const off = prefersReducedMotion() ? null : tick(frame);
  if (!off) { shown = progress(); frame(0, 16); }

  return {
    el: canvas,
    get progress() { return shown; },
    destroy() {
      off?.();
      ro.disconnect();
      canvas.remove();
    },
  };
}

export default scrollComet;
