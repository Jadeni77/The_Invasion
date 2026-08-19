/* What a chest actually credits, locally and on the wire. */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { chestsData, resourceRewardsOf } from '../../GameRendering/MapLayout.jsx';
import { apiUrl } from '../../../config/api.js';

// Derived from the same helper the app calls, so a base-URL change cannot make
// these fail while the app is right.
const COLLECT_URL = apiUrl('/api/player/collect-treasure');
const ME_URL = apiUrl('/api/player/me');

/**
 * What the backend's `/player/me` returns, flat - `fetchPlayerData` maps these
 * onto `playerData.resources`. Concrete starting amounts matter for the
 * local-credit test below, which compares before and after.
 */
const ME_RESPONSE = {
  id: 'p1',
  sessionId: 's1',
  name: 'Commander',
  rank: 'Recruit',
  gold: 100,
  iron: 10,
  grain: 10,
  water: 10,
  gem: 5,
  lobbyEnergy: 5,
  maxLobbyEnergy: 10,
  energyRechargeRate: 6,
  lastEnergyRechargeTime: Date.now(),
  unlockedLevels: [1],
  completedLevels: [],
  collectedTreasures: [],
};

/** The chests that carry both an explicit resource and `all` - the bug's shape. */
const COMBINING_CHESTS = chestsData.filter(
  (chest) => chest.rewards.all !== undefined && chest.rewards.gold !== undefined,
);

let api;

function Probe() {
  api = useGame();
  return <div data-testid="probe" />;
}

/** Every fetch call made to the collect-treasure endpoint, body parsed. */
function collectCalls() {
  return globalThis.fetch.mock.calls
    .filter(([url]) => String(url) === COLLECT_URL)
    .map(([, init]) => JSON.parse(init.body));
}

describe('a chest credits the same rewards locally and on the wire', () => {
  beforeEach(() => {
    // Renders the provider's children rather than the login page.
    localStorage.setItem('auth_token', 'test-token');
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(url) === ME_URL ? ME_RESPONSE : {}),
      }),
    );
    api = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has chests that combine an explicit resource with `all` (guards against a vacuous run)', () => {
    // If the reward data stops combining the two keys, every assertion below
    // passes by never exercising the case the bug lived in.
    expect(COMBINING_CHESTS.length).toBeGreaterThan(0);
    for (const chest of COMBINING_CHESTS) {
      expect(chest.rewards.gold).toBeGreaterThan(0);
      expect(chest.rewards.all).toBeGreaterThan(0);
    }
  });

  it.each(COMBINING_CHESTS.map((c) => [c.id, c]))(
    'sends %s the sum of its explicit gold and its `all`, not one of them',
    async (id, chest) => {
      render(<GameProvider><Probe /></GameProvider>);
      await waitFor(() => expect(api).not.toBeNull());

      await act(async () => {
        await api.collectTreasure(id);
      });

      const [payload] = collectCalls();
      expect(payload, `no POST to ${COLLECT_URL}`).toBeDefined();
      expect(payload.chestId).toBe(id);

      // The number the assignment version got wrong, stated explicitly rather
      // than derived from the helper under test.
      const expectedGold = chest.rewards.gold + chest.rewards.all;
      expect(
        payload.rewards.gold,
        `${id}: server told ${payload.rewards.gold} gold, chest grants ` +
          `${chest.rewards.gold} + ${chest.rewards.all} = ${expectedGold}`,
      ).toBe(expectedGold);

      // `all` also credits the other three, and gem is not one of them.
      for (const res of ['iron', 'grain', 'water']) {
        expect(payload.rewards[res]).toBe(
          (chest.rewards[res] ?? 0) + chest.rewards.all,
        );
      }
      expect(payload.rewards.gem).toBe(chest.rewards.gem);

      // `all` is shorthand, not a resource, and a defender is not one either.
      expect(payload.rewards.all).toBeUndefined();
      expect(payload.rewards.defender).toBeUndefined();
    },
  );

  it('credits the player locally exactly what it told the server', async () => {
    // The two numbers disagreeing *is* the bug, so the test compares them
    // rather than checking each against a constant.
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api).not.toBeNull());
    await waitFor(() => expect(api.playerData?.resources).toBeTruthy());

    const chest = COMBINING_CHESTS[0];
    const before = { ...api.playerData.resources };

    await act(async () => {
      await api.collectTreasure(chest.id);
    });

    const [payload] = collectCalls();
    await waitFor(() => {
      expect(api.playerData.resources.gold).toBe(before.gold + payload.rewards.gold);
    });
    for (const res of ['iron', 'grain', 'water', 'gem']) {
      expect(
        api.playerData.resources[res],
        `${res} credited locally does not match the payload`,
      ).toBe((before[res] ?? 0) + (payload.rewards[res] ?? 0));
    }
  });

  it('sends a chest with no `all` its plain amounts', async () => {
    const plain = chestsData.find((c) => c.rewards.all === undefined && !c.hidden);
    expect(plain, 'no chest without `all` to check').toBeDefined();

    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api).not.toBeNull());
    await act(async () => {
      await api.collectTreasure(plain.id);
    });

    const [payload] = collectCalls();
    for (const [res, amount] of Object.entries(plain.rewards)) {
      if (res === 'defender') continue;
      expect(payload.rewards[res]).toBe(amount);
    }
  });
});

/**
 * The same arithmetic at the unit level. Kept alongside the wire test, not
 * instead of it: this one pins the expansion, that one pins the expansion being
 * the thing the request actually carries.
 */
describe('resourceRewardsOf', () => {
  it('accumulates an explicit resource and `all` instead of overwriting', () => {
    expect(resourceRewardsOf({ rewards: { gold: 1000, all: 1500 } })).toEqual({
      gold: 2500,
      iron: 1500,
      grain: 1500,
      water: 1500,
    });
  });

  it('gives the same answer whichever order the keys are written in', () => {
    // The bug was order-dependent - `Object.entries` order decided which of the
    // two keys survived - so key order is the thing that must stop mattering.
    const a = resourceRewardsOf({ rewards: { gold: 1000, all: 1500 } });
    const b = resourceRewardsOf({ rewards: { all: 1500, gold: 1000 } });
    expect(a).toEqual(b);
  });

  it('expands `all` to the four base resources and never to gem', () => {
    const out = resourceRewardsOf({ rewards: { all: 500, gem: 50 } });
    expect(out).toEqual({ gold: 500, iron: 500, grain: 500, water: 500, gem: 50 });
  });

  it('drops the defender field, in either of its forms', () => {
    expect(resourceRewardsOf({ rewards: { gold: 5, defender: 'Mortar' } })).toEqual({ gold: 5 });
    expect(resourceRewardsOf({ rewards: { gold: 5, defender: ['A', 'B'] } })).toEqual({ gold: 5 });
  });

  it('reads a chest with no rewards as nothing, not a crash', () => {
    expect(resourceRewardsOf(undefined)).toEqual({});
    expect(resourceRewardsOf({})).toEqual({});
  });
});
