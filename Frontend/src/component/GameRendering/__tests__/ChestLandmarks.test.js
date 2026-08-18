/**
 * Chests as landmarks, and the arithmetic that proves the cut lost nothing.
 *
 * `chestsData` held twenty on-route chests, one per level. The approved mockup
 * had three, placed as landmarks between nodes; one per level is wallpaper and
 * is much of why the map read as cluttered. Cutting to six is the easy half.
 * The half that goes wrong quietly is the rewards: nine of the twenty chests
 * carried a defender unlock and all twenty carried resources, so a careless cut
 * deletes real progression and nothing fails.
 *
 * The totals below are what the twenty chests granted, computed once from the
 * pre-cut data and pinned here. They are deliberately literal: deriving them
 * from `chestsData` would make this test agree with whatever the file happens
 * to say, which is precisely the property that would let a reward vanish
 * unnoticed.
 */
import { describe, it, expect } from 'vitest';
import { chestsData, chestDefenders, connectionsData, levelsMapData, mapSettings, zoneAtX } from '../MapLayout.jsx';

/**
 * What the twenty one-per-level chests granted in total.
 *
 * `all` is a shorthand the reward applier expands to its amount for each of
 * gold/iron/grain/water (see collectTreasure in GameContext), so it is tracked
 * as its own line rather than folded into the four - keeping it separate is
 * what makes a chest that swapped `all: 500` for `gold: 500` visible here.
 */
const PRE_CUT_TOTALS = {
  gold: 3850,
  iron: 350,
  grain: 430,
  water: 200,
  gem: 588,
  all: 5500,
};

/** Every defender the twenty chests unlocked, in the order they appeared. */
const PRE_CUT_DEFENDERS = [
  'E-Gen',
  'Barricade',
  'Grenadier',
  'Healer',
  'Frost Archer',
  'Sniper',
  'Ice Bomb',
  'Mortar',
  'Fire Blast',
];

const ON_ROUTE = chestsData.filter((chest) => !chest.hidden);
const SECRET = chestsData.filter((chest) => chest.hidden);

describe('chests are landmarks, not wallpaper', () => {
  it('places five or six on-route chests, down from twenty', () => {
    expect(ON_ROUTE.length).toBeGreaterThanOrEqual(5);
    expect(ON_ROUTE.length).toBeLessThanOrEqual(6);
  });

  it('leaves most levels with no chest beside them', () => {
    // The actual complaint: a chest on every connector. Fewer chests than
    // half the levels is what makes one an event rather than scenery.
    const campaignLevels = levelsMapData.filter((l) => l.id !== 999).length;
    expect(ON_ROUTE.length * 2).toBeLessThan(campaignLevels);
  });

  it('spaces them along the route rather than clustering them', () => {
    const columns = ON_ROUTE.map((chest) => chest.x).sort((a, b) => a - b);
    for (let i = 1; i < columns.length; i++) {
      expect(
        columns[i] - columns[i - 1],
        `chests at x=${columns[i - 1]} and x=${columns[i]} are too close to read as separate landmarks`,
      ).toBeGreaterThan(300);
    }
  });

  it('puts at least one landmark in every terrain region', () => {
    const regions = new Set(ON_ROUTE.map((chest) => zoneAtX(chest.x)));
    for (const zone of ['tutorial', 'early', 'mid', 'late', 'endgame']) {
      expect(regions, `no chest anywhere in the ${zone} region`).toContain(zone);
    }
  });

  it('keeps the first landmark reachable from a standing start', () => {
    // Level 1 is the only level unlocked for a new player. A first chest
    // gated behind anything else is a locked sprite on the opening screen.
    const first = ON_ROUTE.reduce((a, b) => (a.x <= b.x ? a : b));
    expect(first.requiresLevel).toBe(1);
  });
});

