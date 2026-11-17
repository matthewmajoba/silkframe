/**
 * Accordion Path
 * Long trails fold their middle into a single "•••" bead. Hover or focus
 * it and the hidden levels unfold in a rolling stagger — widths glide open
 * while each label rises out of blur — then fold away again when you leave.
 * Keyboard users get the same choreography on focus.
 *
 *   accordionCrumbs(nav, { items: [...], keepStart: 1, keepEnd: 2 });
 */
import { injectStyle } from '../core/style.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';

injectStyle(
  'sf-accordion',
  `.sf-ac{display:inline-flex;align-items:center}
.sf-ac ol{display:flex;align-items:center;margin:0;padding:0;list-style:none}
.sf-ac li{display:flex;align-items:center;white-space:nowrap}
.sf-ac li.is-folded{width:0;overflow:hidden}
.sf-ac a,.sf-ac button.sf-ac-link{color:var(--sf-ac-fg,rgba(255,255,255,.55));text-decoration:none;padding:.45em .55em;border-radius:.5em;
  transition:color .3s,background .3s;background:none;border:0;font:inherit;cursor:pointer}
.sf-ac a:hover,.sf-ac button.sf-ac-link:hover{color:#fff;background:rgba(255,255,255,.06)}
.sf-ac [aria-current="page"]{color:var(--sf-ac-active,#fff)}
.sf-ac-sep{opacity:.35;padding:0 .15em}
.sf-ac-bead{display:inline-flex;align-items:center;gap:.22em;padding:.55em .7em;border-radius:99px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.04);cursor:pointer;color:inherit;font:inherit;overflow:hidden;white-space:nowrap}
.sf-ac-bead i{width:.3em;height:.3em;border-radius:50%;background:currentColor;opacity:.75}`
);

const DEFAULTS = {
  items: [],
  keepStart: 1,
  keepEnd: 2,
  stagger: 55,
  duration: 560,
  closeDelay: 450,
  onNavigate: null,
};

export function accordionCrumbs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  nav.classList.add('sf-ac');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  let open = false;
  let anims = [];
  let closeTimer = null;
  let token = 0;
  let folded = [];
  let bead = null;
  let beadLi = null;

  function render(items) {
    nav.innerHTML = '';
    const ol = document.createElement('ol');
    nav.appendChild(ol);
    const n = items.length;
    const foldFrom = o.keepStart, foldTo = n - o.keepEnd; // [foldFrom, foldTo)
    folded = [];
    items.forEach((label, i) => {
      if (i === foldFrom && foldTo > foldFrom) {
        beadLi = document.createElement('li');
        beadLi.innerHTML = `<span class="sf-ac-sep" aria-hidden="true">/</span>`;
        bead = document.createElement('button');
        bead.type = 'button';
        bead.className = 'sf-ac-bead';
        bead.setAttribute('aria-label', `Show ${foldTo - foldFrom} hidden levels`);
        bead.setAttribute('aria-expanded', 'false');
        bead.innerHTML = '<i></i><i></i><i></i>';
        beadLi.appendChild(bead);
        ol.appendChild(beadLi);
      }
      const li = document.createElement('li');
      if (i > 0) li.innerHTML = `<span class="sf-ac-sep" aria-hidden="true">/</span>`;
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'sf-ac-link';
      link.textContent = label;
      if (i === n - 1) link.setAttribute('aria-current', 'page');
      link.addEventListener('click', () => o.onNavigate?.(i, items));
      li.appendChild(link);
      ol.appendChild(li);
      if (i >= foldFrom && i < foldTo) {
        li.classList.add('is-folded');
        li.setAttribute('aria-hidden', 'true');
        link.tabIndex = -1;
        folded.push({ li, link });
      }
    });
    if (bead) {
      bead.addEventListener('pointerenter', expand);
      bead.addEventListener('focus', expand);
      bead.addEventListener('click', () => (open ? collapse() : expand()));
    }
  }

  const onNavLeave = () => scheduleClose();
  const onNavEnter = () => clearTimeout(closeTimer);
  const onFocusOut = (e) => { if (!nav.contains(e.relatedTarget)) scheduleClose(); };
  nav.addEventListener('pointerleave', onNavLeave);
  nav.addEventListener('pointerenter', onNavEnter);
  nav.addEventListener('focusout', onFocusOut);

  function naturalWidth(li) {
    li.style.width = 'auto';
    const w = li.scrollWidth;
    li.style.width = '';
    return w;
  }

  function cancel() { anims.forEach((a) => a.cancel()); anims = []; }

  function expand() {
    clearTimeout(closeTimer);
    if (open || !bead) return Promise.resolve(true);
    open = true;
    const my = ++token;
    bead.setAttribute('aria-expanded', 'true');
    cancel();
    const D = o.duration;
    const bw = beadLi.offsetWidth;
    anims.push(beadLi.animate([{ width: `${bw}px`, opacity: 1 }, { width: '0px', opacity: 0 }], { duration: D * 0.6, easing: css.inOutQuart, fill: 'forwards' }));
    beadLi.style.overflow = 'hidden';
    folded.forEach(({ li, link }, i) => {
      const w = naturalWidth(li);
      li.removeAttribute('aria-hidden');
      link.tabIndex = 0;
      const delay = 60 + i * o.stagger;
      anims.push(
        li.animate([{ width: '0px' }, { width: `${w}px` }], { duration: D, delay, easing: css.cinematic, fill: 'both' }),
        link.animate([{ opacity: 0, filter: 'blur(5px)', transform: 'translate3d(0,.5em,0) scale(.92)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], {
          duration: D, delay: delay + 60, easing: css.cinematic, fill: 'both',
        })
      );
    });
    return Promise.all(anims.map((a) => a.finished)).then(() => my === token).catch(() => false);
  }

  function collapse() {
    if (!open || !bead) return Promise.resolve(true);
    open = false;
    const my = ++token;
    bead.setAttribute('aria-expanded', 'false');
    const D = o.duration * 0.75;
    const current = anims;
    anims = [];
    const n = folded.length;
    folded.forEach(({ li, link }, i) => {
      const w = li.offsetWidth;
      const delay = (n - 1 - i) * o.stagger * 0.7;
      li.setAttribute('aria-hidden', 'true');
      link.tabIndex = -1;
      anims.push(
        li.animate([{ width: `${w}px` }, { width: '0px' }], { duration: D, delay, easing: css.inOutQuart, fill: 'both' }),
        link.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: D * 0.6, delay, easing: css.inQuart, fill: 'both' })
      );
    });
    current.forEach((a) => a.cancel());
    const bw = (() => { beadLi.style.width = 'auto'; const w = beadLi.scrollWidth; beadLi.style.width = ''; return w; })();
    anims.push(beadLi.animate([{ width: '0px', opacity: 0 }, { width: `${bw}px`, opacity: 1 }], { duration: D, delay: n * o.stagger * 0.5, easing: css.cinematic, fill: 'both' }));
    return Promise.all(anims.map((a) => a.finished)).then(() => my === token).catch(() => false);
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(collapse, o.closeDelay);
  }

  render(o.items);

  return {
    el: nav,
    expand,
    collapse,
    set(items) { cancel(); open = false; render(items); },
    destroy() {
      cancel();
      clearTimeout(closeTimer);
      nav.removeEventListener('pointerleave', onNavLeave);
      nav.removeEventListener('pointerenter', onNavEnter);
      nav.removeEventListener('focusout', onFocusOut);
      nav.innerHTML = '';
      nav.classList.remove('sf-ac');
    },
  };
}

export default accordionCrumbs;
