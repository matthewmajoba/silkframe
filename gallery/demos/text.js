import { velocityCascade } from '../../src/text/velocity-cascade.js';
import { slotReel } from '../../src/text/slot-reel.js';
import { anagramMorph } from '../../src/text/anagram-morph.js';
import { signalDecode } from '../../src/text/signal-decode.js';
import { inkBloom } from '../../src/text/ink-bloom.js';
import { particleText } from '../../src/text/particle-text.js';
import { magneticText } from '../../src/text/magnetic-text.js';
import { prismConverge } from '../../src/text/prism-converge.js';
import { liquidMorph } from '../../src/text/liquid-morph.js';
import { splitFlap } from '../../src/text/split-flap.js';
import { weightWave } from '../../src/text/weight-wave.js';
import { curtainLines } from '../../src/text/curtain-lines.js';
import { bladeSlice } from '../../src/text/blade-slice.js';
import { textRing } from '../../src/text/text-ring.js';
import { elasticHeadline } from '../../src/text/elastic-headline.js';
import { scrollScrub } from '../../src/text/scroll-scrub.js';
import { ghostPointer } from '../scope.js';

const html = (stage, markup) => {
  stage.innerHTML = markup;
  return stage.firstElementChild;
};

export default [
  {
    id: 'velocity-cascade',
    name: 'Velocity Cascade',
    description: 'Glyphs fall under real spring physics. Velocity drives a volume-preserving smear and motion blur, then each letter lands with a tactile bounce.',
    tags: ['spring physics', 'intro', 'exit'],
    file: 'src/text/velocity-cascade.js',
    usage: `import { velocityCascade } from './src/text/velocity-cascade.js';

const fx = velocityCascade('.headline', { order: 'center', stagger: 34 });
await fx.play();      // physics drop-in
await fx.reverse();   // hop + gravity exit`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-serif d-xl">Gravity is optional</h2>`);
      const fx = scope.use(velocityCascade(el, { order: 'start' }));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(2200);
        await fx.reverse();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'signal-decode',
    name: 'Signal Decode',
    description: 'A scanning beam sweeps the line; glyphs cycle at a filmic cadence, lock on as it passes, flare white-hot and cool. Width-locked cells mean zero jitter.',
    tags: ['scramble', 'width-locked', 'beam'],
    file: 'src/text/signal-decode.js',
    usage: `import { signalDecode } from './src/text/signal-decode.js';

const fx = signalDecode('.status', { glyphs: 'mixed', duration: 1700 });
fx.play();
fx.setText('ACCESS GRANTED');   // encode → decode`,
    mount(stage, scope) {
      const wrap = html(
        stage,
        `<div class="d-stack"><p class="d-kicker">// transmission 07</p><h2 class="d-mono d-lg">Establishing uplink</h2></div>`
      );
      const el = wrap.querySelector('h2');
      const fx = scope.use(signalDecode(el));
      const lines = ['Signal acquired', 'Decrypting payload', 'Access granted', 'Establishing uplink'];
      let i = 0;
      scope.loop(async () => {
        if (i === 0) await fx.play();
        await scope.wait(2000);
        await fx.setText(lines[i++ % lines.length]);
      });
    },
  },
  {
    id: 'ink-bloom',
    name: 'Ink Bloom',
    description: 'Words bloom like ink on wet paper — pigment cores swell through a turbulence field, then the threshold relaxes to identity so the resting frame is crisp, unfiltered text.',
    tags: ['svg filter', 'organic', 'no-pop finish'],
    file: 'src/text/ink-bloom.js',
    usage: `import { inkBloom } from './src/text/ink-bloom.js';

const fx = inkBloom('.title', { stagger: 150, duration: 2000 });
fx.play();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-serif d-xl d-italic">Ink remembers every word</h2>`);
      const fx = scope.use(inkBloom(el));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(2400);
        await fx.reverse();
        await scope.wait(400);
      });
    },
  },
  {
    id: 'particle-assembly',
    name: 'Particle Assembly',
    description: 'Text is rasterised from its real layout into thousands of particles that spiral in from a nebula along decaying vortex paths. Move through it — it parts like sand and knits back.',
    tags: ['canvas', 'interactive', 'smoke exit'],
    hint: 'Move your cursor through the letters',
    file: 'src/text/particle-text.js',
    usage: `import { particleText } from './src/text/particle-text.js';

const fx = particleText('.hero', {
  colors: ['#fff4e0', '#ffb547', '#ff7a45'],
  gap: 3, radius: 80,
});
await fx.play();     // assemble
await fx.reverse();  // exhale as smoke`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy">Stardust</h2>`);
      const fx = scope.use(particleText(el, { colors: ['#fff6e6', '#ffd08a', '#ffb547', '#ff8a4c'] }));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(6500);
        await fx.reverse();
        await scope.wait(300);
      });
    },
  },
  {
    id: 'magnetic-field',
    name: 'Magnetic Field',
    description: 'Each glyph rides its own spring inside a field around the pointer — pushed, tilted and scaled by a smooth falloff, rippling like iron filings settling.',
    tags: ['pointer', 'springs', '--sf-heat'],
    hint: 'Move your cursor',
    file: 'src/text/magnetic-text.js',
    usage: `import { magneticText } from './src/text/magnetic-text.js';

magneticText('.title', { mode: 'repel', radius: 170, strength: 0.38 });

/* style by proximity */
.title .sf-char { color: color-mix(in oklab, #ffb547 calc(var(--sf-heat, 0) * 100%), white); }`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy d-heat">Magnetic</h2>`);
      const fx = scope.use(magneticText(el, { radius: 190 }));
      ghostPointer(
        scope,
        stage,
        (x, y, r) => {
          const er = el.getBoundingClientRect();
          fx.point(x - (er.left - r.left), y - (er.top - r.top));
        },
        () => fx.release(),
        { speed: 0.9 }
      );
    },
  },
  {
    id: 'prism-converge',
    name: 'Prism Converge',
    description: 'Text splits into additive light channels that fly in on separate spring paths and recombine into pure white. Pointer velocity knocks the lens out of alignment.',
    tags: ['chromatic', 'blend modes', 'pointer velocity'],
    hint: 'Swipe quickly across',
    file: 'src/text/prism-converge.js',
    usage: `import { prismConverge } from './src/text/prism-converge.js';

const fx = prismConverge('.title', { theme: 'dark', spread: 0.9 });
fx.play();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy d-tight">Prismatic</h2>`);
      const fx = scope.use(prismConverge(el));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(4200);
        await fx.reverse();
        await scope.wait(250);
      });
    },
  },
  {
    id: 'liquid-morph',
    name: 'Liquid Morph',
    description: 'Words melt into one another through a surface-tension threshold while the container width glides on a spring, so the surrounding sentence reflows gracefully.',
    tags: ['gooey', 'word cycle', 'inline'],
    file: 'src/text/liquid-morph.js',
    usage: `<h2>We make <span class="morph">motion</span></h2>

import { liquidMorph } from './src/text/liquid-morph.js';
liquidMorph('.morph', { words: ['motion', 'emotion', 'cinema'] }).play();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-serif d-xl">We make <span class="d-accent d-italic">motion</span> feel.</h2>`);
      const fx = scope.use(
        liquidMorph(el.querySelector('span'), { words: ['motion', 'emotion', 'cinema', 'silk', 'memory'], hold: 1700 })
      );
      fx.play();
    },
  },
  {
    id: 'departure-board',
    name: 'Departure Board',
    description: 'A mechanically faithful split-flap: the upper leaf falls under gravity while its shadow darkens the card below; the lower leaf lands with a rebound. Flips overlap and decelerate.',
    tags: ['3D', 'WAAPI', 'mechanical'],
    file: 'src/text/split-flap.js',
    usage: `import { splitFlap } from './src/text/split-flap.js';

const board = splitFlap('.board', { length: 14 });
board.set('TOKYO    09:45');`,
    mount(stage, scope) {
      const wrap = html(
        stage,
        `<div class="d-board"><p class="d-kicker">Departures · Gate 7</p><div class="d-flap"></div><div class="d-flap"></div></div>`
      );
      const [a, b] = wrap.querySelectorAll('.d-flap');
      const r1 = scope.use(splitFlap(a, { length: 13 }));
      const r2 = scope.use(splitFlap(b, { length: 13 }));
      const rows = [
        ['TOKYO   09:45', 'LISBON  10:20'],
        ['OSLO    11:05', 'KYOTO   11:40'],
        ['MILAN   12:15', 'DUBAI   12:50'],
        ['SEOUL   13:30', 'LIMA    14:05'],
      ];
      let i = 0;
      scope.loop(async () => {
        const [x, y] = rows[i++ % rows.length];
        await Promise.all([r1.set(x), scope.wait(180).then(() => r2.set(y))]);
        await scope.wait(2600);
      });
    },
  },
  {
    id: 'weight-wave',
    name: 'Weight Wave',
    description: 'Drives variable-font axes per glyph. Idle, a swell rolls through the type like light over embossing; when the pointer arrives it hands over smoothly to a lens that follows it.',
    tags: ['variable fonts', 'pointer lens'],
    hint: 'Hover to take control of the swell',
    file: 'src/text/weight-wave.js',
    usage: `import { weightWave } from './src/text/weight-wave.js';

// any variable font — axes map 0→1 influence to [min, max]
weightWave('.title', { axes: { wght: [150, 900], opsz: [9, 144] } }).play();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-fraunces d-xxl">Variable</h2>`);
      const fx = scope.use(weightWave(el, { axes: { wght: [140, 900], opsz: [9, 144] } }));
      fx.play();
    },
  },
  {
    id: 'curtain-lines',
    name: 'Curtain Lines',
    description: 'The editorial line reveal, perfected: each rendered line rises out of its own mask on a long exponential curve with a hinge that straightens as it lands. Re-wraps on resize.',
    tags: ['line masks', 'editorial', 'responsive'],
    file: 'src/text/curtain-lines.js',
    usage: `import { curtainLines } from './src/text/curtain-lines.js';

const fx = curtainLines('.lede', { by: 'lines', stagger: 110 });
fx.play();`,
    mount(stage, scope) {
      const el = html(
        stage,
        `<p class="d-serif d-lg d-measure">Every frame is a decision. The quiet space between two of them is where the feeling lives.</p>`
      );
      const fx = scope.use(curtainLines(el));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(2400);
        await fx.reverse();
        await scope.wait(350);
      });
    },
  },
  {
    id: 'blade-slice',
    name: 'Blade Slice',
    description: 'The headline arrives in two halves cut along a diagonal; at the moment of contact a filament of light races along the seam. The exit draws the blade, then shears apart.',
    tags: ['clip-path', 'light streak', 'intro', 'exit'],
    file: 'src/text/blade-slice.js',
    usage: `import { bladeSlice } from './src/text/blade-slice.js';

const fx = bladeSlice('.title', { angle: -9 });
await fx.play();
await fx.reverse();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy d-upper d-tight">Cut to black</h2>`);
      const fx = scope.use(bladeSlice(el));
      scope.loop(async () => {
        await fx.play();
        await scope.wait(2200);
        await fx.reverse();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'orbit-ring',
    name: 'Orbit Ring',
    description: 'Text wrapped around a true 3D cylinder, spaced by measured glyph advances so kerning survives the curve. Far glyphs dim like engraved glass. Drag to spin with inertia.',
    tags: ['3D', 'drag inertia'],
    hint: 'Drag to spin',
    file: 'src/text/text-ring.js',
    usage: `import { textRing } from './src/text/text-ring.js';

textRing('.ring', { tilt: -14, speed: 18, center: document.querySelector('.orb') }).play();`,
    mount(stage, scope) {
      const wrap = html(stage, `<div class="d-ring d-mono">Silkframe motion library</div>`);
      const orb = document.createElement('div');
      orb.className = 'd-orb';
      const fx = scope.use(textRing(wrap, { tilt: -16, speed: 22, minRadius: 150, center: orb }));
      fx.play();
    },
  },
  {
    id: 'elastic-headline',
    name: 'Elastic Headline',
    description: 'Type made of rubber. Grab a letter and pull — it stretches toward your hand with volume preserved, neighbours follow with a falloff, and release snaps it back on a wobbly underdamped spring.',
    tags: ['drag', 'springs', 'matrix stretch'],
    hint: 'Grab a letter and pull',
    file: 'src/text/elastic-headline.js',
    usage: `import { elasticHeadline } from './src/text/elastic-headline.js';

const fx = elasticHeadline('.title', { reach: 1.3, damping: 8.5 });
fx.pull(3, 0, -80);   // programmatic tug
fx.release();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy d-tight">Elastic</h2>`);
      const fx = scope.use(elasticHeadline(el));
      let touched = false;
      scope.on(el, 'pointerdown', () => (touched = true));
      const tugs = [[1, 0, -1.1], [5, 0.6, 0.9], [3, -0.9, -0.5], [6, 1, -0.8]];
      let n = 0;
      scope.loop(async () => {
        await scope.wait(900);
        if (touched) return;
        const [i, ux, uy] = tugs[n++ % tugs.length];
        const fs = parseFloat(getComputedStyle(el).fontSize);
        // ease the pull in over a few frames, hold, release
        for (let k = 1; k <= 12; k++) {
          fx.pull(Math.min(i, fx.count - 1), ux * fs * 1.1 * (k / 12), uy * fs * 1.1 * (k / 12));
          await scope.wait(16);
        }
        await scope.wait(350);
        fx.release();
        await scope.wait(1400);
      });
    },
  },
  {
    id: 'scroll-scrub',
    name: 'Scroll Scrub',
    description: 'A paragraph read into existence by scrolling: words wake in sequence — rising out of blur, warming to full colour — with a travelling highlight. Wheel steps are smoothed so it never judders.',
    tags: ['scroll-linked', 'smoothed', 'scroll containers'],
    hint: 'Scroll inside the panel',
    file: 'src/text/scroll-scrub.js',
    usage: `import { scrollScrub } from './src/text/scroll-scrub.js';

scrollScrub('.manifesto', { start: 0.9, end: 0.3, highlight: '#ffb547' });
scrollScrub('.copy', { scroller: panel });   // inside a scroll container`,
    mount(stage, scope) {
      const panel = html(
        stage,
        `<div class="d-scrub"><div class="d-scrub-pad"></div><p class="d-serif d-lg d-scrub-text">We believe motion is a language. Not decoration, not delight for its own sake — but timing, weight and intent, spoken one frame at a time.</p><div class="d-scrub-pad"></div></div>`
      );
      scope.use(scrollScrub(panel.querySelector('p'), { scroller: panel, start: 0.95, end: 0.55 }));
      // Auto-scroll back and forth until the visitor takes over.
      let human = false;
      scope.on(panel, 'wheel', () => (human = true), { passive: true });
      scope.on(panel, 'pointerdown', () => (human = true));
      let t = 0;
      scope.raf(() => {
        if (human) return;
        t += 1 / 60;
        const max = panel.scrollHeight - panel.clientHeight;
        panel.scrollTop = max * (0.5 - 0.5 * Math.cos(t * 0.55));
      });
    },
  },
  {
    id: 'anagram-morph',
    name: 'Anagram Morph',
    description: 'Words rearrange themselves: shared letters travel to their new places on arcing paths, letters no longer needed drop away and new ones condense out of blur. LISTEN \u2192 SILENT is pure choreography.',
    tags: ['letter matching', 'arc paths', 'aria-live'],
    file: 'src/text/anagram-morph.js',
    usage: `import { anagramMorph } from './src/text/anagram-morph.js';

anagramMorph('.word', { words: ['listen', 'silent', 'enlist', 'tinsel'] }).play();`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-mono d-xl d-anagram">listen</h2>`);
      const fx = scope.use(anagramMorph(el, { words: ['LISTEN', 'SILENT', 'ENLIST', 'TINSEL', 'INLETS'], hold: 1300 }));
      fx.play();
    },
  },
  {
    id: 'slot-reel',
    name: 'Slot Reel',
    description: 'Every letter is a reel: they spin up left to right, later reels spinning longer, each strip smeared by its own speed, then land one after another with a mechanical kick-back and a gilt flash.',
    tags: ['reels', 'motion smear', 'staggered landing'],
    file: 'src/text/slot-reel.js',
    usage: `import { slotReel } from './src/text/slot-reel.js';

const fx = slotReel('.headline', { spins: 2, stagger: 90 });
fx.play();
fx.setText('JACKPOT');`,
    mount(stage, scope) {
      const el = html(stage, `<h2 class="d-sans d-xxl d-heavy d-tight d-upper">Jackpot</h2>`);
      const fx = scope.use(slotReel(el));
      const words = ['JACKPOT', 'PREMIERE', 'ENCORE', 'JACKPOT'];
      let i = 0;
      scope.loop(async () => {
        await (i === 0 ? fx.play() : fx.setText(words[i % words.length]));
        i++;
        await scope.wait(1500);
      });
    },
  },
];
