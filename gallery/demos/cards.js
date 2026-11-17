import { holoCard } from '../../src/cards/holo-card.js';
import { expandingPanels } from '../../src/cards/expanding-panels.js';
import { depthCard } from '../../src/cards/depth-card.js';
import { flipCard } from '../../src/cards/flip-card.js';
import { cardDeck } from '../../src/cards/card-deck.js';
import { dustCard } from '../../src/cards/dust-card.js';
import { auroraBorder } from '../../src/cards/aurora-border.js';
import { expandCard } from '../../src/cards/expand-card.js';
import { orbitCarousel } from '../../src/cards/orbit-carousel.js';
import { lensReveal } from '../../src/cards/lens-reveal.js';
import { fanHand } from '../../src/cards/fan-hand.js';
import { spotlightGrid } from '../../src/cards/spotlight-grid.js';

const html = (stage, markup) => {
  stage.innerHTML = markup;
  return stage.firstElementChild;
};

const ALBUMS = [
  { t: 'Nocturne', s: 'Side A · 41:12', c: 'linear-gradient(150deg,#1d2340,#4d3a8f 55%,#c07bd8)' },
  { t: 'Solstice', s: 'Side B · 38:40', c: 'linear-gradient(150deg,#3a1407,#c2541e 55%,#ffcf7a)' },
  { t: 'Velvet', s: 'Live · 52:03', c: 'linear-gradient(150deg,#2a0612,#8f1d3f 55%,#ff8fa8)' },
  { t: 'Tidal', s: 'EP · 22:18', c: 'linear-gradient(150deg,#04161d,#0f6b74 55%,#7fe8d6)' },
  { t: 'Halcyon', s: 'Side A · 44:51', c: 'linear-gradient(150deg,#141a0b,#5b7a1f 55%,#e3f08a)' },
  { t: 'Aurum', s: 'Deluxe · 61:30', c: 'linear-gradient(150deg,#1a1205,#9b6b16 55%,#ffe3a0)' },
  { t: 'Glass', s: 'Single · 04:12', c: 'linear-gradient(150deg,#0c0f18,#3a4f7a 55%,#bcd2ff)' },
];

const album = (a, i) => `
  <article class="d-album" style="--art:${a.c}">
    <span class="d-album-no">No. ${String(i + 1).padStart(2, '0')}</span>
    <div class="d-album-art"><i></i></div>
    <h4>${a.t}</h4><p>${a.s}</p>
  </article>`;

