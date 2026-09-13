/*
 * Claiming an achievement pays the player whether or not the server hears.
 *
 * This is the rule the rest of the game already follows. GameContext's win
 * handler says it outright, above the card it grants: "Credited here, before
 * any request goes out, so a dead backend cannot swallow a defender the player
 * has already been told they won."
 *
 * Claiming was the one path that could not obey it. It read the new totals out
 * of the HTTP response, so with no response there were no totals - and the
 * throw from a dropped connection skipped the local update entirely, leaving
 * the player with a button they had pressed, a reward they had been promised,
 * and nothing to show for either. applyClaimedAchievement moved that
 * arithmetic into local state; this pins the consequence, which is that the
 * network no longer has a say in whether the player is paid.
 *
 * The claim is still posted - the server is the copy that survives a new
 * device - and a lost post is recoverable, since claimedAchievements is what
 * stops a second payment and the server will not have recorded one either.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import AchievementPage from '../AchievementPage.jsx';

/* A player who has finished level 1 and not yet claimed what it pays. */
const startingPlayer = () => ({
  resources: { gold: 100, iron: 10, grain: 30, water: 40, gem: 5 },
  completedLevels: [1],
  levelStars: [3],
  totalStars: 3,
  collectedTreasures: [],
  claimedAchievements: [],
  specialAchievements: [],
  cards: [],
});

/* The first achievement in the Progress tab: complete level 1, pays 100 gold. */
const CLAIM_LABEL = /Claim: 100 Gold/;

let player;

/* Partial mock via importOriginal, as SettingModal.test.jsx does - the page
   imports applyClaimedAchievement from the same module and needs the real one. */
vi.mock('../../../GameLogic (MVC)/GameContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),

  useGame: () => ({
    closeAchievements: vi.fn(),
    playerData: player,
    setPlayerData: (updater) => {
      player = typeof updater === 'function' ? updater(player) : updater;
    },
  }),
}));

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  player = startingPlayer();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claiming an achievement with no backend to hear it', () => {
  async function claimOffline() {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<AchievementPage />);

    const button = await screen.findByRole('button', { name: CLAIM_LABEL });
    await act(async () => { button.click(); });
  }

  it('pays the reward anyway', async () => {
    await claimOffline();

    await waitFor(() => expect(player.resources.gold).toBe(200));
  });

  it('records it as claimed, so it cannot be paid twice', async () => {
    await claimOffline();

    await waitFor(() => {
      expect(player.claimedAchievements).toContain('complete_level_1');
    });
  });

  it('leaves the resources the reward does not mention alone', async () => {
    await claimOffline();

    await waitFor(() => expect(player.resources.gold).toBe(200));
    expect(player.resources.gem).toBe(5);
    expect(player.resources.iron).toBe(10);
  });

  /* Local credit is not instead of telling the server, it is as well as. */
  it('still tries to tell the server', async () => {
    await claimOffline();

    const claimed = globalThis.fetch.mock.calls
      .filter(([url]) => String(url).endsWith('/api/player/claim-achievement'))
      .map(([, init]) => JSON.parse(init.body));

    expect(claimed).toContainEqual({
      achievementId: 'complete_level_1',
      rewards: { gold: 100 },
    });
  });
});
