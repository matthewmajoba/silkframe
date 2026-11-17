/**
 * Silkframe — accessible text splitter.
 *
 * split(el, { chars, words, lines, mask })
 *   → { chars, words, lines, wordChars, revert() }
 *
 * - Grapheme-aware (emoji and combined characters stay intact).
 * - Nested inline markup (<em>, <strong>, <a>…) is preserved for chars/words.
 * - `lines: true` groups words into block-level line wrappers after layout;
 *   with `mask: true` each line gets an overflow-clipping wrapper for reveals.
 * - Screen readers get the original sentence once via a visually-hidden copy;
 *   the split fragments are aria-hidden.
 */
import './style.js';

const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));

export function split(el, options = {}) {
  const {
    chars = true,
    words = true,
    lines = false,
    mask = false,
    charClass = 'sf-char',
    wordClass = 'sf-word',
    lineClass = 'sf-line',
  } = options;

  if (el.__sfSplit) el.__sfSplit.revert();

  const originalHTML = el.innerHTML;
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const result = { chars: [], words: [], lines: [], wordChars: [], revert };

  const content = document.createElement('span');
  content.setAttribute('aria-hidden', 'true');
  content.className = 'sf-split';
  content.style.display = 'contents';

  const makeWord = (text) => {
    const w = document.createElement('span');
    w.className = wordClass;
    w.style.display = 'inline-block';
    w.style.whiteSpace = 'nowrap';
    const list = [];
    if (chars) {
      for (const g of graphemes(text)) {
        const c = document.createElement('span');
        c.className = charClass;
        c.style.display = 'inline-block';
        c.textContent = g;
        w.appendChild(c);
        list.push(c);
        result.chars.push(c);
      }
    } else {
      w.textContent = text;
    }
    result.words.push(w);
    result.wordChars.push(list);
    return w;
  };

  const walk = (source, target) => {
    for (const node of Array.from(source.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = node.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) target.appendChild(document.createTextNode(' '));
          else target.appendChild(words || chars ? makeWord(part) : document.createTextNode(part));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          target.appendChild(document.createElement('br'));
          continue;
        }
        const clone = node.cloneNode(false);
        target.appendChild(clone);
        walk(node, clone);
      }
    }
  };

  const source = document.createElement('div');
  source.innerHTML = originalHTML;
  walk(source, content);

  const sr = document.createElement('span');
  sr.className = 'sf-sr';
  sr.textContent = label;

  el.innerHTML = '';
  el.appendChild(sr);
  el.appendChild(content);

  if (lines) buildLines();

  function buildLines() {
    // Read phase: group words by their rendered vertical position and
    // remember each word's inline ancestor chain (<em>, <a>, …).
    const groups = [];
    const chains = new Map();
    let lastTop = null;
    for (const w of result.words) {
      const r = w.getBoundingClientRect();
      if (lastTop === null || Math.abs(r.top - lastTop) > r.height * 0.5) {
        groups.push([]);
        lastTop = r.top;
      }
      groups[groups.length - 1].push(w);
      const chain = [];
      for (let p = w.parentElement; p && p !== content; p = p.parentElement) chain.unshift(p);
      chains.set(w, chain);
    }
    // Write phase: rebuild into line wrappers, re-creating inline markup per line.
    content.innerHTML = '';
    for (const group of groups) {
      const line = document.createElement('span');
      line.className = lineClass;
      line.style.display = 'block';
      let inner = line;
      if (mask) {
        line.style.overflow = 'hidden';
        // Room for ascenders/descenders without changing the line box.
        line.style.paddingBlock = '0.12em';
        line.style.marginBlock = '-0.12em';
        inner = document.createElement('span');
        inner.className = `${lineClass}-inner`;
        inner.style.display = 'block';
        line.appendChild(inner);
      }
      let openChain = [];
      let openWrappers = [];
      group.forEach((w, i) => {
        const chain = chains.get(w) || [];
        let k = 0;
        while (k < chain.length && k < openChain.length && chain[k] === openChain[k]) k++;
        if (i) (k === 0 ? inner : openWrappers[k - 1]).appendChild(document.createTextNode(' '));
        openChain = chain.slice(0, k);
        openWrappers = openWrappers.slice(0, k);
        for (let j = k; j < chain.length; j++) {
          const clone = chain[j].cloneNode(false);
          (j === 0 ? inner : openWrappers[j - 1]).appendChild(clone);
          openWrappers[j] = clone;
          openChain[j] = chain[j];
        }
        (chain.length ? openWrappers[chain.length - 1] : inner).appendChild(w);
      });
      content.appendChild(line);
      result.lines.push(mask ? inner : line);
    }
  }

  function revert() {
    el.innerHTML = originalHTML;
    delete el.__sfSplit;
  }

  el.__sfSplit = result;
  return result;
}
