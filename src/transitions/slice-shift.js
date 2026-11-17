/**
 * Slice Shift
 * Both scenes are cut into horizontal bands. Alternate bands of the
 * outgoing scene shear off left and right while the incoming bands slide
 * in from the opposite side — a precise, editorial cut with velocity skew
 * that snaps square as each band lands.
 *
 *   await sliceShift(container, { slices: 7 }).run(sceneA, sceneB);
 */
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-slices',
  `.sf-slices{position:absolute;pointer-events:none;z-index:40;overflow:hidden}
.sf-slice{position:absolute;left:0;right:0;overflow:hidden}
.sf-slice>.sf-slice-copy{position:absolute;left:0;margin:0;will-change:transform}`
);

const DEFAULTS = {
  slices: 7,
  duration: 1100,
  stagger: 55,
  skew: 14, // degrees of velocity skew mid-flight
  easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
};

export function sliceShift(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  let layer = null;
  let anims = [];
  const cleanup = () => {
    anims.forEach((a) => a.cancel());
    anims = [];
    layer?.remove();
    layer = null;
  };

  async function run(from, to) {
    cleanup();
    if (prefersReducedMotion()) {
      from.style.visibility = 'hidden';
      to.style.visibility = '';
      return true;
    }
    to.style.visibility = '';
    const box = boxIn(from, container);
    layer = document.createElement('div');
    layer.className = 'sf-slices';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
    const n = o.slices;
    const h = box.h / n;
    for (let i = 0; i < n; i++) {
      const band = document.createElement('div');
      band.className = 'sf-slice';
      band.style.top = `${(i * h).toFixed(2)}px`;
      band.style.height = `${(h + 1).toFixed(2)}px`;
      band.style.marginTop = '-0.5px';
      const dir = i % 2 ? 1 : -1;
      const delay = Math.abs(i - (n - 1) / 2) * o.stagger;
      [from, to].forEach((src, k) => {
        const copy = snapshot(src);
        copy.classList.add('sf-slice-copy');
        copy.style.top = `${(-i * h + 0.5).toFixed(2)}px`;
        copy.style.width = `${box.w}px`;
        copy.style.height = `${box.h}px`;
        copy.style.visibility = 'visible';
        band.appendChild(copy);
        const w = box.w; // exact: outgoing trailing edge meets incoming leading edge
        const frames = k === 0
          ? [
              { transform: 'translate3d(0,0,0) skewX(0deg)' },
              { transform: `translate3d(${dir * w * 0.5}px,0,0) skewX(${-dir * o.skew}deg)`, offset: 0.5 },
              { transform: `translate3d(${dir * w}px,0,0) skewX(0deg)` },
            ]
          : [
              { transform: `translate3d(${-dir * w}px,0,0) skewX(0deg)` },
              { transform: `translate3d(${-dir * w * 0.5}px,0,0) skewX(${-dir * o.skew}deg)`, offset: 0.5 },
              { transform: 'translate3d(0,0,0) skewX(0deg)' },
            ];
        anims.push(copy.animate(frames, { duration: o.duration, delay, easing: o.easing, fill: 'both' }));
      });
      layer.appendChild(band);
    }
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    to.style.visibility = '';
    cleanup();
    return true;
  }

  return { run, destroy: cleanup };
}

export default sliceShift;
