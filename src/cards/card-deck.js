/**
 * Throwable Deck
 * A stack you can physically throw. The top card tracks your hand with a
 * pivot that depends on where you grabbed it; release with enough velocity
 * and it flies off along your throw, then slides back in at the bottom of
 * the pile while the rest of the stack springs up to fill the gap.
 *
 *   const deck = cardDeck('.deck');   // children are the cards
 *   deck.next('left');                 // programmatic throw
 */
import { tick, wait } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp } from '../core/utils.js';

injectStyle(
  'sf-deck',
  `.sf-deck{position:relative;touch-action:none;user-select:none}
.sf-deck>*{position:absolute;inset:0;will-change:transform;transform-origin:50% 50%}
.sf-deck>.is-top{cursor:grab}
.sf-deck>.is-top.is-grabbed{cursor:grabbing}`
);

const DEFAULTS = {
  visible: 4, // cards visible in the pile
  offset: 14, // px vertical step per card
  scaleStep: 0.055,
  threshold: 0.38, // fraction of width that commits a throw without velocity
  velocity: 650, // px/s that commits a throw
};

export function cardDeck(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  el.classList.add('sf-deck');
  const cfg = { stiffness: 210, damping: 22, precision: 0.05 };
  const make = (node) => ({
    node,
    x: new Spring(0, cfg),
    y: new Spring(0, cfg),
    r: new Spring(0, cfg),
    s: new Spring(1, { ...cfg, precision: 0.0005 }),
    a: new Spring(1, { ...cfg, precision: 0.001 }),
    vx: 0, vy: 0, vr: 0,
  });
  let pile = Array.from(el.children).map(make);
  const airborne = [];
  let drag = null;
  let off = null;

  function settle(snap = false) {
    pile.forEach((c, i) => {
      const depth = Math.min(i, o.visible);
      c.node.style.zIndex = String(pile.length - i);
      c.node.classList.toggle('is-top', i === 0);
      if (drag && drag.card === c) return;
      const ty = depth * o.offset, ts = 1 - depth * o.scaleStep, ta = i < o.visible ? 1 : 0;
      if (snap) { c.x.set(0); c.y.set(ty); c.r.set(0); c.s.set(ts); c.a.set(ta); }
      else { c.x.to(0); c.y.to(ty); c.r.to(0); c.s.to(ts); c.a.to(ta); }
    });
    wake();
  }

  function render(c) {
    c.node.style.transform = `translate3d(${c.x.value.toFixed(2)}px, ${c.y.value.toFixed(2)}px, 0) rotate(${c.r.value.toFixed(3)}deg) scale(${c.s.value.toFixed(4)})`;
    c.node.style.opacity = clamp(c.a.value).toFixed(3);
  }

  function frame(_, dt) {
    const s = dt / 1000;
    let busy = !!drag || airborne.length > 0;
    for (let i = airborne.length - 1; i >= 0; i--) {
      const c = airborne[i];
      c.x.value += c.vx * s;
      c.y.value += c.vy * s;
      c.r.value += c.vr * s;
      c.vy += 900 * s; // a touch of gravity on the arc
      render(c);
      if (Math.abs(c.x.value) > el.offsetWidth * 1.5 || c.y.value > el.offsetHeight * 1.6) {
        airborne.splice(i, 1);
        rejoin(c);
      }
    }
    for (const c of pile) {
      if (drag && drag.card === c) continue;
      c.x.step(s); c.y.step(s); c.r.step(s); c.s.step(s); c.a.step(s);
      if (!(c.x.resting && c.y.resting && c.r.resting && c.s.resting && c.a.resting)) busy = true;
      render(c);
    }
    if (!busy) { off(); off = null; }
  }
  const wake = () => { if (!off) off = tick(frame); };

  /** Slide a thrown card back in at the bottom of the pile. */
  function rejoin(c) {
    pile.push(c);
    const depth = Math.min(pile.length - 1, o.visible);
    c.x.set(0);
    c.y.set(depth * o.offset + 36);
    c.r.set(0);
    c.s.set(1 - depth * o.scaleStep - 0.06);
    c.a.set(0);
    settle();
  }

  function launch(c, vx, vy) {
    pile = pile.filter((x) => x !== c);
    airborne.push(c);
    const speed = Math.max(Math.hypot(vx, vy), 1500);
    const len = Math.hypot(vx, vy) || 1;
    c.vx = (vx / len) * speed;
    c.vy = (vy / len) * speed * 0.6;
    c.vr = Math.sign(c.vx) * 150;
    c.node.style.zIndex = String(pile.length + 10);
    c.node.classList.remove('is-top');
    settle();
  }

  const onDown = (e) => {
    const c = pile[0];
    if (!c || !c.node.contains(e.target)) return;
    const r = c.node.getBoundingClientRect();
    drag = {
      card: c, x0: e.clientX - c.x.value, y0: e.clientY - c.y.value,
      vx: 0, vy: 0, t: performance.now(), lx: e.clientX, ly: e.clientY,
      // Grab above centre → card swings one way; below → the other.
      pivot: (e.clientY - r.top) / r.height < 0.5 ? 1 : -1,
    };
    c.node.classList.add('is-grabbed');
    c.node.setPointerCapture?.(e.pointerId);
    wake();
  };
  const onMove = (e) => {
    if (!drag) return;
    const c = drag.card;
    const now = performance.now();
    const dts = Math.max((now - drag.t) / 1000, 0.008);
    drag.vx = drag.vx * 0.5 + ((e.clientX - drag.lx) / dts) * 0.5;
    drag.vy = drag.vy * 0.5 + ((e.clientY - drag.ly) / dts) * 0.5;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
    c.x.value = e.clientX - drag.x0;
    c.y.value = e.clientY - drag.y0;
    c.r.value = (c.x.value / el.offsetWidth) * 18 * drag.pivot;
    c.s.value = 1.03;
    render(c);
  };
  const onUp = () => {
    if (!drag) return;
    const { card: c, vx, vy } = drag;
    c.node.classList.remove('is-grabbed');
    drag = null;
    const far = Math.abs(c.x.value) > el.offsetWidth * o.threshold;
    const fast = Math.hypot(vx, vy) > o.velocity;
    if (fast) launch(c, vx, vy);
    else if (far) launch(c, Math.sign(c.x.value) * 1600, vy);
    else {
      c.x.velocity = vx * 0.25;
      c.y.velocity = vy * 0.25;
      settle();
    }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  settle(true);
  pile.forEach(render);

  return {
    el,
    /** Throw the top card programmatically. */
    next(direction = 'right') {
      const c = pile[0];
      if (!c || drag) return;
      const sgn = direction === 'left' ? -1 : 1;
      // A little wind-up before the throw reads as intent.
      c.r.to(-sgn * 4);
      c.x.to(-sgn * 18);
      wake();
      wait(160).then(() => pile[0] === c && !drag && launch(c, sgn * 1800, -420));
    },
    destroy() {
      if (off) off();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('sf-deck');
    },
  };
}

export default cardDeck;
