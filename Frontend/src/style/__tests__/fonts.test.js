import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type } from '../tokens.js';

// Not `fileURLToPath(new URL('../fonts.css', import.meta.url))`: Vite's
// import-analysis plugin statically recognizes that exact
// `new URL(literal, import.meta.url)` syntax as its documented asset-URL
// pattern and rewrites it to a dev-server URL (e.g. http://localhost:3000/...)
// at transform time - it does this for every module Vite transforms,
// including this one under Vitest. fileURLToPath then throws "The URL must
// be of scheme file" because the rewritten URL is http:, not file:. Building
// the path with node:path instead avoids that rewrite (same fix as
// tokens.test.js and generate-tokens.mjs).
const here = dirname(fileURLToPath(import.meta.url));
const fontsCssPath = join(here, '..', 'fonts.css');
const fontsCss = readFileSync(fontsCssPath, 'utf8');

/** Every family named first in a token stack, i.e. the one we intend to use. */
function primaryFamilies() {
  return [type.display, type.body]
    .map((stack) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, ''))
    .filter((family) => !family.startsWith('system-ui'));
}

describe('fonts', () => {
  it('declares an @font-face for every non-system family the tokens name', () => {
    for (const family of primaryFamilies()) {
      expect(fontsCss, `no @font-face for ${family}`).toContain(`font-family: '${family}'`);
    }
  });

  it('points every @font-face at a file that exists', () => {
    const urls = [...fontsCss.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      // Resolve the url(...) target relative to fonts.css's own directory,
      // the same way a browser would resolve a relative CSS url().
      const resolved = join(dirname(fontsCssPath), url);
      expect(existsSync(resolved), `missing font file: ${url}`).toBe(true);
    }
  });
});

/**
 * Lobby.css declared `font-family: "Pixel", sans-serif` twice. No "Pixel"
 * font ever existed anywhere in the repo - no file, no @font-face, no
 * import - so both declarations silently fell back to sans-serif for the
 * life of the project and nothing noticed, because nothing checked a
 * stylesheet's font-family value against the type tokens.
 *
 * The test above guards the opposite direction: every token family has a
 * face. It stays silent about a stylesheet that names a family the tokens
 * never declared, which is exactly the shape of the "Pixel" bug. This
 * block closes that gap by requiring every font-family declaration in a
 * consuming stylesheet to be a reference to a type token, not a literal
 * family name - so a new orphan font-family fails loudly instead of
 * quietly rendering as whatever the fallback happens to be.
 */
describe('stylesheets name only tokenized font families', () => {
  const styleDir = join(here, '..') + '/';
  const EXEMPT = new Set(['tokens.generated.css', 'fonts.css']);

  function stylesheets() {
    return readdirSync(styleDir).filter((f) => f.endsWith('.css') && !EXEMPT.has(f));
  }

  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  it.each(stylesheets())('%s declares font-family only via var(--type-*)', (file) => {
    const css = readFileSync(styleDir + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
    const untokenized = declarations.filter((value) => !/^var\(--type-[a-z-]+\)$/.test(value));
    expect(untokenized, `${file} names a font family outside the token layer: ${untokenized.join(', ')}`).toEqual([]);
  });
});
