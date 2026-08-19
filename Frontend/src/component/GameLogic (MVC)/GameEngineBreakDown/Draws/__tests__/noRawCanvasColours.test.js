import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL (e.g. http://localhost:3000/...) at transform time, for every module it
// transforms, including this one under Vitest. fileURLToPath then throws
// because the rewritten URL is http:, not file:. node:path composition avoids
// the rewrite (same fix as tokens.test.js, fonts.test.js and noRawColours.test.js).
const here = dirname(fileURLToPath(import.meta.url));
const logicRoot = join(here, '..', '..', '..') + '/'; // GameLogic (MVC)/

/*
 * A file is "in scope" if it draws or feeds a colour into a file that does: it
 * touches the canvas colour API directly (fillStyle, strokeStyle, shadowColor,
 * addColorStop), constructs an object with a color/innerColor/ particleColor
 * property, or imports the token module.
 */
const DRAW_SIGNAL = /\.(fillStyle|strokeStyle|shadowColor)\b|\baddColorStop\s*\(|\b(color|innerColor|particleColor)\s*:/;
const TOKEN_IMPORT_SIGNAL = /from\s+['"][^'"]*\/style\/tokens\.js['"]/;

/** Comments are stripped for the same reason stringLiteralsIn() strips them below - see its comment. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/*
 * Walks every `.js` file under GameLogic (MVC), skipping `__tests__`
 * directories - fixtures, not production drawing code.
 */
function walkJsFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function drawsOrFeedsACanvasColour(file) {
  const code = stripComments(readFileSync(file, 'utf8'));
  return DRAW_SIGNAL.test(code) || TOKEN_IMPORT_SIGNAL.test(code);
}

const FILES = walkJsFiles(logicRoot, []).filter(drawsOrFeedsACanvasColour);

/** The extended CSS colour keyword set - not just the handful this codebase happened to use. */
const CSS_NAMED_COLOURS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
  'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'grey', 'green', 'greenyellow', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
  'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime',
  'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown',
  'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
];
const NAMED_COLOUR_RE = new RegExp(`\\b(${CSS_NAMED_COLOURS.join('|')})\\b`, 'i');

/* Pulls every quoted or templated string out of a JS source file. */
function stringLiteralsIn(src) {
  const withoutComments = stripComments(src);
  const literals = [];
  for (const re of [/"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g, /`(?:[^`\\]|\\.)*`/g]) {
    for (const m of withoutComments.matchAll(re)) literals.push(m[0]);
  }
  return literals;
}

/*
 * A colour literal in *any* quoted string - not only one assigned straight to
 * `ctx.fillStyle`.
 */
function colourLiteralsIn(src) {
  const found = [];
  for (const literal of stringLiteralsIn(src)) {
    const inner = literal.slice(1, -1);
    if (/#[0-9a-fA-F]{3,8}\b/.test(inner)) found.push(literal);
    else if (/\brgba?\([^)]*\)/i.test(inner)) found.push(literal);
    else if (/\bhsla?\([^)]*\)/i.test(inner)) found.push(literal);
    else if (NAMED_COLOUR_RE.test(inner)) found.push(literal);
  }
  return found;
}

describe('the derived file list actually finds what it must', () => {
  const relPaths = FILES.map((f) => relative(logicRoot, f));

  it('finds more than a handful of files to check', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  // Each of these was, at some point, missing from a hand-written list: the
  // Draws/ files and the three top-level classes were the original brief;
  // CombatManager.js and FeedbackManager.js were found by manual audit;
  // GridManager.js and the two Drops/ files were found only once the list
  // stopped being hand-written. If any of these ever drops out again, the
  // derivation - not memory - has regressed.
  it.each([
    'GameEngineBreakDown/Draws/DrawEntities.js',
    'GameEngineBreakDown/Draws/DrawUIs.js',
    'GameEngineBreakDown/Draws/DrawExplosionEffect.js',
    'GameEngineBreakDown/Draws/DrawNegativeEffect.js',
    'GameEngine.js',
    'EnemyUnits.js',
    'DefenderUnits.js',
    'GameEngineBreakDown/InGameManagerHandlers/CombatManager.js',
    'Feedback/FeedbackManager.js',
    'GameEngineBreakDown/InGameManagerHandlers/GridManager.js',
    'GameEngineBreakDown/Drops/EnergyDrop.js',
    'GameEngineBreakDown/Drops/CardPieceDrop.js',
  ])('includes %s', (rel) => {
    expect(relPaths).toContain(rel);
  });
});

describe('canvas drawing uses tokens, not raw colours, in any form', () => {
  it.each(FILES)('%s has no colour literal, in any position', (path) => {
    const hits = colourLiteralsIn(readFileSync(path, 'utf8'));
    expect(hits, `${path} has ${hits.length} raw colour literal(s): ${hits.join(', ')}`).toEqual([]);
  });
});
