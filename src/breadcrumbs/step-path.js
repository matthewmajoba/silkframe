/**
 * Step Path
 * The breadcrumb for flows — checkout, onboarding, a wizard. Steps sit on a
 * track; progress pours along it like liquid on a spring. As the fill
 * reaches a step, that step completes: its ring fills and a check mark is
 * drawn in. The current step breathes. Completed steps are links back;
 * going back drains the track and un-draws the checks in reverse.
 *
 *   const steps = stepPath(nav, { steps: ['Cart', 'Shipping', 'Payment', 'Review'] });
 *   steps.set(2);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, smoothstep, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-steps',
  `:where(.sf-steps){position:relative}
.sf-steps{--sf-st-accent:#ffb547;--sf-st-dim:rgba(255,255,255,.14)}
.sf-steps ol{position:relative;display:flex;justify-content:space-between;margin:0;padding:0;list-style:none}
.sf-st-track,.sf-st-fill{position:absolute;top:1em;height:2px;border-radius:2px;margin-top:-1px}
.sf-st-track{background:var(--sf-st-dim)}
.sf-st-fill{background:linear-gradient(90deg,color-mix(in oklab,var(--sf-st-accent) 55%,transparent),var(--sf-st-accent));
  transform-origin:0 50%;box-shadow:0 0 .8em color-mix(in oklab,var(--sf-st-accent) 60%,transparent);will-change:transform}
.sf-st{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:.55em;background:none;border:0;padding:0;font:inherit;
  color:var(--sf-st-fg,rgba(255,255,255,.45));cursor:default;transition:color .4s}
.sf-st.is-done{cursor:pointer;color:var(--sf-st-done,rgba(255,255,255,.75))}
.sf-st.is-done:hover{color:#fff}
.sf-st[aria-current="step"]{color:var(--sf-st-active,#fff)}
.sf-st-dot{position:relative;width:2em;height:2em;border-radius:50%;background:var(--sf-st-bg,#121317);
  box-shadow:inset 0 0 0 2px var(--sf-st-dim);display:grid;place-items:center}
.sf-st-ring{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px var(--sf-st-accent);opacity:0}
.sf-st-core{position:absolute;inset:0;border-radius:50%;background:var(--sf-st-accent);transform:scale(0)}
.sf-st-pulse{position:absolute;inset:-.35em;border-radius:50%;box-shadow:0 0 0 1px var(--sf-st-accent);opacity:0}
.sf-st-num{position:relative;font-size:.78em;font-variant-numeric:tabular-nums}
.sf-st-check{position:absolute;inset:0;width:100%;height:100%}
.sf-st-check path{fill:none;stroke:#141416;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.sf-st-label{font-size:.82em;white-space:nowrap;letter-spacing:.01em}
.sf-st:focus-visible{outline:none}
.sf-st:focus-visible .sf-st-dot{outline:2px solid var(--sf-st-accent);outline-offset:3px}`
);

const DEFAULTS = {
  steps: [],
  index: 0,
  onNavigate: null,
};

export function stepPath(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-steps');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Progress');
  nav.innerHTML = '';
  const ol = document.createElement('ol');
  const track = document.createElement('div');
  track.className = 'sf-st-track';
  const fill = document.createElement('div');
  fill.className = 'sf-st-fill';
  ol.append(track, fill);
  nav.appendChild(ol);
  const N = o.steps.length;
  const nodes = o.steps.map((label, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-st';
    b.innerHTML = `<span class="sf-st-dot"><span class="sf-st-pulse"></span><span class="sf-st-ring"></span><span class="sf-st-core"></span><span class="sf-st-num">${i + 1}</span>
      <svg class="sf-st-check" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10.4l2.7 2.7L14.2 7.4" pathLength="1"/></svg></span><span class="sf-st-label"></span>`;
    b.querySelector('.sf-st-label').textContent = label;
    b.addEventListener('click', () => {
      if (i < current) { set(i); o.onNavigate?.(i, o.steps); }
    });
    li.appendChild(b);
    ol.appendChild(li);
    const q = (s) => b.querySelector(s);
    return { b, ring: q('.sf-st-ring'), core: q('.sf-st-core'), num: q('.sf-st-num'), check: q('.sf-st-check path'), pulse: q('.sf-st-pulse') };
  });
  let current = o.index;
  const progress = new Spring(current, { stiffness: 90, damping: 17, precision: 0.0005 });
  let centers = [];
  let off = null;
  let t = 0;

  function measure() {
    const base = ol.getBoundingClientRect();
    centers = nodes.map((n) => {
      const r = n.b.querySelector('.sf-st-dot').getBoundingClientRect();
      return r.left + r.width / 2 - base.left;
    });
    const L = centers[N - 1] - centers[0];
    track.style.left = fill.style.left = `${centers[0]}px`;
    track.style.width = fill.style.width = `${L}px`;
  }

  function frame(_, dt) {
    const s = dt / 1000;
    t += s;
    progress.step(s);
    const p = clamp(progress.value, 0, N - 1);
    fill.style.transform = `scaleX(${(p / Math.max(N - 1, 1)).toFixed(5)})`;
    nodes.forEach((n, i) => {
      // completion of step i happens as the fill passes it toward i+1
      const done = i < N - 1 ? smoothstep(i + 0.02, i + 0.35, p) : 0;
      const reached = smoothstep(i - 0.25, i, p); // fill has arrived at this node
      const isCurrent = i === current;
      n.core.style.transform = `scale(${done.toFixed(3)})`;
      n.check.style.strokeDashoffset = (1 - smoothstep(0.35, 1, done)).toFixed(3);
      n.check.style.strokeDasharray = '1';
      n.num.style.opacity = (1 - done).toFixed(3);
      n.ring.style.opacity = Math.max(reached, done).toFixed(3);
      // the current step breathes once the fill has settled on it
      const settled = isCurrent ? smoothstep(0.9, 1, 1 - Math.abs(p - i)) : 0;
      n.pulse.style.opacity = (settled * (0.45 + 0.35 * Math.sin(t * 2.4))).toFixed(3);
      n.pulse.style.transform = `scale(${(1 + settled * 0.08 * (0.5 + 0.5 * Math.sin(t * 2.4))).toFixed(4)})`;
    });
  }

  function mark() {
    nodes.forEach((n, i) => {
      n.b.classList.toggle('is-done', i < current);
      n.b.tabIndex = i < current ? 0 : -1;
      if (i === current) n.b.setAttribute('aria-current', 'step');
      else n.b.removeAttribute('aria-current');
      n.b.setAttribute('aria-label', `${o.steps[i]}${i < current ? ', completed' : i === current ? ', current step' : ''}`);
    });
  }

  function set(i) {
    current = clamp(Math.round(i), 0, N - 1);
    mark();
    if (prefersReducedMotion()) progress.set(current);
    else progress.to(current);
    return Promise.resolve(true);
  }

  measure();
  progress.set(current);
  mark();
  const ro = new ResizeObserver(measure);
  ro.observe(nav);
  off = tick(frame);

  return {
    el: nav,
    set,
    next: () => set(current + 1),
    back: () => set(current - 1),
    get index() { return current; },
    destroy() {
      off?.();
      ro.disconnect();
      nav.innerHTML = '';
      nav.classList.remove('sf-steps');
    },
  };
}

export default stepPath;
