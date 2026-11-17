/**
 * Silkframe — DOM snapshots for transitions.
 * Clones an element for use as a visual stand-in (shards, strips, slices):
 * ids are stripped, the copy is inert and hidden from assistive tech, and
 * <canvas> pixels are copied across (cloneNode leaves them blank).
 */
import { injectStyle } from './style.js';

// Clones must not replay CSS entrance animations — they show the settled state.
injectStyle('sf-snap', `.sf-snap,.sf-snap *{animation:none!important;transition:none!important}`);

export function snapshot(el) {
  const copy = el.cloneNode(true);
  copy.classList.add('sf-snap');
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  const src = el.querySelectorAll('canvas');
  if (src.length) {
    copy.querySelectorAll('canvas').forEach((c, i) => {
      try {
        c.getContext('2d').drawImage(src[i], 0, 0);
      } catch {
        /* tainted or webgl — leave blank */
      }
    });
  }
  return copy;
}

/** Size + position of `el` relative to `parent`'s padding box. */
export function boxIn(el, parent) {
  const a = el.getBoundingClientRect();
  const b = parent.getBoundingClientRect();
  return {
    x: a.left - b.left - parent.clientLeft,
    y: a.top - b.top - parent.clientTop,
    w: a.width,
    h: a.height,
  };
}

/** Ensure an element establishes a containing block for overlays. */
export function ensurePositioned(el) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
}
