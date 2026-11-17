import { demos, byId } from './demos/index.js';
import { icons, mountDemo } from './ui.js';
import { fontsReady } from './fonts.js';

const $ = (id) => document.getElementById(id);
const stageWrap = $('vstage');
const stage = stageWrap.querySelector('.stage');
$('back').innerHTML = `${icons.back}Library`;
$('prev').innerHTML = icons.prev;
$('next').innerHTML = icons.next;
$('replay').innerHTML = icons.replay;

let current = null;
let unmount = null;

function show(id, push = true) {
  const demo = byId[id] || demos[0];
  if (!demo) return;
  current = demo;
  unmount?.();
  $('code').textContent = demo.code;
  $('name').textContent = demo.name;
  $('desc').textContent = demo.description;
  $('back').href = `index.html#${demo.id}`;
  document.title = `${demo.name} — Silkframe Theatre`;
  stageWrap.dataset.theme = demo.theme || 'dark';
  const hint = $('hint');
  hint.hidden = !demo.hint;
  hint.querySelector('span').textContent = demo.hint || '';
  if (push) history.replaceState(null, '', `?fx=${demo.id}`);
  // Mount after layout so container-relative sizes resolve.
  requestAnimationFrame(() => (unmount = mountDemo(demo, stage)));
}

const step = (d) => {
  const i = demos.indexOf(current);
  show(demos[(i + d + demos.length) % demos.length].id);
};

$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('replay').addEventListener('click', () => show(current.id, false));
addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key.toLowerCase() === 'r') show(current.id, false);
});

fontsReady.then(() => show(new URLSearchParams(location.search).get('fx'), true));

/** Capture hook: mount a demo on a frozen clock and step to `ms`. */
window.__view = {
  async frame(id, ms = 0) {
    window.__sf.freeze();
    unmount?.();
    const demo = byId[id];
    current = demo;
    stageWrap.dataset.theme = demo.theme || 'dark';
    $('code').textContent = demo.code;
    $('name').textContent = demo.name;
    $('desc').textContent = demo.description;
    const hint = $('hint');
    hint.hidden = !demo.hint;
    hint.querySelector('span').textContent = demo.hint || '';
    unmount = mountDemo(demo, stage);
    await new Promise((r) => setTimeout(r, 80));
    await window.__sf.step(ms);
    return true;
  },
  async step(ms) { await window.__sf.step(ms); return true; },
};
