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
    // Bounded by this rule's own closing brace, not a fixed character count:
    // a window measured from the selector to file end (or any fixed length)
    // depends on what happens to follow .game-map in the file, which is
    // exactly the kind of position-dependent guard this project keeps
    // finding and having to fix. .game-map's body has no nested braces
    // (no @-rule inside it), so `[^}]*` reliably stops at its own `}`.
    const [rule] = css.match(/^\s*\.game-map\s*\{[^}]*\}/m) ?? [];
    expect(rule, 'no .game-map rule found').toBeTruthy();
    expect(rule).not.toMatch(/--colors-accent-/);
  });
});
