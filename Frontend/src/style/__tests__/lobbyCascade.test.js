import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'Lobby.css'), 'utf8');

/** Count top-level rule blocks opening with exactly this selector. */
function declarationsOf(selector) {
  const pattern = new RegExp(`^\\s*${selector.replace('.', '\\.')}\\s*\\{`, 'gm');
  return (css.match(pattern) ?? []).length;
}

describe('the lobby has one rule per container, not several fighting', () => {
  it('declares .lobby-container exactly once', () => {
    expect(declarationsOf('.lobby-container')).toBe(1);
  });

  it('declares .game-map exactly once', () => {
    expect(declarationsOf('.game-map')).toBe(1);
  });

  it('uses no accent token as the map surface', () => {
    const rule = css.slice(css.search(/^\s*\.game-map\s*\{/m));
    expect(rule.slice(0, 400)).not.toMatch(/--colors-accent-/);
  });
});
