/*
 * There were sixteen fetch calls spread through a 1,289-line file, and guest
 * mode needed every one of them to have a local alternative. Guarding each
 * call site would have put the decision in sixteen places, and the seventeenth
 * write path added later would have forgotten it - failing as a guest whose
 * progress simply does not save, which is the worst way for this to break.
 *
 * So the decision lives here, once. These tests hold the two halves of that
 * contract: an account still talks to the backend, and a guest never does.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPersistence } from '../playerPersistence.js';
import { writeGuestSave, newGuestPlayer } from '../guestSave.js';
import { apiUrl } from '../../../config/api.js';

/** A fetch that succeeds at everything, installed as the global. */
function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The body sent to `path`, parsed, or undefined if nothing was sent there. */
function bodySentTo(fetchMock, path) {
  const call = fetchMock.mock.calls.find(([url]) => String(url) === apiUrl(path));
  return call ? JSON.parse(call[1].body) : undefined;
}

/*
 * Every write the module offers. This list has to stay exhaustive: it is what
 * proves a guest never reaches the network, so a write missing from here is a
 * write nothing checks. addCardPieces was absent at first, which is exactly
 * the omission the list exists to make impossible.
 *
 * The second argument the harness passes covers the two-argument operations.
 */
const OPERATIONS = [
  ['completeLevel', { levelId: 3, score: 100, stars: 2 }],
  ['updateStats', { enemiesKilled: 1, defendersDeployed: 1, energyCollected: 1 }],
  ['updateResources', { gold: 10 }],
  ['unlockDefender', 'Sniper'],
  ['unlockSpecialAchievement', 'untouchable'],
  ['addCardPieces', 'Shooter'],
  ['collectTreasure', 'chest-1'],
  ['claimAchievement', 'endless_explorer'],
  ['endlessScore', 12],
];

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.setItem('auth_token', 'a-token');
});

describe('an account', () => {
  it('sends every write to the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const persistence = createPersistence('account');

    for (const [name, arg] of OPERATIONS) {
      await persistence[name](arg, 1);
    }

    expect(fetchMock).toHaveBeenCalledTimes(OPERATIONS.length);
  });

  it('carries the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await createPersistence('account').updateResources({ gold: 1 });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer a-token');
  });

  it('swallows a network failure rather than taking the run down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createPersistence('account').updateResources({ gold: 1 }))
      .resolves.not.toThrow();
  });
});

/*
 * The bodies nothing else pins.
 *
 * complete-level, collect-treasure, unlock-defender, endless-score,
 * add-card-pieces and claim-achievement are all checked through GameContext by
 * tests that parse the request they produce. These three were not checked
 * anywhere, and they are the ones that reshape their argument on the way out -
 * so a wrong shape here is invisible: the request still goes out, the server
 * reads nothing it recognises and applies nothing, and every test still passes.
 */
describe('the shape the backend is expecting', () => {
  /*
   * The nested wrapper, rebuilt by hand in the module. Four call sites send a
   * flat delta and rely on it being wrapped - a loss penalty, an energy
   * purchase, the cost of starting a level, and an endless payout. Dropping
   * `resourcesChange` would silently stop all four from paying or charging.
   */
  it('wraps a resource delta in resourcesChange', async () => {
    const fetchMock = stubFetch();

    await createPersistence('account').updateResources({ gold: -150, lobbyEnergy: 10 });

    expect(bodySentTo(fetchMock, '/api/player/update-resources'))
      .toEqual({ resourcesChange: { gold: -150, lobbyEnergy: 10 } });
  });

  it('sends the three stat counters flat, not wrapped', async () => {
    const fetchMock = stubFetch();

    await createPersistence('account')
      .updateStats({ enemiesKilled: 7, defendersDeployed: 3, energyCollected: 12 });

    expect(bodySentTo(fetchMock, '/api/player/update-stats'))
      .toEqual({ enemiesKilled: 7, defendersDeployed: 3, energyCollected: 12 });
  });

  /* Counters the caller left out are zero, not absent - the server adds what
     it is given, and `undefined` would drop out of the JSON entirely. */
  it('fills in a counter the caller omitted', async () => {
    const fetchMock = stubFetch();

    await createPersistence('account').updateStats({ enemiesKilled: 4 });

    expect(bodySentTo(fetchMock, '/api/player/update-stats'))
      .toEqual({ enemiesKilled: 4, defendersDeployed: 0, energyCollected: 0 });
  });

  it('names a special achievement as achievementId', async () => {
    const fetchMock = stubFetch();

    await createPersistence('account').unlockSpecialAchievement('untouchable');

    expect(bodySentTo(fetchMock, '/api/player/unlock-special-achievement'))
      .toEqual({ achievementId: 'untouchable' });
  });
});

