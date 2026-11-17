/**
 * Explicitly request every face the gallery uses. `document.fonts.ready`
 * alone resolves early when nothing has been laid out yet, which would let
 * effects measure fallback-font metrics.
 */
const FACES = [
  '400 1em "Instrument Serif"',
  'italic 400 1em "Instrument Serif"',
  '400 1em Inter',
  '500 1em Inter',
  '800 1em Inter',
  '400 1em "JetBrains Mono"',
  '500 1em "JetBrains Mono"',
  '400 1em Fraunces',
  '900 1em Fraunces',
];

export const fontsReady = (async () => {
  if (!document.fonts) return;
  try {
    await Promise.race([
      Promise.all(FACES.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await document.fonts.ready;
  } catch {
    /* offline or blocked — fall back to system fonts */
  }
})();
