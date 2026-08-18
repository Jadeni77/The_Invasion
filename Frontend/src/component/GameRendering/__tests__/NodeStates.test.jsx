/**
 * The three node states, and the stars.
 *
 * The CSS declared three states and two of them measured identical: completed
 * was a surface-raised/moss gradient and locked a flat surface-sunken, both dark
 * brown at a glance. RouteAndNodes.test.jsx already asserts the three rule
 * bodies differ textually, which those two did - differing text is not the same
 * claim as differing appearance, and it passed the whole time the owner could
 * not tell them apart.
 *
 * Nothing here can see a rendered pixel; jsdom has no rasteriser, so whether
 * completed now reads as "cleared" at a glance is the owner's call. What is
 * checkable is that the states are distinguished by more than a fill - an
 * outline, a ring and a glyph, each of which survives being small and being
 * looked at by someone who cannot separate two browns.
 *
 * The stars half is a real render test, and it exists to answer one question the
 * screenshot could not: no stars appeared on the owner's map, and it mattered
 * whether that was absent data or a broken render.
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Lobby from '../Lobby.jsx';
import { levelsMapData } from '../MapLayout.jsx';
import { stripComments } from '../../../test/sourceFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// Comments stripped before matching: this file's rules are each preceded by a
// block comment that names other selectors (and quotes their offsets), so an
// unstripped scan can match a selector inside prose instead of the rule.
const css = stripComments(readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8'));

// Every regex metacharacter escaped, not just `.` and `:` - these selectors
// contain `:not(...)`, whose parentheses would otherwise become a capture group
// and make the pattern match a string that does not exist, returning '' for a
// rule that is present. That is a guard reporting "no rule" instead of "wrong
// rule", which is the failure mode worth avoiding in a file full of them.
function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

let mockPlayerData;

vi.mock('../../GameLogic (MVC)/GameContext', () => ({
  useGame: () => ({
    gameState: 'lobby',
    playerData: mockPlayerData,
    startLevel: vi.fn(),
    openUpgradeModal: vi.fn(),
    openAchievements: vi.fn(),
    openCollection: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    handleLogout: vi.fn(),
    collectTreasure: vi.fn(),
    unlockedDefender: null,
    setUnlockedDefender: vi.fn(),
  }),
}));

/** A save with levels 1-3 finished, carrying 3, 2 and 1 stars in that order. */
function playerWithProgress() {
  const levelStars = Array(20).fill(0);
  levelStars[0] = 3;
  levelStars[1] = 2;
  levelStars[2] = 1;
  return {
    name: 'Commander',
    rank: 'Recruit',
    resources: {
      gold: 100, iron: 10, grain: 10, water: 10, gem: 5,
      lobbyEnergy: 5, maxLobbyEnergy: 10, energyRechargeRate: 6,
      lastEnergyRechargeTime: Date.now(),
    },
    cards: [],
    completedLevels: [1, 2, 3],
    unlockedLevels: [1, 2, 3, 4],
    levelStars,
    collectedTreasures: [],
    revealedSecrets: [],
  };
}

describe('completed, available and locked are distinguished by more than a fill', () => {
  const completed = ruleBody('.level-node.completed');
  const available = ruleBody('.level-node.available');
  const locked = ruleBody('.level-node.locked');

  it('declares all three states (guards against a vacuous run)', () => {
    for (const [name, body] of [['completed', completed], ['available', available], ['locked', locked]]) {
      expect(body.trim().length, `.level-node.${name} has no rule`).toBeGreaterThan(0);
    }
  });

  it('gives completed a cleared outline and ring the other two do not have', () => {
    expect(completed).toMatch(/border-color\s*:/);
    expect(completed).toMatch(/--colors-accent-success/);
    expect(locked).not.toMatch(/--colors-accent-success/);
    expect(available).not.toMatch(/--colors-accent-success/);
  });

  it('marks completed with a glyph, so it does not rely on colour alone', () => {
    // A ring is still a ring to anyone who cannot separate two browns, or who
    // is looking at a 54px circle from across the room.
    const badge = ruleBody('.level-node.completed::before');
    expect(badge.trim().length, 'completed has no badge pseudo-element').toBeGreaterThan(0);
    expect(badge).toMatch(/content\s*:/);
    expect(badge).toMatch(/position\s*:\s*absolute/);
  });

  it('does not put the badge on the pseudo-element a boss already uses', () => {
    // A completed boss (10, 18 and 20 can all be both) would otherwise have two
    // equally specific rules fighting over one pseudo-element, and only the
    // later one would render.
    expect(ruleBody('.level-node.boss::after').trim().length).toBeGreaterThan(0);
    expect(css).toMatch(/\.level-node\.completed::before/);
    expect(css).not.toMatch(/\.level-node\.completed::after/);
    expect(levelsMapData.filter((l) => l.isBoss).length).toBeGreaterThan(0);
  });

  it('keeps the ring off the fill the level number sits on', () => {
    // accent-success as the fill would take the number from 5.53:1 to 2.48:1.
    // The fill stays the moss gradient; the state reads from around it.
    expect(completed).toMatch(/background:\s*radial-gradient[^;]*--terrain-node-done/);
    expect(completed).not.toMatch(/background:\s*[^;]*--colors-accent-success/);
  });

  it('leaves locked with neither a ring nor a shadow to catch the eye', () => {
    expect(locked).toMatch(/box-shadow\s*:\s*none/);
    expect(available).toMatch(/box-shadow\s*:[^;]*--colors-accent-energy/);
    expect(completed).toMatch(/box-shadow\s*:[^;]*--colors-accent-success/);
  });

  it('does not fade locked, which would take its level number with it', () => {
    expect(locked).not.toMatch(/opacity\s*:/);
  });
});

