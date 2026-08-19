/*
 * Stopping an endless run keeps what it earned.
 *
 * Endless has no ending but stopping, and the payout lived only in the
 * base-fell path - so a player who quit at wave 30 banked nothing while one who
 * stood aside and let the base fall banked gold, resources and the high score.
 * The game paid you to lose on purpose.
 *
 * The campaign keeps its forfeit: leaving a level pays nothing, which is what
 * the quit dialog now says.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');
const SCORE_URL = apiUrl('/api/player/endless-score');

const SAVE = {
  id: 'p1', sessionId: 's1', name: 'Commander', rank: 'Recruit',
  gold: 100, iron: 10, grain: 10, water: 10, gem: 0,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  // Level 10 finished, which is what unlocks endless - without it startLevel
  // raises the locked gate and never sets the level at all.
  unlockedLevels: [1, 999], completedLevels: [1, 10], collectedTreasures: [],
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

/** The waves reported to the endless-score endpoint. */
function wavesBanked() {
  return globalThis.fetch.mock.calls
    .filter(([url]) => String(url) === SCORE_URL)
    .map(([, init]) => JSON.parse(init.body).waveReached);
}

/** Stand in the middle of an endless run at `wave`. */
async function playEndlessTo(wave) {
  await act(async () => {
    api.setGameState?.('inGame');
    await api.startLevel(999, []);
  });
  await act(async () => { api.updateEndlessWave(wave); });
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

describe('quitting an endless run', () => {
  it('banks the waves survived', async () => {
    await mount();
    await playEndlessTo(30);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(wavesBanked()).toContain(30));
  });

  it('pays out for them', async () => {
    await mount();
    const before = api.playerData.resources.gold;
    await playEndlessTo(30);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.playerData.resources.gold).toBeGreaterThan(before));
  });

  it('records the high score', async () => {
    await mount();
    await playEndlessTo(30);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.playerData.endlessHighScore).toBe(30));
  });

  it('returns to the lobby either way', async () => {
    await mount();
    await playEndlessTo(30);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.gameState).toBe('lobby'));
  });

  it('banks nothing for a run that never started a wave', async () => {
    await mount();
    await playEndlessTo(0);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.gameState).toBe('lobby'));
    expect(wavesBanked()).toEqual([]);
  });
});

describe('quitting a campaign level', () => {
  it('pays nothing, which is what the dialog promises', async () => {
    await mount();
    await act(async () => { await api.startLevel(2, []); });
    const afterStart = api.playerData.resources.gold;

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.gameState).toBe('lobby'));
    expect(api.playerData.resources.gold).toBe(afterStart);
    expect(wavesBanked(), 'a campaign level is not an endless run').toEqual([]);
  });

  it('does not give the energy back', async () => {
    await mount();
    const before = api.playerData.resources.lobbyEnergy;

    await act(async () => { await api.startLevel(2, []); });
    const afterStart = api.playerData.resources.lobbyEnergy;
    expect(afterStart, 'starting a level should cost energy').toBeLessThan(before);

    await act(async () => { await api.endGame('quit'); });

    await waitFor(() => expect(api.gameState).toBe('lobby'));
    expect(api.playerData.resources.lobbyEnergy).toBe(afterStart);
  });
});
