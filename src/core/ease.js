/**
 * Silkframe — easing library.
 * Every function maps t ∈ [0, 1] → progress (back/elastic curves overshoot).
 * `css` mirrors the curves that have exact cubic-bezier equivalents so the
 * same feel can be used with CSS transitions and the Web Animations API.
 */

export const linear = (t) => t;

export const inSine = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const outSine = (t) => Math.sin((t * Math.PI) / 2);
export const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export const inCubic = (t) => t * t * t;
export const outCubic = (t) => 1 - Math.pow(1 - t, 3);
export const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const inQuart = (t) => t * t * t * t;
export const outQuart = (t) => 1 - Math.pow(1 - t, 4);
export const inOutQuart = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

export const inQuint = (t) => t * t * t * t * t;
export const outQuint = (t) => 1 - Math.pow(1 - t, 5);
export const inOutQuint = (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

export const inExpo = (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
export const outExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inOutExpo = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;

export const inCirc = (t) => 1 - Math.sqrt(1 - t * t);
export const outCirc = (t) => Math.sqrt(1 - Math.pow(t - 1, 2));
export const inOutCirc = (t) =>
  t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

export const outBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const back = (s = 1.70158) => (t) => outBack(t, s);

export const outElastic = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

/** Port of WebKit's UnitBezier solver — exact match for CSS cubic-bezier(). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solveX = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-7) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40 && hi - lo > 1e-7; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) return t;
      if (x > v) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveX(x)));
}

/* Signature curves — tuned for a filmic feel. */
export const cinematic = cubicBezier(0.16, 1, 0.3, 1); // long, luxurious settle
export const silk = cubicBezier(0.65, 0, 0.35, 1); // symmetric, weighty in-out
export const snap = cubicBezier(0.85, 0, 0.15, 1); // dramatic hold → release
export const glide = cubicBezier(0.22, 1, 0.36, 1); // softer cinematic
export const anticipate = cubicBezier(0.68, -0.35, 0.32, 1.25); // wind-up + overshoot

export const css = {
  cinematic: 'cubic-bezier(0.16, 1, 0.3, 1)',
  silk: 'cubic-bezier(0.65, 0, 0.35, 1)',
  snap: 'cubic-bezier(0.85, 0, 0.15, 1)',
  glide: 'cubic-bezier(0.22, 1, 0.36, 1)',
  anticipate: 'cubic-bezier(0.68, -0.35, 0.32, 1.25)',
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOutExpo: 'cubic-bezier(0.87, 0, 0.13, 1)',
  outQuart: 'cubic-bezier(0.25, 1, 0.5, 1)',
  inOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',
  inQuart: 'cubic-bezier(0.5, 0, 0.75, 0)',
  outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};
