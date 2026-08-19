/* Chests as landmarks, and the arithmetic that proves the cut lost nothing. */
import { describe, it, expect } from 'vitest';
import { chestsData, chestDefenders, chestCardPieces, connectionsData, levelsMapData, mapSettings, zoneAtX } from '../MapLayout.jsx';
import { defenderUnitClasses } from '../../GameLogic (MVC)/DefenderClassUtils.js';
import { defendersEarnedBy, STARTING_DEFENDER } from '../../GameLogic (MVC)/LevelUnlocks.js';

/* What the twenty one-per-level chests granted in total. */
const PRE_CUT_TOTALS = {
  gold: 3850,
  iron: 350,
  grain: 430,
  water: 200,
  gem: 588,
  all: 5500,
};


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

  /*
   * Defenders moved onto level wins, so no chest grants one. That is the whole
   * point of the move: a chest is optional, and a defender the campaign needs
   * cannot be behind something a player can walk past.
   */
  it('grants no defender from any chest', () => {
    const unlocked = chestsData.flatMap((chest) => chestDefenders(chest));
    expect(unlocked, 'defenders come from winning levels - see LEVEL_UNLOCKS').toEqual([]);
  });

  it('gives card pieces in their place, so a chest is still worth the detour', () => {
    const withPieces = chestsData.filter(
      (chest) => Object.keys(chestCardPieces(chest)).length > 0,
    );
    expect(withPieces.length, 'every on-route chest should carry pieces').toBe(ON_ROUTE.length);
  });

  it('names only real defenders in its piece rewards', () => {
    const named = chestsData.flatMap((chest) => Object.keys(chestCardPieces(chest)));
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) {
      expect(Object.keys(defenderUnitClasses), `${name} is not a defender`).toContain(name);
    }
  });

  /*
   * Pieces credited to a defender the player does not own are lost, so each
   * chest must name one its required level has already granted.
   */
  it('gives pieces only for a defender the chest\'s level has already granted', () => {
    const owedBy = (levelId) => [
      STARTING_DEFENDER,
      ...defendersEarnedBy(Array.from({ length: levelId }, (_, i) => i + 1)),
    ];

    for (const chest of chestsData) {
      for (const name of Object.keys(chestCardPieces(chest))) {
        expect(
          owedBy(chest.requiresLevel),
          `chest ${chest.id} needs level ${chest.requiresLevel} but gives ${name} pieces`,
        ).toContain(name);
      }
    }
  });

  it('weights the rewards later along the route', () => {
    // Six landmarks should feel worth reaching. A flat distribution would be
    // twenty chests' problem with a smaller n.
    const worth = (chest) =>
      Object.entries(chest.rewards)
        .filter(([resource]) => resource !== 'defender' && resource !== 'cardPieces')
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

  // The list form is no longer exercised by the map's own data - it is kept
  // because chestDefenders still has to read whatever a chest declares, and a
  // chest granting a defender again should work rather than crash.
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
