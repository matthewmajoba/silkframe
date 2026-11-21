import { magneticButton } from '../../src/ui/magnetic-button.js';
import { bauhausGoya } from '../../src/ui/loaders/bauhaus-goya.js';
import { mondrianHokusai } from '../../src/ui/loaders/mondrian-hokusai.js';
import { kandinskyMorandi } from '../../src/ui/loaders/kandinsky-morandi.js';
import { calderMiro } from '../../src/ui/loaders/calder-miro.js';
import { rileyKlimt } from '../../src/ui/loaders/riley-klimt.js';
import { gooeyTabs } from '../../src/ui/gooey-tabs.js';
import { scrollComet } from '../../src/ui/scroll-comet.js';
import { morphCursor } from '../../src/ui/morph-cursor.js';
import { odometer } from '../../src/ui/odometer.js';
import { velocityMarquee } from '../../src/ui/velocity-marquee.js';
import { elasticToggle } from '../../src/ui/elastic-toggle.js';
import { cinematicLoader } from '../../src/ui/cinematic-loader.js';
import { toastStack } from '../../src/ui/toast-stack.js';
import { burstButton } from '../../src/ui/burst-button.js';
import { imageTrail } from '../../src/ui/image-trail.js';
import { ghostPointer } from '../scope.js';
import { mulberry32 } from '../../src/core/noise.js';

const html = (stage, markup) => {
  stage.innerHTML = markup;
  return stage.firstElementChild;
};

