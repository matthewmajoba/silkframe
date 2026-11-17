import { liquidCrumbs } from '../../src/breadcrumbs/liquid-crumbs.js';
import { titleHandoff } from '../../src/breadcrumbs/title-handoff.js';
import { ropeCrumbs } from '../../src/breadcrumbs/rope-crumbs.js';
import { inkCrumbs } from '../../src/breadcrumbs/ink-crumbs.js';
import { constellationCrumbs } from '../../src/breadcrumbs/constellation-crumbs.js';
import { accordionCrumbs } from '../../src/breadcrumbs/accordion-crumbs.js';
import { terminalCrumbs } from '../../src/breadcrumbs/terminal-crumbs.js';
import { depthStack } from '../../src/breadcrumbs/depth-stack.js';
import { rollingCrumbs } from '../../src/breadcrumbs/rolling-crumbs.js';

/** A mini page: breadcrumb on top, the current page title below it. */
function page(stage, cls = '') {
  stage.innerHTML = `<div class="d-crumbpage ${cls}"><div class="d-crumbs"></div><div class="d-page-title"><span></span></div></div>`;
  const root = stage.firstElementChild;
  const titleBox = root.querySelector('.d-page-title');
  let shown = '';
  return {
    root,
    nav: root.querySelector('.d-crumbs'),
    title(text) {
      if (text === shown) return;
      shown = text;
      const old = titleBox.querySelector('span');
      const next = document.createElement('span');
      next.textContent = text;
      titleBox.appendChild(next);
      next.animate([{ opacity: 0, transform: 'translate3d(0,0.35em,0)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards',
      });
      if (old) old.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate3d(0,-0.25em,0)', filter: 'blur(4px)' }], { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished.then(() => old.remove());
    },
  };
}

/** Run a navigation script until the visitor interacts. */
function script(scope, el, steps, gap = 1150) {
  let touched = false;
  scope.on(el, 'pointerdown', () => (touched = true));
  let i = 0;
  scope.loop(async () => {
    await scope.wait(gap);
    if (touched) return;
    await steps[i++ % steps.length]();
  });
}

export default [
  {
    id: 'liquid-trail',
    name: 'Liquid Trail',
    description: 'The active marker moves like a drop of liquid — a stiff leading edge races ahead while a soft trailing edge lags, stretching and thinning the pill. New levels unfurl; going up absorbs deeper crumbs.',
    tags: ['asymmetric springs', 'unfurl', 'aria-current'],
    hint: 'Click any earlier crumb',
    file: 'src/breadcrumbs/liquid-crumbs.js',
    usage: `import { liquidCrumbs } from './src/breadcrumbs/liquid-crumbs.js';

const crumbs = liquidCrumbs(nav, { items: ['Home', 'Library'], onNavigate: (i) => route(i) });
crumbs.push('Text');
crumbs.go(0);`,
    mount(stage, scope) {
      const p = page(stage);
      const c = scope.use(liquidCrumbs(p.nav, { items: ['Home', 'Library'], onNavigate: (_, items) => p.title(items[items.length - 1]) }));
      p.title('Library');
      const nav = (fn) => async () => { await fn(); p.title(c.items[c.items.length - 1]); };
      const push = (l) => nav(() => { const r = c.push(l); p.title(l); return r; });
      script(scope, p.root, [push('Text'), push('Kinetic'), push('Velocity'), nav(() => c.go(1)), push('Cards'), push('Holographic'), nav(() => c.go(0)), push('Library')]);
    },
  },
  {
    id: 'constellation-path',
    name: 'Constellation Path',
    description: 'Each level is a star on a hand-drawn arc. Going deeper, stars glide to make room, a filament draws out to the new star which ignites with a halo. Going back, filaments retract star by star.',
    tags: ['SVG arcs', 'de Casteljau', 'springs'],
    hint: 'Click a star to travel back',
    file: 'src/breadcrumbs/constellation-crumbs.js',
    usage: `import { constellationCrumbs } from './src/breadcrumbs/constellation-crumbs.js';

const path = constellationCrumbs(el, { items: ['Atlas'], gap: 150 });
await path.push('Northern Sky');
await path.go(0);`,
    mount(stage, scope) {
      const p = page(stage, 'is-wide');
      const c = scope.use(constellationCrumbs(p.nav, { items: ['Atlas'], onNavigate: (_, items) => p.title(items[items.length - 1]) }));
      p.title('Atlas');
      const push = (l) => async () => { p.title(l); await c.push(l); };
      const go = (i) => async () => { await c.go(i); p.title(c.items[c.items.length - 1]); };
      script(scope, p.root, [push('Northern sky'), push('Orion'), push('Betelgeuse'), go(1), push('Lyra'), push('Vega'), go(0)], 1300);
    },
  },
  {
    id: 'accordion-path',
    name: 'Accordion Path',
    description: 'Long trails fold their middle into a single bead. Hover or focus it and the hidden levels unfold in a rolling stagger — widths glide, labels rise out of blur — then fold away when you leave.',
    tags: ['overflow', 'keyboard', 'stagger'],
    hint: 'Hover the ••• bead',
    file: 'src/breadcrumbs/accordion-crumbs.js',
    usage: `import { accordionCrumbs } from './src/breadcrumbs/accordion-crumbs.js';

accordionCrumbs(nav, {
  items: ['Home', 'Studio', 'Projects', '2026', 'Silkframe', 'Assets', 'Hero.mp4'],
  keepStart: 1, keepEnd: 2,
});`,
    mount(stage, scope) {
      const p = page(stage);
      const items = ['Home', 'Studio', 'Projects', '2026', 'Silkframe', 'Assets', 'Hero.mp4'];
      const c = scope.use(accordionCrumbs(p.nav, { items }));
      p.title('Hero.mp4');
      let human = false;
      scope.on(p.nav, 'pointerenter', () => (human = true));
      scope.loop(async () => {
        await scope.wait(1500);
        if (human) return;
        await c.expand();
        await scope.wait(1700);
        if (human) return;
        await c.collapse();
      });
    },
  },
  {
    id: 'terminal-path',
    name: 'Terminal Path',
    description: 'The breadcrumb as a shell prompt: the old tail backspaces with accelerating key-repeat, new levels type with a human rhythm and each finished segment flashes a commit sweep. The caret breathes.',
    tags: ['typing', 'common prefix', 'clickable segments'],
    hint: 'Click a segment to cd back',
    file: 'src/breadcrumbs/terminal-crumbs.js',
    usage: `import { terminalCrumbs } from './src/breadcrumbs/terminal-crumbs.js';

const term = terminalCrumbs(nav, { prompt: '~', path: ['studio', 'projects'] });
await term.go(['studio', 'archive', '2026']);`,
    mount(stage, scope) {
      const p = page(stage, 'is-mono');
      const c = scope.use(terminalCrumbs(p.nav, { path: ['studio', 'projects', 'silkframe'], onNavigate: (_, path) => p.title(path[path.length - 1] || '~') }));
      p.title('silkframe');
      const go = (path) => async () => { await c.go(path); p.title(path[path.length - 1]); };
      script(scope, p.root, [
        go(['studio', 'projects', 'silkframe', 'src', 'text']),
        go(['studio', 'archive']),
        go(['studio', 'archive', '2025', 'reels']),
        go(['studio', 'projects', 'silkframe']),
      ], 1400);
    },
  },
  {
    id: 'depth-stack',
    name: 'Depth Stack',
    description: 'Wayfinding as physical depth: ancestors recede behind the current level as tabbed sheets. Deeper levels slide up into the front; choosing an ancestor drops the sheets in front of it away under gravity.',
    tags: ['springs', 'gravity', '3D'],
    hint: 'Click a sheet behind to go back',
    file: 'src/breadcrumbs/depth-stack.js',
    usage: `import { depthStack } from './src/breadcrumbs/depth-stack.js';

const stack = depthStack(el, { items: ['Workspace', 'Projects'], peek: 26 });
stack.push('Silkframe');
stack.go(0);`,
    mount(stage, scope) {
      stage.innerHTML = `<div class="d-stackwrap"><div class="d-stack-el"></div></div>`;
      const el = stage.querySelector('.d-stack-el');
      const c = scope.use(depthStack(el, { items: ['Workspace', 'Projects'] }));
      script(scope, el, [
        () => c.push('Silkframe'),
        () => c.push('Transitions'),
        () => c.push('Iris aperture'),
        () => c.go(1),
        () => c.push('Atelier Noir'),
        () => c.go(0),
        () => c.push('Projects'),
      ], 1250);
    },
  },
  {
    id: 'rolling-labels',
    name: 'Rolling Labels',
    description: 'Built for sibling navigation. When a level changes, the old word rolls up and out with a motion smear while the new one rolls in from below and the slot width glides. New levels unfurl, removed ones fold.',
    tags: ['slot roll', 'e-commerce', 'aria-live'],
    file: 'src/breadcrumbs/rolling-crumbs.js',
    usage: `import { rollingCrumbs } from './src/breadcrumbs/rolling-crumbs.js';

const crumbs = rollingCrumbs(nav, { items: ['Shop', 'Shoes', 'Running'] });
crumbs.set(['Shop', 'Bags', 'Leather']);   // only changed levels roll`,
    mount(stage, scope) {
      const p = page(stage, 'is-large');
      const c = scope.use(rollingCrumbs(p.nav, { items: ['Shop', 'Shoes', 'Running'] }));
      p.title('Running');
      const set = (items) => async () => { p.title(items[items.length - 1]); await c.set(items); };
      script(scope, p.root, [
        set(['Shop', 'Bags', 'Leather']),
        set(['Shop', 'Bags', 'Canvas']),
        set(['Shop', 'Jewelry']),
        set(['Shop', 'Shoes', 'Trail', 'Waterproof']),
        set(['Shop', 'Shoes', 'Running']),
      ], 1300);
    },
  },
  {
    id: 'ink-underline',
    name: 'Ink Underline',
    description: 'A breadcrumb annotated by hand: the current level gets a procedurally drawn ink stroke \u2014 wobble, pressure, a flick at the end \u2014 written in on arrival and lifted when you leave. Hover sketches a pencil preview.',
    tags: ['procedural strokes', 'SVG', 'hover preview'],
    hint: 'Hover or click an earlier crumb',
    file: 'src/breadcrumbs/ink-crumbs.js',
    usage: `import { inkCrumbs } from './src/breadcrumbs/ink-crumbs.js';

const crumbs = inkCrumbs(nav, { items: ['Atelier', 'Archive'], ink: '#ffb547' });
crumbs.push('Sketches');
crumbs.go(0);`,
    mount(stage, scope) {
      const p = page(stage, 'is-serif');
      const c = scope.use(inkCrumbs(p.nav, { items: ['Atelier', 'Archive'], onNavigate: (_, items) => p.title(items[items.length - 1]) }));
      p.title('Archive');
      const push = (l) => async () => { p.title(l); await c.push(l); };
      const go = (i) => async () => { await c.go(i); p.title(c.items[c.items.length - 1]); };
      script(scope, p.root, [push('Sketches'), push('1962'), go(1), push('Letters'), go(0), push('Archive')], 1500);
    },
  },
  {
    id: 'title-handoff',
    name: 'Title Handoff',
    description: 'Breadcrumb and page title as one object: going deeper, the title lifts out of the heading and flies up to become the newest crumb; going back, the chosen crumb grows and descends to become the heading again.',
    tags: ['shared element', 'FLIP', 'no layout jumps'],
    hint: 'Click a crumb to go back',
    file: 'src/breadcrumbs/title-handoff.js',
    usage: `import { titleHandoff } from './src/breadcrumbs/title-handoff.js';

const crumbs = titleHandoff(nav, h1, { items: ['Home'], title: 'Library' });
crumbs.push('Text');   // "Library" flies up into the trail
crumbs.go(0);          // "Home" flies down to become the title`,
    mount(stage, scope) {
      stage.innerHTML = `<div class="d-crumbpage d-ho"><nav class="d-crumbs"></nav><h3 class="d-ho-title">Library</h3></div>`;
      const root = stage.firstElementChild;
      const c = scope.use(titleHandoff(root.querySelector('nav'), root.querySelector('h3'), { items: ['Home'], title: 'Library' }));
      script(scope, root, [
        () => c.push('Typography'),
        () => c.push('Kinetic'),
        () => c.go(1),
        () => c.push('Variable'),
        () => c.go(0),
        () => c.push('Library'),
      ], 1500);
    },
  },
  {
    id: 'rope-path',
    name: 'Rope Path',
    description: 'The breadcrumb as a washing line: tags hang from a verlet-simulated rope that sags under their weight. New levels drop onto the line and set it bouncing; going back unhooks deeper tags and they fall away.',
    tags: ['verlet physics', 'pendulums', 'playful'],
    hint: 'Click a tag to go back',
    file: 'src/breadcrumbs/rope-crumbs.js',
    usage: `import { ropeCrumbs } from './src/breadcrumbs/rope-crumbs.js';

const rope = ropeCrumbs(el, { items: ['Home', 'Studio'], slack: 1.045 });
rope.push('Reels');
rope.go(0);`,
    mount(stage, scope) {
      stage.innerHTML = `<div class="d-ropewrap"><div class="d-rope"></div></div>`;
      const el = stage.querySelector('.d-rope');
      const c = scope.use(ropeCrumbs(el, { items: ['Home', 'Studio'] }));
      script(scope, el, [
        () => c.push('Reels'),
        () => c.push('2026'),
        () => c.push('Cut 04'),
        () => c.go(1),
        () => c.push('Stills'),
        () => c.go(0),
        () => c.push('Studio'),
      ], 1300);
    },
  },
];