export default [
  {
    id: 'holo-foil',
    name: 'Holographic Foil',
    description: 'A collectible surface: spring tilt, an iridescent foil band that slides with viewing angle, diffraction-line texture, glitter that only sparkles near the light, and a tracking glare.',
    tags: ['tilt', 'blend modes', 'idle drift'],
    hint: 'Hover and tilt the card',
    file: 'src/cards/holo-card.js',
    usage: `import { holoCard } from './src/cards/holo-card.js';

holoCard('.member-card', { maxTilt: 14, lift: 24 });`,
    mount(stage, scope) {
      const card = html(
        stage,
        `<div class="d-holo">
          <div class="d-holo-top"><span>Silkframe</span><span>Nº 0042</span></div>
          <div class="d-holo-emblem"><i></i></div>
          <div class="d-holo-name">Founding<br><em>Member</em></div>
          <div class="d-holo-foot"><span>Vol. 01</span><span>Since 2026</span></div>
        </div>`
      );
      scope.use(holoCard(card));
    },
  },
  {
    id: 'diorama-depth',
    name: 'Diorama Depth',
    description: 'Turns a flat card into a shadow-box: layers tagged with data-depth slide in parallax against the tilt, so the scene inside has real distance while the clip stays perfect.',
    tags: ['parallax', 'data-depth', 'tilt'],
    hint: 'Move across the card',
    file: 'src/cards/depth-card.js',
    usage: `<div class="card">
  <div data-depth="0">sky</div>  <div data-depth="0.5">hills</div>
  <h3 data-depth="1">Title</h3>
</div>

import { depthCard } from './src/cards/depth-card.js';
depthCard('.card', { maxTilt: 9, depth: 26 });`,
    mount(stage, scope) {
      const card = html(
        stage,
        `<div class="d-diorama">
          <div class="dio-sky" data-depth="0"></div>
          <div class="dio-sun" data-depth="0.12"></div>
          <svg class="dio-layer" data-depth="0.35" viewBox="0 0 400 300" preserveAspectRatio="none"><path d="M0 190 L60 150 L110 175 L170 120 L230 165 L290 130 L350 160 L400 140 L400 300 L0 300Z" fill="#6c3b56"/></svg>
          <svg class="dio-layer" data-depth="0.6" viewBox="0 0 400 300" preserveAspectRatio="none"><path d="M0 225 L50 200 L95 215 L150 180 L210 220 L265 190 L320 214 L400 185 L400 300 L0 300Z" fill="#3d2340"/></svg>
          <svg class="dio-layer" data-depth="0.9" viewBox="0 0 400 300" preserveAspectRatio="none"><path d="M0 260 Q 80 230 150 252 T 300 246 T 400 238 L400 300 L0 300Z" fill="#1c1022"/></svg>
          <div class="dio-text" data-depth="1.15"><span>Chapter III</span><h4>The Long<br>Horizon</h4></div>
        </div>`
      );
      scope.use(depthCard(card));
    },
  },
  {
    id: 'physical-flip',
    name: 'Physical Flip',
    description: 'A card with real thickness: it arcs toward you as it turns, its edge shows at ninety degrees, light rakes across each face and the shadow tightens with height. Drag it — momentum decides the face.',
    tags: ['3D', 'drag', 'springs', 'keyboard'],
    hint: 'Click or drag sideways',
    file: 'src/cards/flip-card.js',
    usage: `<div class="card">
  <div class="front">…</div>
  <div class="back">…</div>
</div>

import { flipCard } from './src/cards/flip-card.js';
const card = flipCard('.card', { thickness: 3, lift: 90 });
card.flip();`,
    mount(stage, scope) {
      const card = html(
        stage,
        `<div class="d-ticket">
          <div class="front">
            <span class="tk-kicker">Admit one</span>
            <h4>Premiere</h4>
            <p>Hall 7 · Row F · Seat 12</p>
            <div class="tk-foot"><span>21:00</span><span>16·11·26</span></div>
          </div>
          <div class="back">
            <div class="tk-code">${Array.from({ length: 64 }, (_, i) => `<i style="opacity:${((i * 37) % 11) / 10 + 0.1}"></i>`).join('')}</div>
            <p>Scan at the door</p>
            <span class="tk-kicker">Silkframe Cinema</span>
          </div>
        </div>`
      );
      const fx = scope.use(flipCard(card));
      let touched = false;
      scope.on(card, 'pointerdown', () => (touched = true));
      scope.loop(async () => {
        await scope.wait(2600);
        if (!touched) fx.flip();
      });
    },
  },
  {
    id: 'throwable-deck',
    name: 'Throwable Deck',
    description: 'A stack you can physically throw. The top card tracks your hand with a grab-dependent pivot; flick it and it flies along your throw, then slides back in at the bottom as the pile rises.',
    tags: ['drag physics', 'velocity', 'stack'],
    hint: 'Grab the top card and throw it',
    file: 'src/cards/card-deck.js',
    usage: `import { cardDeck } from './src/cards/card-deck.js';

const deck = cardDeck('.deck', { visible: 4, offset: 14 });
deck.next('left');   // programmatic throw`,
    mount(stage, scope) {
      const deck = html(stage, `<div class="d-deck">${ALBUMS.slice(0, 5).map(album).join('')}</div>`);
      const fx = scope.use(cardDeck(deck, { offset: 26, scaleStep: 0.045 }));
      let touched = false;
      scope.on(deck, 'pointerdown', () => (touched = true));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(2200);
        if (!touched) fx.next(n++ % 2 ? 'left' : 'right');
      });
    },
  },
  {
    id: 'dust-dissolve',
    name: 'Dust Dissolve',
    description: 'The card disintegrates into ash. A jittered lattice cuts the live element into gap-free flakes; a noisy front sweeps across while turbulent wind curls each flake away. restore() rewinds it.',
    tags: ['fragments', 'turbulence', 'rewind'],
    file: 'src/cards/dust-card.js',
    usage: `import { dustCard } from './src/cards/dust-card.js';

const fx = dustCard(card, { cols: 16, rows: 11, wind: -25 });
await fx.dissolve();
await fx.restore();`,
    mount(stage, scope) {
      const wrap = html(
        stage,
        `<div class="d-dust-wrap"><article class="d-profile">
          <div class="pf-art"><i></i></div>
          <div class="pf-body"><span>Director of Photography</span><h4>Ines Varga</h4><p>Lisbon · 14 features · 3 awards</p></div>
        </article></div>`
      );
      const card = wrap.querySelector('.d-profile');
      const fx = scope.use(dustCard(card));
      scope.loop(async () => {
        await Promise.all([fx.prepare(), scope.wait(1600)]);
        await fx.dissolve();
        await Promise.all([fx.prepare(), scope.wait(500)]);
        await fx.restore();
      });
    },
  },
  {
    id: 'aurora-edge',
    name: 'Aurora Edge',
    description: 'A comet of light circles the border on a conic gradient with an aurora bleeding outside the card. As the pointer nears, the card wakes: the ring brightens, the comet accelerates, the edge tracks you.',
    tags: ['conic gradient', 'proximity', 'mask'],
    hint: 'Bring your cursor close',
    file: 'src/cards/aurora-border.js',
    usage: `import { auroraBorder } from './src/cards/aurora-border.js';

auroraBorder('.plan-card', {
  colors: ['#ffb547', '#ff5fa2', '#7ea6ff'], width: 1.5, reach: 140,
});`,
    mount(stage, scope) {
      const card = html(
        stage,
        `<div class="d-plan">
          <span class="pl-tag">Most loved</span>
          <h4>Studio</h4>
          <p class="pl-price"><b>$49</b> / month</p>
          <ul><li>Every effect, every update</li><li>Commercial licence</li><li>Source + capture mode</li></ul>
          <span class="pl-btn">Start creating</span>
        </div>`
      );
      const fx = scope.use(auroraBorder(card));
      // Gallery: breathe the wake level while untouched.
      let human = false;
      scope.on(stage, 'pointerenter', () => (human = true));
      scope.on(stage, 'pointerleave', () => (human = false));
      const t0 = performance.now();
      scope.interval(() => {
        if (!human) fx.setWake(0.35 + 0.35 * Math.sin((performance.now() - t0) / 900));
      }, 120);
    },
  },
  {
    id: 'portal-expand',
    name: 'Portal Expand',
    description: 'A shared-element expansion: the detail view opens through a clip that starts exactly on the tapped card while its artwork scales into the hero. Siblings recede into depth; copy rises in after.',
    tags: ['FLIP', 'clip-path', 'choreography'],
    hint: 'Click a card · click again to close',
    file: 'src/cards/expand-card.js',
    usage: `import { expandCard } from './src/cards/expand-card.js';

const portal = expandCard(gallery, { siblings: cards });
card.onclick = () => portal.open(card, detailFor(card));
closeBtn.onclick = () => portal.close();`,
    mount(stage, scope) {
      const root = html(
        stage,
        `<div class="d-portal">
          <div class="d-portal-grid">${ALBUMS.slice(0, 3).map(album).join('')}</div>
        </div>`
      );
      const cards = [...root.querySelectorAll('.d-album')];
      const portal = scope.use(expandCard(root, { siblings: cards }));
      const detail = (i) => {
        const a = ALBUMS[i];
        const d = document.createElement('section');
        d.className = 'd-portal-detail';
        d.innerHTML = `<div class="pd-hero" data-portal-hero style="background:${a.c}"><i></i></div>
          <div class="pd-copy"><span data-portal-rise>No. ${String(i + 1).padStart(2, '0')} · ${a.s}</span>
          <h4 data-portal-rise>${a.t}</h4>
          <p data-portal-rise>Recorded to tape in a single night. Twelve songs about light leaving a room.</p></div>`;
        return d;
      };
      let current = null;
      let busy = false;
      let touched = false;
      const toggle = async (i) => {
        if (busy) return;
        busy = true;
        if (portal.isOpen) {
          await portal.close();
          current?.remove();
          current = null;
        } else {
          current = detail(i);
          await portal.open(cards[i], current);
        }
        busy = false;
      };
      cards.forEach((c, i) => scope.on(c, 'click', () => { touched = true; toggle(i); }));
      scope.on(root, 'click', (e) => { if (portal.isOpen && !e.target.closest('.d-album')) { touched = true; toggle(0); } });
      let n = 0;
      scope.loop(async () => {
        await scope.wait(portal.isOpen ? 2200 : 1400);
        if (!touched) await toggle(n++ % 3);
      });
    },
  },
  {
    id: 'orbit-carousel',
    name: 'Orbit Carousel',
    description: 'Cards on a true 3D turntable. Drag to spin — release and it coasts with inertia before a spring eases the nearest card to the front. Far cards dim and soften; a floor reflection grounds it.',
    tags: ['3D', 'inertia', 'snap'],
    hint: 'Drag to spin',
    file: 'src/cards/orbit-carousel.js',
    usage: `import { orbitCarousel } from './src/cards/orbit-carousel.js';

const ring = orbitCarousel('.carousel', { tilt: -8, autoplay: 3200 });
ring.next();`,
    mount(stage, scope) {
      const ring = html(stage, `<div class="d-orbit">${ALBUMS.map(album).join('')}</div>`);
      scope.use(orbitCarousel(ring, { autoplay: 2200 }));
    },
  },
  {
    id: 'lens-reveal',
    name: 'Lens Reveal',
    description: 'A liquid lens glides after the pointer revealing a second layer — the blueprint behind the render. It swells on entry, stretches with velocity like a drop of water and carries a refracted rim.',
    tags: ['mask', 'springs', 'velocity stretch'],
    hint: 'Move over the card',
    file: 'src/cards/lens-reveal.js',
    usage: `<div class="card">
  <div class="base">…</div>
  <div class="reveal">…</div>
</div>

import { lensReveal } from './src/cards/lens-reveal.js';
lensReveal('.card', { radius: 110 });`,
    mount(stage, scope) {
      const card = html(
        stage,
        `<div class="d-lens">
          <div class="base"><div class="ln-orb"></div><span class="ln-k">Render · 01</span><h4>Pavilion</h4></div>
          <div class="reveal"><div class="ln-grid"></div><div class="ln-wire"></div><span class="ln-k">Blueprint · 01</span><h4>Pavilion</h4></div>
        </div>`
      );
      scope.use(lensReveal(card, { radius: 95 }));
    },
  },
  {
    id: 'fanned-hand',
    name: 'Fanned Hand',
    description: 'Cards held like a hand at the table, fanned on an arc. Hover one and it rises out of the hand, straightening, while neighbours lean away on springs; the hand breathes at rest. Click to select.',
    tags: ['arc layout', 'springs', 'falloff'],
    hint: 'Hover across the hand',
    file: 'src/cards/fan-hand.js',
    usage: `import { fanHand } from './src/cards/fan-hand.js';

const hand = fanHand('.hand', { spread: 44, lift: 0.22, onSelect: (i) => pick(i) });
hand.focus(2);`,
    mount(stage, scope) {
      const hand = html(stage, `<div class="d-hand">${ALBUMS.slice(0, 6).map(album).join('')}</div>`);
      const fx = scope.use(fanHand(hand));
      let human = false;
      scope.on(hand, 'pointerenter', () => (human = true));
      scope.on(hand, 'pointerleave', () => (human = false));
      let i = 0;
      const seq = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, -1];
      scope.loop(async () => {
        await scope.wait(seq[i % seq.length] === -1 ? 1600 : 420);
        if (!human) fx.focus(seq[i++ % seq.length]);
      });
    },
  },
  {
    id: 'spotlight-grid',
    name: 'Spotlight Grid',
    description: 'One light, many surfaces: a single soft spotlight follows the pointer across the grid, every border catching it as it passes and the nearest surface glowing from within — gliding on a spring.',
    tags: ['shared light', 'mask', 'springs'],
    hint: 'Move across the grid',
    file: 'src/cards/spotlight-grid.js',
    usage: `import { spotlightGrid } from './src/cards/spotlight-grid.js';

spotlightGrid('.features', { radius: 260, color: '255,181,71' });`,
    mount(stage, scope) {
      const feats = [['Springs', '240 Hz fixed-step physics'], ['Capture', 'Frame-exact export'], ['A11y', 'Reduced motion built in'], ['Zero deps', 'One import per effect'], ['Splitter', 'Grapheme-aware text'], ['Theming', 'CSS custom properties']];
      const grid = html(stage, `<div class="d-spotgrid">${feats.map(([t, d]) => `<article><span>✦</span><h4>${t}</h4><p>${d}</p></article>`).join('')}</div>`);
      scope.use(spotlightGrid(grid, { radius: 230, color: '255,196,120' }));
    },
  },
  {
    id: 'expanding-panels',
    name: 'Expanding Panels',
    description: 'A row of tall panels that behaves like a curtain of glass: the focused panel widens on a spring while its siblings compress, its copy rises in once there is room and the artwork inside parallaxes.',
    tags: ['flex springs', 'parallax', 'focusable'],
    hint: 'Hover the panels',
    file: 'src/cards/expanding-panels.js',
    usage: `<div class="panels">
  <article><div data-panel-art>\u2026</div><div data-panel-copy>\u2026</div></article>
  \u2026
</div>

import { expandingPanels } from './src/cards/expanding-panels.js';
expandingPanels('.panels', { grow: 3.4 });`,
    mount(stage, scope) {
      const items = [
        ['Dawn', 'linear-gradient(180deg,#1d1230,#6b2f45 40%,#d9714a 75%,#ffc98a)'],
        ['Noir', 'radial-gradient(130% 100% at 75% 0%,#23345a,#0b1224 46%,#04060c)'],
        ['Bloom', 'radial-gradient(120% 120% at 25% 80%,#47e0b1,#11806b 32%,#072b27 70%)'],
        ['Ember', 'linear-gradient(160deg,#140403,#4d1006 46%,#c2431a 82%,#ff8a3d)'],
        ['Tide', 'linear-gradient(170deg,#04161d,#0f6b74 55%,#7fe8d6)'],
      ];
      const row = html(stage, `<div class="d-panels">${items.map(([t, bg], i) => `<article><div data-panel-art style="background:${bg}"></div><span class="pn-no">0${i + 1}</span><div data-panel-copy><h4>${t}</h4><p>Scene ${String(i + 1).padStart(2, '0')} \u00b7 4K \u00b7 ProRes</p></div></article>`).join('')}</div>`);
      const fx = scope.use(expandingPanels(row));
      let human = false;
      scope.on(row, 'pointerenter', () => (human = true));
      scope.on(row, 'pointerleave', () => (human = false));
      let i = 0;
      scope.loop(async () => {
        await scope.wait(1500);
        if (!human) fx.open(++i % items.length);
      });
    },
  },
];
