/*
 * The optimistic push of 999 into unlockedLevels used to fire after level 20,
 * not level 10 - one of five places that disagreed about when endless opens
 * (see MapLayout's endlessUnlock.test.js, and PlayerServiceTest's
 * completingTenLevelsMarksEndlessUnlocked / completingNineLevelsDoesNot-
 * MarkEndlessUnlocked on the backend). The backend got that boundary pair;
 * onWinCb's mirrored decision in the setPlayerData callback had none, so a
 * future edit sliding the threshold back toward 20 would go undetected here
 * while the backend test kept passing.
 *
 * The network is killed before onWinCb runs, as in levelUnlocks.test.jsx's
 * "grants it locally even when every request fails". That is not incidental
 * to this test: onWinCb ends with a refetch of /api/player/me, and a live
 * mock would hand back a fixture that never had 999, overwriting the very
 * push this test exists to check. Killing the network isolates the local,
 * synchronous decision from the confirmation that follows it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

const SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Commander', rank: 'Recruit',
  gold: 100, iron: 10, grain: 10, water: 10, gem: 0,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  completedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  collectedTreasures: [],
  levelStars: Array(20).fill(0),
  endlessHighScore: 0,
};

let api;

function Probe() {
  api = useGame();
  return <div />;
}

async function mount() {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
  }));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api.playerData?.resources).toBeTruthy());
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

describe('the optimistic endless unlock, on a level win', () => {
  it('does not fire at nine', async () => {
    await mount();
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    await act(async () => { await api.onWinCb({ score: 500, level: 9 }); });

    expect(api.playerData.unlockedLevels).not.toContain(999);
  });

  it('fires at ten', async () => {
    await mount();
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    await act(async () => { await api.onWinCb({ score: 500, level: 10 }); });

    expect(api.playerData.unlockedLevels).toContain(999);
  });
});
