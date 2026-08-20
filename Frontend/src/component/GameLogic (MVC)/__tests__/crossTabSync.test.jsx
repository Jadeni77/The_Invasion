/*
 * Two tabs of the same account, agreeing.
 *
 * Each tab holds its own copy of playerData, so spending gold in one left the
 * other showing the old total until it was reloaded by hand.
 *
 * Nothing was ever lost: every write is a delta the server applies to its own
 * current value, and no request sends a whole player. It is the DISPLAY that
 * went stale, and the stale tab's next optimistic update was drawn from the
 * wrong total until it refetched.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { shouldRefreshOn, PLAYER_CHANGED, CHANNEL_NAME } from '../crossTabSync.js';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

const SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Test Player', rank: 'Novice',
  gold: 500, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1, 2], completedLevels: [1], levelStars: [3],
  collectedTreasures: [],
};

let api;

function Probe() {
  api = useGame();
  return <div />;
}

/** How many times this tab has asked the server for the player. */
function refetchCount() {
  return globalThis.fetch.mock.calls.filter(([url]) => String(url) === ME_URL).length;
}

async function mount() {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
  }));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api?.playerData?.resources).toBeTruthy());
}

/** Another tab announcing that it moved. */
async function anotherTabChangedSomething() {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  await act(async () => {
    channel.postMessage({ type: PLAYER_CHANGED });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  channel.close();
}

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

describe('deciding when it is safe to catch up', () => {
  it('refreshes in the lobby, where the numbers are shown', () => {
    expect(shouldRefreshOn('lobby')).toBe(true);
  });

  /* Replacing playerData mid-level moves the ground under a run in progress. */
  it('refuses during a level, and on the screens over one', () => {
    expect(shouldRefreshOn('inGame')).toBe(false);
    expect(shouldRefreshOn('upgrade')).toBe(false);
    expect(shouldRefreshOn('settings')).toBe(false);
    expect(shouldRefreshOn('collection')).toBe(false);
  });
});

describe('a tab sitting in the lobby', () => {
  it('catches up when another tab changes the player', async () => {
    await mount();
    const before = refetchCount();

    await anotherTabChangedSomething();

    await waitFor(() => expect(refetchCount()).toBeGreaterThan(before));
  });

  it('catches up when it is looked at again', async () => {
    await mount();
    const before = refetchCount();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await waitFor(() => expect(refetchCount()).toBeGreaterThan(before));
  });
});

describe('a tab that has left the lobby', () => {
  it('ignores the other tab entirely', async () => {
    await mount();
    // Any screen over the lobby will do; the rule is the same for all of them,
    // and openUpgradeModal is the one the context exposes.
    await act(async () => { api.openUpgradeModal(); });
    const before = refetchCount();

    await anotherTabChangedSomething();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(refetchCount(), 'a run in progress owns the screen').toBe(before);
  });
});

describe('announcing a change', () => {
  /*
   * The half the first version of this file missed: it proved a tab REACTS to a
   * message, and posted that message by hand. Nothing checked that playing the
   * game produces one - so the announcing side could have been broken and every
   * test here would still have passed.
   */
  it('announces when the player actually does something', async () => {
    await mount();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await act(async () => {
      await api.collectTreasure('chest-1');
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    listener.close();

    expect(heard.map((m) => m.type)).toContain(PLAYER_CHANGED);
  });

  /*
   * The loop this has to avoid: tab A announces, tab B refetches, B announces
   * the result, A refetches, and so on forever.
   */
  it('does not announce the answer it just got from the server', async () => {
    await mount();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await act(async () => {
      await api.fetchPlayerData();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    listener.close();

    expect(heard, 'a refetch is not a change worth broadcasting').toEqual([]);
  });
});
