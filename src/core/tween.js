/**
 * Silkframe — frame-loop tween.
 * tween({ duration, delay, ease, onUpdate(eased, raw), onComplete })
 * Returns a thenable handle with stop().
 * The update callback fires synchronously with progress 0 so the start
 * state is applied before the first paint (no flash of final content).
 */
import { tick } from './ticker.js';
import { cinematic } from './ease.js';

export function tween({
  duration = 1000,
  delay = 0,
  ease = cinematic,
  onUpdate,
  onComplete,
  immediate = true,
} = {}) {
  let elapsed = -delay;
  let done = false;
  let resolve;
  const finished = new Promise((r) => (resolve = r));

  const finish = (skipped) => {
    if (done) return;
    done = true;
    off();
    if (!skipped) onComplete?.();
    resolve(!skipped);
  };

  if (immediate) onUpdate?.(ease(0), 0);

  const off = tick((_, dt) => {
    elapsed += dt;
    if (elapsed < 0) return;
    const raw = duration <= 0 ? 1 : Math.min(elapsed / duration, 1);
    onUpdate?.(ease(raw), raw);
    if (raw >= 1) finish(false);
  });

  return {
    finished,
    then: (a, b) => finished.then(a, b),
    /** Stop without completing. */
    stop: () => finish(true),
    /** Jump to the end state and complete. */
    complete: () => {
      if (done) return;
      onUpdate?.(ease(1), 1);
      finish(false);
    },
  };
}

/** Run many tweens and resolve when all have finished. */
export function all(handles) {
  return {
    finished: Promise.all(handles.map((h) => h.finished)),
    stop: () => handles.forEach((h) => h.stop()),
  };
}
