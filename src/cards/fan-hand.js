/**
 * Fanned Hand
 * Cards held like a hand at the table: fanned on an arc around a pivot
 * below. Hover a card and it rises out of the hand, straightening, while
 * its neighbours lean away on springs with a falloff; the whole hand
 * breathes gently at rest. Click to select — the card lifts and holds.
 *
 *   const hand = fanHand('.hand', { spread: 46 });
 *   hand.focus(2);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve } from '../core/utils.js';

injectStyle(
  'sf-fan',
  `.sf-fan{position:relative}
.sf-fan>*{position:absolute;left:50%;bottom:0;transform-origin:50% 100%;will-change:transform;cursor:pointer}`
);

const DEFAULTS = {
  spread: 44, // total arc in degrees
  radius: 2.6, // pivot distance in card heights (bigger = flatter arc)
  lift: 0.22, // hovered rise (card heights)
  part: 9, // degrees neighbours lean away
  onSelect: null,
};

export function fanHand(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-fan');
  const cards = Array.from(el.children);
  const N = cards.length;
  const cfg = { stiffness: 170, damping: 17, precision: 0.01 };
  const state = cards.map((node, i) => ({ node, i, a: new Spring(0, cfg), y: new Spring(0, cfg), s: new Spring(1, { ...cfg, precision: 0.0005 }) }));
  let hover = -1;
  let selected = -1;
  let t = 0;
  let off = null;

  function layout() {
    const step = N > 1 ? o.spread / (N - 1) : 0;
    const focus = selected >= 0 ? selected : hover;
    state.forEach((c) => {
      let a = -o.spread / 2 + c.i * step;
      let y = 0, s = 1;
      if (focus >= 0) {
        const d = c.i - focus;
        if (d === 0) { a *= 0.35; y = -o.lift; s = 1.06; }
        else a += Math.sign(d) * o.part * Math.exp(-(Math.abs(d) - 1) / 1.6);
      }
      c.a.to(a); c.y.to(y); c.s.to(s);
      c.node.style.zIndex = String(c.i === focus ? 100 : c.i + 1);
    });
  }

  function frame(_, dt) {
    const sec = dt / 1000;
    t += sec;
    const h = cards[0]?.offsetHeight || 200;
    const R = h * o.radius;
    for (const c of state) {
      c.a.step(sec); c.y.step(sec); c.s.step(sec);
      // Idle breathing: a slow wave through the hand.
      const breathe = Math.sin(t * 1.1 + c.i * 0.7) * 0.6;
      const ang = c.a.value + (hover < 0 && selected < 0 ? breathe : 0);
      const rad = (ang * Math.PI) / 180;
      const x = Math.sin(rad) * R;
      const y = R - Math.cos(rad) * R + c.y.value * h;
      c.node.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px, 0) rotate(${ang.toFixed(3)}deg) scale(${c.s.value.toFixed(4)})`;
    }
  }

  const onOver = (e) => {
    const i = cards.findIndex((c) => c.contains(e.target));
    if (i !== hover) { hover = i; layout(); }
  };
  const onLeave = () => { hover = -1; layout(); };
  const onClick = (e) => {
    const i = cards.findIndex((c) => c.contains(e.target));
    if (i < 0) return;
    selected = selected === i ? -1 : i;
    layout();
    o.onSelect?.(selected);
  };
  el.addEventListener('pointerover', onOver);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('click', onClick);
  layout();
  off = tick(frame);

  return {
    el,
    /** Programmatic hover (−1 = none). */
    focus(i) { hover = i; layout(); },
    select(i) { selected = i; layout(); },
    destroy() {
      off?.();
      el.removeEventListener('pointerover', onOver);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
      el.classList.remove('sf-fan');
    },
  };
}

export default fanHand;
