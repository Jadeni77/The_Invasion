/*
 * A defender is something you win by playing.
 *
 * Nine of the ten used to come from six optional treasure chests, so a player
 * who walked past chest-2 never received Grenadier - and Grenadier is the first
 * defender that meaningfully out-damages a Shooter, which level 4's 1200-health
 * Tank Zombie requires. Progression that can be missed by not clicking a thing
 * is not progression.
 *
 * See docs/superpowers/specs/2026-08-19-defender-unlocking-design.md.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame, withDefender } from '../GameContext.jsx';
import { LEVEL_UNLOCKS, STARTING_DEFENDER, defenderUnlockedBy, defendersEarnedBy } from '../LevelUnlocks.js';
import { defenderUnitClasses } from '../DefenderClassUtils.js';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');
const UNLOCK_URL = apiUrl('/api/player/unlock-defender');

/** A save at the given progress, in the shape the backend returns. */
function saveWith({ completedLevels = [], cards = [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }] } = {}) {
  return {
    id: 'p1', sessionId: 's1', name: 'Commander', rank: 'Recruit',
    gold: 500, iron: 10, grain: 10, water: 10, gem: 5,
    lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
    cards,
    unlockedLevels: [1], completedLevels, collectedTreasures: [],
    levelStars: Array(20).fill(0),
  };
}

let api;

function Probe() {
  api = useGame();
  return <div />;
}

/*
 * A backend that remembers. onWinCb refetches the player when it is done, so a
 * mock that always re-serves the same save would wipe the win before any
 * assertion could see it - and would be testing the mock, not the feature.
 */
async function mount(save) {
  const server = JSON.parse(JSON.stringify(save));

  globalThis.fetch = vi.fn((url, init) => {
    const target = String(url);
    const body = init?.body ? JSON.parse(init.body) : {};

    if (target.endsWith('/complete-level') && !server.completedLevels.includes(body.levelId)) {
      server.completedLevels.push(body.levelId);
    }
    if (target === UNLOCK_URL && !server.cards.some((c) => c.name === body.defenderName)) {
      server.cards.push({
        cardId: server.cards.length + 1,
        name: body.defenderName,
        level: 1, pieces: 0, piecesNeeded: 10,
      });
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(target === ME_URL ? JSON.parse(JSON.stringify(server)) : {}),
    });
  });

  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api.playerData?.cards).toBeTruthy());
}

/** Every defender name posted to the unlock endpoint. */
function unlockedOnTheWire() {
  return globalThis.fetch.mock.calls
    .filter(([url]) => String(url) === UNLOCK_URL)
    .map(([, init]) => JSON.parse(init.body).defenderName);
}

const owned = () => api.playerData.cards.map((c) => c.name);

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the schedule', () => {
  /*
   * The guard that would have caught the original defect: a defender with no
   * way to reach it. It also catches a new defender class added without a home.
   */
  it('puts every defender in reach by playing', () => {
    const reachable = [STARTING_DEFENDER, ...Object.values(LEVEL_UNLOCKS)];

    for (const name of Object.keys(defenderUnitClasses)) {
      expect(reachable, `${name} cannot be won from any level`).toContain(name);
    }
  });

  it('names only defenders that exist', () => {
    for (const name of Object.values(LEVEL_UNLOCKS)) {
      expect(Object.keys(defenderUnitClasses), `${name} is not a defender`).toContain(name);
    }
  });

  it('grants each defender once', () => {
    const granted = Object.values(LEVEL_UNLOCKS);
    expect(new Set(granted).size).toBe(granted.length);
  });

  it('grants nothing on a level that does not exist', () => {
    expect(defenderUnlockedBy(2)).toBeNull();
    expect(defenderUnlockedBy(99)).toBeNull();
  });

  /*
   * The owner's anchor: "the exploder and tank zombie is hard to kill". Level 4
   * opens with a 1200-health Tank Zombie and a Shooter does 15 a shot, so a
   * damage answer above the Shooter's has to be in hand before it.
   */
  it('puts a real damage answer in hand before level 4', () => {
    const byLevel3 = [STARTING_DEFENDER, ...defendersEarnedBy([1, 2, 3])];
    const shooter = new defenderUnitClasses[STARTING_DEFENDER](0, 0, { level: 1 });

    const best = Math.max(...byLevel3.map((name) => {
      const unit = new defenderUnitClasses[name](0, 0, { level: 1 });
      return unit.attackDamage ?? 0;
    }));

    expect(best, 'nothing owned by level 4 out-damages a Shooter').toBeGreaterThan(shooter.attackDamage);
  });

  /*
   * A defender the player cannot afford on the level it arrives for is not an
   * answer to anything. Costs and starting energies both come from source.
   */
  it('grants nothing the next level cannot pay for', () => {
    const startingEnergy = { 1: 100, 2: 120, 3: 160, 4: 200, 5: 240, 6: 280, 7: 320, 8: 360, 9: 400, 10: 440 };

    for (const [levelId, name] of Object.entries(LEVEL_UNLOCKS)) {
      const nextLevel = Number(levelId) + 1;
      const energy = startingEnergy[nextLevel];
      if (energy === undefined) continue; // Past the table; energy only grows.

      const cost = new defenderUnitClasses[name](0, 0, { level: 1 }).cost;
      expect(cost, `${name} costs ${cost} but level ${nextLevel} starts on ${energy}`)
        .toBeLessThanOrEqual(energy);
    }
  });
});

