/*
 * Logging in leaves the game with a player it can draw.
 *
 * `handleLogin` stored the auth response's entity as-is while a refetch stored
 * a transform of the same thing, so a freshly logged-in player had no `name`
 * and no `resources` - and the lobby, which returns its loading screen without
 * `resources`, sat there until a refetch happened to replace it.
 *
 * Testing `toPlayerData` alone does not catch this: the helper was always
 * right, and the login path simply did not call it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';

/** The player the auth response carries: displayName, resources at top level. */
const AUTH_PLAYER = {
  id: 'p1',
  sessionId: 's1',
  displayName: 'Test Player',
  rank: 'Novice Gardener',
  gold: 500, iron: 10, grain: 20, water: 30, gem: 5,
  lobbyEnergy: 42, maxLobbyEnergy: 100,
  lastEnergyRechargeTime: new Date().toISOString(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1], completedLevels: [], levelStars: [],
  collectedTreasures: [],
};

let api;

function Probe() {
  api = useGame();
  return <div />;
}

/*
 * The real door. GameProvider renders LoginPage instead of its children until
 * someone is signed in, so a test that reaches for the context first finds
 * nothing - the login has to actually happen.
 */
async function signIn() {
  globalThis.fetch = vi.fn((url) => {
    if (String(url).includes('/api/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'a-token', player: AUTH_PLAYER }),
      });
    }
    // /me and the rest never answer, so nothing can quietly repair the shape
    // that logging in produced.
    return new Promise(() => {});
  });

  render(<GameProvider><Probe /></GameProvider>);

  fireEvent.change(screen.getByPlaceholderText(/email/i), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/password/i), {
    target: { value: 'a-password' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
  });

  await waitFor(() => expect(api?.playerData).toBeTruthy());
}

beforeEach(() => {
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('signing in', () => {
  it('gives the game a player with the chosen name', async () => {
    await signIn();

    expect(api.playerData.name, 'the lobby renders this').toBe('Test Player');
  });

  /*
   * Lobby returns its loading screen when `playerData.resources` is missing, so
   * without this a login left the player staring at "Loading Game Data..."
   * until something else refetched.
   */
  it('gives it resources, which is what the lobby waits for', async () => {
    await signIn();

    expect(api.playerData.resources).toBeTruthy();
    expect(api.playerData.resources.gold).toBe(500);
    expect(api.playerData.resources.lobbyEnergy).toBe(42);
  });

  it('does not leave the backend\'s own field names in place', async () => {
    await signIn();

    // `displayName` and a flat `gold` are the entity's shape, not the game's.
    expect(api.playerData.displayName).toBeUndefined();
    expect(api.playerData.gold).toBeUndefined();
  });
});
