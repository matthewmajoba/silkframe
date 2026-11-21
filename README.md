# Silkframe — Cinematic Motion Library · Vol. 01

> *Silkframe* is a working name. Rename freely — nothing in the code depends on it.

64 production-ready web animations across five categories — **text, transitions, cards, breadcrumbs and interface details** — written in dependency-free vanilla JavaScript (ES modules). Every effect is driven by real spring physics or filmic easing on a single shared frame loop, animates only compositor-friendly properties wherever possible, respects `prefers-reduced-motion`, and cleans up completely on `destroy()`.

---

## Quick start

```bash
node serve.mjs            # → http://localhost:4180  (or double-click start.bat on Windows)
```

`examples/landing.html` is a complete studio landing page composed from twelve effects — the fastest way to see how they combine in production markup.

The gallery (`index.html`) shows every effect live; **Theatre mode** (`view.html?fx=<id>`) shows one at full size with ←/→ to browse and **R** to replay.

Use an effect in your own project:

```html
<h1 class="headline">Gravity is optional</h1>
<script type="module">
  import { velocityCascade } from './src/text/velocity-cascade.js';
  const fx = velocityCascade('.headline');
  await fx.play();
</script>
```

ES modules must be served over HTTP (any static server or bundler — Vite, Next, Astro, Parcel, webpack — works). Each effect injects its own minimal CSS, so a single import is all you need.

---

## Conventions (every effect)

| Concept | Behaviour |
| --- | --- |
| **Factory** | `effect(target, options)` — `target` is an element or a selector. |
| **Controller** | Returns an object with the methods listed per effect, always including `destroy()`. |
| **Promises** | `play()`, `reverse()`, `run()` and friends resolve when the motion settles, so sequences are plain `await`s. |
| **Reduced motion** | With `prefers-reduced-motion: reduce`, effects jump to their end state (content still appears / swaps). |
| **Accessibility** | Split text keeps one screen-reader copy of the original sentence; breadcrumbs use `aria-current="page"`; switches use `role="switch"` + `aria-checked`; live regions announce changes. |
| **Clean-up** | `destroy()` stops the loop, removes listeners, injected layers and restores the original markup. |
| **Theming** | Colours are options or CSS custom properties (`--sf-…`) documented per effect. |

### Capture mode (frame-perfect export)

All effects run on one shared clock (`src/core/ticker.js`). Detach it from the display to render exact frames — for video export or visual regression tests:

```js
import { setManualClock, advance } from './src/core/ticker.js';
setManualClock(true);
advance(1000 / 60);   // step one 60 fps frame, then screenshot
```

`tests/film.mjs <demo-id> 0,300,800` renders filmstrips of any demo in headless Chrome/Edge this way.

---

## Core (`src/core/`)

| Module | What it gives you |
| --- | --- |
| `ease.js` | Full easing set, exact CSS `cubicBezier()` solver, signature curves `cinematic`, `silk`, `snap`, `glide`, `anticipate` and their `css.*` strings for WAAPI. |
| `spring.js` | `Spring(value, { stiffness, damping, mass })` — fixed 240 Hz sub-stepping, identical on 60/120/144 Hz displays. |
| `ticker.js` | `tick(fn)` shared rAF loop that sleeps when idle; `wait(ms)` frame-clock delay; capture mode. |
| `tween.js` | `tween({ duration, delay, ease, onUpdate })` thenable tweens. |
| `split.js` | Accessible, grapheme-aware text splitting into chars / words / lines (with masks), preserving inline markup. |
| `noise.js` | Seeded simplex noise (2D/3D) and PRNG. |
| `snapshot.js` | Inert DOM clones for transitions (canvas pixels copied, entrance animations frozen). |

---

## Text (`src/text/`)

