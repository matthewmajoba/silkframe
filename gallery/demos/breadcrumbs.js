import { liquidCrumbs } from '../../src/breadcrumbs/liquid-crumbs.js';
import { titleHandoff } from '../../src/breadcrumbs/title-handoff.js';
import { folderTabs } from '../../src/breadcrumbs/folder-tabs.js';
import { stepPath } from '../../src/breadcrumbs/step-path.js';
import { terminalCrumbs } from '../../src/breadcrumbs/terminal-crumbs.js';
import { rollingCrumbs } from '../../src/breadcrumbs/rolling-crumbs.js';
import { accordionCrumbs } from '../../src/breadcrumbs/accordion-crumbs.js';
import { inkCrumbs } from '../../src/breadcrumbs/ink-crumbs.js';
import { wait } from '../../src/core/ticker.js';

/* ---------------------------------------------------------------------------
   A tiny file-browser app that every breadcrumb drives for real: click a row
   to go deeper, click a crumb to go back, and the page slides in the
   matching direction.
--------------------------------------------------------------------------- */

const TREE = {
  Studio: {
    Projects: {
      Silkframe: { Motion: { Springs: null, Easing: null }, Typography: { Variable: null, Kinetic: null }, Release: null },
      Atelier: { Brand: null, Film: null },
    },
    Archive: { 2025: { Reels: null, Stills: null }, 2024: null },
    Shared: { Clients: null, Press: null },
  },
};

const nodeAt = (path) => path.reduce((n, k) => (n ? n[k] : null), TREE);
const kids = (path) => {
  const n = nodeAt(path);
  return n ? Object.keys(n) : [];
};

const FOLDER = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.6 1.6H13A1.5 1.5 0 0 1 14.5 5.1v7.4A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z"/></svg>';
const CHEV = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>';

function windowShell(stage, { cls = '', url = 'silkframe.app/files', head = '' } = {}) {
  stage.innerHTML = `<div class="bc-win ${cls}">
    <div class="bc-bar"><span class="bc-dots"><i></i><i></i><i></i></span><span class="bc-url">${url}</span></div>
    <div class="bc-head">${head}<nav class="bc-nav"></nav></div>
    <div class="bc-main"></div>
  </div>`;
  const root = stage.firstElementChild;
  return { root, nav: root.querySelector('.bc-nav'), main: root.querySelector('.bc-main') };
}

