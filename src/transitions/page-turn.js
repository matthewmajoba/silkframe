/**
 * Page Turn
 * The page is peeled, not rotated. A hand grabs a corner (or the edge) and
 * drags it across the spread; the fold line is always the perpendicular
 * bisector between where the corner started and where the hand is, so the
 * flap is a true reflection of the sheet — its back already printed with
 * the next scene. A soft crease highlight, a bend shadow on the flat page
 * and a cast shadow on the revealed page make it read as paper.
 *
 * Four grabs are picked at random — bottom corner, top corner, a quick
 * flick and a mid-edge pull — and each run is jittered (where the fingers
 * land, how high the corner arcs, the tempo), so no two turns match.
 *
 *   await pageTurn(container).run(currentScene, nextScene);
 *   await pageTurn(container, { style: 'top', direction: 'back' }).run(a, b);
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { clamp, smoothstep, prefersReducedMotion } from '../core/utils.js';
import { cubicBezier } from '../core/ease.js';

injectStyle(
  'sf-pageturn',
  `.sf-pt{position:absolute;pointer-events:none;z-index:40;overflow:hidden}
.sf-pt>div{position:absolute;left:0;top:0}
.sf-pt-copy{position:absolute;left:0;top:0;margin:0}
.sf-pt-flap{transform-origin:0 0;will-change:transform,clip-path}
.sf-pt-band{position:absolute;transform-origin:0 50%;pointer-events:none}`
);

/* Grabs. corner: where along the free edge the hand takes the page (0 top → 1 bottom);
   lift: how far (fraction of height) the corner arcs toward the middle on its way over. */
const STYLES = {
  bottom: { duration: 1450, ease: cubicBezier(0.45, 0.05, 0.25, 1), corner: 1, lift: 0.34 },
  top: { duration: 1400, ease: cubicBezier(0.45, 0.05, 0.25, 1), corner: 0, lift: 0.3 },
  flick: { duration: 980, ease: cubicBezier(0.6, 0.02, 0.2, 1), corner: 0.94, lift: 0.52 },
  edge: { duration: 1300, ease: cubicBezier(0.5, 0, 0.3, 1), corner: 0.6, lift: 0.05 },
};

const DEFAULTS = {
  direction: 'forward', // 'forward': right page turns to the left; 'back': left page turns right
  style: 'random', // 'random' | 'bottom' | 'top' | 'flick' | 'edge'
  jitter: 1, // 0 = identical every time, 1 = natural variation
};

