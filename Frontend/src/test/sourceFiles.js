/**
 * Shared file-list derivation for the guard tests.
 *
 * Every guard on this branch that failed to guard failed on *scope* - which
 * files it was pointed at - never on its matching logic. Four of them share a
 * non-recursive `readdirSync(src/style)` that sees only `.css`; the canvas
 * colour guard walks `GameLogic (MVC)/**` and sees only `.js`. Between those
 * two file lists sat `src/component/**\/*.jsx`, owned by neither, holding the
 * 22 raw colour literals that render the lobby map, and `ctx.font` in 8 files
 * drawing every canvas string in Arial.
 *
 * So the rule this module exists to enforce is: a guard's scope is derived
 * from the tree and from file *content*, never from a hand-written directory
 * or file list. The only guard on this project never found wanting is the one
 * that already did that. A list of directories will be wrong again the next
 * time someone adds a file somewhere nobody predicted.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL (e.g. http://localhost:3000/...) at transform time, for every module it
// transforms, including this one under Vitest. fileURLToPath then throws
// because the rewritten URL is http:, not file:. node:path composition avoids
// the rewrite (the same fix every other test in this repo carries).
export const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every JavaScript/JSX source file under `src/`, recursively.
 *
 * Excluded, and only these:
 * - `__tests__/` and `src/test/` - fixtures and harnesses. A fake canvas
 *   context's placeholder `fillStyle: '#000000'`, or the literal a mutation
 *   test deliberately asserts about, is not something a player looks at.
 * - `src/style/tokens.js` - the definition site. Every colour and family in
 *   the game is a literal *there*; that is the point of it.
 */
export function sourceFiles({ extensions = ['.js', '.jsx'], root = SRC_ROOT } = {}) {
  const out = [];
  walk(root, out, extensions);
  return out
    .filter((file) => relative(root, file) !== join('style', 'tokens.js'))
    .sort();
}

function walk(dir, out, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'test') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out, extensions);
    else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
}

/** Path relative to `src/`, for readable test names and assertions. */
export function relativeToSrc(file) {
  return relative(SRC_ROOT, file);
}

/**
 * Comments stripped before any content scan. Not decoration: this codebase's
 * comments are full of possessive apostrophes ("the enemy's", "doesn't"), and
 * a naive single-quote scan over an unstripped file reads one of those as the
 * start of a string literal and runs to the next one, swallowing real code -
 * and now also mentions colours and font names while explaining why they must
 * not be written as literals, which a scanner would happily flag.
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every quoted or backtick-templated string in a source file. */
export function stringLiteralsIn(src) {
  const code = stripComments(src);
  const literals = [];
  for (const re of [/"(?:[^"\\]|\\.)*"/g, /'(?:[^'\\]|\\.)*'/g, /`(?:[^`\\]|\\.)*`/g]) {
    for (const m of code.matchAll(re)) literals.push(m[0]);
  }
  return literals;
}

export function read(file) {
  return readFileSync(file, 'utf8');
}
