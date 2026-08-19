import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { read, relativeToSrc, sourceFiles, stringLiteralsIn, stylesheetFiles } from '../../test/sourceFiles.js';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL (e.g. http://localhost:3000/...) at transform time, for every module it
// transforms, including this one under Vitest. fileURLToPath then throws
// because the rewritten URL is http:, not file:. node:path composition avoids
// the rewrite (same fix as tokens.test.js and fonts.test.js).
const styleDir = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';

const NAMED_ALLOWED = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

/* Every stylesheet under `src/`, not `readdirSync(src/style)`. */
function stylesheets() {
  return stylesheetFiles().map(relativeToSrc);
}

function readStylesheet(rel) {
  return readFileSync(join(styleDir, '..', rel), 'utf8');
}

function rawColoursIn(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  for (const m of withoutComments.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\brgba?\([^)]*\)/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\bhsla?\([^)]*\)/g)) found.push(m[0]);
  // Scan the whole declaration value (colon to the closing `;`/`!important`),
  // not just a value that is nothing but the colour name - `border: 1px
  // solid white`, `box-shadow: 0 2px 4px black` and `outline: 2px dashed red`
  // must all be caught, not only a bare `color: white`. `[^;{}]` keeps a
  // match from crossing a rule boundary, so this can't mistake a selector's
  // pseudo-class colon (`:hover`, `:not(...)`) for a declaration - those are
  // never followed by `;`/`!` before the next `{`/`}`.
  for (const m of withoutComments.matchAll(/:([^;{}]+)[;!]/g)) {
    // A custom-property name can legitimately contain a colour word, e.g.
    // `var(--decorative-orange)` - strip var(...) references before
    // scanning, or the token layer's own names would fail this test.
    const value = m[1].replace(/var\([^)]*\)/g, '');
    for (const wordMatch of value.matchAll(/[a-z]+/gi)) {
      const word = wordMatch[0].toLowerCase();
      if (!NAMED_ALLOWED.has(word) && CSS_NAMED_COLOURS.has(word)) found.push(word);
    }
  }
  return found;
}

/** The named colours actually used in this codebase today, plus common ones. */
const CSS_NAMED_COLOURS = new Set([
  'white', 'black', 'red', 'green', 'blue', 'gold', 'brown', 'gray', 'grey',
  'orange', 'yellow', 'purple', 'pink', 'cyan', 'magenta', 'silver', 'navy',
  'teal', 'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'darkgoldenrod',
  'darkslategray', 'lightgray', 'lightgrey',
]);

describe('stylesheets use tokens, not raw colours', () => {
  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  it.each(stylesheets())('%s contains no raw colour literal', (file) => {
    const found = rawColoursIn(readStylesheet(file));
    expect(found, `${file} still has raw colours: ${found.join(', ')}`).toEqual([]);
  });
});