describe('stars on completed nodes', () => {
  beforeEach(() => {
    mockPlayerData = playerWithProgress();
  });

  /*
   * The question the owner's screenshot raised: no stars anywhere. This
   * distinguishes the two explanations. If the render were broken, this test
   * would fail with star data present; it passes, so the absence on the owner's
   * map is absent data - nothing completed in that save, and `.stars` only
   * renders for a completed level.
   */
  it('renders stars once a level is completed and has star data', () => {
    const { container } = render(<Lobby />);
    const nodes = container.querySelectorAll('.level-node.completed');
    expect(nodes.length, 'expected levels 1-3 to render as completed').toBe(3);

    const rows = container.querySelectorAll('.level-node.completed .stars');
    expect(rows.length, 'a completed node rendered no star row').toBe(3);
    for (const row of rows) {
      expect(row.querySelectorAll('.star').length).toBe(3);
    }
  });

  it('fills exactly as many stars as the save records, per level', () => {
    const { container } = render(<Lobby />);
    const earnedPerNode = [...container.querySelectorAll('.level-node.completed')].map(
      (node) => node.querySelectorAll('.star.earned').length,
    );
    // Levels 1, 2, 3 recorded 3, 2 and 1 stars; nodes render in route order.
    expect(earnedPerNode).toEqual([3, 2, 1]);
  });

  it('renders no star row on a level that is not completed', () => {
    const { container } = render(<Lobby />);
    expect(container.querySelectorAll('.level-node.available .stars').length).toBe(0);
    expect(container.querySelectorAll('.level-node.locked .stars').length).toBe(0);
  });

  it('shows nothing at all when the save has no completions - absent data, not a broken render', () => {
    mockPlayerData = { ...playerWithProgress(), completedLevels: [], levelStars: Array(20).fill(0) };
    const { container } = render(<Lobby />);
    expect(container.querySelectorAll('.stars').length).toBe(0);
    // Which is the state the map was reviewed in: every node either available
    // or locked, so the star treatment never had a chance to appear.
    expect(container.querySelectorAll('.level-node.completed').length).toBe(0);
  });

  it('renders a completed level with zero stars as three unearned stars', () => {
    // The row still appears - it is the empty state of the row, not its
    // absence - so a player sees what they did not get.
    mockPlayerData = { ...playerWithProgress(), levelStars: Array(20).fill(0) };
    const { container } = render(<Lobby />);
    const row = container.querySelector('.level-node.completed .stars');
    expect(row).not.toBeNull();
    expect(row.querySelectorAll('.star').length).toBe(3);
    expect(row.querySelectorAll('.star.earned').length).toBe(0);
  });
});

/**
 * The star row and the level name both hang below the node on negative
 * offsets, and they overlapped: `.stars` at `bottom: -15px` with a 16px line
 * occupied 1-15px below the node, `.level-name` at `bottom: -20px` occupied
 * about 10-20px, so on a completed level the stars sat on the level's own name.
 * Invisible in review because nothing was completed in that save.
 *
 * Arithmetic on the two declared offsets, which is as far as jsdom goes - it
 * applies no stylesheet and measures no boxes.
 */
describe('the star row and the level name do not overlap', () => {
  const STAR_LINE_PX = 16; // --type-size-md, line-height 1

  function offsetOf(selector) {
    const m = ruleBody(selector).match(/bottom:\s*(-?\d+)px/);
    return m ? Number(m[1]) : null;
  }

  it('stacks the name below the star row with a gap between them', () => {
    const stars = offsetOf('.stars');
    const name = offsetOf('.level-name');
    expect(stars, '.stars declares no bottom offset').not.toBeNull();
    expect(name, '.level-name declares no bottom offset').not.toBeNull();

    // Both measured downward from the node's bottom edge.
    const starsBottom = -stars;
    const starsTop = starsBottom - STAR_LINE_PX;
    const nameBottom = -name;
    expect(starsTop, 'the star row starts above the node').toBeGreaterThan(0);
    expect(nameBottom, 'the name is not below the star row').toBeGreaterThan(starsBottom);
  });

  it('keeps both on negative insets, which is what gets them contrast-checked', () => {
    // contrastRatio.test.js treats a negative inset as the signal that a rule's
    // text paints over the zone terrain rather than its own container. `.star`
    // has no inset of its own and is measured through `.stars`, so turning
    // either into a positive offset drops it from that guard silently - skipped
    // for having no derivable background, not failed.
    expect(offsetOf('.stars')).toBeLessThan(0);
    expect(offsetOf('.level-name')).toBeLessThan(0);
  });

  it('centres the star row on the node rather than leaving it unanchored', () => {
    const stars = ruleBody('.stars');
    expect(stars).toMatch(/left\s*:\s*50%/);
    expect(stars).toMatch(/transform\s*:\s*translateX\(-50%\)/);
  });

  it('keeps the lowest node\'s name on the map', () => {
    const lowest = Math.max(...levelsMapData.map((l) => l.y));
    const nameBottom = -offsetOf('.level-name');
    // Node half-height for the largest node (a 66px boss), plus the offset.
    expect(lowest + 33 + nameBottom).toBeLessThan(600);
  });
});

