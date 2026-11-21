/**
 * Facet Flip
 * The frame becomes a row of louvres. Each one is a true two-sided card —
 * a slice of the outgoing scene on the front, the incoming scene on the
 * back — and they turn in a rolling wave, sinking back in space at mid-turn
 * with light raking across each face.
 *
 *   const flip = facetFlip(container, { facets: 9 });
 *   await flip.run(sceneA, sceneB);
 */
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-facets',
  `.sf-facets{position:absolute;pointer-events:none;z-index:40;display:flex}
:where(.sf-facet){position:relative}.sf-facet{flex:1 1 0;transform-style:preserve-3d;will-change:transform}
.sf-facet-face{position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.sf-facet-face.back{transform:rotateY(180deg)}
.sf-facet-face>.sf-facet-copy{position:absolute;top:0;margin:0}
.sf-facet-shade{position:absolute;inset:0;pointer-events:none;opacity:0;
  background:linear-gradient(90deg,rgba(0,0,0,.75),rgba(0,0,0,.15) 55%,rgba(255,255,255,.08))}
.sf-facet-face.back .sf-facet-shade{background:linear-gradient(270deg,rgba(0,0,0,.75),rgba(0,0,0,.15) 55%,rgba(255,255,255,.08))}`
);

const DEFAULTS = {
  facets: 9,
  axis: 'y', // 'y' = vertical louvres, 'x' = horizontal blinds
  duration: 1250,
  stagger: 70,
  depth: 0.18, // how far facets sink at mid-turn (fraction of container width)
  order: 'start', // 'start' | 'center' | 'end'
  easing: 'cubic-bezier(0.7, 0, 0.2, 1)',
};

export function facetFlip(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  let layer = null;
  let anims = [];

  function cleanup() {
    anims.forEach((a) => a.cancel());
    anims = [];
    layer?.remove();
    layer = null;
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
    const N = o.facets;
    const vertical = o.axis === 'y';
    layer = document.createElement('div');
    layer.className = 'sf-facets';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;flex-direction:${vertical ? 'row' : 'column'}`;
    const size = (vertical ? box.w : box.h) / N;
    const persp = Math.max(box.w, box.h) * 1.6;
    const facets = [];
    for (let i = 0; i < N; i++) {
      const facet = document.createElement('div');
      facet.className = 'sf-facet';
      const faces = [from, to].map((src, side) => {
        const face = document.createElement('div');
        face.className = `sf-facet-face${side ? ' back' : ''}`;
        // The back face is pre-turned around the SAME axis the facet turns on,
        // otherwise horizontal blinds reveal the next scene mirrored.
        if (side) face.style.transform = vertical ? 'rotateY(180deg)' : 'rotateX(180deg)';
        // Faces overlap their neighbours by a sub-pixel so fractional strip
        // boundaries never show anti-aliased seams.
        const bleed = 0.75;
        if (vertical) { face.style.left = `${-bleed}px`; face.style.right = `${-bleed}px`; }
        else { face.style.top = `${-bleed}px`; face.style.bottom = `${-bleed}px`; }
        const copy = snapshot(src);
        copy.classList.add('sf-facet-copy');
        copy.style.width = `${box.w}px`;
        copy.style.height = `${box.h}px`;
        copy.style.left = vertical ? `${-i * size + bleed}px` : '0';
        copy.style.top = vertical ? '0' : `${-i * size + bleed}px`;
        copy.style.visibility = 'visible';
        const shade = document.createElement('div');
        shade.className = 'sf-facet-shade';
        if (!vertical) {
          shade.style.background = side
            ? 'linear-gradient(0deg,rgba(0,0,0,.75),rgba(0,0,0,.15) 55%,rgba(255,255,255,.08))'
            : 'linear-gradient(180deg,rgba(0,0,0,.75),rgba(0,0,0,.15) 55%,rgba(255,255,255,.08))';
        }
        face.append(copy, shade);
        facet.appendChild(face);
        return { face, shade };
      });
      layer.appendChild(facet);
      facets.push({ facet, faces });
    }
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';

    const rank = (i) => (o.order === 'center' ? Math.abs(i - (N - 1) / 2) : o.order === 'end' ? N - 1 - i : i);
    const sink = -Math.max(box.w, box.h) * o.depth;
    const rot = vertical ? 'rotateY' : 'rotateX';
    const turn = vertical ? 180 : -180;
    facets.forEach(({ facet, faces }, i) => {
      const delay = rank(i) * o.stagger;
      const timing = { duration: o.duration, delay, easing: o.easing, fill: 'both' };
      anims.push(
        facet.animate(
          [
            { transform: `perspective(${persp}px) translateZ(0px) ${rot}(0deg)` },
            { transform: `perspective(${persp}px) translateZ(${sink}px) ${rot}(${turn / 2}deg)`, offset: 0.5 },
            { transform: `perspective(${persp}px) translateZ(0px) ${rot}(${turn}deg)` },
          ],
          timing
        ),
        faces[0].shade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], timing),
        faces[1].shade.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], timing)
      );
    });
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    to.style.visibility = '';
    cleanup();
    return true;
  }

  return { run, destroy: cleanup };
}

export default facetFlip;
