/* The lobby survives a phone. Source-level guards, deliberately. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');
const jsx = readFileSync(join(HERE, '..', 'Lobby.jsx'), 'utf8');

/* Every @media block's body, with its condition. */
function mediaBlocks() {
  const blocks = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push({ condition: m[1].trim(), body: css.slice(open + 1, i) });
          break;
        }
      }
    }
  }
  return blocks;
}

/** True when any block narrower-than-something contains a rule matching `re`. */
function someWidthBlock(re) {
  return mediaBlocks().some((b) => /max-width/.test(b.condition) && re.test(b.body));
}

describe('the lobby has narrow-viewport rules at all', () => {
  it('declares at least one max-width media query', () => {
    // It had none, which is the whole reason the phone layout collapsed.
    expect(css).toMatch(/@media\s*\([^)]*max-width/);
  });

  it('lets the top band wrap on a narrow viewport', () => {
    // `nowrap` is correct where one row is achievable and impossible at 390px.
    expect(someWidthBlock(/\.lobby-topband\s*\{[^}]*flex-wrap:\s*wrap/s)).toBe(true);
  });

  it('gives the band blocks a full row each so they cannot overlap', () => {
    expect(someWidthBlock(/flex:\s*1 1 100%/)).toBe(true);
  });

  it('drops the resource captions, which is what buys back the width', () => {
    expect(someWidthBlock(/\.resource-label\s*\{[^}]*display:\s*none/s)).toBe(true);
  });

  it('gives the menu buttons their own row on a phone', () => {
    // At 390px the player name and four buttons together clipped "Settings".
    expect(someWidthBlock(/\.menu-buttons\s*\{[^}]*flex:\s*1 1 100%/s)).toBe(true);
  });

  it('has a stage that sheds text before it resorts to wrapping', () => {
    // The band fails gradually: measured, it wants ~1290px for one row, so there
    // is a range where dropping captions keeps the row rather than breaking it.
    const widths = mediaBlocks()
      .map((b) => Number((/max-width:\s*(\d+)px/.exec(b.condition) || [])[1]))
      .filter(Boolean);
    expect(widths.length, 'no width breakpoints at all').toBeGreaterThan(1);
    expect(Math.max(...widths), 'nothing handles the 900-1300px range').toBeGreaterThan(900);
  });

  it('handles a phone held sideways, which is short rather than narrow', () => {
    // Landscape is the expected posture: wide but under ~500px tall, where the
    // band is what crowds out a 720px terrain.
    const heightBlocks = mediaBlocks().filter((b) => /max-height/.test(b.condition));
    expect(heightBlocks.length, 'no max-height block').toBeGreaterThan(0);
    expect(heightBlocks.some((b) => /\.lobby-topband/.test(b.body))).toBe(true);
  });
});

describe('the opening scroll accounts for a frame shorter than the terrain', () => {
  it('writes scrollTop, not only scrollLeft', () => {
    expect(jsx).toMatch(/viewport\.scrollTop\s*=/);
  });

  it('only scrolls vertically when there is vertical overflow', () => {
    // On a desktop the frame already fits the terrain; this must be a no-op there
    // rather than nudging the map for no reason.
    expect(jsx).toMatch(/scrollHeight\s*-\s*viewport\.clientHeight/);
    expect(jsx).toMatch(/if\s*\(overflowY\s*>\s*0\)/);
  });

  it('clamps the vertical target inside the scrollable range', () => {
    // An unclamped target scrolls past the end and lands wherever the browser
    // decides, which is not the level the player is meant to be looking at.
    expect(jsx).toMatch(/Math\.max\(0,\s*Math\.min\(overflowY/);
  });
});