| Effect | Import | Key options | Methods |
| --- | --- | --- | --- |
| **Velocity Cascade** — spring-physics drop with velocity smear + motion blur; hop-and-gravity exit | `velocityCascade` | `stagger` 34, `distance` 1.15em, `stiffness` 150, `damping` 14, `rotate` 16, `smear`, `blur`, `order` (`start`/`end`/`center`/`edges`/`random`) | `play` `reverse` |
| **Signal Decode** — scanning beam, filmic glyph cycling, lock-on flare; width-locked cells | `signalDecode` | `duration` 1700, `glyphs` (`mixed`/`blocks`/`cipher`/`binary`/`kana`/custom), `fps` 24, `beam`, `flash`, `glow` | `play` `reverse` `setText(str)` |
| **Ink Bloom** — ink-on-wet-paper bloom via turbulence + threshold that relaxes to identity (no pop) | `inkBloom` | `duration` 2000, `stagger` 150, `blur`, `turbulence`, `frequency`, `octaves` | `play` `reverse` |
| **Particle Assembly** — text rasterised from real layout into particles that spiral in; pointer parts them; smoke exit | `particleText` | `gap` 2.6, `size` 1.9, `duration` 2600, `colors[]`, `swirl`, `trail`, `radius`, `force`, `shimmer` | `play` `reverse` |
| **Magnetic Field** — per-glyph springs pushed/tilted by the pointer; exposes `--sf-heat` | `magneticText` | `radius` 170, `strength` 0.38em, `mode` (`repel`/`attract`), `rotate`, `scale`, `lift` | `point(x,y)` `release` |
| **Prism Converge** — additive RGB/CMY channels converge on springs; pointer velocity shears them | `prismConverge` | `theme` (`dark`/`light`), `spread`, `stagger`, `shear` | `play` `reverse` |
| **Liquid Morph** — words melt into each other through a surface-tension threshold; width glides | `liquidMorph` | `words[]`, `duration` 1300, `hold` 2000, `blur`, `align` | `play` `pause` `next` `to(word)` |
| **Departure Board** — mechanical split-flap with gravity leaves, shadows, rebound | `splitFlap` | `length`, `charset`, `flip` 74ms, `settle`, `stagger`, `maxFlips` · CSS `--sf-flap-bg/fg/w/h` | `set(text)` `play` `reverse` |
| **Weight Wave** — variable-font axes driven by an idle swell or a pointer lens | `weightWave` | `axes` `{ wght: [min,max], opsz: [...] }`, `radius`, `wavelength`, `speed`, `sharpness` | `play` `pause` |
| **Curtain Lines** — masked line (or char) reveal with a straightening hinge; re-wraps on resize & font load | `curtainLines` | `by` (`lines`/`chars`), `duration` 1500, `stagger`, `charStagger`, `rotate`, `ease` | `play` `reverse` |
| **Blade Slice** — halves glide together along a diagonal cut; a light filament races the seam | `bladeSlice` | `angle` -9, `distance`, `gap`, `duration` · CSS `--sf-blade`, `--sf-blade-glow` | `play` `reverse` |
| **Orbit Ring** — text on a true 3D cylinder with kerning-aware spacing, depth fade, drag inertia | `textRing` | `tilt`, `speed`, `separator`, `minRadius`, `fade`, `center` (element at the core) | `play` `pause` |
| **Elastic Headline** — grab and pull letters; area-preserving stretch, neighbour falloff, wobbly snap-back | `elasticHeadline` | `reach` 1.3, `give`, `stretch`, `stiffness`, `damping` 8.5 | `pull(i, dx, dy)` `release` |
| **Scroll Scrub** — words wake in sequence as you scroll, with a travelling highlight; smoothed input | `scrollScrub` | `scroller`, `start`, `end`, `window`, `dim`, `blur`, `highlight`, `follow` | `progress` |
| **Slot Reel** — every letter a slot reel: staggered spin, motion smear, kick-back landing, gilt flash | `slotReel` | `pool`, `spins`, `duration`, `stagger`, `flash` | `play` `setText(str)` |
| **Anagram Morph** — shared letters travel on arcs to their new places; others drop away or condense in | `anagramMorph` | `words[]`, `duration`, `hold`, `stagger`, `arc`, `caseSensitive`, `loop` | `play` `pause` `to(word)` |

## Transitions (`src/transitions/`)

Cover transitions take a `swap` callback that runs while the frame is covered: `await fx.run(() => showNext())`.
Cut transitions take the two scenes: `await fx.run(fromEl, toEl)`. Direct effects act on the outgoing element (put the next scene underneath).

