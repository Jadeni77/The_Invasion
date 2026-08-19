/*
 * What the game hands the energy gate when it refuses to start a level.
 *
 * The panel can only offer to buy-and-play the deck the player already picked
 * if the gate carries it, so this covers the producing side: GateNotice's own
 * tests supply a notice and cannot tell whether startLevel builds one.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

/** A save sitting on level 2 with almost no energy, and gold to spare. */
const brokePlayer = {
  id: 'p1', sessionId: 's1', name: 'Commander', rank: 'Recruit',
  gold: 400, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 1, maxLobbyEnergy: 100, energyRechargeRate: 60,
  lastEnergyRechargeTime: Date.now(),
  unlockedLevels: [1, 2], completedLevels: [1], collectedTreasures: [],
};

let api;

function Probe() {
  api = useGame();
  return <div data-testid="probe" />;
}

async function mount(me) {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? me : {}),
  }));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api.playerData?.resources).toBeTruthy());
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('a level the player cannot afford', () => {
  it('raises an energy gate carrying the deck they had chosen', async () => {
    await mount(brokePlayer);

    await act(async () => { await api.startLevel(2, ['Shooter', 'Mortar']); });

    await waitFor(() => expect(api.gateNotice).toBeTruthy());
    expect(api.gateNotice.kind).toBe('energy');
    expect(api.gateNotice.levelId).toBe(2);
    expect(api.gateNotice.selectedCards).toEqual(['Shooter', 'Mortar']);
    // The cost lives in startLevel; read it back rather than restating it.
    expect(api.gateNotice.needed).toBeGreaterThan(brokePlayer.lobbyEnergy);
    expect(api.gateNotice.have).toBe(brokePlayer.lobbyEnergy);
  });

  it('charges nothing and starts nothing', async () => {
    await mount(brokePlayer);

    await act(async () => { await api.startLevel(2, ['Shooter']); });

    await waitFor(() => expect(api.gateNotice).toBeTruthy());
    expect(api.playerData.resources.lobbyEnergy).toBe(brokePlayer.lobbyEnergy);
    expect(api.gameState).toBe('lobby');
  });
});

describe('a level the player can afford', () => {
  it('starts without a gate', async () => {
    await mount({ ...brokePlayer, lobbyEnergy: brokePlayer.maxLobbyEnergy });

    await act(async () => { await api.startLevel(2, ['Shooter']); });

    await waitFor(() => expect(api.gameState).not.toBe('lobby'));
    expect(api.gateNotice).toBeNull();
  });
});