export default [
  {
    id: 'magnetic-button',
    name: 'Magnetic Button',
    description: 'A quiet magnet: within a small field the button leans toward the pointer, softly limited to a fraction of its height, label drifting a touch further. The fill floods in from where you entered and drains where you leave.',
    tags: ['springs', 'direction-aware fill', 'parallax'],
    hint: 'Approach and hover the buttons',
    file: 'src/ui/magnetic-button.js',
    usage: `import { magneticButton } from './src/ui/magnetic-button.js';

magneticButton('.cta', { radius: 70, pull: 0.22 });
/* fill colour: --sf-mag-fill / --sf-mag-fill-fg */`,
    mount(stage, scope) {
      const row = html(stage, `<div class="d-btnrow"><button class="d-btn is-solid">Get started</button><button class="d-btn">View the reel</button></div>`);
      const [a, b] = row.querySelectorAll('button');
      const fa = scope.use(magneticButton(a));
      const fb = scope.use(magneticButton(b));
      // A visitor's cursor: drifts in, hovers near a button, wanders off.
      let human = false;
      scope.on(stage, 'pointerenter', () => (human = true));
      scope.on(stage, 'pointerleave', () => (human = false));
      const at = { x: 0, y: 0 };
      const goal = { x: 0, y: 0 };
      const targets = () => {
        const r = stage.getBoundingClientRect();
        const pick = (el, ox, oy) => { const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2 + ox - r.left, y: q.top + q.height / 2 + oy - r.top }; };
        return [pick(a, -20, -14), { x: r.width * 0.5, y: r.height * 0.2 }, pick(b, 26, 10), pick(b, -10, -4), { x: r.width * 0.8, y: r.height * 0.75 }, pick(a, 16, 12)];
      };
      let i = 0;
      scope.loop(async () => {
        const t = targets()[i++ % 6];
        goal.x = t.x; goal.y = t.y;
        await scope.wait(1300);
      });
      scope.raf(() => {
        if (human) return;
        at.x += (goal.x - at.x) * 0.06;
        at.y += (goal.y - at.y) * 0.06;
        const r = stage.getBoundingClientRect();
        fa.point(r.left + at.x, r.top + at.y);
        fb.point(r.left + at.x, r.top + at.y);
      });
    },
  },
  {
    id: 'morph-cursor',
    name: 'Morph Cursor',
    description: 'A precise dot and a ring that follows on a spring, stretching along its velocity. Over any [data-cursor] element the ring releases the pointer and wraps the target — size, position and radius.',
    tags: ['custom cursor', 'magnetic wrap', 'blend difference'],
    hint: 'Move inside the stage',
    file: 'src/ui/morph-cursor.js',
    usage: `import { morphCursor } from './src/ui/morph-cursor.js';

morphCursor({ root: document.body, size: 38, padding: 8 });
// <a href="/work" data-cursor>Work</a>`,
    mount(stage, scope) {
      const root = html(
        stage,
        `<div class="d-cursorpage">
          <nav class="d-mininav"><span class="d-logo">S/F</span><a data-cursor>Work</a><a data-cursor>Studio</a><a data-cursor>Journal</a><a data-cursor class="d-pill">Contact</a></nav>
          <h3 class="d-serif">Point at <em>anything.</em></h3>
          <div class="d-chips"><span data-cursor>Motion</span><span data-cursor>Identity</span><span data-cursor>Film</span></div>
        </div>`
      );
      const cur = scope.use(morphCursor({ root }));
      const targets = [...root.querySelectorAll('[data-cursor]')];
      let human = false;
      scope.on(root, 'pointerenter', () => (human = true));
      scope.on(root, 'pointerleave', () => (human = false));
      let i = 0;
      scope.loop(async () => {
        if (human) { await scope.wait(500); return; }
        const r = root.getBoundingClientRect();
        // glide through open space, then land on a target
        cur.move(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.45 + Math.random() * 0.2), root);
        await scope.wait(650);
        if (human) return;
        const t = targets[i++ % targets.length];
        const b = t.getBoundingClientRect();
        cur.move(b.left + b.width / 2, b.top + b.height / 2, t);
        await scope.wait(950);
      });
    },
  },
  {
    id: 'rolling-odometer',
    name: 'Rolling Odometer',
    description: 'Every digit is a reel that spins through the values in between — lower places spin more — with velocity smear and a soft mechanical overshoot. Width changes open and close smoothly.',
    tags: ['tabular', 'reels', 'format-aware'],
    file: 'src/ui/odometer.js',
    usage: `import { odometer } from './src/ui/odometer.js';

const odo = odometer('.revenue', { value: 1284302, format: (n) => '$' + n.toLocaleString() });
odo.set(1290118);`,
    mount(stage, scope) {
      const wrap = html(stage, `<div class="d-odo"><p class="d-kicker">Revenue · this quarter</p><div class="d-odo-num"></div><p class="d-odo-delta"></p></div>`);
      const num = wrap.querySelector('.d-odo-num');
      const delta = wrap.querySelector('.d-odo-delta');
      let v = 1284302;
      const odo = scope.use(odometer(num, { value: v, format: (n) => '$' + Math.round(n).toLocaleString('en-US') }));
      const rand = mulberry32(5);
      scope.loop(async () => {
        await scope.wait(1700);
        const jump = rand() < 0.25 ? (rand() - 0.3) * 900000 : (rand() - 0.35) * 60000;
        const next = Math.max(9000, Math.round(v + jump));
        delta.textContent = `${next >= v ? '▲' : '▼'} ${Math.abs(((next - v) / v) * 100).toFixed(2)}%`;
        delta.dataset.dir = next >= v ? 'up' : 'down';
        v = next;
        await odo.set(v);
      });
    },
  },
  {
    id: 'velocity-marquee',
    name: 'Velocity Marquee',
    description: 'An endless ticker that feels the page: scroll or drag and it surges that way, skewing with speed like type on a spinning drum, then eases back to cruising. Seamless at any width.',
    tags: ['scroll velocity', 'drag', 'seamless'],
    hint: 'Scroll the page or drag the text',
    file: 'src/ui/velocity-marquee.js',
    usage: `import { velocityMarquee } from './src/ui/velocity-marquee.js';

velocityMarquee('.ticker', { speed: 60, skew: 10, direction: -1 });`,
    mount(stage, scope) {
      const wrap = html(
        stage,
        `<div class="d-marquees">
          <div class="d-mq d-mq-a"><span>Silkframe <em>✦</em> Motion <em>✦</em> Cinema <em>✦</em> Craft <em>✦</em>&nbsp;</span></div>
          <div class="d-mq d-mq-b"><span>Every frame considered · Zero dependencies · Spring physics · &nbsp;</span></div>
        </div>`
      );
      const [a, b] = wrap.querySelectorAll('.d-mq');
      const fa = scope.use(velocityMarquee(a, { speed: 55, direction: -1 }));
      const fb = scope.use(velocityMarquee(b, { speed: 40, direction: 1, skew: 6 }));
      let n = 0;
      scope.loop(async () => {
        await scope.wait(2600);
        const s = n++ % 2 ? 1 : -1;
        fa.impulse(s * 1700);
        fb.impulse(-s * 1100);
      });
    },
  },
  {
    id: 'elastic-toggle',
    name: 'Elastic Toggle',
    description: 'A switch with a body: pressing squashes the knob in anticipation, release launches it across stretching with velocity, landing with a jelly wobble as the track floods with colour.',
    tags: ['squash & stretch', 'role=switch', 'keyboard'],
    hint: 'Click the switches',
    file: 'src/ui/elastic-toggle.js',
    usage: `<button class="switch" role="switch" aria-checked="false"></button>

import { elasticToggle } from './src/ui/elastic-toggle.js';
elasticToggle('.switch', { onChange: (on) => save(on) });`,
    mount(stage, scope) {
      const list = html(
        stage,
        `<div class="d-toggles">
          <label><span>Motion</span><button class="d-tg" aria-checked="true"></button></label>
          <label><span>Sound design</span><button class="d-tg"></button></label>
          <label><span>Film grain</span><button class="d-tg" aria-checked="true" style="--sf-tg-on:#7ee0d0"></button></label>
        </div>`
      );
      const tgs = [...list.querySelectorAll('.d-tg')].map((b) => scope.use(elasticToggle(b)));
      let touched = false;
      scope.on(list, 'pointerdown', () => (touched = true));
      let i = 0;
      scope.loop(async () => {
        await scope.wait(900);
        if (!touched) await tgs[i++ % tgs.length].press();
      });
    },
  },
  {
    id: 'cinematic-loader',
    name: 'Cinematic Loader',
    description: 'A title-sequence preloader: progress surges, stalls and bursts like real traffic while the counter rolls. At 100 the numerals slip out of their mask and the overlay parts into shutters.',
    tags: ['preloader', 'progressbar role', 'shutter reveal'],
    file: 'src/ui/cinematic-loader.js',
    usage: `import { cinematicLoader } from './src/ui/cinematic-loader.js';

const loader = cinematicLoader(document.body, { label: 'Silkframe' });
loader.progress(42);          // feed real progress…
await loader.reveal();        // …or call run() for a simulated load`,
    mount(stage, scope) {
      const page = html(
        stage,
        `<div class="d-loaderpage"><p class="d-kicker">Now showing</p><h3 class="d-serif">The Quiet<br><em>Between Frames</em></h3></div>`
      );
      const loader = scope.use(cinematicLoader(page, { label: 'Silkframe', duration: 2200 }));
      scope.loop(async () => {
        await loader.run();
        page.classList.remove('is-in');
        void page.offsetWidth;
        page.classList.add('is-in');
        await scope.wait(2600);
      });
    },
  },
  {
    id: 'toast-stack',
    name: 'Toast Stack',
    description: 'Notifications with depth: new toasts rise on a spring and push older ones into a receding pile; hover to fan them into a list. Swipe one sideways — it follows your hand and flicks away.',
    tags: ['springs', 'swipe to dismiss', 'aria-live'],
    hint: 'Hover the stack · swipe a toast',
    file: 'src/ui/toast-stack.js',
    usage: `import { toastStack } from './src/ui/toast-stack.js';

const toasts = toastStack(document.body, { max: 4 });
toasts.show({ title: 'Render complete', body: 'hero.mp4 · 4K · 2.1 GB' });`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-toasthost"><p class="d-kicker">Studio activity</p></div>`);
      const toasts = scope.use(toastStack(host, { duration: 5200 }));
      const msgs = [
        { title: 'Render complete', body: 'hero.mp4 · 4K · 2.1 GB', accent: '#7ee0a8' },
        { title: 'Ines left a note', body: '“Hold the cut two frames longer.”', accent: '#ffb547' },
        { title: 'Grade exported', body: 'LUT · Noir_v3.cube', accent: '#7ea6ff' },
        { title: 'Upload paused', body: 'Reconnecting to studio-02…', accent: '#ff7a59' },
      ];
      let i = 0;
      scope.loop(async () => {
        toasts.show(msgs[i++ % msgs.length]);
        await scope.wait(1500);
      });
    },
  },
  {
    id: 'celebration-burst',
    name: 'Celebration Burst',
    description: 'A success moment with real physics: the button squashes, then releases ribbons and sparks with drag, gravity, flutter and spin — lit as they turn — while a shock ring expands outward.',
    tags: ['canvas', 'physics', 'success state'],
    hint: 'Click Publish',
    file: 'src/ui/burst-button.js',
    usage: `import { burstButton } from './src/ui/burst-button.js';

const btn = burstButton('.publish', { count: 140 });
// fires on click — or call btn.fire() after an async success`,
    mount(stage, scope) {
      const wrap = html(stage, `<div class="d-burst"><p class="d-kicker">Ready when you are</p><button class="d-btn is-solid d-btn-lg">Publish</button></div>`);
      const fx = scope.use(burstButton(wrap.querySelector('button')));
      let touched = false;
      scope.on(wrap, 'pointerdown', () => (touched = true));
      scope.loop(async () => {
        await scope.wait(2800);
        if (!touched) fx.fire();
      });
    },
  },
  {
    id: 'image-trail',
    name: 'Image Trail',
    description: 'The pointer leaves a trail of frames — each lands where you have been, angled by your direction and sized by your speed, then sinks and dissolves under ease-in gravity.',
    tags: ['pointer trail', 'WAAPI', 'portfolio'],
    hint: 'Sweep across the stage',
    file: 'src/ui/image-trail.js',
    usage: `import { imageTrail } from './src/ui/image-trail.js';

imageTrail(section, { images: ['/work/a.jpg', '/work/b.jpg'], spacing: 90 });`,
    mount(stage, scope) {
      const wrap = html(stage, `<div class="d-trail"><h3 class="d-serif">Selected <em>work</em></h3></div>`);
      const grads = [
        'linear-gradient(150deg,#1d2340,#4d3a8f 55%,#c07bd8)',
        'linear-gradient(150deg,#3a1407,#c2541e 55%,#ffcf7a)',
        'linear-gradient(150deg,#04161d,#0f6b74 55%,#7fe8d6)',
        'linear-gradient(150deg,#2a0612,#8f1d3f 55%,#ff8fa8)',
        'linear-gradient(150deg,#141a0b,#5b7a1f 55%,#e3f08a)',
      ];
      const fx = scope.use(imageTrail(wrap, { images: grads, spacing: 70, size: [110, 140] }));
      ghostPointer(scope, stage, (x, y) => fx.feed(x, y), () => fx.reset(), { speed: 1.3 });
    },
  },
  {
    id: 'scroll-comet',
    name: 'Scroll Comet',
    description: 'Reading progress with a comet for a head: it follows the scroll on a smoothed spring, the tail stretches with velocity, it brightens and sheds sparks when you move fast, and rests as a glowing bead.',
    tags: ['progress', 'velocity', 'canvas'],
    hint: 'Scroll the article',
    file: 'src/ui/scroll-comet.js',
    usage: `import { scrollComet } from './src/ui/scroll-comet.js';

scrollComet(header);                           // window scroll
scrollComet(bar, { scroller: articleEl });     // any scroll container`,
    mount(stage, scope) {
      const wrap = html(
        stage,
        `<div class="d-article"><div class="d-article-bar"></div><div class="d-article-body"><p class="d-kicker">Essay \u00b7 6 min read</p><h3 class="d-serif">On the weight of a single frame</h3>${Array.from({ length: 7 }, (_, i) => `<p>${['Motion is never neutral. Every curve carries an attitude \u2014 hesitant, confident, playful or grave \u2014 and the audience reads it before they read a single word.', 'A spring that overshoots says the interface is alive. An exponential ease that lingers says it respects your attention. Linear motion says nothing at all.', 'The craft is in the in-between: the frame where a letter is still blurred by its own speed, the frame where a card has not quite decided which face it will show.', 'Cinema learned this a century ago. Interfaces are only now remembering it.'][i % 4]}</p>`).join('')}</div></div>`
      );
      const body = wrap.querySelector('.d-article-body');
      scope.use(scrollComet(wrap.querySelector('.d-article-bar'), { scroller: body }));
      let human = false;
      scope.on(body, 'wheel', () => (human = true), { passive: true });
      scope.on(body, 'pointerdown', () => (human = true));
      let t = 0;
      scope.raf(() => {
        if (human) return;
        t += 1 / 60;
        const max = body.scrollHeight - body.clientHeight;
        // bursts of fast scrolling separated by calm reading
        const phase = (t % 5) / 5;
        const q = phase < 0.35 ? 0.5 - 0.5 * Math.cos((phase / 0.35) * Math.PI) : 1;
        const lap = Math.floor(t / 5) % 4;
        const from = [0, 0.33, 0.66, 1][lap], to = [0.33, 0.66, 1, 0][lap];
        body.scrollTop = max * (from + (to - from) * q);
      });
    },
  },
  {
    id: 'gooey-tabs',
    name: 'Gooey Tabs',
    description: 'The active-tab marker is a bead of liquid: switching pinches off a droplet that races to the new tab while the old bead drains, and they merge through surface tension. Labels invert where liquid passes.',
    tags: ['goo filter', 'role=tablist', 'arrow keys'],
    hint: 'Click a tab',
    file: 'src/ui/gooey-tabs.js',
    usage: `import { gooeyTabs } from './src/ui/gooey-tabs.js';

const tabs = gooeyTabs(nav, { items: ['Overview', 'Motion', 'Pricing'], onChange: (i) => show(i) });
tabs.select(2);`,
    mount(stage, scope) {
      const wrap = html(stage, `<div class="d-tabs"><div class="d-tabbar"></div></div>`);
      const fx = scope.use(gooeyTabs(wrap.querySelector('.d-tabbar'), { items: ['Overview', 'Motion', 'Pricing', 'Changelog'] }));
      let touched = false;
      scope.on(wrap, 'pointerdown', () => (touched = true));
      const seq = [2, 1, 3, 0];
      let i = 0;
      scope.loop(async () => {
        await scope.wait(1400);
        if (!touched) fx.select(seq[i++ % seq.length]);
      });
    },
  },
  {
    id: 'loader-bauhaus-goya',
    name: 'Loader · Bauhaus × Goya',
    description: 'Bauhaus primaries balanced on a seesaw, painted in the dark of Goya\u2019s Black Paintings: one flickering candle, umber shadows, rough grain. The ball rolls under real gravity while an ochre ring fills; at 100% everything settles into balance.',
    tags: ['seesaw physics', 'chiaroscuro', 'canvas'],
    file: 'src/ui/loaders/bauhaus-goya.js',
    usage: `import { bauhausGoya } from './src/ui/loaders/bauhaus-goya.js';

const loader = bauhausGoya(document.querySelector('.splash'));
loader.progress(0.4);        // feed real progress (0–1)…
await loader.complete();     // …then play the finale
// or: await loader.run(3200)  — a simulated, uneven load`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-artload"></div>`);
      const loader = scope.use(bauhausGoya(host));
      scope.loop(async () => {
        await loader.run(3600);
        await scope.wait(1100);
        loader.reset();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'loader-mondrian-hokusai',
    name: 'Loader · Mondrian × Hokusai',
    description: 'A Mondrian grid on washi paper, each cell flooded by a Hokusai wave \u2014 a curling Prussian-blue crest with claws of foam \u2014 leaving shimmering seigaiha scales. At 100% one great wave rolls across the whole composition.',
    tags: ['wave fronts', 'seigaiha', 'canvas'],
    file: 'src/ui/loaders/mondrian-hokusai.js',
    usage: `import { mondrianHokusai } from './src/ui/loaders/mondrian-hokusai.js';

const loader = mondrianHokusai(document.querySelector('.splash'));
loader.progress(0.4);        // feed real progress (0–1)…
await loader.complete();     // …then play the finale
// or: await loader.run(3200)  — a simulated, uneven load`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-artload"></div>`);
      const loader = scope.use(mondrianHokusai(host));
      scope.loop(async () => {
        await loader.run(3600);
        await scope.wait(1100);
        loader.reset();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'loader-kandinsky-morandi',
    name: 'Loader · Kandinsky × Morandi',
    description: 'Kandinsky\u2019s circles played as music in Morandi\u2019s dusty palette: translucent discs drift and breathe on their own beat of an 84 bpm bar while notes land on a stave. At 100% they gather into concentric rings and strike a chord.',
    tags: ['rhythm', 'multiply blend', 'canvas'],
    file: 'src/ui/loaders/kandinsky-morandi.js',
    usage: `import { kandinskyMorandi } from './src/ui/loaders/kandinsky-morandi.js';

const loader = kandinskyMorandi(document.querySelector('.splash'));
loader.progress(0.4);        // feed real progress (0–1)…
await loader.complete();     // …then play the finale
// or: await loader.run(3200)  — a simulated, uneven load`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-artload"></div>`);
      const loader = scope.use(kandinskyMorandi(host));
      scope.loop(async () => {
        await loader.run(3600);
        await scope.wait(1100);
        loader.reset();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'loader-calder-miro',
    name: 'Loader · Calder × Miró',
    description: 'A Calder mobile hung with Mir\u00f3\u2019s shapes. Every arm is a damped pendulum seeking the balance of the weights below; each new shape that arrives with progress sets the whole mobile swinging to rebalance.',
    tags: ['pendulum physics', 'turning plates', 'canvas'],
    file: 'src/ui/loaders/calder-miro.js',
    usage: `import { calderMiro } from './src/ui/loaders/calder-miro.js';

const loader = calderMiro(document.querySelector('.splash'));
loader.progress(0.4);        // feed real progress (0–1)…
await loader.complete();     // …then play the finale
// or: await loader.run(3200)  — a simulated, uneven load`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-artload"></div>`);
      const loader = scope.use(calderMiro(host));
      scope.loop(async () => {
        await loader.run(3600);
        await scope.wait(1100);
        loader.reset();
        await scope.wait(500);
      });
    },
  },
  {
    id: 'loader-riley-klimt',
    name: 'Loader · Riley × Klimt',
    description: 'Bridget Riley\u2019s op-art current rippling across Klimt\u2019s gold leaf and tesserae. As progress grows the vibration calms into order; at 100% the bands draw straight, part like a curtain and light runs across the gold.',
    tags: ['op art', 'gold leaf', 'canvas'],
    file: 'src/ui/loaders/riley-klimt.js',
    usage: `import { rileyKlimt } from './src/ui/loaders/riley-klimt.js';

const loader = rileyKlimt(document.querySelector('.splash'));
loader.progress(0.4);        // feed real progress (0–1)…
await loader.complete();     // …then play the finale
// or: await loader.run(3200)  — a simulated, uneven load`,
    mount(stage, scope) {
      const host = html(stage, `<div class="d-artload"></div>`);
      const loader = scope.use(rileyKlimt(host));
      scope.loop(async () => {
        await loader.run(3600);
        await scope.wait(1100);
        loader.reset();
        await scope.wait(500);
      });
    },
  },
];