describe('the cut consolidated the rewards instead of dropping them', () => {
  const totals = {};
  for (const chest of chestsData) {
    for (const [resource, amount] of Object.entries(chest.rewards)) {
      if (resource === 'defender') continue;
      totals[resource] = (totals[resource] ?? 0) + amount;
    }
  }

  it.each(Object.entries(PRE_CUT_TOTALS))(
    'still grants the %s the twenty chests granted',
    (resource, expected) => {
      // The secret chests are included in `totals` but were not part of the
      // cut, so their contribution is subtracted from the expectation below
      // rather than silently inflating it.
      const fromSecret = SECRET.reduce(
        (sum, chest) => sum + (chest.rewards[resource] ?? 0),
        0,
      );
      expect(totals[resource] ?? 0).toBe(expected + fromSecret);
    },
  );

  it('unlocks every defender the twenty chests unlocked', () => {
    const unlocked = chestsData.flatMap((chest) => chestDefenders(chest));
    for (const defender of PRE_CUT_DEFENDERS) {
      expect(unlocked, `${defender} is no longer unlockable from any chest`).toContain(defender);
    }
  });

  it('unlocks no defender twice, so no chest is a dead pickup', () => {
    const unlocked = chestsData.flatMap((chest) => chestDefenders(chest));
    expect(new Set(unlocked).size).toBe(unlocked.length);
  });

  it('weights the rewards later along the route', () => {
    // Six landmarks should feel worth reaching. A flat distribution would be
    // twenty chests' problem with a smaller n.
    const worth = (chest) =>
      Object.entries(chest.rewards)
        .filter(([resource]) => resource !== 'defender')
        .reduce((sum, [, amount]) => sum + amount, 0);
    const ordered = [...ON_ROUTE].sort((a, b) => a.x - b.x);
    expect(worth(ordered[ordered.length - 1])).toBeGreaterThan(worth(ordered[0]));
  });
});

describe('a chest can carry more than one defender', () => {
  it('reads a single name and a list the same way', () => {
    expect(chestDefenders({ rewards: { defender: 'Mortar' } })).toEqual(['Mortar']);
    expect(chestDefenders({ rewards: { defender: ['Sniper', 'Ice Bomb'] } })).toEqual([
      'Sniper',
      'Ice Bomb',
    ]);
  });

  it('reads a chest with no defender as an empty list, not a crash', () => {
    expect(chestDefenders({ rewards: { gold: 10 } })).toEqual([]);
    expect(chestDefenders(undefined)).toEqual([]);
  });

  it('actually uses the list form, or the nine defenders did not fit', () => {
    // Vacuity guard: nine defenders on six chests is only possible if some
    // chest carries more than one. If this fails, either the chest count or
    // the defender list changed and the consolidation needs rethinking.
    const multi = chestsData.filter((chest) => chestDefenders(chest).length > 1);
    expect(multi.length).toBeGreaterThan(0);
  });
});

describe('chests still derive their position from the route', () => {
  it('sits every on-route chest exactly on its connector\'s midpoint', () => {
    for (const chest of ON_ROUTE) {
      const connector = connectionsData.find((c) => c.from === chest.requiresLevel);
      expect(connector, `chest ${chest.id} requires level ${chest.requiresLevel} with no connector leaving it`).toBeDefined();
      expect(chest.x).toBeCloseTo(connector.x, 6);
      expect(chest.y).toBeCloseTo(connector.y, 6);
    }
  });

  it('anchors each secret chest to the node that reveals it, off the route', () => {
    for (const chest of SECRET) {
      const node = levelsMapData.find((l) => l.id === chest.requiresLevel);
      expect(node, `secret chest ${chest.id} requires a level that does not exist`).toBeDefined();
      const distance = Math.hypot(chest.x - node.x, chest.y - node.y);
      // Near its level, but clear of the node's own 66px circle and clear of
      // the trail - it is meant to be found beside the route, not on it.
      expect(distance).toBeGreaterThan(60);
      expect(distance).toBeLessThan(260);
    }
  });

  it('keeps every chest inside the terrain', () => {
    for (const chest of chestsData) {
      expect(chest.x, `chest ${chest.id}`).toBeGreaterThan(0);
      expect(chest.y, `chest ${chest.id}`).toBeGreaterThan(0);
      // Derived, not restated: this read `600` and so failed the moment the
      // terrain grew, even though every chest was still inside it.
      expect(chest.y, `chest ${chest.id}`).toBeLessThan(mapSettings.mapHeight);
    }
  });
});