describe('winning a level', () => {
  it('grants the defender that level carries', async () => {
    await mount(saveWith());
    expect(owned()).not.toContain('E-Gen');

    await act(async () => { await api.onWinCb({ score: 500, level: 1 }); });

    await waitFor(() => expect(owned()).toContain('E-Gen'));
  });

  /*
   * The win credits the card locally before any request goes out, so a dead
   * backend cannot swallow a defender the player has just been told they won.
   *
   * This is also what keeps the grant honest: with the network alive, the
   * back-grant on the next fetch would hand over the same defender anyway, so
   * deleting the win-time grant would pass unnoticed. Killing the network is
   * what isolates it.
   */
  it('grants it locally even when every request fails', async () => {
    await mount(saveWith());
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    await act(async () => { await api.onWinCb({ score: 500, level: 1 }); });

    await waitFor(() => expect(owned()).toContain('E-Gen'));
  });

  it('tells the player, on the notice a chest uses', async () => {
    await mount(saveWith());

    await act(async () => { await api.onWinCb({ score: 500, level: 3 }); });

    await waitFor(() => expect(api.chestReward).toBeTruthy());
    expect(api.chestReward.defenders).toEqual(['Grenadier']);
  });

  it('persists it through the endpoint the chest path uses', async () => {
    await mount(saveWith());

    await act(async () => { await api.onWinCb({ score: 500, level: 1 }); });

    await waitFor(() => expect(unlockedOnTheWire()).toContain('E-Gen'));
  });

  it('grants nothing on a level that carries nothing', async () => {
    await mount(saveWith());
    const before = owned().length;

    await act(async () => { await api.onWinCb({ score: 500, level: 2 }); });

    await waitFor(() => expect(api.playerData.completedLevels).toContain(2));
    expect(owned().length).toBe(before);
    expect(api.chestReward).toBeNull();
  });

  it('hands out one card however often the level is replayed', async () => {
    await mount(saveWith());

    await act(async () => { await api.onWinCb({ score: 500, level: 1 }); });
    await waitFor(() => expect(owned()).toContain('E-Gen'));

    await act(async () => { await api.onWinCb({ score: 900, level: 1 }); });

    expect(owned().filter((name) => name === 'E-Gen')).toHaveLength(1);
    // And the replay does not re-announce it, or say it again on the wire.
    expect(unlockedOnTheWire()).toEqual(['E-Gen']);
  });
});

describe('a save made before unlocks moved onto levels', () => {
  /*
   * Such a save holds cleared levels whose defenders it never received, and the
   * win handler only fires on a NEW win - so without this the player stays
   * permanently short of tools they earned.
   */
  it('is given every defender its cleared levels earned', async () => {
    await mount(saveWith({ completedLevels: [1, 2, 3, 4, 5, 6, 7, 8] }));

    for (const name of ['E-Gen', 'Grenadier', 'Barricade', 'Healer']) {
      expect(owned(), `${name} was earned by a cleared level`).toContain(name);
    }
  });

  it('is given nothing its cleared levels did not earn', async () => {
    await mount(saveWith({ completedLevels: [1, 2, 3] }));

    expect(owned()).toContain('Grenadier');
    expect(owned(), 'level 5 is not cleared').not.toContain('Barricade');
    expect(owned(), 'level 17 is not cleared').not.toContain('Mortar');
  });

  it('persists what it back-grants', async () => {
    await mount(saveWith({ completedLevels: [1, 3] }));

    await waitFor(() => {
      expect(unlockedOnTheWire().sort()).toEqual(['E-Gen', 'Grenadier']);
    });
  });

  it('leaves a save that is already complete alone', async () => {
    await mount(saveWith({
      completedLevels: [1],
      cards: [
        { cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 },
        { cardId: 2, name: 'E-Gen', level: 3, pieces: 4, piecesNeeded: 10 },
      ],
    }));

    expect(unlockedOnTheWire()).toEqual([]);
    // And it keeps the progress it had, rather than being reset to a new card.
    expect(api.playerData.cards.find((c) => c.name === 'E-Gen').level).toBe(3);
  });
});

describe('building a card', () => {
  const cards = [{ id: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }];

  it('adds one the player does not have', () => {
    const next = withDefender(cards, 'Mortar');
    expect(next.map((c) => c.name)).toEqual(['Shooter', 'Mortar']);
  });

  it('hands back the same list for one they already hold', () => {
    expect(withDefender(cards, 'Shooter')).toBe(cards);
  });

  it('hands back the same list when there is nothing to add', () => {
    expect(withDefender(cards, null)).toBe(cards);
  });

  it('gives two defenders added together different ids', () => {
    const next = withDefender(withDefender(cards, 'Sniper'), 'Mortar');
    const ids = next.map((c) => c.id);
    expect(new Set(ids).size, `ids collided: ${ids}`).toBe(ids.length);
  });

  it('starts a new card at level 1 with no pieces', () => {
    const [, added] = withDefender(cards, 'Mortar');
    expect(added.level).toBe(1);
    expect(added.pieces).toBe(0);
    expect(added.piecesNeeded).toBeGreaterThan(0);
  });
});