describe('every referenced custom property exists', () => {
  const declared = new Set(
    [...readFileSync(styleDir + 'tokens.generated.css', 'utf8')
      .matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );

  it.each(stylesheets())('%s references only declared properties', (file) => {
    const used = [...readStylesheet(file)
      .matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((name) => !declared.has(name));
    expect(missing, `${file} uses undeclared: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * The seam. This guard read `src/style/*.css`; the canvas guard read
 * `GameLogic (MVC)/**\/*.js`. `src/component/**\/*.jsx` was owned by neither,
 * and it held 22 raw colour literals - five flat-UI zone hues with five
 * hand-darkened borders and five glows, an inline '#444' for locked levels,
 * and a seven-hex rainbow gradient - rendering twenty level nodes and six
 * zone backdrops on the lobby map. Inline styles beat the stylesheet, so
 * tokenizing Lobby.css could not touch any of it, and criterion 2's letter
 * ("no *stylesheet*...") survived while its purpose did not.
 *
 * Scope is therefore the whole JS/JSX surface under `src/`, derived by
 * walking the tree (see src/test/sourceFiles.js), not a list of directories
 * anyone has to remember to update. Over-inclusion is free here: a file with
 * no colour literal passes trivially, so pointing this at everything costs
 * nothing and removes the possibility of a seam.
 */
describe('component source uses tokens, not raw colours', () => {
  const FILES = sourceFiles();

  /**
   * Hex, rgb()/rgba(), hsl()/hsla() in any string literal, anywhere. This is
   * the check that covers the shapes actually found: object-property values
   * in a config module, an inline ternary, and a gradient argument list.
   */
  function functionalColoursIn(src) {
    const found = [];
    for (const literal of stringLiteralsIn(src)) {
      const inner = literal.slice(1, -1);
      for (const m of inner.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
      for (const m of inner.matchAll(/\brgba?\([^)]*\)/gi)) found.push(m[0]);
      for (const m of inner.matchAll(/\bhsla?\([^)]*\)/gi)) found.push(m[0]);
    }
    return found;
  }

  /* Named colours, but only where the string is being used *as* a colour. */
  const COLOUR_PROPERTY = String.raw`(?:background|backgroundColor|borderColor|border|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|color|fill|stroke|outline|outlineColor|boxShadow|textShadow|caretColor|columnRuleColor|textDecorationColor|glowColor)`;

  function namedColoursIn(src) {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const found = [];
    const values = [];
    for (const m of code.matchAll(new RegExp(`${COLOUR_PROPERTY}\\s*:\\s*(['"\`])((?:[^\\\\]|\\\\.)*?)\\1`, 'g'))) {
      values.push(m[2]);
    }
    for (const literal of stringLiteralsIn(src)) {
      if (/\b(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\s*\(/i.test(literal)) {
        values.push(literal.slice(1, -1));
      }
    }
    for (const value of values) {
      // var(--decorative-orange) legitimately contains a colour word; the
      // stylesheet half of this guard strips var() for the same reason.
      const stripped = value.replace(/var\([^)]*\)/g, '');
      for (const wordMatch of stripped.matchAll(/[a-z]+/gi)) {
        const word = wordMatch[0].toLowerCase();
        if (!NAMED_ALLOWED.has(word) && CSS_NAMED_COLOURS.has(word)) found.push(word);
      }
    }
    return found;
  }

  /*
   * The login screen predates this spec, is named nowhere in it, and styles
   * itself entirely from a local inline-style object in a different idiom
   * (dark blue-violet gradients, #4CAF50 buttons).
   */
  const PINNED = new Map([
    ['component/login/LoginPage.jsx', [
      '#1a1a2e', '#16213e',
      'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)',
      '#fff', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.08)', '#fff',
      '#4CAF50', '#fff', '#ff6b6b', '#7fffa4', '#88aaff',
    ]],
  ]);

  it('derives a file list covering the whole JS/JSX surface, not one directory', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  // The two files the seam actually contained, plus one from each side of it.
  // If any of these drops out, the derivation has regressed and the guard is
  // silently narrower than it reads.
  it.each([
    'component/GameRendering/MapLayout.jsx',
    'component/GameRendering/Lobby.jsx',
    'component/GameRendering/GameBoard.jsx',
    'component/common/Card.jsx',
    'component/login/LoginPage.jsx',
    'component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawUIs.js',
  ])('includes %s', (rel) => {
    expect(FILES.map(relativeToSrc)).toContain(rel);
  });

  it.each(FILES.map((f) => [relativeToSrc(f), f]))('%s has no functional colour literal', (rel, file) => {
    const hits = functionalColoursIn(read(file));
    const pinned = PINNED.get(rel);
    if (pinned) {
      expect(hits, `${rel}'s pinned literal set has changed - convert it or update the pin deliberately`).toEqual(pinned);
      return;
    }
    expect(hits, `${rel} has ${hits.length} raw colour literal(s): ${hits.join(', ')}`).toEqual([]);
  });

  it.each(FILES.map((f) => [relativeToSrc(f), f]))('%s names no colour where a colour is expected', (rel, file) => {
    const hits = namedColoursIn(read(file));
    expect(hits, `${rel} uses named colour(s) as a style value: ${hits.join(', ')}`).toEqual([]);
  });
});

describe('numeric readouts keep their tabular figures', () => {
  const gameBoard = readFileSync(styleDir + 'GameBoard.css', 'utf8');

  it('keeps tabular-nums on the top bar', () => {
    expect(gameBoard).toContain('font-variant-numeric: tabular-nums');
  });

  /*
   * .energy-value, .score-value and .health-value are each named twice in
   * GameBoard.css: once as part of the shared `.energy-value,\n.score-value,
   * \n.health-value { font-variant-numeric: tabular-nums; ... }` selector
   * group, and once as their own standalone rule carrying the reserved width.
   */
  function soleSelectorRule(css, selector) {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = m[1].split(',').map((s) => s.trim());
      if (selectors.length === 1 && selectors[0] === selector) return m[2];
    }
    return '';
  }

  it.each([
    ['.energy-value', '4.5ch'],
    ['.score-value', '6.5ch'],
    ['.health-value', '5.5ch'],
  ])('keeps the reserved width on %s', (selector, width) => {
    const rule = soleSelectorRule(gameBoard, selector);
    expect(rule, `no standalone rule found for ${selector}`).not.toEqual('');
    expect(rule).toContain(width);
  });
});
