import { categories, demos } from './demos/index.js';
import { icons, highlight, escapeHTML, mountDemo } from './ui.js';
import { Spring } from '../src/core/spring.js';
import { tick } from '../src/core/ticker.js';
import { curtainLines } from '../src/text/curtain-lines.js';
import { signalDecode } from '../src/text/signal-decode.js';
import { fontsReady } from './fonts.js';
import { textRing } from '../src/text/text-ring.js';
import { odometer } from '../src/ui/odometer.js';

const library = document.getElementById('library');
const pills = document.getElementById('pills');

/* ---------- Build sections ---------- */

const cardFor = (demo) => {
  const el = document.createElement('article');
  el.className = 'fx';
  el.id = demo.id;
  el.innerHTML = `
    <div class="fx-stage" data-theme="${demo.theme || 'dark'}">
      <div class="stage"></div>
      ${demo.hint ? `<span class="fx-hint"><i></i>${escapeHTML(demo.hint)}</span>` : ''}
    </div>
    <div class="fx-meta">
      <div class="fx-head">
        <span class="fx-code">${demo.code}</span>
        <h3 class="fx-name">${escapeHTML(demo.name)}</h3>
        <div class="fx-actions">
          <button class="fx-btn" data-act="replay" title="Replay" aria-label="Replay ${escapeHTML(demo.name)}">${icons.replay}</button>
          <button class="fx-btn" data-act="code" title="Usage" aria-label="Show usage" aria-expanded="false">${icons.code}</button>
          <a class="fx-btn" href="view.html?fx=${demo.id}" title="Open full screen" aria-label="Open ${escapeHTML(demo.name)} full screen">${icons.expand}</a>
        </div>
      </div>
      <p class="fx-desc">${escapeHTML(demo.description)}</p>
      <ul class="fx-tags">${(demo.tags || []).map((t) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
    </div>
    <div class="fx-code-panel"><div>
      <div class="code-bar"><span>${escapeHTML(demo.file || '')}</span><button data-act="copy">Copy</button></div>
      <pre class="code"><code>${highlight(demo.usage || '')}</code></pre>
    </div></div>`;
  return el;
};

const byArticle = new Map();
categories.forEach((cat, ci) => {
  const section = document.createElement('section');
  section.className = 'section wrap';
  section.id = `cat-${cat.id}`;
  section.innerHTML = `
    <header class="section-head">
      <span class="section-index">${String(ci + 1).padStart(2, '0')}</span>
      <div>
        <h2 class="section-title">${cat.title}</h2>
        <p class="section-blurb">${escapeHTML(cat.blurb)}</p>
      </div>
      <span class="section-count">${cat.demos.length} effects</span>
    </header>
    <div class="grid"></div>`;
  const grid = section.querySelector('.grid');
  demos
    .filter((d) => d.category === cat.id)
    .forEach((d) => {
      const card = cardFor(d);
      byArticle.set(card, d);
      grid.appendChild(card);
    });
  library.appendChild(section);
});

/* ---------- Lazy mount / unmount ---------- */

const live = new Map();
const mount = (card) => {
  if (live.has(card)) return;
  live.set(card, mountDemo(byArticle.get(card), card.querySelector('.stage')));
};
const unmount = (card) => {
  const off = live.get(card);
  if (off) { off(); live.delete(card); }
};

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const card = e.target.closest('.fx');
      if (e.intersectionRatio >= 0.35) mount(card);
      else if (!e.isIntersecting) unmount(card);
    }
  },
  { threshold: [0, 0.35] }
);
fontsReady.then(() => byArticle.forEach((_, card) => io.observe(card.querySelector('.fx-stage'))));

document.addEventListener('visibilitychange', () => {
  // Pause everything while the tab is hidden; remount visible stages on return.
  if (document.hidden) {
    [...live.keys()].forEach(unmount);
  } else {
    byArticle.forEach((_, card) => {
      const r = card.querySelector('.fx-stage').getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) mount(card);
    });
  }
});

/* ---------- Card actions ---------- */

