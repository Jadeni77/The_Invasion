/*
 * The player is told what a chest gave them, even when the server never hears
 * about it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { chestsData, chestCardPieces, resourceRewardsOf } from '../../GameRendering/MapLayout.jsx';
import { apiUrl } from '../../../config/api.js';

// Derived from the same helper the app calls, so a base-URL change cannot make
// these fail while the app is right.
const COLLECT_URL = apiUrl('/api/player/collect-treasure');
const ME_URL = apiUrl('/api/player/me');

const ME_RESPONSE = {
  id: 'p1', sessionId: 's1', name: 'Commander', rank: 'Recruit',
  gold: 100, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 5, maxLobbyEnergy: 10, energyRechargeRate: 6,
  lastEnergyRechargeTime: Date.now(),
  unlockedLevels: [1], completedLevels: [], collectedTreasures: [],
};

/** A chest carrying both halves of a reward: resources and card pieces. */
const RICH_CHEST = chestsData.find(
  (c) => Object.keys(chestCardPieces(c)).length > 0
    && Object.keys(resourceRewardsOf(c)).length > 0,
);

let api;

function Probe() {
  api = useGame();
  return <div data-testid="probe" />;
}

/** Every fetch resolves, except collect-treasure, which rejects like a dead backend. */
function mockFetchWithDeadCollect() {
  globalThis.fetch = vi.fn((url) => {
    if (String(url) === COLLECT_URL) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(String(url) === ME_URL ? ME_RESPONSE : {}) });
  });
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a chest always reports what it gave', () => {
  it('has a chest carrying both halves (guards against a vacuous run)', () => {
    expect(RICH_CHEST, 'no chest gives both resources and pieces').toBeDefined();
    expect(Object.keys(chestCardPieces(RICH_CHEST)).length).toBeGreaterThan(0);
    expect(Object.keys(resourceRewardsOf(RICH_CHEST)).length).toBeGreaterThan(0);
  });

  it('sets the reward notice even when the collect POST rejects', async () => {
    mockFetchWithDeadCollect();
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      await api.collectTreasure(RICH_CHEST.id);
    });

    await waitFor(() => expect(api.chestReward).not.toBeNull());
    expect(api.chestReward.chestId).toBe(RICH_CHEST.id);
    // And it carries both halves: the resources are what the old notification
    // never mentioned, so a chest of pure gold announced nothing.
    expect(api.chestReward.resources).toEqual(resourceRewardsOf(RICH_CHEST));
    expect(api.chestReward.cardPieces).toEqual(chestCardPieces(RICH_CHEST));
  });

  it('carries every resource the player was actually credited with', async () => {
    mockFetchWithDeadCollect();
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      await api.collectTreasure(RICH_CHEST.id);
    });

    await waitFor(() => expect(api.chestReward).not.toBeNull());
    // The notice reads from the same expansion the credit does, so `all` is
    // spread and the two can never disagree about the number shown.
    const expected = resourceRewardsOf(RICH_CHEST);
    expect(Object.keys(api.chestReward.resources).sort()).toEqual(Object.keys(expected).sort());
    for (const [resource, amount] of Object.entries(expected)) {
      expect(api.chestReward.resources[resource], resource).toBe(amount);
    }
  });

  it('still reports the reward when every request succeeds', async () => {
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(String(url) === ME_URL ? ME_RESPONSE : {}) }),
    );
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api).not.toBeNull());

    await act(async () => {
      await api.collectTreasure(RICH_CHEST.id);
    });

    await waitFor(() => expect(api.chestReward).not.toBeNull());
    expect(api.chestReward.cardPieces).toEqual(chestCardPieces(RICH_CHEST));
  });

  it('credits the pieces to the card they are for', async () => {
    mockFetchWithDeadCollect();
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api.playerData?.cards).toBeTruthy());

    const [cardName, amount] = Object.entries(chestCardPieces(RICH_CHEST))[0];
    const before = api.playerData.cards.find((c) => c.name === cardName)?.pieces ?? 0;

    await act(async () => {
      await api.collectTreasure(RICH_CHEST.id);
    });

    await waitFor(() => {
      const after = api.playerData.cards.find((c) => c.name === cardName)?.pieces ?? 0;
      expect(after, `${cardName} pieces`).toBe(before + amount);
    });
  });
});
