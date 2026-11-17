/**
 * Cinematic Loader
 * A title-sequence preloader. Progress is never linear: it surges, stalls
 * and bursts like real network traffic while a large counter rolls and a
 * hairline fills. At 100 the numerals slip up out of their mask, the frame
 * holds, and the overlay parts into two shutters that slide away to reveal
 * the page beneath.
 *
 *   const loader = cinematicLoader(container, { label: 'Silkframe' });
 *   await loader.run();          // or loader.progress(p) with real data
 */
import { tick, wait } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, lerp, prefersReducedMotion } from '../core/utils.js';
import { css } from '../core/ease.js';
import { ensurePositioned } from '../core/snapshot.js';

injectStyle(
  'sf-loader',
  `.sf-ld{position:absolute;inset:0;z-index:60;pointer-events:none;color:var(--sf-ld-fg,#ede8df)}
.sf-ld-shutter{position:absolute;left:0;right:0;height:50.5%;background:var(--sf-ld-bg,#0a0a0d);will-change:transform}
.sf-ld-shutter.top{top:0}
.sf-ld-shutter.bottom{bottom:0}
.sf-ld-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:var(--sf-ld-pad,6%)}
.sf-ld-row{display:flex;justify-content:space-between;align-items:flex-end}
.sf-ld-label{font-family:var(--sf-ld-mono,ui-monospace,monospace);font-size:.8em;letter-spacing:.24em;text-transform:uppercase;opacity:.7;overflow:hidden}
.sf-ld-label>span{display:inline-block}
.sf-ld-count{font-variant-numeric:tabular-nums;line-height:.82;overflow:hidden;font-size:var(--sf-ld-size,9em);letter-spacing:-.04em}
.sf-ld-count>span{display:inline-block;will-change:transform}
.sf-ld-bar{position:absolute;left:var(--sf-ld-pad,6%);right:var(--sf-ld-pad,6%);top:50%;height:1px;background:rgba(255,255,255,.12);overflow:hidden}
.sf-ld-bar>i{position:absolute;inset:0;background:var(--sf-ld-accent,#ffb547);transform-origin:0 50%;transform:scaleX(0)}`
);

const DEFAULTS = {
  label: 'Loading',
  duration: 2600, // simulated load time for run()
  seed: 2,
};

export function cinematicLoader(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  ensurePositioned(container);
  const root = document.createElement('div');
  root.className = 'sf-ld';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.innerHTML = `
    <div class="sf-ld-shutter top"></div><div class="sf-ld-shutter bottom"></div>
    <div class="sf-ld-bar"><i></i></div>
    <div class="sf-ld-ui">
      <div class="sf-ld-row"><span class="sf-ld-label"><span></span></span><span class="sf-ld-label"><span>Est. 2026</span></span></div>
      <div class="sf-ld-row"><span class="sf-ld-label"><span>Preparing scene</span></span><span class="sf-ld-count"><span>0</span></span></div>
    </div>`;
  root.querySelector('.sf-ld-label span').textContent = o.label;
  const count = root.querySelector('.sf-ld-count span');
  const bar = root.querySelector('.sf-ld-bar i');
  const shutters = root.querySelectorAll('.sf-ld-shutter');
  const ui = root.querySelector('.sf-ld-ui');
  let shown = 0;
  let target = 0;
  let off = null;

  function render() {
    const n = Math.round(shown);
    count.textContent = String(n);
    bar.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;
    root.setAttribute('aria-valuenow', String(n));
  }

  function ensureLoop() {
    if (off) return;
    off = tick((_, dt) => {
      // Critically-damped chase: fast when far, gentle near the target.
      shown += (target - shown) * (1 - Math.exp(-(dt / 1000) * 6));
      if (Math.abs(target - shown) < 0.05) shown = target;
      render();
    });
  }

  function mount() {
    root.style.visibility = '';
    shutters.forEach((s) => (s.style.transform = ''));
    ui.style.opacity = '';
    count.style.transform = '';
    shown = target = 0;
    render();
    container.appendChild(root);
  }

  /** Feed real progress (0–100). */
  function progress(p) {
    target = clamp(p, 0, 100);
    ensureLoop();
  }

  /** Simulated, organically uneven load. Resolves after the reveal. */
  async function run() {
    mount();
    if (prefersReducedMotion()) { await wait(300); return reveal(); }
    const rand = mulberry32(o.seed);
    // Build a lumpy progress profile: bursts and stalls.
    const marks = [0];
    let acc = 0;
    while (acc < 100) {
      acc = Math.min(100, acc + 6 + rand() * 26);
      marks.push(acc);
    }
    const stepMs = o.duration / (marks.length - 1);
    ensureLoop();
    for (let i = 1; i < marks.length; i++) {
      target = marks[i];
      await wait(stepMs * (0.5 + rand()));
    }
    target = 100;
    while (shown < 99.95) await wait(30);
    return reveal();
  }

  async function reveal() {
    off?.();
    off = null;
    shown = 100;
    render();
    await wait(260);
    const D = 1100;
    const anims = [
      count.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-105%,0)' }], { duration: 700, easing: css.inOutQuart, fill: 'forwards' }),
      ui.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 250, easing: 'ease-out', fill: 'forwards' }),
      bar.parentElement.animate([{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(0)', opacity: 0 }], { duration: 600, delay: 200, easing: css.inOutQuart, fill: 'forwards' }),
    ];
    await wait(520);
    anims.push(
      shutters[0].animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-101%,0)' }], { duration: D, easing: css.inOutExpo, fill: 'forwards' }),
      shutters[1].animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,101%,0)' }], { duration: D, easing: css.inOutExpo, fill: 'forwards' })
    );
    await Promise.all(anims.map((a) => a.finished)).catch(() => {});
    root.remove();
    anims.forEach((a) => a.cancel());
    return true;
  }

  return {
    run,
    progress,
    reveal,
    destroy() {
      off?.();
      root.remove();
    },
  };
}

export default cinematicLoader;
