import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL (e.g. http://localhost:3000/...) at transform time, for every module it
// transforms, including this one under Vitest. fileURLToPath then throws
// because the rewritten URL is http:, not file:. node:path composition avoids
// the rewrite (same fix as tokens.test.js and fonts.test.js).
const styleDir = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';

/** Generated or font-only sheets are allowed to hold literals. */
const EXEMPT = new Set(['tokens.generated.css', 'fonts.css']);

const NAMED_ALLOWED = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

function stylesheets() {
  return readdirSync(styleDir).filter((f) => f.endsWith('.css') && !EXEMPT.has(f));
}

function rawColoursIn(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  for (const m of withoutComments.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\brgba?\([^)]*\)/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\bhsla?\([^)]*\)/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/:\s*([a-z]+)\s*[;!]/g)) {
    const word = m[1].toLowerCase();
    if (!NAMED_ALLOWED.has(word) && CSS_NAMED_COLOURS.has(word)) found.push(word);
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
    const found = rawColoursIn(readFileSync(styleDir + file, 'utf8'));
    expect(found, `${file} still has raw colours: ${found.join(', ')}`).toEqual([]);
  });
});

describe('every referenced custom property exists', () => {
  const declared = new Set(
    [...readFileSync(styleDir + 'tokens.generated.css', 'utf8')
      .matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );

  it.each(stylesheets())('%s references only declared properties', (file) => {
    const used = [...readFileSync(styleDir + file, 'utf8')
      .matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((name) => !declared.has(name));
    expect(missing, `${file} uses undeclared: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('numeric readouts keep their tabular figures', () => {
  const gameBoard = readFileSync(styleDir + 'GameBoard.css', 'utf8');

  it('keeps tabular-nums on the top bar', () => {
    expect(gameBoard).toContain('font-variant-numeric: tabular-nums');
  });

  /**
   * .energy-value, .score-value and .health-value are each named twice in
   * GameBoard.css: once as part of the shared `.energy-value,\n.score-value,
   * \n.health-value { font-variant-numeric: tabular-nums; ... }` selector
   * group, and once as their own standalone rule carrying the reserved
   * width. A naive `css.indexOf(selector)` finds the shared group first for
   * every one of the three names (each is the group's last selector,
   * immediately followed by ` {`, so it is textually indistinguishable from
   * a standalone rule) and never reaches the width - it would report a
   * missing width even when the CSS is untouched. Finding the rule whose
   * selector list has exactly one entry is what actually locates the width
   * declaration.
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
