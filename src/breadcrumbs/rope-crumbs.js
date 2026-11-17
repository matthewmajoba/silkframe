/**
 * Rope Path
 * The breadcrumb as a washing line. Each level is a tag hanging from a
 * rope simulated with verlet physics: the rope sags under the tags' weight,
 * a new level drops onto the line and sets it bouncing, tags swing with the
 * rope's motion, and going back unhooks the deeper tags so they fall away.
 *
 *   const rope = ropeCrumbs(el, { items: ['Home', 'Studio'] });
 *   rope.push('Reels');   rope.go(0);
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { svg, resolve, clamp, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-rope',
  `.sf-rope{position:relative;height:var(--sf-rope-h,9em)}
.sf-rope svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.sf-rope-tag{position:absolute;left:0;top:0;transform-origin:50% 0;border:0;font:inherit;cursor:pointer;white-space:nowrap;
  padding:.5em .85em .55em;border-radius:.45em;background:var(--sf-rope-tag,#f1ebe1);color:var(--sf-rope-tag-fg,#121115);
  box-shadow:0 .5em 1em -.4em rgba(0,0,0,.6);will-change:transform}
.sf-rope-tag::before{content:"";position:absolute;left:50%;top:.32em;width:.34em;height:.34em;margin-left:-.17em;border-radius:50%;
  background:rgba(0,0,0,.35);box-shadow:inset 0 1px 1px rgba(0,0,0,.4)}
.sf-rope-tag[aria-current="page"]{background:var(--sf-rope-active,#ffb547)}
.sf-rope-tag span{display:block;padding-top:.35em}`
);

const DEFAULTS = {
  items: [],
  points: 28,
  slack: 1.045, // rope length relative to the span
  gravity: 2400, // px/s²
  tagMass: 2.6, // extra load at each tag point
  thread: 22, // px between rope and tag
  onNavigate: null,
};

export function ropeCrumbs(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-rope');
  el.setAttribute('role', 'navigation');
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Breadcrumb');
  el.innerHTML = '';
  const board = svg('svg', { 'aria-hidden': 'true' });
  const shadow = svg('path', { fill: 'none', stroke: 'rgba(0,0,0,.45)', 'stroke-width': 3, 'stroke-linecap': 'round' });
  const rope = svg('path', { fill: 'none', stroke: 'var(--sf-rope-color,#cfc6b6)', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  const threads = svg('path', { fill: 'none', stroke: 'rgba(230,220,205,.55)', 'stroke-width': 1 });
  board.append(shadow, rope, threads);
  el.appendChild(board);

  const N = o.points;
  const px = new Float32Array(N), py = new Float32Array(N), ox = new Float32Array(N), oy = new Float32Array(N);
  const load = new Float32Array(N);
  let W = 0, H = 0, pad = 0, rest = 0, y0 = 0;
  let tags = []; // { node, label, k (rope index), ang, av, falling, fx, fy, vx, vy, rot }
  let off = null;

  function geometry() {
    W = el.clientWidth; H = el.clientHeight;
    pad = Math.min(30, W * 0.05);
    y0 = H * 0.18;
    rest = ((W - pad * 2) / (N - 1)) * o.slack;
  }
  geometry();
  for (let i = 0; i < N; i++) {
    px[i] = ox[i] = pad + ((W - pad * 2) * i) / (N - 1);
    py[i] = oy[i] = y0;
  }

  function attach() {
    load.fill(1);
    const live = tags.filter((t) => !t.falling);
    live.forEach((t, j) => {
      t.k = Math.round(((j + 1) / (live.length + 1)) * (N - 1));
      load[t.k] += o.tagMass;
    });
  }

  function step(s) {
    // Verlet integration
    for (let i = 1; i < N - 1; i++) {
      const vx = (px[i] - ox[i]) * 0.992, vy = (py[i] - oy[i]) * 0.992;
      ox[i] = px[i]; oy[i] = py[i];
      px[i] += vx;
      py[i] += vy + o.gravity * load[i] * 0.35 * s * s;
    }
    px[0] = pad; py[0] = y0; px[N - 1] = W - pad; py[N - 1] = y0;
    for (let it = 0; it < 10; it++) {
      for (let i = 0; i < N - 1; i++) {
        const dx = px[i + 1] - px[i], dy = py[i + 1] - py[i];
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - rest) / d;
        const wa = i === 0 ? 0 : 0.5, wb = i + 1 === N - 1 ? 0 : 0.5;
        const k = diff / Math.max(wa + wb, 0.0001);
        px[i] += dx * k * wa; py[i] += dy * k * wa;
        px[i + 1] -= dx * k * wb; py[i + 1] -= dy * k * wb;
      }
    }
  }

  function draw(s) {
    let d = `M${px[0].toFixed(1)},${py[0].toFixed(1)}`;
    for (let i = 1; i < N - 1; i++) {
      const mx = (px[i] + px[i + 1]) / 2, my = (py[i] + py[i + 1]) / 2;
      d += ` Q${px[i].toFixed(1)},${py[i].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    d += ` L${px[N - 1].toFixed(1)},${py[N - 1].toFixed(1)}`;
    rope.setAttribute('d', d);
    shadow.setAttribute('d', d);
    shadow.setAttribute('transform', 'translate(0,3)');
    let t = '';
    for (const tag of tags) {
      if (tag.falling) {
        tag.vy += o.gravity * s;
        tag.fx += tag.vx * s; tag.fy += tag.vy * s; tag.rot += tag.vr * s;
        tag.node.style.transform = `translate3d(${(tag.fx - tag.w / 2).toFixed(1)}px, ${tag.fy.toFixed(1)}px, 0) rotate(${tag.rot.toFixed(1)}deg)`;
        tag.node.style.opacity = clamp(1 - (tag.fy - y0) / (H * 1.2)).toFixed(3);
        continue;
      }
      const k = tag.k;
      const ax = px[k], ay = py[k];
      // Pendulum swing driven by the attach point's horizontal acceleration.
      const accel = (px[k] - ox[k]) / Math.max(s, 0.001);
      tag.av += (-tag.ang * 60 - tag.av * 5 - accel * 0.9) * s;
      tag.ang += tag.av * s;
      const ang = clamp(tag.ang, -0.7, 0.7);
      const tx = ax + Math.sin(ang) * o.thread, ty = ay + Math.cos(ang) * o.thread;
      t += `M${ax.toFixed(1)},${ay.toFixed(1)} L${tx.toFixed(1)},${(ty + 4).toFixed(1)} `;
      tag.fx = tx; tag.fy = ty;
      tag.node.style.transform = `translate3d(${(tx - tag.w / 2).toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${(-ang * 57.3).toFixed(2)}deg)`;
    }
    threads.setAttribute('d', t || 'M0,0');
  }

  function frame(_, dt) {
    const s = Math.min(dt / 1000, 1 / 30);
    step(s);
    draw(s);
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tags[i].falling && tags[i].fy > H * 1.6) { tags[i].node.remove(); tags.splice(i, 1); }
    }
  }

  function current() {
    const live = tags.filter((t) => !t.falling);
    live.forEach((t, j) => {
      if (j === live.length - 1) t.node.setAttribute('aria-current', 'page');
      else t.node.removeAttribute('aria-current');
    });
  }

  function make(label, drop) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'sf-rope-tag';
    node.innerHTML = '<span></span>';
    node.querySelector('span').textContent = label;
    node.addEventListener('click', () => {
      const live = tags.filter((t) => !t.falling);
      const i = live.findIndex((t) => t.node === node);
      if (i >= 0 && i < live.length - 1) { go(i); o.onNavigate?.(i, live.map((t) => t.label)); }
    });
    el.appendChild(node);
    const tag = { node, label, k: 0, ang: drop ? (Math.random() - 0.5) * 0.8 : 0, av: 0, falling: false, fx: 0, fy: 0, vx: 0, vy: 0, vr: 0, w: node.offsetWidth };
    return tag;
  }

  function push(label) {
    const tag = make(label, true);
    tags.push(tag);
    attach();
    current();
    if (!prefersReducedMotion()) {
      // Drop onto the line: kick the rope down at the attach point.
      const k = tag.k;
      for (let i = Math.max(1, k - 3); i <= Math.min(N - 2, k + 3); i++) oy[i] -= 9 * (1 - Math.abs(i - k) / 4);
      tag.node.animate([{ opacity: 0, translate: '0 -1.2em' }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' });
    }
    return Promise.resolve(true);
  }

  function go(index) {
    const live = tags.filter((t) => !t.falling);
    if (index >= live.length - 1) return Promise.resolve(true);
    live.slice(index + 1).forEach((t, n) => {
      t.falling = true;
      t.vx = (Math.random() - 0.5) * 140;
      t.vy = -160 - n * 40;
      t.vr = (Math.random() - 0.5) * 260;
      // the rope springs up as the weight leaves it
      for (let i = Math.max(1, t.k - 3); i <= Math.min(N - 2, t.k + 3); i++) oy[i] += 7 * (1 - Math.abs(i - t.k) / 4);
    });
    attach();
    current();
    return Promise.resolve(true);
  }

  o.items.forEach((l) => tags.push(make(l, false)));
  attach();
  current();
  // settle the rope before first paint
  for (let i = 0; i < 160; i++) step(1 / 120);
  draw(1 / 60);
  const ro = new ResizeObserver(() => geometry());
  ro.observe(el);
  off = tick(frame);

  return {
    el,
    push,
    go,
    pop() { return go(tags.filter((t) => !t.falling).length - 2); },
    get items() { return tags.filter((t) => !t.falling).map((t) => t.label); },
    destroy() {
      off?.();
      ro.disconnect();
      el.innerHTML = '';
      el.classList.remove('sf-rope');
    },
  };
}

export default ropeCrumbs;
