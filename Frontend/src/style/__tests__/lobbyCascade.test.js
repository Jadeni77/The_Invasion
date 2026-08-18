import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../test/sourceFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'Lobby.css'), 'utf8');
const cssNoComments = stripComments(css);

/**
 * Every top-level rule opener in the file - `.foo {`, `@keyframes name {` -
 * derived from this file's own formatting: a top-level selector starts at
 * column 0, while everything nested under it (a keyframes percentage, a
 * declaration) is indented. That is what actually distinguishes "a rule" from
 * "a thing inside a rule" in this codebase, not a hand-picked list of
 * selectors to go look for - which is exactly how the previous version of
 * this guard, fixed at `.lobby-container`/`.game-map`, went blind to eight of
 * the ten real collisions in this same file (see final-review.md I5).
 * Comments are stripped first so a line like " * Depth layers..." inside a
 * block comment can never be mistaken for one.
 */
function topLevelSelectors(text) {
  return [...text.matchAll(/^([^\s{}][^{}]*)\{/gm)].map((m) => m[1].trim());
}

function declarationCounts(text) {
  const counts = new Map();
  for (const selector of topLevelSelectors(text)) {
    counts.set(selector, (counts.get(selector) ?? 0) + 1);
  }
  return counts;
}

const counts = declarationCounts(cssNoComments);

/** Count top-level rule blocks opening with exactly this selector. */
function declarationsOf(selector) {
  return counts.get(selector) ?? 0;
}

/**
 * Selectors this file still declares more than once, dated at the point this
 * pass found and audited them (2026-08-18) rather than unwinding them, plus
 * the reason each is safe to leave alone for now. None is a media-query
 * override - this file has none - so there is no structural "different
 * context" excuse available; every one is a genuine same-context collision.
 * `.map-connection` and `.level-number` were on this same list until this
 * pass fixed them (the former was rendering the route as an opaque 7px bar -
 * see final-review.md I5 - the latter was C1's own broken colour, on a
 * selector that happened to be declared twice). Deleting an entry here means
 * its collision was resolved; a name showing up in the failure below that
 * ISN'T on this list is a new collision, not a known one.
 */
const KNOWN_DUPLICATE_SELECTORS = [
  // Three definitions of the same @keyframes name; last one wins for every
  // consumer, including `.energy .value::after`, which asked for the FIRST
  // one's plain opacity pulse and silently gets the last one's
  // translate+scale+fade instead. Cosmetic, not a visibility bug like
  // `.map-connection`'s collision was.
  '@keyframes pulse',
  // Two `.energy .value` rules (one sets colour, one sets `position:
  // relative` for the `::after` pulse ring) - additive, not conflicting;
  // both declarations survive because they don't share a property.
  '.energy .value',
  // Superseded pulse-ring sizing/colour pair for `.level-pulse` - the later
  // rule's `background`/`animation` win, the earlier rule's `position`/
  // `width`/`height`/`border-radius` survive unchanged either way (same
  // values in both), so the collision is inert.
  '.level-pulse',
  // `.treasure-chest`'s 40x40 sizing wins over the earlier 50x40, but the
  // earlier rule's `transform: translate(-50%, -50%)` and `filter:
  // drop-shadow(...)` survive uncontested - the chest is still centred and
  // glowing, just not from the rule someone would expect to find it in.
  '.treasure-chest',
  // Same pair, `:hover` state: the later rule's `transform: scale(1.2)`
  // drops the centring translate the earlier rule declared, so a hovered
  // chest visibly shifts. Real, but not the route-occlusion class of bug
  // `.map-connection` was, and not one of this pass's named fixes.
  '.treasure-chest:not(.collected):not(.locked-chest):hover',
  '.treasure-chest.collected',
  '.treasure-chest.locked-chest',
  // Sizing/position from the first rule collide with offsets from the
  // second; the glow ring is slightly off-centre on the chest as a result.
  '.chest-glow',
];

describe('the lobby has one rule per container, not several fighting', () => {
  it('finds selectors to check (guards against a vacuous run)', () => {
    expect(counts.size).toBeGreaterThan(20);
  });

  it('declares every selector in Lobby.css at most once, except the dated, audited list', () => {
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s).sort();
    const unexpected = duplicated.filter((s) => !KNOWN_DUPLICATE_SELECTORS.includes(s));
    const resolved = KNOWN_DUPLICATE_SELECTORS.filter((s) => !duplicated.includes(s));
    expect(
      unexpected,
      `New duplicate selector(s) in Lobby.css not on the audited list: ${unexpected.join(', ') || 'none'}.` +
        (resolved.length
          ? ` Also, these audited entries are no longer duplicated - delete them from KNOWN_DUPLICATE_SELECTORS: ${resolved.join(', ')}.`
          : ''),
    ).toEqual([]);
  });

  it('declares .lobby-container exactly once', () => {
    expect(declarationsOf('.lobby-container')).toBe(1);
  });

  it('declares .game-map exactly once', () => {
    expect(declarationsOf('.game-map')).toBe(1);
  });

  it('declares .game-map-container exactly once', () => {
    expect(declarationsOf('.game-map-container')).toBe(1);
  });

  it('declares .map-connection exactly once (its collision rendered the route as an opaque 7px bar)', () => {
    expect(declarationsOf('.map-connection')).toBe(1);
  });

  it('declares .level-number exactly once', () => {
    expect(declarationsOf('.level-number')).toBe(1);
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
