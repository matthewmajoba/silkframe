/* Shared gallery helpers: icons, code highlighting, stage mounting. */
import { createScope } from './scope.js';
import { setManualClock, advance } from '../src/core/ticker.js';

/**
 * Debug / capture hook: window.__sf.freeze() then __sf.step(ms) renders
 * exact frames for both the JS ticker and Web Animations.
 */
window.__sf = {
  freeze() {
    setManualClock(true);
    document.getAnimations().forEach((a) => a.pause());
  },
  thaw() {
    setManualClock(false);
    document.getAnimations().forEach((a) => a.play());
  },
  /** Advance frame by frame, yielding between frames so promise chains run. */
  async step(ms, fps = 60) {
    const frame = 1000 / fps;
    for (let t = 0; t < ms; t += frame) {
      const dt = Math.min(frame, ms - t);
      advance(dt, fps);
      document.getAnimations().forEach((a) => {
        if (a.playState !== 'finished') {
          a.pause();
          a.currentTime = (a.currentTime || 0) + dt;
          // Paused animations never resolve .finished — complete them explicitly.
          const end = a.effect?.getComputedTiming().endTime;
          if (end !== undefined && end !== Infinity && a.currentTime >= end) a.finish();
        }
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  },
};

export const icons = {
  replay:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  code:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4l-7 7"/><path d="M4 20l7-7"/></svg>',
  prev:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  next:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  back:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
};

export const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tiny single-pass JS/CSS/HTML highlighter for usage snippets. */
export function highlight(src) {
  const re =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(import|from|export|const|let|await|async|new|return|function|default)\b|\b(\d+(?:\.\d+)?)\b|\b([a-zA-Z_$][\w$]*)(?=\()/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    out += escapeHTML(src.slice(last, m.index));
    const [tok, c, s, k, n, f] = m;
    const cls = c ? 'c' : s ? 's' : k ? 'k' : n ? 'n' : f ? 'f' : '';
    out += `<span class="tok-${cls}">${escapeHTML(tok)}</span>`;
    last = m.index + tok.length;
  }
  return out + escapeHTML(src.slice(last));
}

/** Mount a demo into a stage element; returns an unmount function. */
export function mountDemo(demo, stage) {
  stage.innerHTML = '';
  const scope = createScope();
  try {
    const r = demo.mount(stage, scope);
    if (r && typeof r.then === 'function') r.catch((e) => console.error(`[${demo.id}]`, e));
  } catch (err) {
    console.error(`[${demo.id}]`, err);
  }
  return () => {
    scope.destroy();
    stage.innerHTML = '';
  };
}
