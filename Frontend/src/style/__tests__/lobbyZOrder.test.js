import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../test/sourceFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = stripComments(readFileSync(join(HERE, '..', 'Lobby.css'), 'utf8'));

function rulesOf(text) {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}

const rules = rulesOf(css);

/*
 * The z-index the cascade actually assigns `selector`, last-declaration-wins
 * across every rule naming it (handles `.treasure-chest`, one of the file's
 * own known, audited duplicate selectors - see lobbyCascade.test.js - where
 * only the second copy declares `z-index` at all).
 */
function zIndexOf(selector) {
  let value = null;
  for (const rule of rules) {
    if (rule.selector !== selector) continue;
    const m = rule.body.match(/(?:^|[;{\s])z-index:\s*(-?\d+)\s*;/);
    if (m) value = Number(m[1]);
  }
  return value;
}

/*
 * This is the whole point of the test: I1 shipped because nothing pinned the
 * stack `Lobby.css:473-482` (the block comment above `.zone-ridge`) documents
 * in prose.
 */
const DOCUMENTED_STACK = [
  ['.zone-ridge', 1],
  ['.terrain-prop', 3],
  ['.zone-fore', 4],
  ['.game-map::after', 5],
  ['.map-connection', 6],
  ['.treasure-chest', 8],
  ['.level-node', 10],
  ['.endless-portal', 15],
];

describe('the map layer stack (Lobby.css)', () => {
  it('documents a stack of more than a couple of layers (guards against a vacuous run)', () => {
    expect(DOCUMENTED_STACK.length).toBeGreaterThan(5);
  });

  it.each(DOCUMENTED_STACK)('%s declares the documented z-index (%i)', (selector, expected) => {
    expect(zIndexOf(selector), `${selector} has no z-index declared at all`).toBe(expected);
  });

  it('renders every layer in the documented order, lowest to highest', () => {
    const zIndexes = DOCUMENTED_STACK.map(([selector]) => zIndexOf(selector));
    for (let i = 1; i < zIndexes.length; i++) {
      expect(
        zIndexes[i],
        `${DOCUMENTED_STACK[i][0]} (z-index ${zIndexes[i]}) does not sit above ` +
          `${DOCUMENTED_STACK[i - 1][0]} (z-index ${zIndexes[i - 1]})`,
      ).toBeGreaterThan(zIndexes[i - 1]);
    }
  });

  it('paints the route (.map-connection) above the opaque foreground band (.zone-fore) - I1', () => {
    // Named explicitly, not just left to the loop above: this exact pair is
    // the one the review measured - 3 connectors fully occluded, 13 washed
    // out under the ridge - and the one a future edit is most likely to
    // silently reverse again by touching one side without the other.
    expect(zIndexOf('.map-connection')).toBeGreaterThan(zIndexOf('.zone-fore'));
  });
});
