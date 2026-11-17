/**
 * Rolling Labels
 * Built for sibling navigation (Shop / Shoes → Shop / Bags). Every level
 * is a slot: when its label changes the old word rolls up and out with a
 * motion smear while the new one rolls in from below, and the slot width
 * glides between them. New levels unfurl, removed levels fold away.
 *
 *   const crumbs = rollingCrumbs(nav, { items: ['Shop', 'Shoes'] });
 *   crumbs.set(['Shop', 'Bags', 'Leather']);
 */
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-rolling',
  `.sf-rl{display:inline-flex;align-items:center}
.sf-rl ol{display:flex;align-items:center;margin:0;padding:0;list-style:none}
.sf-rl li{display:flex;align-items:center;white-space:nowrap}
.sf-rl-sep{opacity:.35;padding:0 .55em}
.sf-rl-slot{position:relative;display:inline-block;overflow:hidden;vertical-align:bottom;height:1.4em;line-height:1.4em;
  padding:0 .05em;margin:-.1em 0;color:var(--sf-rl-fg,rgba(255,255,255,.6))}
.sf-rl li:last-child .sf-rl-slot{color:var(--sf-rl-active,#fff)}
.sf-rl-word{position:absolute;left:.05em;top:0;white-space:nowrap;will-change:transform,filter}
.sf-rl-sizer{visibility:hidden;white-space:nowrap}`
);

const DEFAULTS = {
  items: [],
  duration: 640,
  stagger: 70,
};

export function rollingCrumbs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-rl');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = '<ol></ol>';
  const ol = nav.querySelector('ol');
  const live = document.createElement('span');
  live.className = 'sf-sr';
  live.setAttribute('aria-live', 'polite');
  nav.appendChild(live);
  let levels = [];

  function makeLevel(label, index) {
    const li = document.createElement('li');
    if (index > 0) li.innerHTML = '<span class="sf-rl-sep" aria-hidden="true">/</span>';
    const slot = document.createElement('span');
    slot.className = 'sf-rl-slot';
    const sizer = document.createElement('span');
    sizer.className = 'sf-rl-sizer';
    sizer.textContent = label;
    const word = document.createElement('span');
    word.className = 'sf-rl-word';
    word.textContent = label;
    slot.append(sizer, word);
    li.appendChild(slot);
    return { li, slot, sizer, word, label };
  }

  const widthOf = (lvl, text) => {
    const prev = lvl.sizer.textContent;
    lvl.sizer.textContent = text;
    const w = lvl.sizer.getBoundingClientRect().width;
    lvl.sizer.textContent = prev;
    return w;
  };

  function roll(lvl, next, delay) {
    const D = o.duration;
    const from = widthOf(lvl, lvl.label);
    const to = widthOf(lvl, next);
    const incoming = document.createElement('span');
    incoming.className = 'sf-rl-word';
    incoming.textContent = next;
    lvl.slot.appendChild(incoming);
    const outgoing = lvl.word;
    lvl.word = incoming;
    lvl.label = next;
    lvl.sizer.textContent = next;
    const anims = [
      lvl.slot.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: D, delay, easing: css.cinematic, fill: 'backwards' }),
      outgoing.animate(
        [
          { transform: 'translate3d(0,0,0) scaleY(1)', filter: 'blur(0)', opacity: 1 },
          { transform: 'translate3d(0,-55%,0) scaleY(1.35)', filter: 'blur(1.5px)', opacity: 0.6, offset: 0.45 },
          { transform: 'translate3d(0,-120%,0) scaleY(1)', filter: 'blur(0)', opacity: 0 },
        ],
        { duration: D * 0.75, delay, easing: css.inOutQuart, fill: 'forwards' }
      ),
      incoming.animate(
        [
          { transform: 'translate3d(0,120%,0) scaleY(1)', filter: 'blur(0)', opacity: 0 },
          { transform: 'translate3d(0,50%,0) scaleY(1.35)', filter: 'blur(1.5px)', opacity: 0.6, offset: 0.5 },
          { transform: 'translate3d(0,0,0) scaleY(1)', filter: 'blur(0)', opacity: 1 },
        ],
        { duration: D, delay: delay + D * 0.12, easing: css.cinematic, fill: 'backwards' }
      ),
    ];
    return Promise.all(anims.map((a) => a.finished)).then(() => outgoing.remove());
  }

  function unfurl(lvl, delay) {
    const w = widthOf(lvl, lvl.label);
    const D = o.duration;
    lvl.li.style.overflow = 'hidden';
    const liW = (() => { const r = lvl.li.getBoundingClientRect().width; return r; })();
    return Promise.all([
      lvl.li.animate([{ width: '0px' }, { width: `${liW}px` }], { duration: D, delay, easing: css.cinematic, fill: 'backwards' }).finished,
      lvl.word.animate([{ transform: 'translate3d(0,120%,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: D, delay: delay + 80, easing: css.cinematic, fill: 'backwards' }).finished,
    ]).then(() => { lvl.li.style.overflow = ''; return w; });
  }

  function fold(lvl, delay) {
    const w = lvl.li.getBoundingClientRect().width;
    lvl.li.style.overflow = 'hidden';
    const D = o.duration * 0.7;
    return Promise.all([
      lvl.li.animate([{ width: `${w}px` }, { width: '0px' }], { duration: D, delay, easing: css.inOutQuart, fill: 'forwards' }).finished,
      lvl.word.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate3d(0,-120%,0)', opacity: 0 }], { duration: D * 0.7, delay, easing: css.inQuart, fill: 'forwards' }).finished,
    ]).then(() => lvl.li.remove());
  }

  function markCurrent() {
    levels.forEach((l, i) => {
      if (i === levels.length - 1) l.slot.setAttribute('aria-current', 'page');
      else l.slot.removeAttribute('aria-current');
    });
  }

  function set(items, { instant = false } = {}) {
    live.textContent = items.join(' / ');
    if (instant || prefersReducedMotion()) {
      ol.innerHTML = '';
      levels = items.map((l, i) => makeLevel(l, i));
      levels.forEach((l) => ol.appendChild(l.li));
      markCurrent();
      return Promise.resolve(true);
    }
    const jobs = [];
    let k = 0;
    items.forEach((label, i) => {
      const lvl = levels[i];
      if (!lvl) {
        const fresh = makeLevel(label, i);
        levels.push(fresh);
        ol.appendChild(fresh.li);
        jobs.push(unfurl(fresh, k++ * o.stagger));
      } else if (lvl.label !== label) {
        jobs.push(roll(lvl, label, k++ * o.stagger));
      }
    });
    const extra = levels.splice(items.length);
    extra.reverse().forEach((lvl, j) => jobs.push(fold(lvl, j * o.stagger)));
    markCurrent();
    return Promise.all(jobs).then(() => true);
  }

  set(o.items, { instant: true });

  return {
    el: nav,
    set,
    get items() { return levels.map((l) => l.label); },
    destroy() {
      nav.innerHTML = '';
      nav.classList.remove('sf-rl');
    },
  };
}

export default rollingCrumbs;
