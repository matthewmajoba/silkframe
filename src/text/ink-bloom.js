/**
 * Ink Bloom
 * Words bloom out of the page like ink hitting wet paper: tiny pigment
 * cores appear first, swell through a turbulent displacement field, then
 * the alpha threshold relaxes to identity so the final frame is pixel-
 * identical to plain, anti-aliased text (no pop when the filter detaches).
 *
 *   const fx = inkBloom('.title', { stagger: 160 });
 *   fx.play();
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { clamp, lerp, resolve, smoothstep, svg, uniqueId, prefersReducedMotion } from '../core/utils.js';
import { outCubic } from '../core/ease.js';

injectStyle('sf-ink', `.sf-ink-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}`);

const DEFAULTS = {
  duration: 2000, // per word
  stagger: 150,
  blur: 0.085, // em
  turbulence: 0.28, // displacement in em
  frequency: 0.018,
  octaves: 3,
};

export function inkBloom(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const parts = split(el, { chars: false, words: true });
  const defs = svg('svg', { class: 'sf-ink-defs', 'aria-hidden': 'true', focusable: 'false' });
  el.appendChild(defs);

  const words = parts.words.map((node, i) => {
    const id = uniqueId('sf-ink');
    const filter = svg('filter', {
      id,
      x: '-30%', y: '-60%', width: '160%', height: '220%',
      'color-interpolation-filters': 'sRGB',
    });
    const turb = svg('feTurbulence', {
      type: 'fractalNoise', baseFrequency: o.frequency, numOctaves: o.octaves, seed: 7 + i * 13, result: 'noise',
    });
    const blur = svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 0, result: 'soft' });
    const disp = svg('feDisplacementMap', {
      in: 'soft', in2: 'noise', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G', result: 'flow',
    });
    const matrix = svg('feColorMatrix', { in: 'flow', type: 'matrix', values: identity() });
    filter.append(turb, blur, disp, matrix);
    defs.appendChild(filter);
    return { node, id, blur, disp, matrix };
  });

  function identity(a = 1, b = 0) {
    return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a.toFixed(3)} ${b.toFixed(3)}`;
  }

  let off = null;
  let settle = null;

  function apply(w, p, fs) {
    // p: 0 → 1 local progress
    // Pigment cores (high threshold on a soft source) swell as the blur
    // tightens; contrast then relaxes to identity for a pop-free finish.
    const e = outCubic(p);
    const contrast = lerp(14, 1, smoothstep(0.55, 1, p));
    const threshold = lerp(0.42, 0.5, smoothstep(0.3, 0.8, p));
    w.blur.setAttribute('stdDeviation', (lerp(o.blur, 0, e) * fs).toFixed(2));
    w.disp.setAttribute('scale', (lerp(o.turbulence, 0, smoothstep(0, 0.9, p)) * fs).toFixed(2));
    w.matrix.setAttribute('values', identity(contrast, threshold * (1 - contrast)));
    w.node.style.opacity = smoothstep(0, 0.04, p).toFixed(3);
  }

  function attach(w) { w.node.style.filter = `url(#${w.id})`; }
  function detach(w) { w.node.style.filter = ''; w.node.style.opacity = ''; }

  function stop() {
    if (off) off();
    off = null;
    if (settle) settle(false);
    settle = null;
  }

  function run(forward) {
    stop();
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (prefersReducedMotion()) {
      words.forEach((w) => { detach(w); if (!forward) w.node.style.opacity = '0'; });
      return Promise.resolve(true);
    }
    const n = words.length;
    const D = forward ? o.duration : o.duration * 0.7;
    words.forEach((w, i) => {
      attach(w);
      apply(w, forward ? 0 : 1, fs);
      w.delay = (forward ? i : n - 1 - i) * o.stagger;
    });
    return new Promise((done) => {
      settle = done;
      let t = 0;
      off = tick((_, dt) => {
        t += dt;
        let busy = false;
        for (const w of words) {
          const p = clamp((t - w.delay) / D);
          apply(w, forward ? p : 1 - p, fs);
          if (p < 1) busy = true;
        }
        if (!busy) {
          off(); off = null; settle = null;
          words.forEach((w) => {
            if (forward) detach(w);
            else w.node.style.opacity = '0';
          });
          done(true);
        }
      });
    });
  }

  return {
    el,
    play: () => run(true),
    reverse: () => run(false),
    destroy() {
      stop();
      defs.remove();
      parts.revert();
    },
  };
}

export default inkBloom;
