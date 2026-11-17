/**
 * Toast Stack
 * Notifications with physical depth. New toasts rise in on a spring and
 * push older ones back into a tidy, receding pile; hover the pile and it
 * fans out into a readable list. Swipe a toast sideways to dismiss it —
 * it follows your hand and flicks away with your velocity.
 *
 *   const toasts = toastStack(container);
 *   toasts.show({ title: 'Render complete', body: 'hero.mp4 · 4K' });
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { clamp } from '../core/utils.js';

injectStyle(
  'sf-toasts',
  `.sf-toasts{position:absolute;right:var(--sf-toast-inset,1.4em);bottom:var(--sf-toast-inset,1.4em);width:var(--sf-toast-w,22em);height:0;z-index:70}
.sf-toast{position:absolute;right:0;bottom:0;width:100%;box-sizing:border-box;padding:.95em 1.1em;border-radius:.9em;
  background:var(--sf-toast-bg,rgba(24,23,30,.92));color:var(--sf-toast-fg,#efe9df);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 .8em 2em -.6em rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);display:grid;grid-template-columns:auto 1fr;gap:.2em .85em;
  align-items:center;transform-origin:50% 100%;will-change:transform,opacity;touch-action:pan-y;cursor:grab;user-select:none}
.sf-toast i{grid-row:span 2;width:.6em;height:.6em;border-radius:50%;background:var(--sf-toast-accent,#7ee0a8);box-shadow:0 0 .8em currentColor}
.sf-toast b{font-weight:600;font-size:.95em}
.sf-toast span{font-size:.82em;opacity:.6}`
);

const DEFAULTS = {
  max: 4,
  gap: 10, // px between expanded toasts
  peek: 11, // px each stacked toast shows behind
  duration: 4200, // auto-dismiss (0 = never)
};

export function toastStack(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const host = document.createElement('div');
  host.className = 'sf-toasts';
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'Notifications');
  host.setAttribute('aria-live', 'polite');
  container.appendChild(host);
  const toasts = [];
  let expanded = false;
  let off = null;

  function make({ title, body, accent }) {
    const el = document.createElement('div');
    el.className = 'sf-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<i></i><b></b><span></span>';
    el.querySelector('b').textContent = title;
    el.querySelector('span').textContent = body || '';
    if (accent) el.querySelector('i').style.background = accent;
    host.appendChild(el);
    const cfg = { stiffness: 230, damping: 24, precision: 0.05 };
    const t = {
      el,
      y: new Spring(60, cfg), x: new Spring(0, cfg),
      s: new Spring(0.9, { ...cfg, precision: 0.0005 }), a: new Spring(0, { ...cfg, precision: 0.002 }),
      h: 0, life: o.duration, leaving: false, drag: null,
    };
    el.addEventListener('pointerdown', (e) => {
      t.drag = { x0: e.clientX - t.x.value, lx: e.clientX, lt: performance.now(), v: 0 };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!t.drag) return;
      const now = performance.now();
      t.drag.v = t.drag.v * 0.5 + ((e.clientX - t.drag.lx) / Math.max((now - t.drag.lt) / 1000, 0.008)) * 0.5;
      t.drag.lx = e.clientX; t.drag.lt = now;
      t.x.value = e.clientX - t.drag.x0;
      t.x.velocity = 0;
      wake();
    });
    const end = () => {
      if (!t.drag) return;
      const v = t.drag.v;
      t.drag = null;
      if (Math.abs(t.x.value) > 90 || Math.abs(v) > 600) dismiss(t, Math.sign(t.x.value || v) * 1, v);
      else t.x.to(0);
      wake();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return t;
  }

  function layout() {
    const live = toasts.filter((t) => !t.leaving);
    let stackY = 0;
    live.forEach((t, i) => {
      t.h = t.el.offsetHeight;
      const depth = i; // 0 = newest (front)
      if (expanded) {
        t.y.to(-stackY);
        t.s.to(1);
        t.a.to(1);
        stackY += t.h + o.gap;
      } else {
        t.y.to(-depth * o.peek);
        t.s.to(1 - depth * 0.05);
        t.a.to(depth >= o.max ? 0 : 1 - depth * 0.18);
      }
      t.el.style.zIndex = String(100 - depth);
    });
    wake();
  }

  function dismiss(t, dir = 1, v = 0) {
    if (t.leaving) return;
    t.leaving = true;
    t.x.stiffness = 90;
    t.x.velocity = v || dir * 900;
    t.x.to(dir * 420);
    t.a.to(0);
    layout();
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = false;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      if (!t.drag) t.x.step(s);
      t.y.step(s); t.s.step(s); t.a.step(s);
      if (!expanded && !t.leaving && o.duration && i === 0) {
        t.life -= dt;
        if (t.life <= 0) dismiss(t, 1);
      }
      const drift = t.drag || t.leaving ? clamp(t.x.value / 6, -14, 14) : 0;
      t.el.style.transform = `translate3d(${t.x.value.toFixed(2)}px, ${t.y.value.toFixed(2)}px, 0) rotate(${(drift * 0.25).toFixed(2)}deg) scale(${t.s.value.toFixed(4)})`;
      t.el.style.opacity = clamp(t.a.value).toFixed(3);
      t.el.style.pointerEvents = t.a.value < 0.2 ? 'none' : '';
      if (t.leaving && t.a.value < 0.02) {
        t.el.remove();
        toasts.splice(i, 1);
        continue;
      }
      if (!(t.x.resting && t.y.resting && t.s.resting && t.a.resting) || t.drag) busy = true;
      if (!t.leaving && o.duration && toasts[0] === t && !expanded) busy = true;
    }
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  host.addEventListener('pointerenter', () => { expanded = true; layout(); });
  host.addEventListener('pointerleave', () => { expanded = false; layout(); });

  function show(data) {
    const t = make(data);
    toasts.unshift(t);
    // keep the pile bounded
    toasts.filter((x) => !x.leaving).slice(o.max + 1).forEach((x) => dismiss(x, 1));
    layout();
    return { dismiss: () => dismiss(t, 1) };
  }

  return {
    show,
    clear() { toasts.forEach((t) => dismiss(t, 1)); },
    destroy() {
      if (off) off();
      host.remove();
    },
  };
}

export default toastStack;
