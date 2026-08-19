import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canvasFont, ensureDisplayFontLoaded, type } from '../tokens.js';
import { read, relativeToSrc, sourceFiles, stringLiteralsIn, stripComments, stylesheetFiles } from '../../test/sourceFiles.js';

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

/* Lobby.css declared `font-family: "Pixel", sans-serif` twice. */
describe('stylesheets name only tokenized font families', () => {
  // Every stylesheet under `src/`, derived by walking (see
  // src/test/sourceFiles.js). The previous non-recursive
  // `readdirSync(src/style)` could not see a stylesheet colocated with its
  // component - `component/GameRendering/ProbePanel.css` declaring
  // `font-family: "Comic Sans MS"` passed this guard without being read at
  // all. Same defect as the `.jsx` seam, in the CSS half.
  function stylesheets() {
    return stylesheetFiles().map(relativeToSrc);
  }

  function readStylesheet(rel) {
    return readFileSync(join(here, '..', '..', rel), 'utf8');
  }

  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  it.each(stylesheets())('%s declares font-family only via var(--type-*)', (file) => {
    const css = readStylesheet(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
    const untokenized = declarations.filter((value) => !/^var\(--type-[a-z-]+\)$/.test(value));
    expect(untokenized, `${file} names a font family outside the token layer: ${untokenized.join(', ')}`).toEqual([]);
  });

  // The block above only reads `font-family:`. The `font:` shorthand sets the
  // family too, so `font: bold 16px Arial` would have declared an untokenized
  // family and passed silently - latent today (nothing uses the shorthand),
  // and closed here rather than left as the next instance of this pattern.
  it.each(stylesheets())('%s does not smuggle a family in via the font: shorthand', (file) => {
    const css = readStylesheet(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const shorthands = [...css.matchAll(/(?:^|[;{\s])font:\s*([^;}]+)/g)].map((m) => m[1].trim());
    expect(shorthands, `${file} uses the font: shorthand: ${shorthands.join(', ')}`).toEqual([]);
  });
});

/* The canvas half, which is where this guard was actually failing. */
describe('canvas and inline typography come from the token layer', () => {
  const FONT_ASSIGNMENT = /\.font\s*=\s*([^;\n]+)/g;
  const INLINE_FAMILY = /fontFamily\s*:\s*([^,}\n]+)/g;

  /** Files that set a font at all, by content - the derivation. */
  const FILES = sourceFiles().filter((file) => {
    const code = stripComments(read(file));
    return /\.font\s*=/.test(code) || /fontFamily\s*:/.test(code) || /font-family/.test(code);
  });

  /**
   * Weight/style/size/line-height keywords a `ctx.font` string may legitimately
   * contain. Anything left over in a quoted string after these are removed is
   * a font *family* written by hand.
   */
  const NON_FAMILY = /\b(?:bold|bolder|lighter|normal|italic|oblique|small-caps|\d+(?:\.\d+)?(?:px|em|rem|%|pt)?|\/)\b/g;

  function handwrittenFamiliesIn(expression) {
    const leftovers = [];
    for (const literal of stringLiteralsIn(expression)) {
      const remainder = literal
        .slice(1, -1)
        .replace(/\$\{[^}]*\}/g, ' ')   // template holes are computed sizes
        .replace(NON_FAMILY, ' ')
        .replace(/[\s,'"]/g, '');
      if (remainder) leftovers.push(literal);
    }
    return leftovers;
  }

  it('finds every font-setting file by content', () => {
    // A vacuity guard with teeth: if the derivation silently narrows to
    // nothing (a renamed property, a changed extension), every it.each below
    // would pass by having nothing to check. Seven files set a font today -
    // the review's "8 files" counted the seven it then listed.
    expect(FILES.length).toBeGreaterThanOrEqual(7);
  });

  it.each([
    'component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawUIs.js',
    'component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawNegativeEffect.js',
    'component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawExplosionEffect.js',
    'component/GameLogic (MVC)/DefenderUnits.js',
    'component/GameLogic (MVC)/EnemyUnits.js',
    'component/GameLogic (MVC)/GameEngineBreakDown/Drops/EnergyDrop.js',
    'component/GameLogic (MVC)/GameEngineBreakDown/Drops/CardPieceDrop.js',
  ])('derives %s from its content', (rel) => {
    expect(FILES.map(relativeToSrc)).toContain(rel);
  });

  it.each(FILES.map((f) => [relativeToSrc(f), f]))('%s names no font family by hand', (rel, file) => {
    const code = stripComments(read(file));
    const offenders = [];
    for (const [, expression] of code.matchAll(FONT_ASSIGNMENT)) {
      offenders.push(...handwrittenFamiliesIn(expression));
    }
    for (const [, expression] of code.matchAll(INLINE_FAMILY)) {
      offenders.push(...handwrittenFamiliesIn(expression));
    }
    expect(offenders, `${rel} hardcodes ${offenders.length} font family/families: ${offenders.join(', ')}`).toEqual([]);
  });

  it.each(FILES.map((f) => [relativeToSrc(f), f]))('%s builds every font from the token layer', (rel, file) => {
    // The check above rejects a literal family; this one rejects the other
    // direction - a font assembled from a local constant or a variable that
    // happens to hold "16px Arial", where no literal appears at the
    // assignment site at all. Both have to hold for the token layer to be the
    // only route to a font.
    const code = stripComments(read(file));
    const untokenized = [];
    for (const [whole, expression] of code.matchAll(FONT_ASSIGNMENT)) {
      if (!/canvasFont\s*\(|\btype\.[a-zA-Z]/.test(expression)) untokenized.push(whole.trim());
    }
    expect(untokenized, `${rel} sets a font without the token layer: ${untokenized.join(' | ')}`).toEqual([]);
  });
});

describe('canvasFont composes a usable ctx.font from the type tokens', () => {
  it('puts the whole display stack in the font string, not just the first family', () => {
    // Rejects a helper that emits only "Black Ops One": canvas text would then
    // have no fallback at all if the face were unavailable, where DOM text
    // falls back through system-ui.
    expect(canvasFont(16)).toBe(`16px ${type.display}`);
    expect(canvasFont(16)).toContain('system-ui');
  });

  it('keeps the weight ahead of the size, the order the shorthand requires', () => {
    // Rejects `12px bold ...`, which is not a valid font shorthand: the
    // browser discards the whole assignment and silently keeps the previous
    // font, so every "bold" label on the battlefield would come out at
    // whatever weight the last draw happened to leave behind.
    expect(canvasFont(12, 'bold')).toBe(`bold 12px ${type.display}`);
  });

  it('accepts a fractional size, as the fade effects produce', () => {
    // DrawExplosionEffect scales its size by an alpha (20 * alpha), so a
    // helper that rounded or rejected non-integers would break that fade.
    expect(canvasFont(20 * 0.35)).toBe(`7px ${type.display}`);
    expect(canvasFont(7.5)).toContain('7.5px');
  });
});

describe('the display face is loaded before canvas text asks for it', () => {
  it('asks the document for the display family', async () => {
    // Rejects the shape this replaced - putting the family in ctx.font and
    // trusting it to appear. Canvas text does not trigger a webfont fetch, so
    // without this the first frames draw in the fallback family and never
    // redraw.
    const load = vi.fn(() => Promise.resolve([]));
    await ensureDisplayFontLoaded({ fonts: { load } });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0]).toContain('Black Ops One');
  });

  it('resolves rather than throwing where there is no font manager', async () => {
    // jsdom has no document.fonts; Node has no document. GameEngine.initialize
    // awaits this, so a throw here would stop the game from starting in every
    // test in this suite and in any non-browser host.
    await expect(ensureDisplayFontLoaded(undefined)).resolves.toBeUndefined();
    await expect(ensureDisplayFontLoaded({})).resolves.toBeUndefined();
  });

  it('resolves rather than rejecting when the fetch fails', async () => {
    // A font that 404s must degrade to the fallback family, not deadlock
    // initialize() on an unhandled rejection.
    const load = vi.fn(() => Promise.reject(new Error('network')));
    await expect(ensureDisplayFontLoaded({ fonts: { load } })).resolves.toBeUndefined();
  });
});
