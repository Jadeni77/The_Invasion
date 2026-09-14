/*
 * A reply that is not shaped like a player still has to land somewhere.
 *
 * toPlayerData guards `cards` and `levelStars` with bare truthiness
 * (GameContext.jsx), so a truthy non-array - `cards: {}` from a backend change,
 * or a proxy returning an error envelope where the player should be - reaches
 * .map/.reduce and throws. The parse succeeded, so nothing upstream catches it.
 *
 * fetchPlayerData is called and not awaited in two places, so an escaping throw
 * is an unhandled rejection and the lobby sits on its loading screen forever
 * with playerData === null. Falling back to defaults is what the original code
 * did; when persistence moved out into its own module the catch that did it
 * went with the network error handling, and only the network half came back.
 *
 * The current Java backend cannot produce this shape. That makes it latent,
 * not harmless - the value of this task was that it changed no behaviour, and
 * a fallback that silently stopped existing is a change.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

const GOOD_SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Commander', rank: 'Recruit',
  gold: 777, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1], completedLevels: [], collectedTreasures: [],
  levelStars: Array(20).fill(0), endlessHighScore: 0,
};

/* Parses fine, is truthy, and is not an array - so .map throws inside the
   transform rather than anywhere the network error handling can see it. */
const MALFORMED_SAVE = { ...GOOD_SAVE, cards: { 0: 'Shooter' } };

let api;

function Probe() {
  api = useGame();
  return <div />;
}

function serve(save) {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? save : {}),
  }));
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a player the transform cannot read', () => {
  it('falls back to defaults rather than leaving the lobby loading forever', async () => {
    serve(MALFORMED_SAVE);

    render(<GameProvider><Probe /></GameProvider>);

    await waitFor(() => expect(api.playerData).not.toBeNull());
    expect(api.playerData.resources).toBeTruthy();
    expect(api.playerData.cards.length).toBeGreaterThan(0);
  });

  /*
   * The other half of `prev ?? getDefaultPlayerData()`: a bad refetch must not
   * throw away a player who is already loaded and playing.
   */
  it('keeps the player already in memory when a later fetch is unreadable', async () => {
    serve(GOOD_SAVE);
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api.playerData?.resources?.gold).toBe(777));

    serve(MALFORMED_SAVE);
    await act(async () => { await api.fetchPlayerData(); });

    expect(
      api.playerData.resources.gold,
      'a malformed refetch reset a player who was already loaded',
    ).toBe(777);
  });

  /* A guard against the fallback being reached by a route that is too easy:
     a well-formed save must still load normally. */
  it('reads a well-formed player as itself', async () => {
    serve(GOOD_SAVE);

    render(<GameProvider><Probe /></GameProvider>);

    await waitFor(() => expect(api.playerData?.resources?.gold).toBe(777));
    expect(api.playerData.name).toBe('Commander');
  });
});
