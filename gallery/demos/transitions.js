import { aperture } from '../../src/transitions/aperture.js';
import { chromaticShift } from '../../src/transitions/chromatic-shift.js';
import { lightLeak } from '../../src/transitions/light-leak.js';
import { liquidCurtain } from '../../src/transitions/liquid-curtain.js';
import { glassShatter } from '../../src/transitions/glass-shatter.js';
import { facetFlip } from '../../src/transitions/facet-flip.js';
import { emberBurn } from '../../src/transitions/ember-burn.js';
import { hyperspace } from '../../src/transitions/hyperspace.js';
import { rippleGrid } from '../../src/transitions/ripple-grid.js';
import { sliceShift } from '../../src/transitions/slice-shift.js';
import { pageTurn } from '../../src/transitions/page-turn.js';
import { metaballBloom } from '../../src/transitions/metaball-bloom.js';

const SCENES = [
  { id: 'dawn', title: 'Dawn', meta: 'Scene 01 · 05:42 · Exterior' },
  { id: 'noir', title: '<em>Noir</em>', meta: 'Scene 02 · 23:10 · Alley' },
  { id: 'bloom', title: 'Bloom', meta: 'Scene 03 · 14:05 · Glasshouse' },
  { id: 'ember', title: '<em>Ember</em>', meta: 'Scene 04 · 19:58 · Foundry' },
];

/** Four full-bleed cinematic scenes stacked in the stage. */
function theatre(stage, order = [0, 1, 2, 3]) {
  stage.innerHTML = `<div class="d-theatre">${order
    .map((i, n) => {
      const s = SCENES[i];
      return `<section class="d-scene sc-${s.id}${n === 0 ? ' is-live' : ''}">
        <div class="sc-light"></div>
        <span class="sc-num">${String(i + 1).padStart(2, '0')} / 04</span>
        <h3 class="sc-title">${s.title}</h3>
        <span class="sc-meta">${s.meta}</span>
      </section>`;
    })
    .join('')}</div>`;
  const root = stage.firstElementChild;
  const scenes = [...root.children];
  scenes.forEach((s, i) => (s.style.visibility = i ? 'hidden' : ''));
  let cur = 0;
  const live = (el) => {
    el.classList.remove('is-live');
    void el.offsetWidth;
    el.classList.add('is-live');
  };
  return {
    root,
    scenes,
    get current() { return scenes[cur]; },
    /** Advance the index; returns [outgoing, incoming]. */
    advance() {
      const a = scenes[cur];
      cur = (cur + 1) % scenes.length;
      return [a, scenes[cur]];
    },
    /** Cover-style swap: hide outgoing, show incoming. */
    swap(a, b) {
      a.style.visibility = 'hidden';
      b.style.visibility = '';
      live(b);
    },
    /** Put incoming directly beneath outgoing (for burn / shatter). */
    under(a, b) {
      scenes.forEach((s) => (s.style.zIndex = ''));
      a.style.zIndex = '2';
      b.style.zIndex = '1';
      b.style.visibility = '';
      live(b);
    },
    live,
  };
}

const coverDemo = (factory, gap = 1500) => (stage, scope) => {
  const th = theatre(stage);
  const fx = scope.use(factory(th.root));
  scope.loop(async () => {
    await scope.wait(gap);
    const [a, b] = th.advance();
    await fx.run(() => th.swap(a, b));
  });
};

