/**
 * Title Handoff
 * Breadcrumb and page title as one continuous object. Going deeper, the
 * current title lifts out of the heading, shrinks and flies up to become
 * the newest crumb while the new title rises in beneath. Going back, the
 * chosen crumb grows and descends to become the heading again, and the
 * levels after it fold away. Shared-element motion, no layout jumps.
 *
 *   const nav = titleHandoff(navEl, h1, { items: ['Home'], title: 'Library' });
 *   nav.push('Text');   nav.go(0);
 */
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';
import { wait } from '../core/ticker.js';

injectStyle(
  'sf-handoff',
  `.sf-ho{display:flex;align-items:center;flex-wrap:wrap}
.sf-ho ol{display:flex;align-items:center;margin:0;padding:0;list-style:none}
.sf-ho li{display:flex;align-items:center;white-space:nowrap}
.sf-ho-link{background:none;border:0;font:inherit;color:var(--sf-ho-fg,rgba(255,255,255,.6));padding:.4em .1em;cursor:pointer;transition:color .3s}
.sf-ho-link:hover{color:#fff}
.sf-ho-sep{opacity:.35;padding:0 .55em}
.sf-ho-fly{position:absolute;left:0;top:0;margin:0;white-space:nowrap;pointer-events:none;transform-origin:0 0;will-change:transform,opacity;z-index:30}`
);

const DEFAULTS = {
  items: [],
  title: '',
  duration: 820,
  onNavigate: null,
};

export function titleHandoff(navTarget, titleTarget, options = {}) {
  const nav = resolve(navTarget);
  const title = resolve(titleTarget);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-ho');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = '<ol></ol>';
  const ol = nav.querySelector('ol');
  // Common positioned ancestor for the flying copies.
  const stageEl = (() => {
    let p = title.parentElement;
    while (p && p !== document.body && !p.contains(nav)) p = p.parentElement;
    return p || document.body;
  })();
  if (getComputedStyle(stageEl).position === 'static') stageEl.style.position = 'relative';
  let items = [];
  let busy = false;

  const rel = (el) => {
    const a = el.getBoundingClientRect(), b = stageEl.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };

  const lineH = (el) => {
    const cs = getComputedStyle(el);
    return cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
  };
  /** Where the title-styled ghost must sit (unscaled origin) so its text
   *  lines up with the crumb's text at `ratio` scale: align line-box centres. */
  function crumbAnchor(btn, ratio) {
    const b = rel(btn);
    const cs = getComputedStyle(btn);
    const top = b.y + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth || 0);
    return {
      x: b.x + parseFloat(cs.paddingLeft),
      y: top + lineH(btn) / 2 - (lineH(title) * ratio) / 2,
    };
  }

  function crumb(label) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="sf-ho-sep" aria-hidden="true">/</span>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-ho-link';
    b.textContent = label;
    b.addEventListener('click', () => {
      const i = items.findIndex((it) => it.btn === b);
      if (i >= 0) { go(i); o.onNavigate?.(i, items.map((it) => it.label)); }
    });
    li.appendChild(b);
    return { li, btn: b, label };
  }

  /** A copy of `text` styled like the title, flown from box A to box B. */
  function fly(text, from, to, fromScale, toScale, D, fromColor, toColor) {
    const ghost = document.createElement('div');
    ghost.className = 'sf-ho-fly';
    const cs = getComputedStyle(title);
    ghost.style.font = cs.font;
    ghost.style.letterSpacing = cs.letterSpacing;
    ghost.style.color = cs.color;
    ghost.style.lineHeight = cs.lineHeight;
    ghost.textContent = text;
    stageEl.appendChild(ghost);
    const a = ghost.animate(
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${fromScale})`, color: fromColor || ghost.style.color },
        { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(${toScale})`, color: toColor || ghost.style.color },
      ],
      { duration: D, easing: css.cinematic, fill: 'forwards' }
    );
    return a.finished.then(() => ghost, () => ghost);
  }

  function setTitle(text) {
    title.textContent = text;
  }

  async function push(label) {
    if (busy) return false;
    busy = true;
    const old = title.textContent;
    const it = crumb(old);
    it.btn.style.visibility = 'hidden';
    ol.appendChild(it.li);
    items.push(it);
    if (prefersReducedMotion()) {
      it.btn.style.visibility = '';
      setTitle(label);
      busy = false;
      return true;
    }
    const D = o.duration;
    const from = rel(title);
    const ratio = parseFloat(getComputedStyle(it.btn).fontSize) / parseFloat(getComputedStyle(title).fontSize);
    const toBox = crumbAnchor(it.btn, ratio);
    it.li.querySelector('.sf-ho-sep').animate([{ opacity: 0 }, { opacity: 0.35 }], { duration: D * 0.6, delay: D * 0.35, fill: 'backwards' });
    const ghostP = fly(old, from, toBox, 1, ratio, D, getComputedStyle(title).color, getComputedStyle(it.btn).color);
    title.style.visibility = 'hidden';
    setTitle(label);
    await wait(D * 0.28);
    title.style.visibility = '';
    const rise = title.animate(
      [{ opacity: 0, transform: 'translate3d(0, .35em, 0)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: D, easing: css.cinematic, fill: 'backwards' }
    );
    const ghost = await ghostP;
    it.btn.style.visibility = '';
    ghost.remove();
    await rise.finished.catch(() => {});
    busy = false;
    return true;
  }

  async function go(index) {
    if (busy || index < 0 || index >= items.length) return false;
    busy = true;
    const target = items[index];
    const removed = items.splice(index);
    if (prefersReducedMotion()) {
      removed.forEach((r) => r.li.remove());
      setTitle(target.label);
      busy = false;
      return true;
    }
    const D = o.duration;
    const ratio = parseFloat(getComputedStyle(target.btn).fontSize) / parseFloat(getComputedStyle(title).fontSize);
    const tb = rel(title);
    const fromBox = crumbAnchor(target.btn, ratio);
    // Old title steps back and dissolves.
    const out = title.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translate3d(0,.25em,0) scale(.97)', filter: 'blur(6px)' }], {
      duration: D * 0.45, easing: css.inQuart, fill: 'forwards',
    });
    target.btn.style.visibility = 'hidden';
    const ghostP = fly(target.label, fromBox, tb, ratio, 1, D, getComputedStyle(target.btn).color, getComputedStyle(title).color);
    // Deeper crumbs fold away right-to-left.
    removed.slice(1).reverse().forEach((r, k) => {
      r.li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(-.6em,0,0)' }], { duration: 360, delay: k * 50, easing: 'ease-in', fill: 'forwards' });
    });
    const ghost = await ghostP;
    setTitle(target.label);
    out.cancel();
    removed.forEach((r) => r.li.remove());
    ghost.remove();
    busy = false;
    return true;
  }

  o.items.forEach((l) => {
    const it = crumb(l);
    ol.appendChild(it.li);
    items.push(it);
  });
  if (o.title) setTitle(o.title);

  return {
    el: nav,
    push,
    go,
    get items() { return items.map((i) => i.label); },
    get title() { return title.textContent; },
    destroy() {
      nav.innerHTML = '';
      nav.classList.remove('sf-ho');
      stageEl.querySelectorAll('.sf-ho-fly').forEach((g) => g.remove());
    },
  };
}

export default titleHandoff;
