/**
 * Liquid Trail
 * A breadcrumb whose active marker behaves like a drop of liquid: its
 * leading edge races ahead on a stiff spring while the trailing edge lags
 * on a soft one, so the pill stretches (and thins, conserving volume) as it
 * travels. New levels unfurl out of the trail; going up "absorbs" the
 * deeper crumbs back into the one you chose.
 *
 *   const crumbs = liquidCrumbs(nav, { items: ['Home', 'Library'] });
 *   crumbs.push('Text');   crumbs.go(0);
 */
import { tick } from '../core/ticker.js';
import { Spring } from '../core/spring.js';
import { injectStyle } from '../core/style.js';
import { resolve, clamp, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-lcrumbs',
  `:where(.sf-lc){position:relative}.sf-lc{display:inline-flex;align-items:center}
.sf-lc ol{position:relative;z-index:1;display:flex;align-items:center;margin:0;padding:0;list-style:none}
.sf-lc li{display:flex;align-items:center;white-space:nowrap}
:where(.sf-lc-link){position:relative}.sf-lc-link{display:block;padding:.5em .95em;border-radius:99px;color:var(--sf-lc-fg,rgba(255,255,255,.55));
  text-decoration:none;transition:color .35s;cursor:pointer;background:none;border:0;font:inherit}
.sf-lc-link:hover{color:var(--sf-lc-hover,#fff)}
.sf-lc-link[aria-current="page"]{color:var(--sf-lc-active-fg,#0b0b0e);cursor:default}
.sf-lc-sep{display:inline-grid;place-items:center;width:1.1em;opacity:.4}
.sf-lc-sep svg{width:.7em;height:.7em}
.sf-lc-blob{position:absolute;left:0;top:50%;height:2.1em;border-radius:99px;pointer-events:none;
  background:var(--sf-lc-active,#ede8df);box-shadow:0 0 1.4em rgba(255,255,255,.12);will-change:transform,width}`
);

const CHEVRON = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 1.5 3.5 3.5-3.5 3.5"/></svg>';

const DEFAULTS = {
  items: [],
  onNavigate: null,
  duration: 620,
};

