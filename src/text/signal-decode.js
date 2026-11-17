/**
 * Signal Decode
 * A scanning beam sweeps the line; glyphs cycle through a curated cipher set
 * at a film-like cadence, lock on as the beam passes, flare white-hot and
 * cool down to their resting colour. Glyph cells are width-locked so the
 * line never jitters, even with proportional fonts.
 *
 *   const fx = signalDecode('.code', { glyphs: 'blocks' });
 *   fx.play();
 *   fx.setText('NEW MESSAGE').then(...)
 */
import { split } from '../core/split.js';
import { tick } from '../core/ticker.js';
import { injectStyle } from '../core/style.js';
import { mulberry32 } from '../core/noise.js';
import { clamp, resolve, prefersReducedMotion, smoothstep } from '../core/utils.js';
import { inOutCubic } from '../core/ease.js';

const SETS = {
  blocks: '▖▗▘▙▚▛▜▝▞▟▀▄█▌▐░▒▓',
  cipher: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>?/\\|',
  binary: '01',
  mixed: '▚▞▙▟░▒#%&*+=<>/\\ABCDEFGHKMNRSTXZ0123456789',
  kana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン',
};

injectStyle(
  'sf-decode',
  `.sf-decode{position:relative}
.sf-decode .sf-char{text-align:center;vertical-align:top}
.sf-decode-beam{position:absolute;top:-25%;bottom:-25%;left:0;width:2px;pointer-events:none;
  background:linear-gradient(to bottom,transparent,var(--sf-beam,#fff) 30%,var(--sf-beam,#fff) 70%,transparent);
  box-shadow:0 0 18px 2px var(--sf-beam-glow,rgba(255,200,120,.75));opacity:0;will-change:transform,opacity}
.sf-decode-beam::before{content:"";position:absolute;top:10%;bottom:10%;right:1px;width:9em;max-width:40vw;
  background:linear-gradient(to left,var(--sf-beam-wash,rgba(255,190,110,.16)),transparent)}`
);

const DEFAULTS = {
  duration: 1700,
  glyphs: 'mixed',
  fps: 24, // glyph-cycling cadence (filmic, not frame-rate bound)
  scatter: 0.12, // random lock-on spread (fraction of duration)
  lead: 0.18, // how long (fraction) glyphs scramble before the beam arrives
  flash: '255,244,222', // rgb of lock-on flare
  glow: '255,170,80', // rgb of flare glow
  beam: true,
  seed: 11,
};

const parseRGB = (str) => {
  const m = str.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
};

