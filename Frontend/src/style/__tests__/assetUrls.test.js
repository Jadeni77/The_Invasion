import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stylesheetFiles } from '../../test/sourceFiles.js';

// dirname(fileURLToPath(import.meta.url)), not import.meta.dirname: Vite's
// import-analysis rewrites some import.meta forms, and this is the pattern
// every existing test in this repo uses.
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, '..', '..', '..', 'public');

/** Every url() in a stylesheet, paired with the file it should resolve to. */
function urlTargets(cssPath) {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/g)]
    .map((m) => m[1].trim())
    .filter((url) => !url.startsWith('data:') && !url.startsWith('http'))
    .map((url) => ({
      url,
      // A leading slash is served from public/; anything else is relative to the sheet.
      file: url.startsWith('/') ? join(PUBLIC_DIR, url) : resolve(dirname(cssPath), url),
    }));
}

describe('every stylesheet url() resolves to a file that exists', () => {
  const sheets = stylesheetFiles();

  it('finds stylesheets to check', () => {
    expect(sheets.length).toBeGreaterThan(5);
  });

  it.each(sheets)('%s references no missing file', (sheet) => {
    const missing = urlTargets(sheet)
      .filter(({ file }) => !existsSync(file))
      .map(({ url }) => url);
    expect(missing, `${sheet} references missing: ${missing.join(', ')}`).toEqual([]);
  });
});