| Effect | Import | Type | Key options |
| --- | --- | --- | --- |
| **Iris Aperture** — rotating pinwheel iris with per-leaf lighting | `aperture(container)` | cover | `blades` 7, `close` 950, `hold`, `open` 1250, `rotation`, `tone`, `light`, `seam`, `origin` |
| **Liquid Curtain** — stacked colour layers with bowing liquid edges | `liquidCurtain(container)` | cover | `colors[]`, `direction` (`up`/`down`/`left`/`right`), `duration`, `lag`, `bulge` |
| **Glass Shatter** — radial fracture, crack propagation, 3D shard tumble; rewindable | `glassShatter(el)` | direct | `origin`, `spokes`, `rings`, `crack`, `hold`, `duration`, `gravity`, `force` → `shatter()` `assemble()` |
| **Facet Flip** — two-sided louvres turning in a wave, sinking mid-turn | `facetFlip(container)` | cut | `facets` 9, `axis` (`y`/`x`), `duration`, `stagger`, `depth`, `order` |
| **Ember Burn** — film-burn dissolve with char band and molten rim on live DOM | `emberBurn(el)` | direct | `duration`, `angle`, `directional`, `scale`, `ember`, `core`, `char`, `edge` → `burn()` `ignite()` |
| **Hyperspace** — accelerating star streaks, scene pulled into the tunnel, white bloom | `hyperspace(container)` | cover | `stars`, `duration`, `tint`, `flash`, `origin`, `scene: () => el` |
| **Ripple Grid** — tile wavefront from a point, crest colour, dissolves outward | `rippleGrid(container)` | cover | `size`, `speed`, `grow`, `color`, `crest` → `run(swap, {x, y})` |
| **Slice Shift** — alternating bands shear away/in with velocity skew | `sliceShift(container)` | cut | `slices` 7, `duration`, `stagger`, `skew`, `easing` |
| **Page Turn** — a real peel: the corner is dragged across the spread, the flap is a true reflection with crease light and cast shadow; four grabs (bottom, top, flick, edge) chosen at random and jittered every run | `pageTurn(container)` | cut | `direction` (`forward`/`back`), `style` (`random`/`bottom`/`top`/`flick`/`edge`), `jitter` 1 |
| **Chromatic Shift** — R/G/B drift apart on one smooth bell curve with true lateral aberration, crossfade at the peak, re-converge; compositing only | `chromaticShift(container)` | cut | `duration` 1300, `spread` 0.035, `aberration`, `angle`, `sweep` |
| **Anamorphic Flare** — a light source slides across the lens: thin blue anamorphic streak, ghost reflections through the optical centre, wash at the cut | `lightLeak(container)` | cover | `duration` 2100, `from` (`left`/`right`), `streak`, `core`, `scene: () => el` |
| **Metaball Bloom** — glossy liquid drops fall and stretch, splash, pool until the frame is sealed, then drain leaving drips; lit with specular, fresnel rim and meniscus | `metaballBloom(container)` | cover | `color`, `specular`, `rim`, `drops`, `cover`, `drain`, `gravity`, `resolution` → `run(swap, {x, y})` |

## Cards (`src/cards/`)

| Effect | Import | Markup / key options | Methods |
| --- | --- | --- | --- |
| **Holographic Foil** | `holoCard(el)` | `maxTilt` 14, `lift`, `idle` | `aim(x,y)` `release` |
| **Diorama Depth** | `depthCard(wrap)` | layers with `data-depth="0–1.6"` inside a `[data-depth-surface]` card; `[data-float]` layers sit in front of the glass and may break out of the frame; `maxTilt`, `depth`, `shine`, `idle` | — |
| **Physical Flip** | `flipCard(el)` | `.front` + `.back` children; `thickness`, `lift`, `stiffness`, `damping`, `drag` | `flip(side?)` |
| **Throwable Deck** | `cardDeck(el)` | children are cards; `visible`, `offset`, `scaleStep`, `threshold`, `velocity`, `gravity` 2900, `drag` 0.9 | `next('left'/'right')` |
| **Dust Dissolve** | `dustCard(el)` | `cols`, `rows`, `duration`, `wind`, `strength`, `sweep`; the intact card is the real element (no seams); pair two to dissolve one card into another | `prepare` `dissolve` `restore` |
| **Aurora Edge** | `auroraBorder(el)` | `colors[]`, `width`, `speed`, `boost`, `reach`, `tail` | `setWake(0–1)` `pause` |
| **Portal Expand** | `expandCard(container, { siblings })` | detail element with `[data-portal-hero]` and `[data-portal-rise]` children | `open(card, detail)` `close()` |
| **Orbit Carousel** | `orbitCarousel(el)` | children are cards; `radius`, `spacing`, `tilt`, `autoplay`, `friction` | `go(i)` `next` `prev` |
| **Lens Reveal** | `lensReveal(el)` | `.base` + `.reveal` children (the reveal layer is moved, not cloned); `radius`, `zoom` 1.15, `stretch`, `maxStretch`, `idle` | `moveTo(x, y)` `release` |
| **Expanding Panels** | `expandingPanels(el)` | children with optional `[data-panel-art]` / `[data-panel-copy]`; `grow`, `start`, `stiffness`, `damping` | `open(i)` |
| **Fanned Hand** | `fanHand(el)` | children are cards; `spread` 40, `radius`, `lift` 0.11, `straighten`, `part` 3.2, `breathe`, `onSelect` | `focus(i)` `select(i)` |
| **In the Dark** (spotlight grid) | `spotlightGrid(el)` | children are cards; `[data-lit]` content is only visible in the beam; `radius`, `light`, `darkness`, `fog`, `motes`, `idle` | `aim(x, y)` `release` |

