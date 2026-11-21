/**
 * Chromatic Shift
 * A lens slipping out of convergence and back. One continuous curve drives
 * the whole cut: the red, green and blue channels drift apart along a slowly
 * turning axis — with true lateral aberration, red scaled slightly larger
 * than blue toward the edges — peak at the middle, where the scenes
 * crossfade, then glide back into perfect registration on the new scene.
 *
 * Transforms and opacity only: channels are isolated by multiplying each
 * snapshot with a pure R/G/B plate, recombined with screen blending inside
 * an isolated group per scene, so every frame is pure compositing.
 *
 *   await chromaticShift(container).run(currentScene, nextScene);
 */
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { clamp, smoothstep, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-chroma',
  `.sf-chroma{position:absolute;pointer-events:none;z-index:40;overflow:hidden;background:#000}
.sf-chroma-group{position:absolute;inset:0;isolation:isolate;will-change:opacity}
.sf-chroma-ch{position:absolute;inset:0;mix-blend-mode:screen;isolation:isolate;will-change:transform}
.sf-chroma-plate{position:absolute;inset:0;mix-blend-mode:multiply}`
);

const DEFAULTS = {
  duration: 1300,
  spread: 0.035, // peak channel offset as a fraction of width
  aberration: 0.025, // peak radial scale difference between red and blue
  angle: 0, // degrees: base axis of separation
  sweep: 30, // degrees the axis turns through the cut
};

export function chromaticShift(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  let layer = null;
  let off = null;
  const cleanup = () => {
    off?.();
    off = null;
    layer?.remove();
    layer = null;
  };

  function group(src, box) {
    const g = document.createElement('div');
    g.className = 'sf-chroma-group';
    const chans = ['#ff0000', '#00ff00', '#0000ff'].map((plate) => {
      const d = document.createElement('div');
      d.className = 'sf-chroma-ch';
      const c = snapshot(src);
      c.style.cssText += `position:absolute;left:0;top:0;width:${box.w}px;height:${box.h}px;margin:0;visibility:visible`;
      const p = document.createElement('div');
      p.className = 'sf-chroma-plate';
      p.style.background = plate;
      d.append(c, p);
      g.appendChild(d);
      return d;
    });
    return { g, chans };
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
    const A = group(from, box);
    const B = group(to, box);
    B.g.style.opacity = '0';
    layer.append(A.g, B.g);
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';

    const S = box.w * o.spread;
    const k = [-1, 0, 1]; // R, G, B along the axis
    const zoom = [1, 0, -1]; // R larger, B smaller → radial lateral aberration
    const pose = (p) => {
      // Smooth bell: zero velocity at both ends, peak at the crossfade.
      const s = Math.pow(Math.sin(Math.PI * p), 2);
      const ang = ((o.angle + o.sweep * (p - 0.5)) * Math.PI) / 180;
      const ax = Math.cos(ang), ay = Math.sin(ang);
      // Overscan exactly enough that no shifted channel exposes the frame edge,
      // which also reads as the lens breathing as focus slips.
      const lens = 1 + s * (o.spread * 2.3 + o.aberration + 0.008);
      for (const grp of [A, B]) {
        grp.chans.forEach((el, i) => {
          const off = k[i] * S * s;
          const sc = lens * (1 + zoom[i] * o.aberration * s);
          el.style.transform = `translate3d(${(ax * off).toFixed(2)}px, ${(ay * off).toFixed(2)}px, 0) scale(${sc.toFixed(5)})`;
        });
      }
      const x = smoothstep(0.32, 0.68, p);
      B.g.style.opacity = x.toFixed(4);
      A.g.style.opacity = (1 - smoothstep(0.55, 0.75, p)).toFixed(4);
    };
    pose(0);
    await new Promise((done) => {
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        const p = clamp(t / o.duration);
        pose(p);
        if (p >= 1) { off(); off = null; done(); }
      });
    });
    to.style.visibility = '';
    cleanup();
    return true;
  }

  return { run, destroy: cleanup };
}

export default chromaticShift;
