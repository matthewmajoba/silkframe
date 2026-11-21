/**
 * Fanned Hand
 * Cards held like a hand at the table, fanned on an arc around a pivot
 * below. Hover and the nearest card eases up out of the hand while its
 * neighbours make just enough room — a few degrees, falling off quickly —
 * all on soft, critically damped springs. The hovered card is chosen by
 * the pointer's angle around the pivot (with hysteresis), so overlapping
 * cards never flicker between each other as they move.
 *
 *   const hand = fanHand('.hand', { spread: 40 });
 *   hand.focus(2);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';

injectStyle(
  'sf-fan',
  `:where(.sf-fan){position:relative}
.sf-fan>*{position:absolute;left:50%;bottom:0;transform-origin:50% 100%;will-change:transform;cursor:pointer}`
);

const DEFAULTS = {
  spread: 40, // total arc in degrees
  radius: 2.8, // pivot distance in card heights (bigger = flatter arc)
  lift: 0.11, // hovered rise (card heights)
  straighten: 0.3, // how much the hovered card straightens (0–1)
  part: 3.2, // degrees the immediate neighbours make room
  scale: 1.025,
  breathe: 0.25, // degrees of idle breathing
  onSelect: null,
};

export function fanHand(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-fan');
  const cards = Array.from(el.children);
  const N = cards.length;
  // Critically damped: no wobble, just a soft arrival.
  const cfg = { stiffness: 140, damping: 24, precision: 0.005 };
  const state = cards.map((node, i) => ({
    node, i,
    a: new Spring(0, cfg),
    y: new Spring(0, cfg),
    s: new Spring(1, { ...cfg, precision: 0.0002 }),
  }));
  let hover = -1;
  let selected = -1;
  let t = 0;
  let off = null;
  const step = N > 1 ? o.spread / (N - 1) : 0;
  const baseAngle = (i) => -o.spread / 2 + i * step;

  function layout() {
    const focus = selected >= 0 ? selected : hover;
    state.forEach((c) => {
      let a = baseAngle(c.i);
      let y = 0, s = 1;
      if (focus >= 0) {
        const d = c.i - focus;
        if (d === 0) { a *= 1 - o.straighten; y = -o.lift; s = o.scale; }
        else a += Math.sign(d) * o.part * Math.exp(-(Math.abs(d) - 1) * 0.9);
      }
      c.a.to(a); c.y.to(y); c.s.to(s);
      c.node.style.zIndex = String(c.i === focus ? 100 : c.i + 1);
      c.node.setAttribute('aria-selected', String(c.i === selected));
    });
  }

  function frame(_, dt) {
    const sec = dt / 1000;
    t += sec;
    const h = cards[0]?.offsetHeight || 200;
    const R = h * o.radius;
    const resting = hover < 0 && selected < 0;
    for (const c of state) {
      c.a.step(sec); c.y.step(sec); c.s.step(sec);
      // Idle breathing: a slow, shallow wave through the hand.
      const breathe = resting ? Math.sin(t * 0.9 + c.i * 0.6) * o.breathe : 0;
      const ang = c.a.value + breathe;
      const rad = (ang * Math.PI) / 180;
      const x = Math.sin(rad) * R;
      const y = R - Math.cos(rad) * R + c.y.value * h;
      c.node.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px, 0) rotate(${ang.toFixed(3)}deg) scale(${c.s.value.toFixed(4)})`;
    }
  }

  // Pick the card whose arc angle is nearest the pointer's angle about the pivot.
  function pick(e) {
    const r = el.getBoundingClientRect();
    const h = cards[0]?.offsetHeight || 200;
    const R = h * o.radius;
    const px = r.left + r.width / 2, py = r.bottom + R;
    const ang = (Math.atan2(e.clientX - px, py - e.clientY) * 180) / Math.PI;
    const raw = (ang + o.spread / 2) / (step || 1);
    let i = Math.round(raw);
    // hysteresis: keep the current card until the pointer is clearly past the midpoint
    if (hover >= 0 && Math.abs(raw - hover) < 0.62) i = hover;
    return Math.max(0, Math.min(N - 1, i));
  }

  const onMove = (e) => {
    const i = pick(e);
    if (i !== hover) { hover = i; layout(); }
  };
  const onLeave = () => { hover = -1; layout(); };
  const onClick = (e) => {
    const i = pick(e);
    selected = selected === i ? -1 : i;
    layout();
    o.onSelect?.(selected);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('click', onClick);
  layout();
  state.forEach((c) => { c.a.set(c.a.target); c.y.set(c.y.target); c.s.set(c.s.target); });
  off = tick(frame);

  return {
    el,
    /** Programmatic hover (−1 = none). */
    focus(i) { hover = i; layout(); },
    select(i) { selected = i; layout(); },
    destroy() {
      off?.();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
      el.classList.remove('sf-fan');
    },
  };
}

export default fanHand;