/** Directional page swap: deeper slides left, back slides right. */
function pager(main) {
  let current = null;
  return (html, dir, onReady) => {
    const page = document.createElement('div');
    page.className = 'bc-page';
    page.innerHTML = html;
    main.appendChild(page);
    onReady?.(page);
    if (current && dir) {
      const old = current;
      const d = dir > 0 ? 1 : -1;
      // Hand off, don't overlap: the old page clears out quickly, the new one
      // arrives once it has gone.
      old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate3d(${-d * 2.5}%,0,0)` }], {
        duration: 170, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards',
      }).finished.then(() => old.remove(), () => old.remove());
      page.animate([{ opacity: 0, transform: `translate3d(${d * 4}%,0,0)` }, { opacity: 1, transform: 'none' }], {
        duration: 560, delay: 190, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards',
      });
    } else current?.remove();
    current = page;
  };
}

function listHTML(path, { title = true } = {}) {
  const names = kids(path);
  const here = path[path.length - 1];
  const rows = names.length
    ? names
        .map((k) => {
          const n = kids([...path, k]).length;
          return `<button class="bc-row" data-go="${k}">${FOLDER}<span class="bc-name">${k}</span><span class="bc-meta">${n ? `${n} item${n > 1 ? 's' : ''}` : 'Empty'}</span>${CHEV}</button>`;
        })
        .join('')
    : `<div class="bc-files">${['Cover.png', 'Notes.md', 'Cut-04.mov'].map((f) => `<div class="bc-file"><i></i><span>${f}</span></div>`).join('')}</div>`;
  return `${title ? `<h3 class="bc-title">${here}</h3>` : ''}<div class="bc-list">${rows}</div>`;
}

/**
 * Generic driver: `nav` adapter receives (prev, next) and animates the crumb.
 * Crumb clicks call `back(index)`; row clicks go deeper. Untouched, a short
 * tour plays on its own.
 */
function browse(stage, scope, shell, adapter, { title = true, start = ['Studio', 'Projects'], tour, waitCrumb = false } = {}) {
  let path = start.slice();
  const show = pager(shell.main);
  const render = (dir) =>
    show(listHTML(path, { title }), dir, (page) => {
      page.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
        touched = true;
        goTo([...path, b.dataset.go]);
      }));
    });
  let touched = false;
  scope.on(shell.root, 'pointerdown', () => (touched = true));
  const goTo = (next, fromCrumb = false) => {
    const prev = path;
    path = next;
    const dir = next.length >= prev.length ? 1 : -1;
    const r = fromCrumb ? null : adapter.apply(prev, next);
    // e.g. a terminal prints the listing only once the command has been typed
    if (waitCrumb && r && r.then) r.then(() => path === next && render(dir));
    else render(dir);
  };
  render(0);
  const steps = tour || [
    ['Studio', 'Projects', 'Silkframe'],
    ['Studio', 'Projects', 'Silkframe', 'Motion'],
    ['Studio', 'Projects', 'Silkframe', 'Motion', 'Springs'],
    ['Studio', 'Projects'],
    ['Studio', 'Projects', 'Atelier'],
    ['Studio'],
    ['Studio', 'Archive'],
    ['Studio', 'Archive', '2025'],
    ['Studio', 'Projects'],
  ];
  let i = 0;
  scope.loop(async () => {
    await scope.wait(1500);
    if (!touched) goTo(steps[i++ % steps.length]);
  });
  return { back: (index) => { touched = true; goTo(path.slice(0, index + 1), true); }, get path() { return path; } };
}

/** Adapter for push/go style components: walk up to the common ancestor, then down. */
const stackAdapter = (c) => ({
  apply(prev, next) {
    let k = 0;
    while (k < prev.length && k < next.length && prev[k] === next[k]) k++;
    if (k < prev.length) c.go(k - 1);
    next.slice(k).forEach((l, n) => wait(n * 140 + (k < prev.length ? 380 : 0)).then(() => c.push(l)));
  },
});

export default [
  {
    id: 'liquid-trail',
    name: 'Liquid Trail',
    description: 'The active marker moves like a drop of liquid: a stiff leading edge races ahead while the trailing edge lags, stretching the pill between crumbs. New levels unfurl from behind it; going up absorbs deeper crumbs.',
    tags: ['asymmetric springs', 'unfurl', 'aria-current'],
    hint: 'Open a folder · click a crumb to go back',
    file: 'src/breadcrumbs/liquid-crumbs.js',
    usage: `import { liquidCrumbs } from './src/breadcrumbs/liquid-crumbs.js';

const crumbs = liquidCrumbs(nav, { items: ['Studio', 'Projects'], onNavigate: (i) => route(i) });
crumbs.push('Silkframe');
crumbs.go(0);`,
    mount(stage, scope) {
      const shell = windowShell(stage);
      let ctl;
      const c = scope.use(liquidCrumbs(shell.nav, { items: ['Studio', 'Projects'], onNavigate: (i) => ctl.back(i) }));
      ctl = browse(stage, scope, shell, stackAdapter(c));
    },
  },
  {
    id: 'title-handoff',
    name: 'Title Handoff',
    description: 'Breadcrumb and page title as one object: opening a folder lifts the heading out of the page and flies it up into the trail; going back, the chosen crumb grows and descends to become the heading again.',
    tags: ['shared element', 'FLIP', 'colour interpolation'],
    hint: 'Open a folder · click a crumb',
    file: 'src/breadcrumbs/title-handoff.js',
    usage: `import { titleHandoff } from './src/breadcrumbs/title-handoff.js';

const crumbs = titleHandoff(nav, h1, { items: ['Studio'], title: 'Projects' });
crumbs.push('Silkframe');   // "Projects" flies up into the trail
crumbs.go(0);               // "Studio" flies down to become the title`,
    mount(stage, scope) {
      const shell = windowShell(stage, { cls: 'is-handoff', head: '' });
      const title = document.createElement('h3');
      title.className = 'bc-title bc-ho-title';
      shell.main.before(title);
      let ctl;
      const c = scope.use(titleHandoff(shell.nav, title, { items: ['Studio'], title: 'Projects', onNavigate: (i) => ctl.back(i) }));
      // The title belongs to the component; pages render lists only.
      const adapter = {
        apply(prev, next) {
          let k = 0;
          while (k < prev.length && k < next.length && prev[k] === next[k]) k++;
          if (k === next.length && next.length < prev.length) c.go(next.length - 1); // straight back up
          else if (k < prev.length) { c.go(k - 1); wait(900).then(() => next.slice(k).forEach((l) => c.push(l))); } // sideways
          else next.slice(k).forEach((l, n) => wait(n * 900).then(() => c.push(l))); // deeper
        },
      };
      ctl = browse(stage, scope, shell, adapter, {
        title: false,
        tour: [
          ['Studio', 'Projects', 'Silkframe'],
          ['Studio', 'Projects', 'Silkframe', 'Typography'],
          ['Studio', 'Projects'],
          ['Studio', 'Projects', 'Atelier'],
          ['Studio'],
          ['Studio', 'Projects'],
        ],
      });
    },
  },
  {
    id: 'folder-tabs',
    name: 'Folder Tabs',
    description: 'Breadcrumbs as the tabs of nested folders. The deepest folder sits in front and flows into the page; opening one slides a new tab out from behind, and going back slides the deeper tabs home behind your choice.',
    tags: ['tab shapes', 'springs', 'keyboard'],
    hint: 'Open a folder · click a tab behind',
    file: 'src/breadcrumbs/folder-tabs.js',
    usage: `import { folderTabs } from './src/breadcrumbs/folder-tabs.js';

const tabs = folderTabs(nav, { items: ['Studio', 'Projects'] });
tabs.push('Silkframe');
tabs.go(0);
/* --sf-ft-front: the page colour the front tab flows into */`,
    mount(stage, scope) {
      const shell = windowShell(stage, { cls: 'is-tabs' });
      let ctl;
      const c = scope.use(folderTabs(shell.nav, { items: ['Studio', 'Projects'], onNavigate: (i) => ctl.back(i) }));
      ctl = browse(stage, scope, shell, stackAdapter(c));
    },
  },
  {
    id: 'step-path',
    name: 'Step Path',
    description: 'The breadcrumb for flows. Progress pours along the track on a spring; as it reaches each step the ring fills and a check is drawn in. The current step breathes, completed steps link back, and going back drains it all in reverse.',
    tags: ['checkout', 'stepper', 'aria-current=step'],
    hint: 'Continue · or click a completed step',
    file: 'src/breadcrumbs/step-path.js',
    usage: `import { stepPath } from './src/breadcrumbs/step-path.js';

const steps = stepPath(nav, { steps: ['Cart', 'Shipping', 'Payment', 'Review'], onNavigate: (i) => show(i) });
steps.set(2);`,
    mount(stage, scope) {
      const STEPS = ['Cart', 'Shipping', 'Payment', 'Review'];
      const shell = windowShell(stage, { cls: 'is-steps', url: 'silkframe.app/checkout' });
      const show = pager(shell.main);
      const pages = [
        `<h3 class="bc-title">Your cart</h3><div class="bc-cart"><div><i></i><span>Silkframe — Studio licence</span><b>$49</b></div><div><i></i><span>Capture mode add-on</span><b>$12</b></div></div>`,
        `<h3 class="bc-title">Shipping</h3><div class="bc-form"><label>Full name<i></i></label><label>Address<i></i></label><label>City<i class="half"></i></label></div>`,
        `<h3 class="bc-title">Payment</h3><div class="bc-form"><label>Card<i></i></label><label>Expiry<i class="half"></i></label></div>`,
        `<h3 class="bc-title">Review</h3><div class="bc-cart"><div><span>Total</span><b>$61</b></div></div>`,
      ];
      let idx = 0;
      const steps = scope.use(stepPath(shell.nav, { steps: STEPS, onNavigate: (i) => go(i, true) }));
      const go = (i, fromNav) => {
        const dir = i > idx ? 1 : -1;
        idx = i;
        if (!fromNav) steps.set(i);
        show(`${pages[i]}<button class="bc-cta">${i === STEPS.length - 1 ? 'Place order' : 'Continue'}</button>`, dir, (p) => {
          p.querySelector('.bc-cta').addEventListener('click', () => { touched = true; go(i === STEPS.length - 1 ? 0 : i + 1); });
        });
      };
      let touched = false;
      scope.on(shell.root, 'pointerdown', () => (touched = true));
      show(`${pages[0]}<button class="bc-cta">Continue</button>`, 0, (p) => p.querySelector('.bc-cta').addEventListener('click', () => { touched = true; go(1); }));
      const tour = [1, 2, 3, 1, 2, 3, 0];
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1700);
        if (!touched) go(tour[n++ % tour.length]);
      });
    },
  },
  {
    id: 'terminal-path',
    name: 'Terminal Path',
    description: 'The breadcrumb as a shell prompt: the old tail backspaces with accelerating key-repeat, new levels type with a human rhythm, and each finished segment flashes a commit sweep. Every segment is a link back.',
    tags: ['typing', 'common prefix', 'clickable segments'],
    hint: 'Open a directory · click a segment',
    file: 'src/breadcrumbs/terminal-crumbs.js',
    usage: `import { terminalCrumbs } from './src/breadcrumbs/terminal-crumbs.js';

const term = terminalCrumbs(nav, { prompt: '~', path: ['studio', 'projects'] });
await term.go(['studio', 'archive', '2025']);`,
    mount(stage, scope) {
      const shell = windowShell(stage, { cls: 'is-term', url: 'zsh — 80×24' });
      let ctl;
      const lower = (p) => p.map((s) => String(s).toLowerCase());
      const term = scope.use(terminalCrumbs(shell.nav, { path: lower(['Studio', 'Projects']), onNavigate: (i) => ctl.back(i) }));
      ctl = browse(stage, scope, shell, { apply: (_, next) => term.go(lower(next)) }, { title: false, waitCrumb: true });
    },
  },
  {
    id: 'rolling-labels',
    name: 'Rolling Labels',
    description: 'Built for sibling navigation. When a level changes, the old word rolls up and out with a motion smear while the new one rolls in from below and the slot glides to its width. New levels unfurl, removed ones fold.',
    tags: ['slot roll', 'e-commerce', 'aria-live'],
    hint: 'Pick a category',
    file: 'src/breadcrumbs/rolling-crumbs.js',
    usage: `import { rollingCrumbs } from './src/breadcrumbs/rolling-crumbs.js';

const crumbs = rollingCrumbs(nav, { items: ['Shop', 'Shoes', 'Running'] });
crumbs.set(['Shop', 'Bags', 'Leather']);   // only changed levels roll`,
    mount(stage, scope) {
      const CATS = { Shoes: ['Running', 'Trail', 'Court'], Bags: ['Leather', 'Canvas', 'Travel'], Jewelry: ['Rings', 'Chains'] };
      const shell = windowShell(stage, { cls: 'is-shop', url: 'silkframe.shop' });
      const show = pager(shell.main);
      let cat = 'Shoes', sub = 'Running';
      const c = scope.use(rollingCrumbs(shell.nav, { items: ['Shop', cat, sub] }));
      const render = (dir) =>
        show(
          `<div class="bc-chips">${Object.keys(CATS).map((k) => `<button data-cat="${k}" class="${k === cat ? 'on' : ''}">${k}</button>`).join('')}</div>
           <div class="bc-chips sub">${CATS[cat].map((k) => `<button data-sub="${k}" class="${k === sub ? 'on' : ''}">${k}</button>`).join('')}</div>
           <div class="bc-grid">${Array.from({ length: 4 }, (_, i) => `<div class="bc-prod" style="--h:${(i * 47 + cat.length * 31 + sub.length * 13) % 360}"><i></i><span>${sub} ${['01', '02', '03', '04'][i]}</span></div>`).join('')}</div>`,
          dir,
          (p) => {
            p.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { touched = true; pick(b.dataset.cat, CATS[b.dataset.cat][0]); }));
            p.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { touched = true; pick(cat, b.dataset.sub); }));
          }
        );
      const pick = (k, s) => {
        const dir = Object.keys(CATS).indexOf(k) - Object.keys(CATS).indexOf(cat) || CATS[k].indexOf(s) - CATS[k].indexOf(sub) || 1;
        cat = k; sub = s;
        c.set(['Shop', cat, sub]);
        render(dir);
      };
      let touched = false;
      scope.on(shell.root, 'pointerdown', () => (touched = true));
      render(0);
      const tour = [['Bags', 'Leather'], ['Bags', 'Canvas'], ['Jewelry', 'Rings'], ['Shoes', 'Trail'], ['Shoes', 'Running']];
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1600);
        if (!touched) pick(...tour[n++ % tour.length]);
      });
    },
  },
  {
    id: 'accordion-path',
    name: 'Accordion Path',
    description: 'Deep paths fold their middle into a single bead so the trail never wraps. Hover or focus it and the hidden levels unfold in a rolling stagger, rising out of blur, then fold away when you leave.',
    tags: ['overflow', 'keyboard', 'stagger'],
    hint: 'Hover the ••• bead',
    file: 'src/breadcrumbs/accordion-crumbs.js',
    usage: `import { accordionCrumbs } from './src/breadcrumbs/accordion-crumbs.js';

accordionCrumbs(nav, {
  items: ['Studio', 'Projects', 'Silkframe', 'Motion', 'Springs'],
  keepStart: 1, keepEnd: 2,
});`,
    mount(stage, scope) {
      const shell = windowShell(stage, { cls: 'is-accordion' });
      const start = ['Studio', 'Projects', 'Silkframe', 'Motion', 'Springs'];
      let ctl;
      const c = scope.use(accordionCrumbs(shell.nav, { items: start, keepStart: 1, keepEnd: 2, onNavigate: (i) => ctl.back(i) }));
      ctl = browse(stage, scope, shell, { apply: (_, next) => c.set(next) }, {
        start,
        tour: [['Studio', 'Projects', 'Silkframe', 'Typography'], ['Studio', 'Projects', 'Silkframe', 'Typography', 'Kinetic'], ['Studio', 'Archive', '2025', 'Reels'], start],
      });
      let human = false;
      scope.on(shell.nav, 'pointerenter', () => (human = true));
      scope.loop(async () => {
        await scope.wait(2300);
        if (human) return;
        await c.expand();
        await scope.wait(1400);
        if (!human) await c.collapse();
      });
    },
  },
  {
    id: 'ink-underline',
    name: 'Ink Underline',
    description: 'A breadcrumb annotated by hand: the current level gets a procedurally drawn ink stroke — wobble, pressure, a flick at the end — written in on arrival and lifted when you leave. Hover sketches a pencil preview.',
    tags: ['procedural strokes', 'SVG', 'editorial'],
    hint: 'Open a folder · hover a crumb',
    file: 'src/breadcrumbs/ink-crumbs.js',
    usage: `import { inkCrumbs } from './src/breadcrumbs/ink-crumbs.js';

const crumbs = inkCrumbs(nav, { items: ['Studio', 'Projects'], ink: '#ffb547' });
crumbs.push('Silkframe');
crumbs.go(0);`,
    mount(stage, scope) {
      const shell = windowShell(stage, { cls: 'is-ink', url: 'silkframe.journal' });
      let ctl;
      const c = scope.use(inkCrumbs(shell.nav, { items: ['Studio', 'Projects'], onNavigate: (i) => ctl.back(i) }));
      ctl = browse(stage, scope, shell, stackAdapter(c));
    },
  },
];