/*
 * The one request that posts a whole player rather than a delta.
 *
 * /api/player/import binds against GuestSaveRequest, which is a FLAT projection
 * of the Player entity - and playerData is not that shape. Three differences,
 * every one of them silent:
 *
 *   - gold, iron, grain, water, gem and lobbyEnergy live under
 *     `playerData.resources` and must be sent at the top level. Nested, they
 *     arrive null, PlayerService.importGuestSave falls back to the new
 *     account's defaults for each, and every resource the guest earned is gone
 *     while levels and stars come through fine.
 *   - a card's `id` is the entity's `cardId`.
 *   - a card's `upgradeCost` and `cost` are derived here from lookup tables and
 *     have no field to bind to; Jackson ignores unknown properties rather than
 *     erroring, so sending them looks fine and does nothing.
 *
 * Nothing throws in any of those cases, on either side. These tests are the
 * only thing between a guest and losing their progress at the moment they
 * decide to sign up.
 */
describe('the guest save on the wire', () => {
  /** A guest who has actually played: resources spent and earned, two cards. */
  function playedGuest() {
    const player = newGuestPlayer();
    return {
      ...player,
      resources: {
        ...player.resources,
        gold: 640, iron: 22, grain: 51, water: 73, gem: 7, lobbyEnergy: 37,
      },
      cards: [
        { id: 1, name: 'Shooter', level: 3, pieces: 4, piecesNeeded: 10,
          upgradeCost: { gold: 100, iron: 5, water: 3 }, cost: 20 },
        { id: 2, name: 'Sniper', level: 1, pieces: 9, piecesNeeded: 25,
          upgradeCost: { gold: 400, water: 60, grain: 35, gem: 3 }, cost: 50 },
      ],
      unlockedLevels: [1, 2, 3],
      completedLevels: [1, 2],
      levelStars: [3, 2, ...Array(18).fill(0)],
      collectedTreasures: ['chest-1'],
      claimedAchievements: ['first_win'],
      specialAchievements: ['untouchable'],
      endlessHighScore: 12,
      totalEnemiesKilled: 140,
      totalDefendersDeployed: 31,
      totalEnergyCollected: 900,
    };
  }

  /** Post `playerData` and hand back what came out on the wire. */
  async function imported(playerData) {
    const fetchMock = stubFetch();
    await createPersistence('account').importGuestSave(playerData);
    return bodySentTo(fetchMock, '/api/player/import');
  }

  it('lifts the resources out of `resources` and sends them flat', async () => {
    const body = await imported(playedGuest());

    expect(body).toMatchObject({
      gold: 640, iron: 22, grain: 51, water: 73, gem: 7, lobbyEnergy: 37,
    });
    expect(body.resources, 'the endpoint has no `resources` to bind').toBeUndefined();
  });

  it('names a card id the way the entity does', async () => {
    const body = await imported(playedGuest());

    expect(body.cards.map((card) => card.cardId)).toEqual([1, 2]);
    for (const card of body.cards) {
      expect(Object.keys(card)).not.toContain('id');
    }
  });

  /* piecesNeeded is recomputed server-side from the card's name, so a forged
     save cannot claim a card upgrades for one piece; upgradeCost and cost are
     derived from lookup tables here and have no field on the DTO at all. */
  it('leaves the derived card fields at home', async () => {
    const body = await imported(playedGuest());

    for (const card of body.cards) {
      expect(Object.keys(card).sort()).toEqual(['cardId', 'level', 'name', 'pieces']);
    }
  });

  it('carries the progress lists and the lifetime counters', async () => {
    const body = await imported(playedGuest());

    expect(body).toMatchObject({
      unlockedLevels: [1, 2, 3],
      completedLevels: [1, 2],
      levelStars: [3, 2, ...Array(18).fill(0)],
      collectedTreasures: ['chest-1'],
      claimedAchievements: ['first_win'],
      specialAchievements: ['untouchable'],
      endlessHighScore: 12,
      totalEnemiesKilled: 140,
      totalDefendersDeployed: 31,
      totalEnergyCollected: 900,
    });
    expect(body.cards[0]).toEqual({ cardId: 1, name: 'Shooter', level: 3, pieces: 4 });
  });

  /*
   * Every field GuestSaveRequest.java declares, exactly.
   *
   * `cardUnlockProgress` used to be the one exception - a DTO field with no
   * counterpart in playerData, because the frontend has never tracked that
   * counter. A field nothing on this side can fill is a field only a forged
   * save can fill, so it was removed from the DTO; PlayerService.importGuestSave
   * derives the counter from the roster in `cards` instead.
   *
   * Pinned as a set so that a field added to the DTO without a mapper change,
   * or a field the mapper invents, fails here rather than being noticed by a
   * player whose progress arrived incomplete.
   */
  it('sends the fields the DTO declares, and nothing else', async () => {
    const body = await imported(playedGuest());

    expect(Object.keys(body).sort()).toEqual([
      'cards',
      'claimedAchievements',
      'collectedTreasures',
      'completedLevels',
      'endlessHighScore',
      'gem',
      'gold',
      'grain',
      'iron',
      'levelStars',
      'lobbyEnergy',
      'specialAchievements',
      'totalDefendersDeployed',
      'totalEnemiesKilled',
      'totalEnergyCollected',
      'unlockedLevels',
      'water',
    ]);
  });
});

