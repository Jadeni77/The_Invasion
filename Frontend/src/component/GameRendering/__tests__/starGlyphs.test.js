import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT, read, relativeToSrc, sourceFiles } from '../../../test/sourceFiles.js';

/*
 * `GameBoard.css` styles `.stars-value` with `font-family:
 * var(--type-display)` and `color: var(--colors-accent-energy)`, and both
 * declarations did nothing, because `GameBoard.jsx` rendered U+2B50 WHITE
 * MEDIUM STAR into it.
 */

/** Star codepoints with Emoji_Presentation=Yes - drawn by the emoji font. */
const EMOJI_STARS = [
  ['⭐', 'U+2B50 WHITE MEDIUM STAR'],
  ['\u{1F31F}', 'U+1F31F GLOWING STAR'],
  ['\u{1F320}', 'U+1F320 SHOOTING STAR'],
];

/** The text-presentation star this game styles. */
const TEXT_STAR = '★';

const STYLE_DIR = join(SRC_ROOT, 'style');

/** Every class name some stylesheet gives a `color` or a `font-family`. */
function classesStyledAsText() {
  const styled = new Set();
  for (const file of readdirSync(STYLE_DIR).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(STYLE_DIR, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(?:^|[\s;])(?:color|font-family)\s*:/.test(body)) continue;
      for (const [, className] of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) styled.add(className);
    }
  }
  return styled;
}

/*
 * JSX elements written as `className=... > content <`, paired with the classes
 * named on them.
 */
function classedElements(src) {
  const elements = [];
  const pattern = /className\s*=\s*(?:"([^"]*)"|\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\})[^>]*>([\s\S]{0,200}?)</g;
  for (const m of src.matchAll(pattern)) {
    const classAttr = m[1] ?? m[2] ?? m[3] ?? '';
    const classes = [...classAttr.matchAll(/[A-Za-z_][\w-]*/g)].map((c) => c[0]);
    elements.push({ classes, content: m[4] });
  }
  return elements;
}

const STYLED_CLASSES = classesStyledAsText();
const FILES = sourceFiles();

describe('a recoloured or re-faced element holds a glyph that can take it', () => {
  it('finds classes that stylesheets recolour, and files that use them', () => {
    // Vacuity guard: if either derivation returns nothing, every check below
    // passes by having nothing to compare.
    expect(STYLED_CLASSES.size).toBeGreaterThan(20);
    expect(STYLED_CLASSES.has('stars-value'), '.stars-value is no longer recoloured').toBe(true);
    expect(FILES.length).toBeGreaterThan(20);
  });

  it.each(FILES.map((f) => [relativeToSrc(f), f]))('%s puts no colour emoji in a recoloured slot', (rel, file) => {
    const offenders = [];
    for (const { classes, content } of classedElements(read(file))) {
      const styled = classes.filter((c) => STYLED_CLASSES.has(c));
      if (styled.length === 0) continue;
      for (const [glyph, name] of EMOJI_STARS) {
        if (content.includes(glyph)) offenders.push(`${name} inside .${styled.join('.')}`);
      }
    }
    expect(
      offenders,
      `${rel}: ${offenders.join('; ')} - a colour-emoji glyph renders from the platform `
      + 'emoji font, so it ignores both the color and the font-family the rule sets. '
      + `Use ${TEXT_STAR} (U+2605), which defaults to text presentation.`,
    ).toEqual([]);
  });

  it('renders the same star on the results screen as in the level select', () => {
    // Rejects the divergence directly, in the direction the class-pairing
    // check cannot see: two screens each using a glyph that is *individually*
    // fine but not the same one, so the treatment lands on one and not the
    // other. Whatever star this game uses, both screens use it.
    const results = read(FILES.find((f) => relativeToSrc(f).endsWith(join('GameRendering', 'GameBoard.jsx'))));
    const levelSelect = read(FILES.find((f) => relativeToSrc(f).endsWith(join('GameRendering', 'Lobby.jsx'))));

    expect(results, 'GameBoard.jsx renders no star').toContain(TEXT_STAR);
    expect(levelSelect, 'Lobby.jsx renders no star').toContain(TEXT_STAR);
  });
});
