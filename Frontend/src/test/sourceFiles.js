/* Shared file-list derivation for the guard tests. */
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

/* Every JavaScript/JSX source file under `src/`, recursively. */
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

/*
 * Every stylesheet under `src/`, recursively, minus the two that are allowed
 * to hold literals - and those two are recognised by their content, not by
 * their filenames: - the generated token sheet, by its `GENERATED FILE`
 * banner; - a sheet whose every rule is an `@font-face`, which is what makes
 * it a font declaration rather than a consumer of the token layer.
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

/* Comments stripped before any content scan. */
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
