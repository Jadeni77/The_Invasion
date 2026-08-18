/**
 * A bare single-class selector must be owned by one stylesheet.
 *
 * Every stylesheet in this app is bundled globally, so `.close-button` declared
 * in four files is not four local styles - it is one global class with four
 * competing definitions, and bundle order decides which wins. That is how the
 * Settings dialog's X came to render in the viewport's top-right corner instead
 * of its own header: `UpgradeModal.css` set `position: absolute` on
 * `.close-button`, it won everywhere, and absolute positioning resolved against
 * the overlay's `position: fixed`. The same mechanism put `UpgradeModal`'s
 * per-card buttons in a corner earlier in this project.
 *
 * A collision is invisible in review - each file looks correct on its own - and
 * it changes behaviour on another screen entirely. Hence a guard.
 *
 * Scope is derived from the stylesheet directory rather than a hand-written file
 * list, because twelve guards in this project have been found not to guard and
 * every one failed on scope.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { stylesheetFiles } from '../../test/sourceFiles.js';

/**
 * Collisions that predate this guard. Each entry stores the number of
 * stylesheets that declare it, NOT just the name: a selector picking up a THIRD
 * declaration must fail even though it is already listed, which is the hole an
 * allowlist of bare names would leave open.
 *
 * These are recorded in docs/superpowers/2026-08-12-known-issues-and-followups.md
 * (issue 31). Shrink this table; do not add to it.
 */
const KNOWN_COLLISIONS = {
  '.energy-icon': 4,
  '.resource-icon': 3,
  '.progress-bar': 2,
  '.progress-fill': 2,
  '.progress-text': 2,
  '.back-button': 2,
  '.resource-symbol': 2,
  '.resource-info': 2,
  '.resource-value': 2,
  '.resource-label': 2,
  '.card-name': 2,
  '.card-cost': 2,
  '.cancel-button': 2,
  '.deployment-indicator': 2,
  '.indicator-icon': 2,
  '.pieces-icon': 2,
  '.action-buttons': 2,
};

/** Strip comments so a selector quoted in prose is not read as a declaration. */
function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Which stylesheets declare each bare `.single-class` selector. */
function ownership() {
  const owners = new Map();
  for (const file of stylesheetFiles()) {
    if (basename(file) === 'tokens.generated.css') continue;
    const css = withoutComments(readFileSync(file, 'utf8'));
    for (const match of css.matchAll(/(?:^|[}])\s*([^{}@]+)\{/g)) {
      for (const part of match[1].split(',')) {
        const selector = part.trim();
        // Only bare single-class selectors behave like globals. Anything
        // scoped (`.screen .thing`) or compound (`.a.b`) is already owned.
        if (!/^\.[a-zA-Z][\w-]*$/.test(selector)) continue;
        if (!owners.has(selector)) owners.set(selector, new Set());
        owners.get(selector).add(basename(file));
      }
    }
  }
  return owners;
}

describe('a bare class selector is owned by one stylesheet', () => {
  const owners = ownership();

  it('reads a real set of stylesheets (guards against a vacuous run)', () => {
    expect(stylesheetFiles().length).toBeGreaterThan(8);
    expect(owners.size).toBeGreaterThan(100);
  });

  it('declares no NEW bare class in more than one stylesheet', () => {
    const unexpected = [];
    for (const [selector, files] of owners) {
      if (files.size < 2) continue;
      if (KNOWN_COLLISIONS[selector]) continue;
      unexpected.push(`${selector} -> ${[...files].sort().join(', ')}`);
    }
    expect(
      unexpected.sort(),
      'a bare class declared in two stylesheets is one global class with two '
      + 'definitions; scope it to its own screen (.screen .thing)',
    ).toEqual([]);
  });

  it('does not let a known collision spread to another stylesheet', () => {
    // The count matters, not just the name. A third `.resource-icon` would sit
    // inside a name-only allowlist unnoticed.
    const spread = [];
    for (const [selector, expectedCount] of Object.entries(KNOWN_COLLISIONS)) {
      const actual = owners.get(selector)?.size ?? 0;
      if (actual > expectedCount) {
        spread.push(`${selector}: now in ${actual} stylesheets, was ${expectedCount}`);
      }
    }
    expect(spread.sort()).toEqual([]);
  });

  it('keeps the allowlist honest - a fixed collision must be deleted from it', () => {
    const stale = [];
    for (const [selector, expectedCount] of Object.entries(KNOWN_COLLISIONS)) {
      const actual = owners.get(selector)?.size ?? 0;
      if (actual < expectedCount) {
        stale.push(`${selector}: down to ${actual} - update KNOWN_COLLISIONS to ${actual || 'removed'}`);
      }
    }
    expect(stale.sort(), 'good news, but the table has to follow').toEqual([]);
  });

  it('has scoped .close-button, the collision that shipped a visible bug', () => {
    expect(owners.get('.close-button') ?? new Set()).toEqual(new Set());
  });
});
