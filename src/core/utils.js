/**
 * Silkframe — small shared helpers.
 */

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const mapRange = (v, a1, b1, a2, b2, clamped = true) => {
  const t = invLerp(a1, b1, v);
  return lerp(a2, b2, clamped ? clamp(t) : t);
};
/** Smooth 0→1 window of t between edge0 and edge1. */
export const smoothstep = (edge0, edge1, t) => {
  const x = clamp((t - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};
/** Local progress of a staggered item inside a global timeline. */
export const segment = (t, start, end) => clamp((t - start) / (end - start));

/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda, dtMs) => 1 - Math.exp(-lambda * (dtMs / 1000));

export const resolve = (target, root = document) =>
  typeof target === 'string' ? root.querySelector(target) : target;

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

/** Observe size changes; returns a disconnect function. */
export function onResize(el, fn) {
  let first = true;
  const ro = new ResizeObserver(() => {
    if (first) { first = false; return; }
    fn();
  });
  ro.observe(el);
  return () => ro.disconnect();
}

/** Debounce helper for resize handling. */
export function debounce(fn, ms = 150) {
  let id;
  const d = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
  d.cancel = () => clearTimeout(id);
  return d;
}

/** Create an element with props + children in one call. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Collects teardown functions so effects can clean up in one call. */
export function disposer() {
  const fns = [];
  return {
    add(fn) { if (typeof fn === 'function') fns.push(fn); return fn; },
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      fns.push(() => target.removeEventListener(type, fn, opts));
    },
    run() { while (fns.length) { try { fns.pop()(); } catch (e) { console.error(e); } } },
  };
}

/** Pointer position relative to an element's box. */
export function localPoint(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
}

export const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

let uid = 0;
export const uniqueId = (prefix = 'sf') => `${prefix}-${(++uid).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