export function signalDecode(target, options = {}) {
  const el = resolve(target);
  const o = { ...DEFAULTS, ...options };
  const set = SETS[o.glyphs] || o.glyphs;
  const pool = Array.from(set);
  const rand = mulberry32(o.seed);
  el.classList.add('sf-decode');
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

  let parts, cells, beam, off, settle, baseRGB;

  function build() {
    parts = split(el, { chars: true, words: true });
    baseRGB = parseRGB(getComputedStyle(el).color);
    const elRect = el.getBoundingClientRect();
    // Read pass
    const rects = parts.chars.map((c) => c.getBoundingClientRect());
    // Write pass — lock cell geometry so cycling glyphs never reflow the line.
    cells = parts.chars.map((node, i) => {
      const r = rects[i];
      node.style.width = `${r.width}px`;
      node.style.height = `${r.height}px`;
      return {
        node,
        final: node.textContent,
        x: (r.left + r.width / 2 - elRect.left) / Math.max(elRect.width, 1),
        jitter: rand(),
        phase: rand(),
        resolved: false,
        at: 0,
        lastSwap: -1,
      };
    });
    if (o.beam) {
      beam = document.createElement('span');
      beam.className = 'sf-decode-beam';
      beam.setAttribute('aria-hidden', 'true');
      el.appendChild(beam);
    }
  }
  build();

  const pick = () => pool[Math.floor(rand() * pool.length)];

  function stop() {
    if (off) off();
    off = null;
    if (settle) settle(false);
    settle = null;
  }

  function paint(c, heat, scrambling, now) {
    if (scrambling) {
      const frame = Math.floor((now / 1000) * o.fps + c.phase * 10);
      if (frame !== c.lastSwap) {
        c.lastSwap = frame;
        c.node.textContent = c.final === ' ' ? ' ' : pick();
      }
      const flicker = 0.28 + 0.32 * Math.abs(Math.sin(frame * 1.7 + c.phase * 6));
      c.node.style.opacity = flicker.toFixed(2);
      c.node.style.color = '';
      c.node.style.textShadow = '';
      return;
    }
    if (c.node.textContent !== c.final) c.node.textContent = c.final;
    c.node.style.opacity = '';
    if (heat > 0.004) {
      const f = parseRGB(`(${o.flash})`);
      const mix = (a, b) => Math.round(a + (b - a) * heat);
      c.node.style.color = `rgb(${mix(baseRGB[0], f[0])},${mix(baseRGB[1], f[1])},${mix(baseRGB[2], f[2])})`;
      c.node.style.textShadow = `0 0 ${(heat * 0.55).toFixed(3)}em rgba(${o.glow},${(heat * 0.9).toFixed(3)})`;
    } else {
      c.node.style.color = '';
      c.node.style.textShadow = '';
    }
  }

  /** Decode in: scramble → lock-on sweep → flare → rest. */
  function play() {
    stop();
    if (prefersReducedMotion()) {
      cells.forEach((c) => paint(c, 0, false));
      return Promise.resolve(true);
    }
    const D = o.duration;
    cells.forEach((c) => {
      c.resolved = false;
      c.at = clamp(c.x + (c.jitter - 0.5) * 2 * o.scatter) * D * 0.82 + D * 0.08;
      c.start = Math.max(0, c.at - D * o.lead - c.jitter * D * 0.25);
      c.node.style.opacity = '0';
    });
    return new Promise((done) => {
      settle = done;
      let t = 0;
      off = tick((now, dt) => {
        t += dt;
        let busy = false;
        if (beam) {
          const p = clamp(t / (D * 0.98));
          const bx = (inOutCubic(p) * 1.16 - 0.08) * el.clientWidth;
          beam.style.transform = `translate3d(${bx.toFixed(1)}px,0,0)`;
          beam.style.opacity = (smoothstep(0, 0.08, p) * (1 - smoothstep(0.9, 1, p))).toFixed(3);
          if (p < 1) busy = true;
        }
        for (const c of cells) {
          if (t < c.start) { c.node.style.opacity = '0'; busy = true; continue; }
          if (t < c.at) { paint(c, 0, true, now); busy = true; continue; }
          const heat = Math.exp(-(t - c.at) / 260);
          paint(c, heat, false, now);
          if (heat > 0.004) busy = true;
        }
        if (!busy) {
          off(); off = null; settle = null;
          cells.forEach((c) => paint(c, 0, false));
          if (beam) beam.style.opacity = '0';
          done(true);
        }
      });
    });
  }

  /** Encode out: glyphs dissolve back into cipher noise and fade. */
  function reverse() {
    stop();
    if (prefersReducedMotion()) {
      cells.forEach((c) => (c.node.style.opacity = '0'));
      return Promise.resolve(true);
    }
    const D = o.duration * 0.6;
    cells.forEach((c) => {
      c.at = clamp(1 - c.x + (c.jitter - 0.5) * 0.3) * D * 0.6;
    });
    return new Promise((done) => {
      settle = done;
      let t = 0;
      off = tick((now, dt) => {
        t += dt;
        let busy = false;
        for (const c of cells) {
          if (t < c.at) { busy = true; continue; }
          const k = clamp((t - c.at) / (D * 0.45));
          paint(c, 0, true, now);
          c.node.style.opacity = ((1 - k) * 0.6).toFixed(3);
          if (k < 1) busy = true;
        }
        if (!busy) {
          off(); off = null; settle = null;
          done(true);
        }
      });
    });
  }

  /** Swap to new text with an encode → decode cycle. */
  async function setText(text) {
    await reverse();
    beam?.remove();
    parts.revert();
    el.textContent = text;
    build();
    return play();
  }

  function destroy() {
    stop();
    beam?.remove();
    parts.revert();
    el.classList.remove('sf-decode');
  }

  return { el, play, reverse, setText, destroy };
}

export default signalDecode;