library.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = btn.closest('.fx');
  const act = btn.dataset.act;
  if (act === 'replay') {
    unmount(card);
    mount(card);
  } else if (act === 'code') {
    const panel = card.querySelector('.fx-code-panel');
    const open = !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  } else if (act === 'copy') {
    const demo = byArticle.get(card);
    try {
      await navigator.clipboard.writeText(demo.usage);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Select & copy';
    }
    setTimeout(() => (btn.textContent = 'Copy'), 1600);
  }
});

/* ---------- Category pills with a liquid indicator ---------- */

const indicator = document.createElement('span');
indicator.className = 'pill-indicator';
pills.appendChild(indicator);
const total = demos.length;
const pillDefs = [{ id: 'all', label: 'All', count: total }, ...categories.map((c) => ({ id: c.id, label: c.label, count: c.demos.length }))];
pillDefs.forEach((p) => {
  const b = document.createElement('button');
  b.className = 'pill';
  b.dataset.cat = p.id;
  b.innerHTML = `${p.label}<sup>${p.count}</sup>`;
  b.addEventListener('click', () => {
    const target = p.id === 'all' ? library : document.getElementById(`cat-${p.id}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  pills.appendChild(b);
});

// Leading edge is stiff, trailing edge is soft — the pill stretches like liquid.
const left = new Spring(0, { stiffness: 260, damping: 26 });
const right = new Spring(0, { stiffness: 260, damping: 26 });
let indicatorOff = null;
let initialised = false;
function moveIndicator(id) {
  const btn = pills.querySelector(`[data-cat="${id}"]`);
  if (!btn) return;
  pills.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-current', String(p === btn)));
  const l = btn.offsetLeft, r = l + btn.offsetWidth;
  if (!initialised) {
    left.set(l); right.set(r); initialised = true;
  } else {
    const goingRight = l > left.value;
    left.stiffness = goingRight ? 120 : 320;
    right.stiffness = goingRight ? 320 : 120;
    left.damping = goingRight ? 18 : 28;
    right.damping = goingRight ? 28 : 18;
    left.to(l); right.to(r);
  }
  if (!indicatorOff) {
    indicatorOff = tick((_, dt) => {
      left.step(dt / 1000); right.step(dt / 1000);
      indicator.style.transform = `translate3d(${left.value.toFixed(2)}px,0,0)`;
      indicator.style.width = `${Math.max(0, right.value - left.value).toFixed(2)}px`;
      if (left.resting && right.resting) { indicatorOff(); indicatorOff = null; }
    });
  }
}
moveIndicator('all');

const sectionIO = new IntersectionObserver(
  (entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) moveIndicator(visible.target.id.replace('cat-', ''));
  },
  { rootMargin: '-35% 0px -55% 0px' }
);
document.querySelectorAll('.section').forEach((s) => sectionIO.observe(s));
const heroIO = new IntersectionObserver(([e]) => e.isIntersecting && moveIndicator('all'), { rootMargin: '0px 0px -60% 0px' });
heroIO.observe(document.querySelector('.hero'));

/* ---------- Stats + hero intro (dogfooding the library) ---------- */

const statTotal = odometer(document.getElementById('stat-total'), { value: 0, duration: 2200 });
const statCats = odometer(document.getElementById('stat-cats'), { value: 0, duration: 1800 });
document.getElementById('catnav-meta').textContent = `${total} effects · zero dependencies`;

fontsReady.then(() => {
  const title = document.querySelector('.hero-title');
  title.style.visibility = '';
  curtainLines(title, { by: 'chars', stagger: 120, charStagger: 22, duration: 1600, rotate: 9 }).play();
  const eyebrow = document.querySelector('.eyebrow span');
  signalDecode(eyebrow, { duration: 1400, beam: false, glyphs: 'cipher' }).play();
  setTimeout(() => { statTotal.set(total); statCats.set(categories.length); }, 700);
  // Hero visual: the Orbit Ring around a glowing core (desktop only).
  const ringEl = document.querySelector('.hero-ring');
  if (ringEl && matchMedia('(min-width: 900px)').matches) {
    const orb = document.createElement('div');
    orb.className = 'hero-orb';
    textRing(ringEl, { tilt: -18, speed: 14, minRadius: Math.min(innerWidth * 0.16, 290), center: orb, fade: 0.06 }).play();
  }
});
