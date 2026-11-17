/**
 * Constellation Path
 * Each level is a star on a hand-drawn arc. Going deeper, the existing
 * stars glide to make room, a filament of light draws out to the new star,
 * which ignites with a pop and a halo while its label fades up. Going back,
 * filaments retract star by star into the one you picked.
 *
 *   const path = constellationCrumbs(el, { items: ['Home', 'Atlas'] });
 *   path.push('Northern Sky');   path.go(0);
 */
import { tick, wait } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { svg, resolve, clamp, prefersReducedMotion } from '../core/utils.js';
import { inOutCubic } from '../core/ease.js';

injectStyle(
  'sf-constellation',
  `.sf-cn{position:relative;height:var(--sf-cn-h,7em)}
.sf-cn svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.sf-cn-node{position:absolute;left:0;top:50%;width:0;height:0;border:0;padding:0;background:none;color:inherit;font:inherit;cursor:pointer}
.sf-cn-dot{position:absolute;left:-.42em;top:-.42em;width:.84em;height:.84em;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#fff,var(--sf-cn-star,#ffcf86) 45%,rgba(255,170,80,.0) 72%);
  box-shadow:0 0 .9em var(--sf-cn-glow,rgba(255,180,90,.65))}
.sf-cn-halo{position:absolute;left:-1.1em;top:-1.1em;width:2.2em;height:2.2em;border-radius:50%;
  border:1px solid var(--sf-cn-star,#ffcf86);opacity:0;pointer-events:none}
.sf-cn-node.is-current .sf-cn-halo{animation:sf-cn-halo 2.4s cubic-bezier(.16,1,.3,1) infinite}
@keyframes sf-cn-halo{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.sf-cn-label{position:absolute;left:50%;top:1.2em;transform:translateX(-50%);white-space:nowrap;
  font-size:.82em;letter-spacing:.04em;color:var(--sf-cn-fg,rgba(255,255,255,.55));transition:color .4s}
.sf-cn-node:hover .sf-cn-label,.sf-cn-node.is-current .sf-cn-label{color:var(--sf-cn-active,#fff)}
.sf-cn-node.is-current{cursor:default}`
);

const DEFAULTS = {
  items: [],
  onNavigate: null,
  gap: 150, // max px between stars
  arc: 0.32, // curvature of each filament (fraction of gap)
  draw: 520, // ms per filament
};

