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
 * time someone adds a file somewhere nobody predicted - including a list of
 * directories to *exclude*, which is how the first version of this module
 * reintroduced the very seam it exists to close (see sourceFiles below).
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
 * Nothing is excluded by *where it sits*. The first version of this walker
 * skipped any directory named `__tests__` or `test`, and a probe file at
 * `src/component/test/ProbeSandbox.jsx` walked straight through every guard
 * that used it: a plausible directory name switched the guards off for
 * everything beneath it. That is the same class of defect as the seam this
 * module was written to close, reintroduced by the module itself.
 *
 * So exclusion is a property of the file:
 * - it *is* a test, by name (`*.test.js`, `*.spec.jsx`, ...); or
 * - it *is* test support, by content - it imports `vitest` or
 *   `@testing-library/*`, which nothing in the shipped app does. This is what
 *   keeps `src/test/setup.js` out without naming its directory.
 * - `src/style/tokens.js` is exempt as the definition site: every colour and
 *   family in the game is a literal *there*, which is the point of it. That is
 *   one named file, asserted below, not a directory.
 *
 * A test's fixtures (a fake canvas context's placeholder `fillStyle:
 * '#000000'`, or the literal a mutation test asserts about) are therefore
 * still out of scope, but only because the file holding them is recognisably
 * a test - not because it happens to live in a directory with a certain name.
 */
export const TOKEN_DEFINITION = join('style', 'tokens.js');

const TEST_FILENAME = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_SUPPORT_IMPORT = /from\s+['"](?:vitest|@testing-library\/[^'"]+)['"]/;

export function isTestFile(file) {
  if (TEST_FILENAME.test(file)) return true;
  return TEST_SUPPORT_IMPORT.test(readFileSync(file, 'utf8'));
}

export function sourceFiles({ extensions = ['.js', '.jsx'], root = SRC_ROOT } = {}) {
  const out = [];
  walk(root, out, extensions);
  return out
    .filter((file) => relative(root, file) !== TOKEN_DEFINITION)
    .filter((file) => !isTestFile(file))
    .sort();
}

/**
 * Every stylesheet under `src/`, recursively, minus the two that are allowed
 * to hold literals - and those two are recognised by their content, not by
 * their filenames:
 *
 * - the generated token sheet, by its `GENERATED FILE` banner;
 * - a sheet whose every rule is an `@font-face`, which is what makes it a
 *   font declaration rather than a consumer of the token layer.
 *
 * Four guards used to share a non-recursive `readdirSync(src/style)`, so a
 * stylesheet colocated with its component - `component/GameRendering/
 * ProbePanel.css` - was invisible to all of them, as were `src/App.css` and
 * `src/index.css`. Widening the JS side alone left that half of the original
 * seam open.
 */
export function stylesheetFiles({ root = SRC_ROOT } = {}) {
  const out = [];
  walk(root, out, ['.css']);
  return out.filter((file) => !isTokenLayerSheet(readFileSync(file, 'utf8'))).sort();
}

function isTokenLayerSheet(css) {
  if (/GENERATED FILE/.test(css)) return true;
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
  return rules.length > 0 && rules.every((selector) => selector.startsWith('@font-face'));
}

function walk(dir, out, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
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
