/**
 * Silkframe — style injection.
 * Each effect ships its own minimal CSS and injects it once, so importing
 * a single effect module is all a project needs.
 */
const injected = new Set();

export function injectStyle(id, css) {
  if (injected.has(id) || typeof document === 'undefined') return;
  injected.add(id);
  const el = document.createElement('style');
  el.dataset.silkframe = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/* Visually hidden but available to assistive technology. */
injectStyle(
  'sf-core',
  `.sf-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}`
);