export function constellationCrumbs(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-cn');
  el.setAttribute('role', 'navigation');
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Breadcrumb');
  el.innerHTML = '';
  const root = svg('svg', { 'aria-hidden': 'true' });
  const glowPath = svg('path', { fill: 'none', stroke: 'rgba(255,190,110,.35)', 'stroke-width': 4, 'stroke-linecap': 'round', filter: 'blur(3px)' });
  const path = svg('path', { fill: 'none', stroke: 'rgba(255,225,180,.85)', 'stroke-width': 1.2, 'stroke-linecap': 'round' });
  const trail = svg('path', { fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 1, 'stroke-dasharray': '2 6' });
  root.append(trail, glowPath, path);
  el.appendChild(root);

  const stars = [];
  let off = null;
  let W = 0, H = 0;

  function makeStar(label) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'sf-cn-node';
    node.innerHTML = `<span class="sf-cn-halo"></span><span class="sf-cn-dot"></span><span class="sf-cn-label"></span>`;
    node.querySelector('.sf-cn-label').textContent = label;
    node.addEventListener('click', () => {
      const i = stars.findIndex((s) => s.node === node);
      if (i >= 0 && i < stars.length - 1) { go(i); o.onNavigate?.(i, stars.map((s) => s.label)); }
    });
    el.appendChild(node);
    return {
      node, label,
      x: new Spring(0, { stiffness: 120, damping: 18, precision: 0.05 }),
      pop: new Spring(0, { stiffness: 260, damping: 12, precision: 0.001 }),
      text: new Spring(0, { stiffness: 120, damping: 20, precision: 0.001 }),
      seg: 0, // draw progress of the filament arriving at this star
      segTarget: 0,
      dot: node.querySelector('.sf-cn-dot'),
      lab: node.querySelector('.sf-cn-label'),
      halo: node.querySelector('.sf-cn-halo'),
    };
  }

  function slots() {
    W = el.clientWidth; H = el.clientHeight;
    const n = stars.length;
    const gap = n > 1 ? Math.min(o.gap, (W - 80) / (n - 1)) : 0;
    const total = gap * (n - 1);
    const x0 = (W - total) / 2;
    stars.forEach((s, i) => s.x.to(x0 + i * gap));
  }

  function current() {
    stars.forEach((s, i) => {
      s.node.classList.toggle('is-current', i === stars.length - 1);
      if (i === stars.length - 1) s.node.setAttribute('aria-current', 'page');
      else s.node.removeAttribute('aria-current');
    });
  }

  // Quadratic arc between consecutive stars, alternating above/below.
  const ctrl = (a, b, i) => {
    const y = H / 2;
    return [(a + b) / 2, y + (i % 2 ? 1 : -1) * Math.abs(b - a) * o.arc];
  };
  const qpoint = (p0, c, p1, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
  ];

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = false;
    let d = '';
    let ghost = '';
    stars.forEach((st, i) => {
      st.x.step(s); st.pop.step(s); st.text.step(s);
      if (st.seg !== st.segTarget) {
        const dir = Math.sign(st.segTarget - st.seg);
        st.seg = clamp(st.seg + (dir * dt) / o.draw, 0, 1);
        if ((dir > 0 && st.seg >= st.segTarget) || (dir < 0 && st.seg <= st.segTarget)) st.seg = st.segTarget;
        busy = true;
      }
      if (!st.x.resting || !st.pop.resting || !st.text.resting) busy = true;
      st.node.style.transform = `translate3d(${st.x.value.toFixed(2)}px, 0, 0)`;
      st.dot.style.transform = `scale(${Math.max(0, st.pop.value).toFixed(4)})`;
      st.lab.style.opacity = clamp(st.text.value).toFixed(3);
      st.lab.style.transform = `translate3d(-50%, ${((1 - clamp(st.text.value)) * 0.5).toFixed(3)}em, 0)`;
      if (i > 0) {
        const a = [stars[i - 1].x.value, H / 2];
        const b = [st.x.value, H / 2];
        const c = ctrl(a[0], b[0], i);
        ghost += `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]} `;
        const t = inOutCubic(st.seg);
        if (t > 0.001) {
          // de Casteljau split → partial filament up to t
          const c1 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
          const e = qpoint(a, c, b, t);
          d += `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${e[0].toFixed(1)},${e[1].toFixed(1)} `;
        }
      }
    });
    path.setAttribute('d', d || 'M0,0');
    glowPath.setAttribute('d', d || 'M0,0');
    trail.setAttribute('d', ghost || 'M0,0');
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  async function push(label) {
    const st = makeStar(label);
    const prev = stars[stars.length - 1];
    stars.push(st);
    st.x.set(prev ? prev.x.value : el.clientWidth / 2);
    slots();
    current();
    if (prefersReducedMotion() || !prev) {
      st.x.set(st.x.target); st.pop.set(1); st.text.set(1); st.seg = st.segTarget = 1;
      wake();
      return true;
    }
    st.segTarget = 1;
    wake();
    await wait(o.draw * 0.8);
    st.pop.to(1);
    st.pop.velocity = 14;
    await wait(120);
    st.text.to(1);
    wake();
    await wait(400);
    return true;
  }

  async function go(index) {
    if (index >= stars.length - 1) return true;
    const removed = stars.slice(index + 1).reverse();
    for (const st of removed) {
      st.text.to(0);
      st.pop.to(0);
      wake();
      await wait(90);
      st.segTarget = 0;
      wake();
      await wait(o.draw * 0.55);
    }
    removed.forEach((st) => st.node.remove());
    stars.splice(index + 1);
    current();
    slots();
    wake();
    return true;
  }

  function set(labels) {
    stars.splice(0).forEach((s) => s.node.remove());
    labels.forEach((l) => {
      const st = makeStar(l);
      stars.push(st);
      st.pop.set(1); st.text.set(1); st.seg = st.segTarget = 1;
    });
    slots();
    stars.forEach((st) => st.x.set(st.x.target));
    current();
    wake();
  }

  set(o.items);
  const ro = new ResizeObserver(() => { slots(); wake(); });
  ro.observe(el);

  return {
    el,
    push,
    go,
    pop: () => go(stars.length - 2),
    set,
    get items() { return stars.map((s) => s.label); },
    destroy() {
      if (off) off();
      ro.disconnect();
      el.innerHTML = '';
      el.classList.remove('sf-cn');
    },
  };
}

export default constellationCrumbs;