export function pageTurn(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  let layer = null;
  let off = null;
  let last = null;

  const cleanup = () => {
    off?.();
    off = null;
    layer?.remove();
    layer = null;
  };

  function copyOf(src, box) {
    const c = snapshot(src);
    c.classList.add('sf-pt-copy');
    c.style.width = `${box.w}px`;
    c.style.height = `${box.h}px`;
    c.style.visibility = 'visible';
    return c;
  }

  function pickStyle() {
    const forced = typeof window !== 'undefined' && window.__sfPageTurnStyle; // capture/debug hook
    if (forced && STYLES[forced]) return forced;
    if (o.style !== 'random' && STYLES[o.style]) return o.style;
    const keys = Object.keys(STYLES).filter((k) => k !== last);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  /** Clip a convex polygon by a half-plane through M with normal n (Sutherland–Hodgman). */
  function clipHalf(points, M, n, keepPositive) {
    const side = (p) => ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]) * (keepPositive ? 1 : -1);
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const sa = side(a), sb = side(b);
      if (sa >= 0) out.push(a);
      if ((sa >= 0) !== (sb >= 0)) {
        const t = sa / (sa - sb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  const poly = (pts) =>
    pts.length ? `polygon(${pts.map((p) => `${p[0].toFixed(2)}px ${p[1].toFixed(2)}px`).join(',')})` : 'polygon(0 0,0 0,0 0)';

  /** A long gradient band laid along the fold line, pointing along `dir`. */
  function band(parent, gradient) {
    const el = document.createElement('div');
    el.className = 'sf-pt-band';
    el.style.background = gradient;
    parent.appendChild(el);
    return el;
  }
  function placeBand(el, M, dir, L, width) {
    el.style.width = `${width.toFixed(1)}px`;
    el.style.height = `${(2 * L).toFixed(1)}px`;
    el.style.left = `${M[0].toFixed(2)}px`;
    el.style.top = `${(M[1] - L).toFixed(2)}px`;
    el.style.transform = `rotate(${Math.atan2(dir[1], dir[0]).toFixed(5)}rad)`;
  }

  async function run(from, to) {
    cleanup();
    if (prefersReducedMotion()) {
      from.style.visibility = 'hidden';
      to.style.visibility = '';
      return true;
    }
    const name = pickStyle();
    last = name;
    const S = STYLES[name];
    const J = o.jitter;
    const rnd = (a) => (Math.random() * 2 - 1) * a * J;
    const duration = S.duration * (1 + rnd(0.1));
    const cornerY = clamp(S.corner + rnd(0.05));
    const lift = Math.max(0.02, S.lift * (1 + rnd(0.25)));

    to.style.visibility = '';
    const box = boxIn(from, container);
    const W = box.w, H = box.h, sx = W / 2;
    const fwd = o.direction !== 'back';
    // Geometry is solved in "forward" space and mirrored for the backward turn.
    const mx = (p) => (fwd ? p : [W - p[0], p[1]]);

    layer = document.createElement('div');
    layer.className = 'sf-pt';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${W}px;height:${H}px`;
    const holder = (clip) => {
      const d = document.createElement('div');
      d.style.width = `${W}px`;
      d.style.height = `${H}px`;
      if (clip) d.style.clipPath = clip;
      layer.appendChild(d);
      return d;
    };
    const halfClip = (side) => (side === 'left' ? `inset(0 ${W - sx}px 0 0)` : `inset(0 0 0 ${sx}px)`);
    const stayS = fwd ? 'left' : 'right', turnS = fwd ? 'right' : 'left';
    const stay = holder(halfClip(stayS));
    stay.appendChild(copyOf(from, box));
    const reveal = holder(halfClip(turnS));
    reveal.appendChild(copyOf(to, box));
    const revealShade = holder(''); // cast shadow, clipped to the uncovered area
    const shadow = band(revealShade, 'linear-gradient(90deg, rgba(0,0,0,.5), rgba(0,0,0,.18) 35%, rgba(0,0,0,0))');
    const front = holder('');
    front.appendChild(copyOf(from, box));
    const bend = band(front, 'linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,.06) 40%, rgba(0,0,0,0))');
    // Flap: the sheet's back (incoming scene mirrored about the spine), reflected over the fold.
    const flap = holder('');
    flap.classList.add('sf-pt-flap');
    const mirror = document.createElement('div');
    mirror.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:matrix(-1,0,0,1,${2 * sx},0)`;
    mirror.appendChild(copyOf(to, box));
    flap.appendChild(mirror);
    const crease = band(flap, 'linear-gradient(90deg, rgba(0,0,0,.34), rgba(255,250,240,.2) 7%, rgba(255,250,240,.05) 22%, rgba(0,0,0,.06) 60%, rgba(0,0,0,.14))');
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';

    // Forward-space geometry.
    const page = [[sx, 0], [W, 0], [W, H], [sx, H]];
    const C = [W, cornerY * H];
    const Cend = [2 * sx - W, C[1]]; // the corner lands mirrored across the spine
    const towardMiddle = cornerY > 0.5 ? -1 : 1;
    const K = [sx, C[1] + towardMiddle * lift * H]; // arc of the hand
    const pw = W - sx;
    const sTop = [sx, 0], sBot = [sx, H];
    const L = Math.hypot(pw, H) * 2;
    const nearSpine = cornerY >= 0.5 ? sBot : sTop;
    const farSpine = cornerY >= 0.5 ? sTop : sBot;
    const rNear = Math.hypot(C[0] - nearSpine[0], C[1] - nearSpine[1]);
    const rFar = Math.hypot(C[0] - farSpine[0], C[1] - farSpine[1]);
    const constrain = (D) => {
      // Paper can't stretch: the grabbed point stays within reach of the spine.
      for (const [c, r] of [[nearSpine, rNear], [farSpine, rFar]]) {
        const dx = D[0] - c[0], dy = D[1] - c[1];
        const d = Math.hypot(dx, dy);
        if (d > r) D = [c[0] + (dx / d) * r, c[1] + (dy / d) * r];
      }
      return D;
    };

    const pose = (p) => {
      const t = S.ease(p);
      const u = 1 - t;
      let D = [u * u * C[0] + 2 * u * t * K[0] + t * t * Cend[0], u * u * C[1] + 2 * u * t * K[1] + t * t * Cend[1]];
      D = constrain(D);
      const dx = D[0] - C[0], dy = D[1] - C[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.5) {
        front.style.clipPath = poly(page.map(mx));
        flap.style.clipPath = poly([]);
        revealShade.style.clipPath = poly([]);
        return;
      }
      const n = [dx / len, dy / len];
      const M = [(C[0] + D[0]) / 2, (C[1] + D[1]) / 2];
      const folded = clipHalf(page, M, n, false); // the corner's side
      const flat = clipHalf(page, M, n, true);
      const Ms = mx(M);
      const ns = fwd ? n : [-n[0], n[1]];
      front.style.clipPath = poly(flat.map(mx));
      revealShade.style.clipPath = poly(folded.map(mx));
      flap.style.clipPath = poly(folded.map(mx));
      // Reflection across the fold line: P' = P − 2((P − M)·n)n.
      const a = 1 - 2 * ns[0] * ns[0], b = -2 * ns[0] * ns[1], d = 1 - 2 * ns[1] * ns[1];
      const k = 2 * (Ms[0] * ns[0] + Ms[1] * ns[1]);
      flap.style.transform = `matrix(${a.toFixed(5)},${b.toFixed(5)},${b.toFixed(5)},${d.toFixed(5)},${(k * ns[0]).toFixed(2)},${(k * ns[1]).toFixed(2)})`;
      // Shading follows the fold and deepens while the sheet is lifted.
      const reach = Math.min(len * 0.5, pw);
      const lifted = Math.sin(Math.PI * t);
      const into = [-ns[0], -ns[1]]; // from the fold toward the corner's side
      placeBand(shadow, Ms, into, L, 18 + reach * 0.55 * (0.4 + lifted));
      shadow.style.opacity = (0.35 + 0.65 * lifted).toFixed(3);
      placeBand(bend, Ms, ns, L, 14 + reach * 0.25);
      bend.style.opacity = (0.5 + 0.5 * lifted).toFixed(3);
      // Flap-local coordinates are pre-reflection, and the fold maps to itself.
      placeBand(crease, Ms, into, L, Math.max(30, reach * 1.1));
      crease.style.opacity = (0.55 + 0.45 * (1 - smoothstep(0.85, 1, t))).toFixed(3);
    };

    pose(0);
    await new Promise((done) => {
      let tt = 0;
      off = tick((_, dt) => {
        tt += dt;
        const p = clamp(tt / duration);
        pose(p);
        if (p >= 1) { off(); off = null; done(); }
      });
    });
    to.style.visibility = '';
    cleanup();
    return name;
  }

  return { run, destroy: cleanup, styles: Object.keys(STYLES) };
}

export default pageTurn;
