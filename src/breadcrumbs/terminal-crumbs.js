/**
 * Terminal Path
 * The breadcrumb as a shell prompt. Navigating backspaces the old tail with
 * an accelerating key-repeat, then types the new levels with a human
 * rhythm — quicker inside words, a breath after each slash — and every
 * finished segment flashes a commit sweep. The caret breathes rather than
 * blinks, and holds solid while typing.
 *
 *   const term = terminalCrumbs(nav, { path: ['studio', 'projects'] });
 *   await term.go(['studio', 'archive', '2026']);
 */
import { injectStyle } from '../core/style.js';
import { wait } from '../core/ticker.js';
import { mulberry32 } from '../core/noise.js';
import { resolve, prefersReducedMotion } from '../core/utils.js';

injectStyle(
  'sf-term',
  `.sf-term{display:inline-flex;align-items:center;font-family:var(--sf-term-font,ui-monospace,'JetBrains Mono',monospace);white-space:pre}
.sf-term-prompt{color:var(--sf-term-prompt,#7ee0a8);margin-right:.6ch}
.sf-term-path{display:inline-flex;align-items:center}
:where(.sf-term-seg){position:relative}.sf-term-seg{color:var(--sf-term-fg,#e9e4dc);background:none;border:0;padding:0;font:inherit;cursor:pointer}
.sf-term-seg:hover{color:#fff;text-decoration:underline;text-decoration-color:rgba(255,255,255,.35);text-underline-offset:.25em}
.sf-term-seg.is-current{color:var(--sf-term-current,#ffcf86);cursor:default;text-decoration:none}
.sf-term-seg::after{content:"";position:absolute;left:0;right:0;bottom:-.18em;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,var(--sf-term-current,#ffcf86),transparent);transform:scaleX(0);opacity:0}
.sf-term-seg.is-commit::after{animation:sf-term-commit .9s cubic-bezier(.16,1,.3,1)}
@keyframes sf-term-commit{0%{transform:scaleX(0);opacity:1}60%{opacity:1}100%{transform:scaleX(1);opacity:0}}
.sf-term-slash{color:var(--sf-term-dim,rgba(255,255,255,.35))}
.sf-term-caret{display:inline-block;width:.6ch;height:1.15em;margin-left:.12ch;border-radius:1px;background:var(--sf-term-caret,#ffcf86);
  animation:sf-term-breathe 1.15s ease-in-out infinite}
.sf-term.is-typing .sf-term-caret{animation:none;opacity:1}
@keyframes sf-term-breathe{0%,100%{opacity:1}50%{opacity:.08}}`
);

const DEFAULTS = {
  prompt: '~',
  path: [],
  speed: 1, // typing speed multiplier
  onNavigate: null,
  seed: 4,
};

export function terminalCrumbs(target, options = {}) {
  const nav = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const rand = mulberry32(o.seed);
  nav.classList.add('sf-term');
  if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Breadcrumb');
  nav.innerHTML = `<span class="sf-term-prompt" aria-hidden="true">${o.prompt}</span><span class="sf-term-path"></span><span class="sf-term-caret" aria-hidden="true"></span>`;
  const host = nav.querySelector('.sf-term-path');
  let segs = []; // committed labels
  let text = ''; // currently displayed string (e.g. "/studio/projects")
  let token = 0;

  /** Re-render the displayed string as clickable segments. */
  function paint(commitIndex = -1) {
    host.innerHTML = '';
    const parts = text.split('/');
    // text begins with "/" so parts[0] is ''
    parts.forEach((part, i) => {
      if (i === 0) return;
      const slash = document.createElement('span');
      slash.className = 'sf-term-slash';
      slash.textContent = '/';
      host.appendChild(slash);
      if (!part) return;
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 'sf-term-seg';
      seg.textContent = part;
      const index = i - 1;
      const committed = index < segs.length && segs[index] === part;
      if (committed && index === segs.length - 1) {
        seg.classList.add('is-current');
        seg.setAttribute('aria-current', 'page');
      }
      if (index === commitIndex) seg.classList.add('is-commit');
      seg.addEventListener('click', () => {
        if (index < segs.length - 1) {
          const next = segs.slice(0, index + 1);
          go(next);
          o.onNavigate?.(index, next);
        }
      });
      host.appendChild(seg);
    });
  }

  const human = (ch, next) => {
    // Faster mid-word, slower at boundaries, tiny random jitter.
    let d = 38 + rand() * 46;
    if (ch === '/') d = 140 + rand() * 90;
    if (next === undefined) d += 30;
    return d / o.speed;
  };

  async function go(path) {
    const my = ++token;
    const targetText = path.length ? '/' + path.join('/') : '';
    // Longest common segment prefix
    let k = 0;
    while (k < segs.length && k < path.length && segs[k] === path[k]) k++;
    const keepText = k ? '/' + path.slice(0, k).join('/') : '';
    if (prefersReducedMotion()) {
      segs = path.slice(); text = targetText; paint(); return true;
    }
    nav.classList.add('is-typing');
    // 1 — backspace with accelerating key-repeat
    segs = segs.slice(0, k);
    let repeat = 0;
    while (text.length > keepText.length) {
      if (my !== token) return false;
      text = text.slice(0, -1);
      paint();
      await wait(repeat < 2 ? 110 : Math.max(16, 60 - repeat * 6));
      repeat++;
    }
    await wait(180);
    // 2 — type the new tail
    const tail = targetText.slice(keepText.length);
    for (let i = 0; i < tail.length; i++) {
      if (my !== token) return false;
      text += tail[i];
      // Commit a segment when its trailing slash arrives or the path ends.
      const ended = i === tail.length - 1 || tail[i + 1] === '/';
      let commit = -1;
      if (ended) {
        const done = text.split('/').filter(Boolean);
        segs = done.slice();
        commit = done.length - 1;
      }
      paint(commit);
      await wait(human(tail[i], tail[i + 1]));
    }
    segs = path.slice();
    paint(segs.length - 1);
    nav.classList.remove('is-typing');
    return true;
  }

  segs = o.path.slice();
  text = segs.length ? '/' + segs.join('/') : '';
  paint();

  return {
    el: nav,
    go,
    push: (label) => go([...segs, label]),
    pop: () => go(segs.slice(0, -1)),
    get path() { return segs.slice(); },
    destroy() {
      token++;
      nav.innerHTML = '';
      nav.classList.remove('sf-term', 'is-typing');
    },
  };
}

export default terminalCrumbs;