export default [
  {
    id: 'iris-aperture',
    name: 'Iris Aperture',
    description: 'A camera iris closes on a rotating pinwheel, leaf seams radiating from each vertex. It holds a beat in darkness while content swaps, then opens on a long exponential release.',
    tags: ['SVG', 'cover transition', 'origin-aware'],
    file: 'src/transitions/aperture.js',
    usage: `import { aperture } from './src/transitions/aperture.js';

const iris = aperture(container, { blades: 7, rotation: 62 });
await iris.run(() => router.show(nextPage));   // swap while closed`,
    mount: coverDemo((root) => aperture(root, { blades: 7 }), 1500),
  },
  {
    id: 'liquid-curtain',
    name: 'Liquid Curtain',
    description: 'Layers of colour pour across the frame, each leading edge bowing like a liquid surface under momentum. Accent layers flash at the edges before the final layer seals the frame.',
    tags: ['SVG paths', 'layered', 'cover transition'],
    file: 'src/transitions/liquid-curtain.js',
    usage: `import { liquidCurtain } from './src/transitions/liquid-curtain.js';

const curtain = liquidCurtain(container, {
  colors: ['#ffb547', '#ff7a59', '#0d0d10'], direction: 'up',
});
await curtain.run(() => swapPage());`,
    mount: coverDemo((root) => liquidCurtain(root), 1400),
  },
  {
    id: 'glass-shatter',
    name: 'Glass Shatter',
    description: 'Fractures like tempered glass — radial spokes crossed by rings. Cracks race outward, the frame holds, then shards tumble away in 3D with glints. assemble() rewinds time.',
    tags: ['3D', 'DOM shards', 'rewind'],
    hint: 'Click to choose the impact point',
    file: 'src/transitions/glass-shatter.js',
    usage: `import { glassShatter } from './src/transitions/glass-shatter.js';

// next scene sits underneath; the current one breaks away
await glassShatter(scene, { origin: { x: 320, y: 180 } }).shatter();

// or rewind: shards fly in and fuse into the element
await glassShatter(nextScene).assemble();`,
    mount(stage, scope) {
      const th = theatre(stage);
      let origin = null;
      let busy = false;
      let kick = null;
      scope.on(th.root, 'click', (e) => {
        const r = th.root.getBoundingClientRect();
        origin = { x: e.clientX - r.left, y: e.clientY - r.top };
        kick?.();
      });
      let n = 0;
      scope.loop(async () => {
        const [a, b] = th.advance();
        const assembling = n++ % 2 === 1;
        // Pre-build shards while the scene rests (idle-time chunks).
        let fx = scope.use(glassShatter(assembling ? b : a, { origin }));
        fx.prepare();
        await Promise.race([scope.wait(1500), new Promise((r) => (kick = r))]);
        if (busy) return;
        busy = true;
        if (origin) { fx.destroy(); fx = scope.use(glassShatter(assembling ? b : a, { origin })); }
        if (!assembling) {
          th.under(a, b);
          await fx.shatter();
        } else {
          // b assembles on top of a
          b.style.zIndex = '3';
          await fx.assemble();
          th.live(b);
          a.style.visibility = 'hidden';
        }
        origin = null;
        busy = false;
      });
    },
  },
  {
    id: 'facet-flip',
    name: 'Facet Flip',
    description: 'The frame becomes louvres — true two-sided cards with the outgoing scene on the front and the incoming on the back — turning in a rolling wave that sinks back in space mid-turn.',
    tags: ['3D', 'two-sided', 'WAAPI'],
    file: 'src/transitions/facet-flip.js',
    usage: `import { facetFlip } from './src/transitions/facet-flip.js';

const flip = facetFlip(container, { facets: 9, axis: 'y', order: 'center' });
await flip.run(currentScene, nextScene);`,
    mount(stage, scope) {
      const th = theatre(stage);
      const v = scope.use(facetFlip(th.root, { facets: 9 }));
      const hz = scope.use(facetFlip(th.root, { facets: 6, axis: 'x', order: 'center', stagger: 90 }));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1300);
        const [a, b] = th.advance();
        th.live(b);
        await (n++ % 2 ? hz : v).run(a, b);
      });
    },
  },
  {
    id: 'ember-burn',
    name: 'Ember Burn',
    description: 'The scene burns away like film catching in a projector gate: a scorched char band, a molten rim with bloom, then nothing. A pre-baked burn field keeps it cheap on live DOM.',
    tags: ['SVG filter', 'live DOM', 'fractal field'],
    file: 'src/transitions/ember-burn.js',
    usage: `import { emberBurn } from './src/transitions/ember-burn.js';

// next scene sits underneath
await emberBurn(scene, { angle: 30, directional: 0.5 }).burn();`,
    mount(stage, scope) {
      const th = theatre(stage);
      let n = 0;
      scope.loop(async () => {
        const [a, b] = th.advance();
        const fx = scope.use(emberBurn(a, { angle: [25, 160, 300, 210][n % 4], seed: (n++ % 4) + 1 }));
        // Bake the burn field off-thread while the scene rests.
        await Promise.all([fx.prepare(), scope.wait(1300)]);
        th.under(a, b);
        await fx.burn();
        fx.destroy();
      });
    },
  },
  {
    id: 'hyperspace',
    name: 'Hyperspace',
    description: 'A jump to light speed: stars stretch into streaks as velocity climbs exponentially, the outgoing scene is pulled into the tunnel, everything blooms white and the new scene drops out of warp.',
    tags: ['canvas', 'cover transition', 'scene pull'],
    file: 'src/transitions/hyperspace.js',
    usage: `import { hyperspace } from './src/transitions/hyperspace.js';

const jump = hyperspace(container, { scene: () => visibleScene() });
await jump.run(() => swapScene());`,
    mount(stage, scope) {
      const th = theatre(stage);
      const visible = () => th.scenes.find((s) => s.style.visibility !== 'hidden');
      const fx = scope.use(hyperspace(th.root, { scene: visible }));
      scope.loop(async () => {
        await scope.wait(1400);
        const [a, b] = th.advance();
        await fx.run(() => th.swap(a, b));
      });
    },
  },
  {
    id: 'ripple-grid',
    name: 'Ripple Grid',
    description: 'A wavefront of tiles radiates from where you touch, blooming from glowing points into a sealed grid — then the same wave keeps travelling, dissolving the tiles back to points.',
    tags: ['grid', 'origin-aware', 'cover transition'],
    hint: 'Click anywhere to send a wave',
    file: 'src/transitions/ripple-grid.js',
    usage: `import { rippleGrid } from './src/transitions/ripple-grid.js';

const ripple = rippleGrid(container, { size: 64, crest: '#ffb547' });
button.onclick = (e) => ripple.run(() => swap(), { x: e.offsetX, y: e.offsetY });`,
    mount(stage, scope) {
      const th = theatre(stage);
      const fx = scope.use(rippleGrid(th.root, { size: 56 }));
      let origin = null;
      let kick = null;
      scope.on(th.root, 'click', (e) => {
        const r = th.root.getBoundingClientRect();
        origin = { x: e.clientX - r.left, y: e.clientY - r.top };
        kick?.();
      });
      const corners = [[0.15, 0.2], [0.85, 0.75], [0.5, 0.5], [0.8, 0.2]];
      let n = 0;
      scope.loop(async () => {
        await Promise.race([scope.wait(1500), new Promise((r) => (kick = r))]);
        const r = th.root.getBoundingClientRect();
        const c = corners[n++ % corners.length];
        const o = origin || { x: r.width * c[0], y: r.height * c[1] };
        origin = null;
        const [a, b] = th.advance();
        await fx.run(() => th.swap(a, b), o);
      });
    },
  },
  {
    id: 'slice-shift',
    name: 'Slice Shift',
    description: 'Both scenes are cut into bands. Alternate bands of the outgoing scene shear away left and right while the incoming bands slide in opposite — an editorial cut with velocity skew.',
    tags: ['bands', 'velocity skew', 'WAAPI'],
    file: 'src/transitions/slice-shift.js',
    usage: `import { sliceShift } from './src/transitions/slice-shift.js';

await sliceShift(container, { slices: 7, skew: 14 }).run(currentScene, nextScene);`,
    mount(stage, scope) {
      const th = theatre(stage);
      const fx = scope.use(sliceShift(th.root, { slices: 7 }));
      scope.loop(async () => {
        await scope.wait(1400);
        const [a, b] = th.advance();
        th.live(b);
        await fx.run(a, b);
      });
    },
  },
  {
    id: 'page-turn',
    name: 'Page Turn',
    description: 'The frame becomes a spread: the outgoing scene lifts on the spine and turns over — its back already printed with the next scene — while light falls across the sheet and a shadow sweeps beneath.',
    tags: ['3D', 'two-sided', 'book'],
    file: 'src/transitions/page-turn.js',
    usage: `import { pageTurn } from './src/transitions/page-turn.js';

await pageTurn(container).run(current, next);
await pageTurn(container, { direction: 'back' }).run(next, current);`,
    mount(stage, scope) {
      const th = theatre(stage);
      const fwd = scope.use(pageTurn(th.root));
      const back = scope.use(pageTurn(th.root, { direction: 'back' }));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1300);
        const [a, b] = th.advance();
        th.live(b);
        await (n++ % 3 === 2 ? back : fwd).run(a, b);
      });
    },
  },
  {
    id: 'metaball-bloom',
    name: 'Metaball Bloom',
    description: 'A liquid body erupts from where you touch: droplets race ahead, stretch on surface tension and are swallowed as the mass seals the frame — then it retreats into one drop that splits and evaporates.',
    tags: ['metaballs', 'canvas field', 'origin-aware'],
    hint: 'Click to choose the source',
    file: 'src/transitions/metaball-bloom.js',
    usage: `import { metaballBloom } from './src/transitions/metaball-bloom.js';

const goo = metaballBloom(container, { color: '#0d0d10', rim: '#ffb547' });
el.onclick = (e) => goo.run(() => swap(), { x: e.offsetX, y: e.offsetY });`,
    mount(stage, scope) {
      const th = theatre(stage);
      const fx = scope.use(metaballBloom(th.root));
      let origin = null;
      let kick = null;
      scope.on(th.root, 'click', (e) => {
        const r = th.root.getBoundingClientRect();
        origin = { x: e.clientX - r.left, y: e.clientY - r.top };
        kick?.();
      });
      const spots = [[0.22, 0.7], [0.78, 0.3], [0.5, 0.55]];
      let n = 0;
      scope.loop(async () => {
        await Promise.race([scope.wait(1400), new Promise((r) => (kick = r))]);
        const r = th.root.getBoundingClientRect();
        const c = spots[n++ % spots.length];
        const o = origin || { x: r.width * c[0], y: r.height * c[1] };
        origin = null;
        const [a, b] = th.advance();
        await fx.run(() => th.swap(a, b), o);
      });
    },
  },
  {
    id: 'light-leak',
    name: 'Anamorphic Flare',
    description: 'The J.J. Abrams cut: a point of light slides across the lens, a razor-thin blue streak shoots edge to edge, ghost reflections mirror it through the optical centre, and the cut happens inside the wash.',
    tags: ['anamorphic', 'lens ghosts', 'additive canvas'],
    file: 'src/transitions/light-leak.js',
    usage: `import { lightLeak } from './src/transitions/light-leak.js';

const leak = lightLeak(container, { scene: () => visibleScene() });
await leak.run(() => showNext());`,
    mount(stage, scope) {
      const th = theatre(stage);
      const visible = () => th.scenes.find((s) => s.style.visibility !== 'hidden');
      const ltr = scope.use(lightLeak(th.root, { scene: visible }));
      const rtl = scope.use(lightLeak(th.root, { scene: visible, from: 'right', seed: 4 }));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1300);
        const [a, b] = th.advance();
        await (n++ % 2 ? rtl : ltr).run(() => th.swap(a, b));
      });
    },
  },
  {
    id: 'chromatic-shift',
    name: 'Chromatic Shift',
    description: 'A lens-breaking cut: the outgoing scene separates into red, green and blue channels that shear apart and soften; the incoming channels slide in from the opposite sides and recombine perfectly.',
    tags: ['RGB channels', 'screen blend', 'static filters'],
    file: 'src/transitions/chromatic-shift.js',
    usage: `import { chromaticShift } from './src/transitions/chromatic-shift.js';

await chromaticShift(container, { spread: 0.06, angle: 0 }).run(current, next);`,
    mount(stage, scope) {
      const th = theatre(stage);
      const h = scope.use(chromaticShift(th.root));
      const d = scope.use(chromaticShift(th.root, { angle: 70, spread: 0.03 }));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(1300);
        const [a, b] = th.advance();
        th.live(b);
        await (n++ % 2 ? d : h).run(a, b);
      });
    },
  },
];
