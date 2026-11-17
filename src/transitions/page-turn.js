/**
 * Page Turn
 * The frame becomes a book spread. The outgoing scene's right half lifts on
 * the spine and turns over — its back is already printed with the incoming
 * scene's left half — while light falls across the curling sheet and a
 * soft shadow sweeps over the page beneath.
 *
 *   await pageTurn(container).run(currentScene, nextScene);          // forward
 *   await pageTurn(container, { direction: 'back' }).run(a, b);      // backward
 */
import { injectStyle } from '../core/style.js';
import { snapshot, boxIn, ensurePositioned } from '../core/snapshot.js';
import { prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-pageturn',
  `.sf-pt{position:absolute;pointer-events:none;z-index:40;perspective:var(--sf-pt-perspective,2400px)}
.sf-pt-half{position:absolute;top:0;bottom:0;width:50%;overflow:hidden}
.sf-pt-half>.sf-pt-copy,.sf-pt-face>.sf-pt-copy{position:absolute;top:0;margin:0}
.sf-pt-page{position:absolute;top:0;bottom:0;width:50%;transform-style:preserve-3d;will-change:transform}
.sf-pt-face{position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.sf-pt-face.back{transform:rotateY(180deg)}
.sf-pt-shade{position:absolute;inset:0;pointer-events:none;opacity:0}
.sf-pt-cast{position:absolute;top:0;bottom:0;width:50%;pointer-events:none;opacity:0}`
);

const DEFAULTS = {
  direction: 'forward', // 'forward' turns right → left; 'back' turns left → right
  duration: 1350,
  easing: 'cubic-bezier(0.62, 0.02, 0.32, 1)',
};

export function pageTurn(container, options = {}) {
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

  function half(src, side, box) {
    const h = document.createElement('div');
    h.className = 'sf-pt-half';
    h.style[side === 'left' ? 'left' : 'right'] = '0';
    const c = snapshot(src);
    c.classList.add('sf-pt-copy');
    c.style.width = `${box.w}px`;
    c.style.height = `${box.h}px`;
    c.style.left = side === 'left' ? '0' : `${-box.w / 2}px`;
    c.style.visibility = 'visible';
    h.appendChild(c);
    return h;
  }

  function face(src, side, box, back) {
    const f = document.createElement('div');
    f.className = `sf-pt-face${back ? ' back' : ''}`;
    const c = snapshot(src);
    c.classList.add('sf-pt-copy');
    c.style.width = `${box.w}px`;
    c.style.height = `${box.h}px`;
    c.style.left = side === 'left' ? '0' : `${-box.w / 2}px`;
    c.style.visibility = 'visible';
    const shade = document.createElement('div');
    shade.className = 'sf-pt-shade';
    f.append(c, shade);
    return { f, shade };
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
    const fwd = o.direction !== 'back';
    layer = document.createElement('div');
    layer.className = 'sf-pt';
    layer.style.cssText += `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
    // Static halves: what stays (from) and what is revealed (to).
    const stay = half(from, fwd ? 'left' : 'right', box);
    // Under the stay half: the incoming scene's matching half. Once the sheet
    // passes 90° the stay half is swapped out, so the anti-aliased spine edge
    // of the rotated sheet can only ever bleed matching content.
    const stayNext = half(to, fwd ? 'left' : 'right', box);
    const reveal = half(to, fwd ? 'right' : 'left', box);
    // The turning sheet: front = from's moving half, back = to's other half.
    const page = document.createElement('div');
    page.className = 'sf-pt-page';
    page.style[fwd ? 'left' : 'right'] = '50%';
    page.style.transformOrigin = fwd ? '0% 50%' : '100% 50%';
    const front = face(from, fwd ? 'right' : 'left', box, false);
    const back = face(to, fwd ? 'left' : 'right', box, true);
    page.append(front.f, back.f);
    // Shadow the sheet casts on the revealed page.
    const cast = document.createElement('div');
    cast.className = 'sf-pt-cast';
    cast.style[fwd ? 'left' : 'right'] = '50%';
    cast.style.background = `linear-gradient(${fwd ? 90 : 270}deg, rgba(0,0,0,.55), rgba(0,0,0,.15) 40%, transparent 75%)`;
    front.shade.style.background = `linear-gradient(${fwd ? 90 : 270}deg, rgba(0,0,0,.55), rgba(0,0,0,.05) 55%, rgba(255,255,255,.06))`;
    back.shade.style.background = `linear-gradient(${fwd ? 270 : 90}deg, rgba(0,0,0,.45), rgba(0,0,0,0) 50%, rgba(255,255,255,.1))`;
    // Spine shadow on the page that stays.
    const spine = document.createElement('div');
    spine.className = 'sf-pt-cast';
    spine.style[fwd ? 'right' : 'left'] = '50%';
    spine.style.background = `linear-gradient(${fwd ? 270 : 90}deg, rgba(0,0,0,.35), transparent 30%)`;
    layer.append(stayNext, stay, reveal, cast, spine, page);
    container.appendChild(layer);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';

    const D = o.duration;
    const sign = fwd ? -1 : 1;
    const timing = { duration: D, easing: o.easing, fill: 'both' };
    anims.push(
      page.animate(
        [
          { transform: 'rotateY(0deg) translateZ(0px)' },
          { transform: `rotateY(${sign * 90}deg) translateZ(${box.w * 0.02}px)`, offset: 0.5 },
          { transform: `rotateY(${sign * 180}deg) translateZ(0px)` },
        ],
        timing
      ),
      front.shade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], timing),
      back.shade.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], timing),
      cast.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }], timing),
      spine.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], timing),
      stay.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0, offset: 0.551 }, { opacity: 0 }], timing)
    );
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    to.style.visibility = '';
    cleanup();
    return true;
  }

  return { run, destroy: cleanup };
}

export default pageTurn;