export function liquidCrumbs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-lc');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = '';
  const blob = document.createElement('span');
  blob.className = 'sf-lc-blob';
  blob.setAttribute('aria-hidden', 'true');
  const ol = document.createElement('ol');
  nav.append(blob, ol);

  let items = [];
  const left = new Spring(0, { stiffness: 260, damping: 26, precision: 0.05 });
  const right = new Spring(0, { stiffness: 260, damping: 26, precision: 0.05 });
  let tracking = 0; // ms of forced tracking while layout animates
  let off = null;
  let first = true;

  function makeItem(label, index) {
    const li = document.createElement('li');
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'sf-lc-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.innerHTML = CHEVRON;
      li.appendChild(sep);
    }
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'sf-lc-link';
    a.textContent = label;
    a.addEventListener('click', () => {
      const i = items.findIndex((it) => it.li === li);
      if (i >= 0 && i < items.length - 1) {
        go(i);
        o.onNavigate?.(i, items.map((it) => it.label));
      }
    });
    li.appendChild(a);
    return { li, link: a, label };
  }

  function markCurrent() {
    items.forEach((it, i) => {
      if (i === items.length - 1) it.link.setAttribute('aria-current', 'page');
      else it.link.removeAttribute('aria-current');
    });
  }

  function aimBlob() {
    const cur = items[items.length - 1];
    if (!cur) return;
    // The list is the links' offsetParent; the blob lives in the nav.
    const l = cur.link.offsetLeft + ol.offsetLeft;
    const r = l + cur.link.offsetWidth;
    if (first) { left.set(l); right.set(r); first = false; return; }
    // Leading edge stiff, trailing edge soft → the drop stretches as it moves.
    const forward = l > left.target;
    left.stiffness = forward ? 110 : 340; left.damping = forward ? 17 : 30;
    right.stiffness = forward ? 340 : 110; right.damping = forward ? 30 : 17;
    left.to(l); right.to(r);
  }

  function frame(_, dt) {
    const s = dt / 1000;
    tracking -= dt;
    if (tracking > 0) aimBlob();
    left.step(s); right.step(s);
    const w = Math.max(0, right.value - left.value);
    const natural = right.target - left.target || 1;
    const stretch = clamp(w / natural - 1, 0, 1.5);
    const sy = 1 - stretch * 0.18;
    blob.style.width = `${w.toFixed(2)}px`;
    blob.style.transform = `translate3d(${left.value.toFixed(2)}px, -50%, 0) scaleY(${sy.toFixed(4)})`;
    if (tracking <= 0 && left.resting && right.resting) { off(); off = null; }
  }
  const wake = (ms = 0) => {
    tracking = Math.max(tracking, ms);
    aimBlob();
    if (!off) off = tick(frame);
  };

  function naturalWidth(li) {
    const prev = li.style.width;
    li.style.width = 'auto';
    const w = li.scrollWidth;
    li.style.width = prev;
    return w;
  }

  function push(label) {
    const it = makeItem(label, items.length);
    items.push(it);
    ol.appendChild(it.li);
    markCurrent();
    if (prefersReducedMotion() || first) { wake(); return Promise.resolve(true); }
    const w = naturalWidth(it.li);
    it.li.style.overflow = 'hidden';
    const D = o.duration;
    const anims = [
      it.li.animate([{ width: '0px' }, { width: `${w}px` }], { duration: D, easing: css.cinematic }),
      it.link.animate(
        [{ opacity: 0, transform: 'translate3d(-0.8em,0,0)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: D, delay: D * 0.15, easing: css.cinematic, fill: 'backwards' }
      ),
    ];
    const sep = it.li.querySelector('.sf-lc-sep');
    if (sep) anims.push(sep.animate([{ transform: 'rotate(-90deg) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 0.4 }], { duration: D * 0.8, easing: css.outBack }));
    wake(D + 80);
    return Promise.all(anims.map((a) => a.finished)).then(() => {
      it.li.style.overflow = '';
      return true;
    });
  }

  /** Navigate up to `index`; deeper crumbs are absorbed back into it. */
  function go(index) {
    if (index >= items.length - 1) return Promise.resolve(true);
    const removed = items.splice(index + 1);
    markCurrent();
    if (prefersReducedMotion()) { removed.forEach((r) => r.li.remove()); wake(); return Promise.resolve(true); }
    const D = o.duration * 0.8;
    const anims = removed.reverse().flatMap((it, k) => {
      const w = it.li.offsetWidth;
      it.li.style.overflow = 'hidden';
      const delay = k * 55;
      return [
        it.li.animate([{ width: `${w}px` }, { width: '0px' }], { duration: D, delay, easing: css.inOutQuart, fill: 'forwards' }),
        it.link.animate([{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: 'blur(5px)', transform: 'translate3d(-1.2em,0,0) scale(.9)' }], { duration: D * 0.7, delay, easing: css.inQuart, fill: 'forwards' }),
      ];
    });
    wake(D + removed.length * 55 + 60);
    return Promise.all(anims.map((a) => a.finished)).then(() => {
      removed.forEach((r) => r.li.remove());
      wake(60);
      return true;
    });
  }

  function set(labels) {
    items.forEach((it) => it.li.remove());
    items = [];
    first = true;
    labels.forEach((l) => {
      const it = makeItem(l, items.length);
      items.push(it);
      ol.appendChild(it.li);
    });
    markCurrent();
    wake();
  }

  set(o.items);
  const ro = new ResizeObserver(() => wake(50));
  ro.observe(nav);

  return {
    el: nav,
    push,
    go,
    pop: () => go(items.length - 2),
    set,
    get items() { return items.map((it) => it.label); },
    destroy() {
      if (off) off();
      ro.disconnect();
      nav.innerHTML = '';
      nav.classList.remove('sf-lc');
    },
  };
}

export default liquidCrumbs;
