/**
 * Curtain Lines
 * The editorial reveal, perfected: each rendered line rises out of its own
 * mask on a long exponential curve with a hinge rotation that straightens
 * as it lands. Optional per-character cascade inside each line. Lines are
 * re-measured on resize so wrapping is always correct.
 *
 *   const fx = curtainLines('.lede', { by: 'lines' });
 *   fx.play();
 */
import { split } from '../core/split.js';
import { resolve, debounce, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';

const DEFAULTS = {
  by: 'lines', // 'lines' | 'chars'
  duration: 1500,
  stagger: 110, // between lines
  charStagger: 18, // between chars when by = 'chars'
  rotate: 7, // hinge degrees
  ease: css.cinematic,
};

export function curtainLines(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  let parts = split(el, { chars: o.by === 'chars', words: true, lines: true, mask: true });
  let anims = [];
  let busy = false;

  const targets = () =>
    o.by === 'chars'
      ? parts.lines.map((line) => Array.from(line.querySelectorAll('.sf-char')))
      : parts.lines.map((line) => [line]);

  function cancel() {
    anims.forEach((a) => a.cancel());
    anims = [];
  }

  function run(forward) {
    cancel();
    const groups = targets();
    if (prefersReducedMotion()) {
      groups.flat().forEach((n) => (n.style.opacity = forward ? '' : '0'));
      return Promise.resolve(true);
    }
    busy = true;
    const hidden = { transform: `translate3d(0, 112%, 0) rotate(${o.rotate}deg)`, opacity: 1 };
    const out = { transform: `translate3d(0, -112%, 0) rotate(${-o.rotate * 0.4}deg)`, opacity: 1 };
    const shown = { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 };
    groups.forEach((nodes, li) => {
      nodes.forEach((node, ci) => {
        node.style.transformOrigin = '0% 100%';
        if (o.by === 'chars') node.style.display = 'inline-block';
        const delay = li * o.stagger + ci * o.charStagger;
        const a = node.animate(forward ? [hidden, shown] : [shown, out], {
          duration: forward ? o.duration : o.duration * 0.6,
          delay: forward ? delay : delay * 0.5,
          easing: forward ? o.ease : css.inQuart,
          fill: 'both',
        });
        anims.push(a);
      });
    });
    return Promise.all(anims.map((a) => a.finished))
      .then(() => {
        groups.flat().forEach((n) => {
          n.style.transform = forward ? '' : out.transform;
        });
        cancel();
        busy = false;
        return true;
      })
      .catch(() => false);
  }

  const relayout = debounce(() => {
    if (busy) return;
    parts = split(el, { chars: o.by === 'chars', words: true, lines: true, mask: true });
  }, 200);
  let lastWidth = el.clientWidth;
  const ro = new ResizeObserver(() => {
    if (el.clientWidth !== lastWidth) { lastWidth = el.clientWidth; relayout(); }
  });
  ro.observe(el);
  // Webfonts arriving late change line breaks — re-measure when they land.
  const onFonts = () => relayout();
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  return {
    el,
    play: () => run(true),
    reverse: () => run(false),
    destroy() {
      cancel();
      relayout.cancel();
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      parts.revert();
    },
  };
}

export default curtainLines;
