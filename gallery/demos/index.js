import text from './text.js';
import transitions from './transitions.js';
import cards from './cards.js';
import breadcrumbs from './breadcrumbs.js';
import ui from './ui.js';

export const categories = [
  {
    id: 'text',
    code: 'T',
    label: 'Text',
    title: 'Typography <em>in motion</em>',
    blurb: 'Headline intros, live type and kinetic details — physics-driven, width-stable and accessible to screen readers.',
    demos: text,
  },
  {
    id: 'transitions',
    code: 'S',
    label: 'Transitions',
    title: 'Scene <em>changes</em>',
    blurb: 'Cover and cut transitions for pages, slides and states — each with a beat of anticipation and a filmic release.',
    demos: transitions,
  },
  {
    id: 'cards',
    code: 'C',
    label: 'Cards',
    title: 'Surfaces <em>with weight</em>',
    blurb: 'Cards that behave like objects — they tilt, flip, fly, shatter into dust and open like portals.',
    demos: cards,
  },
  {
    id: 'breadcrumbs',
    code: 'B',
    label: 'Breadcrumbs',
    title: 'Wayfinding, <em>animated</em>',
    blurb: 'Breadcrumbs that explain where you went — accessible markup with aria-current, keyboard focus and choreography for every change.',
    demos: breadcrumbs,
  },
  {
    id: 'ui',
    code: 'U',
    label: 'Interface',
    title: 'Interface <em>details</em>',
    blurb: 'The small moments that make a product feel expensive — buttons, cursors, counters, switches and celebrations.',
    demos: ui,
  },
];

export const demos = categories.flatMap((c) =>
  c.demos.map((d, i) => ({ ...d, category: c.id, code: `${c.code}—${String(i + 1).padStart(2, '0')}` }))
);

export const byId = Object.fromEntries(demos.map((d) => [d.id, d]));