## Breadcrumbs (`src/breadcrumbs/`)

All render accessible markup inside the element you pass (a `<nav>` is ideal) and call `onNavigate(index, items)` when a crumb is chosen. The gallery demos run each one inside a small working file browser, so you can see how it pairs with real page changes.

| Effect | Import | Key options | Methods |
| --- | --- | --- | --- |
| **Liquid Trail** — asymmetric-spring active pill, unfurl/absorb | `liquidCrumbs(nav)` | `items[]`, `duration` · CSS `--sf-lc-active`, `--sf-lc-fg` | `push` `go(i)` `pop` `set` |
| **Accordion Path** — middle levels fold into a bead | `accordionCrumbs(nav)` | `items[]`, `keepStart`, `keepEnd`, `stagger`, `closeDelay` | `expand` `collapse` `set` |
| **Terminal Path** — backspace/type with human rhythm, commit sweeps | `terminalCrumbs(nav)` | `prompt`, `path[]`, `speed` · CSS `--sf-term-*` | `go(path)` `push` `pop` |
| **Rolling Labels** — changed levels roll like slot reels | `rollingCrumbs(nav)` | `items[]`, `duration`, `stagger` | `set(items)` |
| **Title Handoff** — the page title flies up into the trail (and a crumb flies down to become the title), colour interpolated in flight | `titleHandoff(nav, h1)` | `items[]`, `title`, `duration` | `push` `go` |
| **Folder Tabs** — each level is a folder tab; the front tab flows into the page, deeper tabs slide in front, ancestors darken behind | `folderTabs(nav)` | `items[]`, `overlap` · CSS `--sf-ft-front`, `--sf-ft-base` | `push` `go` `pop` `set` |
| **Step Path** — checkout/wizard stepper: progress pours along the track, rings fill and checks draw in, the current step breathes | `stepPath(nav)` | `steps[]`, `index`, `onNavigate` · CSS `--sf-st-accent` | `set(i)` `next` `back` |
| **Ink Underline** — hand-drawn ink stroke written under the current level, pencil preview on hover | `inkCrumbs(nav)` | `items[]`, `ink`, `width`, `draw` | `push` `go` `pop` `set` |

## Interface (`src/ui/`)

| Effect | Import | Key options | Methods |
| --- | --- | --- | --- |
| **Magnetic Button** — a quiet magnet: soft-limited lean toward the pointer, label parallax, direction-aware fill, press squeeze | `magneticButton(el)` | `radius` 70, `pull` 0.22, `label` 0.45, `fill` · CSS `--sf-mag-fill` | `point(x,y)` |
| **Morph Cursor** — velocity-stretched ring that wraps `[data-cursor]` targets | `morphCursor({ root })` | `size`, `stretch`, `padding` · CSS `--sf-cursor` | `move(x,y)` `leave` |
| **Rolling Odometer** — per-digit reels with smear and overshoot | `odometer(el)` | `value`, `format(n)`, `duration`, `stagger`, `blur` | `set(n)` |
| **Velocity Marquee** — scroll/drag-reactive ticker with skew | `velocityMarquee(el)` | `speed`, `direction`, `skew`, `sensitivity`, `listen` | `impulse(v)` |
| **Elastic Toggle** — squash, stretch, jelly landing | `elasticToggle(el)` | `checked`, `onChange` · CSS `--sf-tg-on/off/w/h` | `toggle` `set` `press` |
| **Cinematic Loader** — uneven progress, counter, shutter reveal | `cinematicLoader(container)` | `label`, `duration` · CSS `--sf-ld-*` | `run` `progress(p)` `reveal` |
| **Toast Stack** — depth pile, hover fan-out, swipe dismiss | `toastStack(container)` | `max`, `gap`, `peek`, `duration` | `show({title, body, accent})` `clear` |
| **Celebration Burst** — confetti physics + shock ring | `burstButton(el)` | `colors[]`, `count`, `power` | `fire(x?, y?)` |
| **Gooey Tabs** — liquid active-tab bead that pinches a droplet between tabs; labels auto-invert | `gooeyTabs(nav)` | `items[]`, `index`, `onChange` | `select(i)` |
| **Scroll Comet** — progress line with a velocity-stretched comet head and sparks | `scrollComet(host)` | `scroller`, `color`, `head`, `track`, `thickness`, `follow`, `sparks` | `progress` |
| **Image Trail** — frames drop along the pointer path, then erode like footprints in sand: a grainy front eats each one, the rim turns sand-coloured and grains drift away | `imageTrail(el)` | `images[]` (URLs or CSS gradients), `spacing`, `size`, `life`, `erode`, `sand`, `wind`, `max` | `feed(x, y)` `reset` |