/**
 * A state rule must not silently un-centre the thing it restyles.
 *
 * `transform` is one property, not a list that accumulates. Both of this map's
 * clickable elements are centred on their coordinate with
 * `translate(-50%, -50%)`, and both had a `:hover` rule declaring only a
 * `scale(...)` - which *replaces* that translate rather than composing with it.
 * A hovered node jumped 27px down and right (33px for a 66px boss) and a hovered
 * chest 20px, in both cases away from the cursor about to click it. Both were
 * pre-existing, and both were on the screen the owner was about to judge.
 *
 * Derived rather than listed: the base selectors come from reading which rules
 * declare a centring translate, so an element centred that way in future is
 * covered without anyone remembering to add it. Scoped to Lobby.css, where it
 * happened; a rule that declares no `transform` at all is not implicated, since
 * it inherits the base rule's.
 */
describe('a pseudo-class rule never drops a centring translate', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));

  const CENTRING = /transform:\s*[^;]*translate\(\s*-50%/;

  /** Base class selectors whose own rule centres the element with a translate. */
  const centredBases = [
    ...new Set(
      rules
        .filter((r) => /^\.[a-zA-Z0-9-]+$/.test(r.selector) && CENTRING.test(r.body))
        .map((r) => r.selector),
    ),
  ];

  it('finds centred elements to check (guards against a vacuous run)', () => {
    expect(centredBases.length).toBeGreaterThan(3);
    expect(centredBases).toContain('.level-node');
    expect(centredBases).toContain('.treasure-chest');
  });

  it('restates the translate in every pseudo-class rule that sets a transform', () => {
    const offenders = [];
    for (const base of centredBases) {
      for (const rule of rules) {
        // A rule for this same base element carrying a pseudo-class or
        // modifier - `.level-node:not(.locked):hover`, `.x.y:hover`, `.x:active`.
        if (!rule.selector.startsWith(`${base}:`) && !rule.selector.startsWith(`${base}.`)) continue;
        if (!/(?::hover|:active|:focus)/.test(rule.selector)) continue;
        const declared = rule.body.match(/transform:\s*([^;]+);/);
        if (!declared) continue; // inherits the base rule's transform - fine
        if (!CENTRING.test(rule.body)) {
          offenders.push(`${rule.selector} sets "transform: ${declared[1].trim()}"`);
        }
      }
    }
    expect(
      offenders,
      'transform replaces rather than accumulates, so these rules un-centre '
        + `their element on hover: ${offenders.join('; ')}`,
    ).toEqual([]);
  });

  it('names the two that were broken, so the fix is pinned and not merely absent', () => {
    const nodeHover = ruleBody('.level-node:not(.locked):hover');
    expect(nodeHover).toMatch(/transform:\s*translate\(-50%,\s*-50%\)\s*scale\(/);
    // The later of the two rules for this selector is the one whose transform
    // wins, and `ruleBody` returns the first - so assert over the whole file.
    const chestHovers = [...css.matchAll(
      /\.treasure-chest:not\(\.collected\):not\(\.locked-chest\):hover\s*\{([^}]*)\}/g,
    )].map((m) => m[1]);
    expect(chestHovers.length).toBeGreaterThan(0);
    for (const body of chestHovers) {
      if (!/transform:/.test(body)) continue;
      expect(body).toMatch(/transform:\s*translate\(-50%,\s*-50%\)\s*scale\(/);
    }
  });

  it('documents the one remaining case, which is animation rather than hover', () => {
    // `@keyframes chestGlow` animates `transform: scale(...)` on `.chest-glow`,
    // whose own transform is a centring translate from the earlier of that
    // selector's two rules - so the glow shifts while it pulses. Left alone
    // deliberately: `.chest-glow` is on lobbyCascade's audited duplicate list
    // precisely because its two rules disagree about how it is positioned at
    // all (the later one uses -10px insets), so "restore the translate" would
    // be preserving a placement that is itself unresolved. Decoration, behind
    // the chest, not clickable. Recorded here so it is a known deferral rather
    // than an oversight, and asserted so this note cannot quietly go stale.
    expect(css).toMatch(/@keyframes chestGlow\s*\{[^}]*scale\(/s);
  });
});
