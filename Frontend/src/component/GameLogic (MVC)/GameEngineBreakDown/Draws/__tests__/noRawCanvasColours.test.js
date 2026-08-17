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
// the rewrite (same fix as tokens.test.js, fonts.test.js and noRawColours.test.js).
const here = dirname(fileURLToPath(import.meta.url));
const drawsDir = join(here, '..') + '/';
const logicDir = join(here, '..', '..', '..') + '/';

/**
 * Every drawing file the guard scans. A first version of this guard matched
 * only `ctx.fillStyle = "literal"` - a bare assignment - and missed the
 * colour arriving as an object property (`color: "brown"`), a ternary branch
 * (`cond ? "a" : "b"`), a `gradient.addColorStop()` argument, and a
 * `return "literal"` feeding fillStyle indirectly. All four forms were found
 * and converted by hand; none of them would have been caught by re-running
 * that guard, which is exactly the failure mode this project has shipped
 * four times now. This version matches the colour itself, in any quoted
 * string in the file, so no future syntactic position can hide one.
 *
 * CombatManager.js and FeedbackManager.js aren't part of Draws/ and share no
 * directory a scan could sweep up automatically, but they are real
 * construction sites for colours these files paint (the enemy projectile's
 * `color`, and the screen flash's colour) - so they're named explicitly.
 * Everything else is derived from readdirSync, so a new Draws file cannot
 * slip past the way these two originally did.
 */
const FILES = [
  ...readdirSync(drawsDir).filter((f) => f.endsWith('.js')).map((f) => drawsDir + f),
  logicDir + 'GameEngine.js',
  logicDir + 'EnemyUnits.js',
  logicDir + 'DefenderUnits.js',
  logicDir + 'GameEngineBreakDown/InGameManagerHandlers/CombatManager.js',
  logicDir + 'Feedback/FeedbackManager.js',
];

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

/**
 * Pulls every quoted or templated string out of a JS source file. Comments
 * are stripped first - not as decoration, but because this codebase's
 * comments are full of possessive apostrophes ("the enemy's", "doesn't"),
 * and a naive single-quote scan over an unstripped file would read one of
 * those apostrophes as the start of a string literal and run until the next
 * one, silently swallowing real code in between.
 */
function stringLiteralsIn(src) {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const literals = [];
  for (const re of [/"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g, /`(?:[^`\\]|\\.)*`/g]) {
    for (const m of withoutComments.matchAll(re)) literals.push(m[0]);
  }
  return literals;
}

/**
 * A colour literal in *any* quoted string - not only one assigned straight
 * to `ctx.fillStyle`. This is what catches the object-property, ternary,
 * addColorStop and return-value forms in one guard instead of one regex per
 * shape, and is why the file list above matters more than the match logic:
 * a colour hiding in a file this test never reads is still invisible.
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

describe('canvas drawing uses tokens, not raw colours, in any form', () => {
  it('finds drawing files to check', () => {
    expect(FILES.length).toBeGreaterThan(4);
  });

  it.each(FILES)('%s has no colour literal, in any position', (path) => {
    const hits = colourLiteralsIn(readFileSync(path, 'utf8'));
    expect(hits, `${path} has ${hits.length} raw colour literal(s): ${hits.join(', ')}`).toEqual([]);
  });
});