---

### Art loaders (`src/ui/loaders/`)

Canvas preloaders that pair two artists. Each accepts real progress, smooths it on a spring so jumpy network updates still read as fluid motion, loops gently while waiting, and plays a finale when complete.

```js
import { bauhausGoya } from './src/ui/loaders/bauhaus-goya.js';
const loader = bauhausGoya(document.querySelector('.splash'));
loader.progress(0.4);      // 0–1, as often as you like
await loader.complete();   // runs to 100% and plays the finale
// or: await loader.run(3200) for a simulated, uneven load
```

| Loader | Import | What happens |
| --- | --- | --- |
| **Bauhaus × Goya** | `bauhausGoya` | Bauhaus primaries on a rocking seesaw, lit by one flickering candle in Goya’s black-painting dark; the ball rolls under gravity, an ochre ring fills, everything settles into balance at 100%. |
| **Mondrian × Hokusai** | `mondrianHokusai` | A Mondrian grid on washi paper; each cell floods with a curling Hokusai wave that leaves shimmering seigaiha scales; a great wave crosses the whole composition at 100%. |
| **Kandinsky × Morandi** | `kandinskyMorandi` | Kandinsky’s circles in Morandi’s dusty palette, each breathing on its own beat of an 84 bpm bar while notes land on a stave; they gather into concentric rings at 100%. |
| **Calder × Miró** | `calderMiro` | A Calder mobile of Miró shapes; every arm is a damped pendulum, and each shape hung as progress arrives sets the mobile swinging to rebalance; a gust, then level, at 100%. |
| **Riley × Klimt** | `rileyKlimt` | Bridget Riley’s op-art bands rippling over Klimt’s gold leaf; the vibration calms as progress grows, and the bands part to reveal the gold at 100%. |

All loaders expose `progress(p)`, `complete()`, `run(ms)`, `reset()`, `value` and `destroy()`, and render a `role="progressbar"` with live `aria-valuenow`.

## Project layout

```
index.html            gallery
view.html             theatre mode (one effect, full size)
docs.html             this README, rendered
examples/landing.html a real page built from the library
serve.mjs / start.bat zero-dependency local server
src/core/             motion engine (ticker, springs, easing, split, noise, snapshot)
src/text|transitions|cards|breadcrumbs|ui/   the effects
gallery/              gallery shell, demo definitions (gallery/demos/*.js) and demo styles
tests/smoke.html      mounts every demo on a frozen clock and reports errors
tests/smoke.mjs       headless runner for the smoke test
tests/film.mjs        headless filmstrip renderer (frame-exact)
```

## Performance notes

- Everything shares one frame loop that sleeps when idle; off-screen gallery stages are fully unmounted.
- Fragment effects (**Dust Dissolve**, **Glass Shatter**) build their pieces via `prepare()` — call it ahead of time (e.g. on hover or when the scene settles) so the first frame is instant. Lower `cols`/`rows` or `spokes`/`rings` for low-end devices.
- **Ember Burn** bakes its burn field in a Web Worker (cached per size/seed) and runs only four cheap filter primitives per frame; the glow is drawn on a canvas at reduced resolution.
- **Metaball Bloom** evaluates its field in JS at `resolution` × CSS pixels (default 0.3) and upscales; raise it for sharper edges, lower it for weaker devices.
- **Lens Reveal**, **Chromatic Shift** and **Portal Expand** animate transforms and opacity only, so they never repaint while moving.
- `tests/perf.mjs id1,id2` reports frame-time percentiles in headless Chrome (software-composited, so layer-heavy effects read pessimistic there).

## Browser support

Current Chrome, Edge, Safari and Firefox. Progressive details: `-webkit-box-reflect` (carousel floor reflection) is Chromium/WebKit only; variable-font effects need a variable font. Pointer-driven effects degrade to their idle choreography on touch devices; the custom cursor disables itself on coarse pointers.

## Testing

```bash
node serve.mjs &
node tests/smoke.mjs                       # every demo, frozen clock, error report
node tests/film.mjs ink-bloom 0,400,900    # filmstrip → prints the sheet path
node tests/perf.mjs lens-reveal,hyperspace  # real-time frame-time percentiles
```

The film/smoke tools drive a locally installed Chrome or Edge over the DevTools Protocol; Pillow (`pip install pillow`) is used to stitch filmstrips.
