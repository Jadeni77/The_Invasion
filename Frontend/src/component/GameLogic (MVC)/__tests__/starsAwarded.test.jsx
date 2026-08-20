/*
 * The rating as the game actually records it.
 *
 * levelStars.test.js checks the rule in isolation. This checks the path a
 * player's stars are really saved through - `onWinCb`, which is where the
 * score-based version lived, and which writes levelStars for the level just
 * won.
 *
 * The last case is the one that matters most: a colossal score with a battered
 * base earns ONE star. Under the old rule that was three, so anything that
 * quietly reintroduces score as the measure fails here.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');
const COMPLETE_URL = apiUrl('/api/player/complete-level');

const SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Commander', rank: 'Recruit',
  gold: 100, iron: 10, grain: 10, water: 10, gem: 0,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1, 2, 3], completedLevels: [], collectedTreasures: [],
  levelStars: Array(20).fill(0), endlessHighScore: 0,
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

/**
 * Win `level`, and report the stars the backend was told to record.
 *
 * Read from the request body rather than from playerData, because onWinCb ends
 * by refetching the player - so what the local state holds a moment later is
 * whatever /api/player/me returns, which here is a fixture. The number sent to
 * complete-level is the one that persists.
 */
async function win(level, { score, baseDamageTaken = 0, defendersLost = 0 }) {
  await act(async () => {
    await api.onWinCb({ score, level, baseDamageTaken, defendersLost });
  });

  const sent = globalThis.fetch.mock.calls
    .filter(([url]) => String(url) === COMPLETE_URL)
    .map(([, init]) => JSON.parse(init.body))
    .filter((body) => body.levelId === level)
    .pop();

  return sent?.stars;
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

describe('the stars a win records', () => {
  /*
   * Level 1 fields eleven Basic Zombies at ten points each, so 110 is every
   * point the level has to give. The old rule wanted 150 for three stars: a
   * flawless run was rated two, which is how this was reported.
   */
  it('gives a flawless level 1 three stars, on the 110 points it can produce', async () => {
    await mount();

    expect(await win(1, { score: 110 })).toBe(3);
  });

  it('gives two for the same score with the base hit once', async () => {
    await mount();

    expect(await win(2, { score: 110, baseDamageTaken: 10 })).toBe(2);
  });

  it('gives one for a huge score and a base past half', async () => {
    await mount();

    // 99999 points is three stars on any level under the old rule.
    expect(await win(3, { score: 99999, baseDamageTaken: 60 })).toBe(1);
  });

  /*
   * Defenders lost cannot cost a star: a Titan has 5000 health and hits for 50
   * every two seconds, so whatever holds one dies while it is worn down, and
   * levels 14 and 18-20 field them. Docking a star for that would put three out
   * of reach on those levels - the exact problem this change removed.
   */
  it('gives three with the base untouched even when defenders fell', async () => {
    await mount();

    expect(await win(2, { score: 500, defendersLost: 6 })).toBe(3);
  });
});
