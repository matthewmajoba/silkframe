/**
 * Portal Expand
 * A shared-element expansion. The detail view is revealed through a clip
 * that starts exactly on the tapped card — same position, same radius —
 * and opens to fill the frame while the card's artwork scales into the
 * hero. Siblings recede into depth and soften; detail copy rises in after
 * the portal lands. close() runs the whole choreography in reverse.
 *
 *   const portal = expandCard(container);
 *   portal.open(card, detailElement);   portal.close();
 */
import { injectStyle } from '../core/style.js';
import { css } from '../core/ease.js';
import { boxIn, ensurePositioned } from '../core/snapshot.js';
import { prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-portal',
  `.sf-portal{position:absolute;inset:0;z-index:40;overflow:hidden;visibility:hidden}
.sf-portal [data-portal-rise]{will-change:transform,opacity}`
);

const DEFAULTS = {
  duration: 900,
  recede: 0.92, // sibling scale while open
  siblings: null, // NodeList / array of elements that recede
};

export function expandCard(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  let state = null; // { card, detail, anims }

  const radius = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const insetFor = (box, W, H, r) =>
    `inset(${box.y.toFixed(1)}px ${(W - box.x - box.w).toFixed(1)}px ${(H - box.y - box.h).toFixed(1)}px ${box.x.toFixed(1)}px round ${r}px)`;

  function choreograph(card, detail, opening) {
    const W = container.clientWidth, H = container.clientHeight;
    const box = boxIn(card, container);
    const r = radius(card);
    const from = insetFor(box, W, H, r);
    const to = `inset(0px 0px 0px 0px round 0px)`;
    const D = o.duration;
    const ease = opening ? css.cinematic : css.inOutQuart;
    const anims = [];
    detail.style.visibility = 'visible';
    anims.push(detail.animate([{ clipPath: opening ? from : to }, { clipPath: opening ? to : from }], {
      duration: D, easing: ease, fill: 'both',
    }));
    // The hero artwork starts framed like the card, then settles full-bleed.
    const hero = detail.querySelector('[data-portal-hero]');
    if (hero) {
      // Map the hero's resting box onto the card's box (cover-fit).
      const hb = boxIn(hero, container);
      const s = Math.max(box.w / hb.w, box.h / hb.h);
      const tx = box.x + box.w / 2 - (hb.x + hb.w / 2), ty = box.y + box.h / 2 - (hb.y + hb.h / 2);
      const a = `translate(${tx}px, ${ty}px) scale(${s})`;
      anims.push(hero.animate([{ transform: opening ? a : 'none' }, { transform: opening ? 'none' : a }], {
        duration: D, easing: ease, fill: 'both',
      }));
    }
    const rise = Array.from(detail.querySelectorAll('[data-portal-rise]'));
    rise.forEach((n, i) => {
      anims.push(n.animate(
        opening
          ? [{ opacity: 0, transform: 'translate3d(0, 28px, 0)' }, { opacity: 1, transform: 'none' }]
          : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 16px, 0)' }],
        opening
          ? { duration: D * 0.9, delay: D * 0.35 + i * 70, easing: css.cinematic, fill: 'both' }
          : { duration: D * 0.35, delay: i * 30, easing: css.inQuart, fill: 'both' }
      ));
    });
    const sibs = o.siblings ? Array.from(o.siblings) : [];
    sibs.forEach((s) => {
      if (s === card) return;
      anims.push(s.animate(
        [
          { transform: 'none', filter: 'blur(0px) brightness(1)', opacity: 1 },
          { transform: `scale(${o.recede})`, filter: 'blur(3px) brightness(0.6)', opacity: 0.55 },
        ],
        { duration: D, easing: ease, fill: 'both', direction: opening ? 'normal' : 'reverse' }
      ));
    });
    // Hide the source card while its stand-in is in flight.
    card.style.visibility = 'hidden';
    return anims;
  }

  async function open(card, detail) {
    if (state) return;
    if (!detail.classList.contains('sf-portal')) detail.classList.add('sf-portal');
    if (detail.parentElement !== container) container.appendChild(detail);
    if (prefersReducedMotion()) {
      detail.style.visibility = 'visible';
      state = { card, detail, anims: [] };
      return true;
    }
    const anims = choreograph(card, detail, true);
    state = { card, detail, anims };
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    return true;
  }

  async function close() {
    if (!state) return;
    const { card, detail, anims: prev } = state;
    if (prefersReducedMotion()) {
      detail.style.visibility = 'hidden';
      card.style.visibility = '';
      state = null;
      return true;
    }
    prev.forEach((a) => a.cancel());
    const anims = choreograph(card, detail, false);
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    card.style.visibility = '';
    detail.style.visibility = 'hidden';
    anims.forEach((a) => a.cancel());
    state = null;
    return true;
  }

  return {
    open,
    close,
    get isOpen() { return !!state; },
    destroy() {
      state?.anims.forEach((a) => a.cancel());
      if (state) state.card.style.visibility = '';
      state = null;
    },
  };
}

export default expandCard;
