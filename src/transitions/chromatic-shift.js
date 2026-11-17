/**
 * Chromatic Shift
 * A lens-breaking cut. The outgoing scene separates into its red, green and
 * blue channels, which shear apart and soften as if the projector lost
 * convergence; through the flare the incoming scene's channels slide in
 * from the opposite sides and recombine into a perfect image. Channels are
 * isolated with a multiply blend against a pure R/G/B plate (GPU blending,
 * no filter rasterisation), so frames only move composited layers.
 *
 *   await chromaticShift(container).run(currentScene, nextScene);
 */
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-chroma',
  `.sf-chroma{position:absolute;pointer-events:none;z-index:40;overflow:hidden;isolation:isolate;background:#000}
.sf-chroma>.sf-chroma-ch{position:absolute;inset:0;mix-blend-mode:screen;isolation:isolate;will-change:transform,opacity,filter}
.sf-chroma-plate{position:absolute;inset:0;mix-blend-mode:multiply}`
);

const DEFAULTS = {
  duration: 1250,
  spread: 0.06, // channel offset as a fraction of width
  angle: 0, // degrees of the shear direction
  easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
};

export function chromaticShift(container, options = {}) {
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

  function channels(src, box) {
    return ['#ff0000', '#00ff00', '#0000ff'].map((plate) => {
      // channel = scene × pure plate (multiply); channels recombine via screen.
      const d = document.createElement('div');
      d.className = 'sf-chroma-ch';
      const c = snapshot(src);
      c.style.cssText += `position:absolute;left:0;top:0;width:${box.w}px;height:${box.h}px;margin:0;visibility:visible`;
      const p = document.createElement('div');
      p.className = 'sf-chroma-plate';
      p.style.background = plate;
      d.append(c, p);
      return d;
    });
  }

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
    layer.className = 'sf-chroma';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
    const out = channels(from, box);
    const inn = channels(to, box);
    layer.append(...out, ...inn);
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';
    const D = o.duration;
    const a = (o.angle * Math.PI) / 180;
    const S = box.w * o.spread;
    const dx = Math.cos(a) * S, dy = Math.sin(a) * S;
    const k = [-1, 0, 1]; // R, G, B directions
    const T = { duration: D, easing: o.easing, fill: 'both' };
    out.forEach((el, i) => {
      anims.push(el.animate(
        [
          { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, filter: 'blur(0px)' },
          { transform: `translate3d(${k[i] * dx * 1.2}px,${k[i] * dy * 1.2}px,0) scale(${1.14 + 0.03 * (i === 1)})`, opacity: 0, filter: 'blur(6px)', offset: 0.62 },
          { transform: `translate3d(${k[i] * dx * 1.2}px,${k[i] * dy * 1.2}px,0) scale(1.16)`, opacity: 0, filter: 'blur(6px)' },
        ],
        T
      ));
    });
    inn.forEach((el, i) => {
      anims.push(el.animate(
        [
          { transform: `translate3d(${-k[i] * dx * 1.2}px,${-k[i] * dy * 1.2}px,0) scale(1.16)`, opacity: 0, filter: 'blur(6px)' },
          { transform: `translate3d(${-k[i] * dx * 1.2}px,${-k[i] * dy * 1.2}px,0) scale(1.16)`, opacity: 0, filter: 'blur(6px)', offset: 0.34 },
          { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, filter: 'blur(0px)' },
        ],
        T
      ));
    });
    await Promise.all(anims.map((x) => x.finished)).catch(() => {});
    to.style.visibility = '';
    cleanup();
    return true;
  }

  return { run, destroy: cleanup };
}

export default chromaticShift;
