/**
 * Lens Reveal
 * A glass loupe glides after the pointer and shows a second layer through
 * it — an x-ray, a night version, the blueprint behind the render. The view
 * inside is magnified about the lens centre like real optics; the lens
 * swells into existence with a little pop, stretches along its direction of
 * travel like a drop of water (oriented to the motion, not just the axes),
 * and carries a glass rim: specular highlight, refracted ring, chromatic
 * fringe and a soft shadow on the page beneath.
 *
 * Everything is transforms on two composited layers — the lens shape and an
 * inverse-transformed view inside it — so it never repaints while moving.
 * The reveal layer is moved into the lens (not cloned), so live content
 * such as video keeps playing.
 *
 *   <div class="card"><div class="base">…</div><div class="reveal">…</div></div>
 *   lensReveal('.card', { radius: 110, zoom: 1.15 });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-lens',
  `:where(.sf-lens){position:relative}.sf-lens{overflow:hidden;isolation:isolate}
.sf-lens-glass{position:absolute;left:0;top:0;border-radius:50%;overflow:hidden;transform-origin:0 0;will-change:transform;
  pointer-events:none;z-index:5;visibility:hidden;box-shadow:0 1.4em 2.6em -1em rgba(0,0,0,.6)}
.sf-lens-view{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.sf-lens-view>.sf-lens-reveal{position:absolute;inset:0}
.sf-lens-shade{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:
    radial-gradient(circle,transparent 64%,rgba(255,255,255,.1) 71%,rgba(255,255,255,.02) 76%,transparent 80%),
    radial-gradient(circle,transparent 58%,rgba(0,0,0,.28) 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.42),inset .35em 0 .7em rgba(255,40,120,.16),inset -.35em 0 .7em rgba(0,190,255,.18),
    inset 0 -.9em 1.6em rgba(0,0,0,.28)}
.sf-lens-spec{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;will-change:transform}`
);

const DEFAULTS = {
  radius: 110, // px
  zoom: 1.15, // magnification inside the lens
  stretch: 0.00045, // velocity → elongation
  maxStretch: 0.38,
  idle: true, // drift autonomously until touched
  hideCursor: false,
};

export function lensReveal(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-lens');
  const reveal = el.querySelector('.reveal,[data-lens="reveal"]');
  const home = { parent: reveal.parentNode, next: reveal.nextSibling };
  reveal.classList.add('sf-lens-reveal');
  const R = o.radius;
  const glass = document.createElement('div');
  glass.className = 'sf-lens-glass';
  glass.style.width = glass.style.height = `${R * 2}px`;
  const view = document.createElement('div');
  view.className = 'sf-lens-view';
  const shade = document.createElement('div');
  shade.className = 'sf-lens-shade';
  shade.setAttribute('aria-hidden', 'true');
  view.appendChild(reveal);
  // Highlights are pinned to the light (upper-left), not to the lens's
  // direction of travel: they are counter-positioned every frame.
  const spec = document.createElement('div');
  spec.className = 'sf-lens-spec';
  const specD = R * 0.62;
  spec.style.cssText += `width:${specD}px;height:${specD}px;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,.12) 32%,rgba(255,255,255,0) 68%)`;
  const glint = document.createElement('div');
  glint.className = 'sf-lens-spec';
  const glintD = R * 0.5;
  glint.style.cssText += `width:${glintD}px;height:${glintD}px;background:radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,0) 66%)`;
  glass.append(view, shade, spec, glint);
  el.appendChild(glass);
  if (o.hideCursor) el.style.cursor = 'none';

  const cfg = { stiffness: 170, damping: 20, precision: 0.05 };
  const x = new Spring(0, cfg), y = new Spring(0, cfg);
  const size = new Spring(0, { stiffness: 160, damping: 15, precision: 0.0005 });
  let theta = 0;
  let stretchE = 0;
  let inside = false;
  let t = 0;
  let off = null;

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    const W = el.clientWidth, H = el.clientHeight;
    if (!inside && o.idle) {
      x.to(W * (0.5 + Math.sin(t * 0.55) * 0.3));
      y.to(H * (0.5 + Math.sin(t * 0.9 + 0.8) * 0.24));
      size.to(0.88);
    }
    x.step(s); y.step(s); size.step(s);
    view.style.width = `${W}px`;
    view.style.height = `${H}px`;

    // Stretch along the direction of travel (eased, so it never snaps).
    const vx = x.velocity, vy = y.velocity;
    const v = Math.hypot(vx, vy);
    const target = clamp(v * o.stretch, 0, o.maxStretch);
    stretchE += (target - stretchE) * (1 - Math.exp(-s * 14));
    if (v > 40) {
      const a = Math.atan2(vy, vx);
      let d = a - theta;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest turn
      theta += d * (1 - Math.exp(-s * 12));
    }
    const k = Math.max(0.0001, size.value);
    if (k < 0.02) {
      glass.style.visibility = 'hidden';
    } else {
      glass.style.visibility = 'visible';
      const sx = k * (1 + stretchE), sy = k / Math.sqrt(1 + stretchE);
      const c = Math.cos(theta), sn = Math.sin(theta);
      // Lens: p ↦ C + R(θ)·diag(sx,sy)·(p − (R,R))
      const a = c * sx, b = sn * sx, cc = -sn * sy, d = c * sy;
      const ex = x.value - (a * R + cc * R), ey = y.value - (b * R + d * R);
      glass.style.transform = `matrix(${a.toFixed(5)},${b.toFixed(5)},${cc.toFixed(5)},${d.toFixed(5)},${ex.toFixed(2)},${ey.toFixed(2)})`;
      // View: q ↦ zoom·L⁻¹·(q − C) + (R,R)  — so the scene stays put and is
      // magnified about the lens centre, whatever shape the lens takes.
      const m = o.zoom;
      const ia = (m * c) / sx, ic = (m * sn) / sx; // row 1
      const ib = (-m * sn) / sy, id = (m * c) / sy; // row 2
      const fx = R - (ia * x.value + ic * y.value);
      const fy = R - (ib * x.value + id * y.value);
      view.style.transform = `matrix(${ia.toFixed(5)},${ib.toFixed(5)},${ic.toFixed(5)},${id.toFixed(5)},${fx.toFixed(2)},${fy.toFixed(2)})`;
      // Light direction in screen space → lens-local position: R(−θ)·offset.
      const place = (node, d, ox, oy) => {
        const lx = R + (c * ox + sn * oy) / (1 + stretchE * 0.5);
        const ly = R + (-sn * ox + c * oy);
        node.style.transform = `translate3d(${(lx - d / 2).toFixed(2)}px, ${(ly - d / 2).toFixed(2)}px, 0)`;
      };
      place(spec, specD, -0.4 * R, -0.5 * R);
      place(glint, glintD, 0.42 * R, 0.6 * R);
    }
    if (!o.idle && !inside && size.resting && size.value < 0.02 && x.resting && y.resting) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  const local = (e) => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onEnter = (e) => {
    inside = true;
    if (size.value < 0.05) {
      // appear where the pointer is, not where the idle drift was
      const [px, py] = local(e);
      x.set(px); y.set(py);
    }
    size.to(1);
    wake();
  };
  const onMove = (e) => {
    const [px, py] = local(e);
    x.to(px);
    y.to(py);
    if (!inside) onEnter(e);
    wake();
  };
  const onLeave = () => { inside = false; if (!o.idle) size.to(0); wake(); };
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  x.set(el.clientWidth / 2);
  y.set(el.clientHeight / 2);
  wake();

  return {
    el,
    /** Programmatic control (element-local px). */
    moveTo(px, py) { inside = true; x.to(px); y.to(py); size.to(1); wake(); },
    release: onLeave,
    destroy() {
      if (off) off();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      reveal.classList.remove('sf-lens-reveal');
      home.parent.insertBefore(reveal, home.next);
      glass.remove();
      el.classList.remove('sf-lens');
      el.style.cursor = '';
    },
  };
}

export default lensReveal;
