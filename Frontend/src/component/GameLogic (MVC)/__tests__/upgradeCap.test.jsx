/**
 * Defenders stop at MAX_DEFENDER_LEVEL.
 *
 * `startCardUpgrade` checked two things - can the player afford it, and do they
 * have the card pieces - and nothing else. There was no ceiling, so a Sniper could
 * be taken to level 100 and one-shot the campaign, with stats extrapolated far
 * past the ability tables that are supposed to define them.
 *
 * Five is not a number invented here: every defender's ability table in
 * DefenderClassUtils grants its last ability at level 5, and nothing in the
 * project describes a level 6.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { MAX_DEFENDER_LEVEL } from '../DefenderClassUtils.js';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

/** A player with everything, so only the level ceiling can refuse an upgrade. */
function meResponse(cards) {
  return {
    id: 'p1', sessionId: 's1', name: 'Commander', rank: 'Recruit',
    gold: 999999, iron: 999999, grain: 999999, water: 999999, gem: 999999,
    lobbyEnergy: 100, maxLobbyEnergy: 100, energyRechargeRate: 60,
    lastEnergyRechargeTime: Date.now(),
    unlockedLevels: [1], completedLevels: [], collectedTreasures: [],
    cards,
  };
}

let api;
function Probe() {
  api = useGame();
  return <div data-testid="probe" />;
}

/*
 * `cardId`, not `id`: fetchPlayerData maps the backend's `cardId` onto
 * playerData's `id`, so a fixture using `id` produces a card whose id is
 * undefined and `cards.find(c => c.id === 1)` quietly returns nothing.
 * `upgradeCost` is recomputed from name and level by the mapping, so it is not
 * worth stating here.
 */
const cardAt = (level) => ({
  cardId: 1, name: 'Sniper', level, pieces: 999999, piecesNeeded: 1,
});

async function providerWith(cards) {
  globalThis.fetch = vi.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url) === ME_URL ? meResponse(cards) : {}),
    }),
  );
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api).not.toBeNull());
  await waitFor(() => expect(api.playerData).not.toBeNull());
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
});

afterEach(() => { vi.restoreAllMocks(); });

describe('the defender upgrade ceiling', () => {
  it('is 5, matching the highest level any ability table describes', () => {
    expect(MAX_DEFENDER_LEVEL).toBe(5);
  });

  it('refuses to upgrade a defender already at the ceiling', async () => {
    await providerWith([cardAt(MAX_DEFENDER_LEVEL)]);

    await act(async () => { await api.startCardUpgrade(1); });

    const card = api.playerData.cards.find((c) => c.id === 1);
    expect(card.level, 'a maxed defender must not gain a level').toBe(MAX_DEFENDER_LEVEL);
  });

  it('refuses even when the player can trivially afford it', async () => {
    // The point of the guard: affordability was the ONLY thing standing between a
    // rich player and a level 100 Sniper.
    await providerWith([cardAt(MAX_DEFENDER_LEVEL)]);

    await act(async () => {
      await api.startCardUpgrade(1);
      await api.startCardUpgrade(1);
      await api.startCardUpgrade(1);
    });

    expect(api.playerData.cards.find((c) => c.id === 1).level).toBe(MAX_DEFENDER_LEVEL);
  });

  it('still allows an upgrade below the ceiling', async () => {
    // Guards against "fixing" this by refusing everything.
    await providerWith([cardAt(MAX_DEFENDER_LEVEL - 1)]);

    await act(async () => { await api.startCardUpgrade(1); });

    expect(api.playerData.cards.find((c) => c.id === 1).level).toBe(MAX_DEFENDER_LEVEL);
  });
});