describe('a guest', () => {
  it('never touches the network, on any operation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const persistence = createPersistence('guest');

    for (const [name, arg] of OPERATIONS) {
      await persistence[name](arg, 1);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /*
   * A guest has to report a write as done, because callers gate on the answer.
   * collectTreasure's dependent grants are skipped when the chest was not
   * recorded; a guest resolving anything falsy here would silently stop
   * banking their own card pieces while the resources landed.
   */
  it('reports every write as done, so callers that gate on the result proceed', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const persistence = createPersistence('guest');

    for (const [name, arg] of OPERATIONS) {
      await expect(persistence[name](arg, 1), `${name} did not report success`)
        .resolves.toBe(true);
    }
  });

  it('loads the player out of the slot', async () => {
    const saved = { ...newGuestPlayer(), completedLevels: [1, 2] };
    writeGuestSave(saved);
    vi.stubGlobal('fetch', vi.fn());

    const loaded = await createPersistence('guest').loadPlayer();

    expect(loaded.completedLevels).toEqual([1, 2]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts a new guest when the slot is empty', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const loaded = await createPersistence('guest').loadPlayer();
    expect(loaded.completedLevels).toEqual([]);
  });

  it('recharges energy earned while the game was closed', async () => {
    const stale = newGuestPlayer();
    stale.resources.lobbyEnergy = 10;
    stale.resources.lastEnergyRechargeTime = Date.now() - 5 * 60 * 1000;
    writeGuestSave(stale);
    vi.stubGlobal('fetch', vi.fn());

    const loaded = await createPersistence('guest').loadPlayer();

    expect(loaded.resources.lobbyEnergy).toBe(15);
  });

  it('cannot import, having nowhere to import to', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(createPersistence('guest').importGuestSave(newGuestPlayer()))
      .resolves.toBe(false);
  });
});
