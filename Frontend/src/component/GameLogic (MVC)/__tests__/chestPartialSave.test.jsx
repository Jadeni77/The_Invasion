/*
 * A chest that was not recorded grants nothing else.
 *
 * Opening a chest is three writes, and only the first is independent:
 * collect-treasure marks the chest collected, and the card pieces and
 * defenders are given BECAUSE it was opened. Marking it collected is also the
 * only thing that stops it being opened again.
 *
 * So a failed collect-treasure alongside a succeeding add-card-pieces is a
 * duplication bug, not a lost write: the pieces are banked, the chest is still
 * sitting unclaimed on the server, and the next reload offers it again. The
 * player collects it as many times as they care to reload, and chest-6 carries
 * 40 Mortar pieces.
 *
 * Before persistence moved into playerPersistence.js, a dropped connection
 * threw and skipped these loops - so this held by accident for that one case
 * only. A backend answering 500 never threw and duplicated happily. Gating on
 * the recorded result covers both.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { chestsData, chestCardPieces } from '../../GameRendering/MapLayout.jsx';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');
const COLLECT_URL = apiUrl('/api/player/collect-treasure');
const PIECES_URL = apiUrl('/api/player/add-card-pieces');

/* A chest that actually grants pieces, so the assertion cannot pass vacuously. */
const CHEST = chestsData.find((c) => Object.keys(chestCardPieces(c)).length > 0);

const SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Commander', rank: 'Recruit',
  gold: 100, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1], completedLevels: [], collectedTreasures: [],
  levelStars: Array(20).fill(0), endlessHighScore: 0,
};

let api;

function Probe() {
  api = useGame();
  return <div />;
}

/** Every request made to the add-card-pieces endpoint. */
function pieceCalls() {
  return globalThis.fetch.mock.calls.filter(([url]) => String(url) === PIECES_URL);
}

/**
 * Mount, then serve a backend where collect-treasure fails in `mode` and every
 * other endpoint succeeds - which is the combination that duplicates.
 */
async function mountWithFailingCollect(mode) {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
  }));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api.playerData?.resources).toBeTruthy());

  globalThis.fetch = vi.fn((url) => {
    if (String(url) === COLLECT_URL) {
      return mode === 'offline'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
    });
  });
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

describe('a chest whose collection was not recorded', () => {
  it('has a chest carrying card pieces to test with', () => {
    // Guards the two assertions below against passing because no chest grants
    // pieces at all, which would make them prove nothing.
    expect(CHEST, 'no chest grants card pieces').toBeDefined();
    expect(Object.keys(chestCardPieces(CHEST)).length).toBeGreaterThan(0);
  });

  it('banks no card pieces when the connection dropped', async () => {
    await mountWithFailingCollect('offline');

    await act(async () => { await api.collectTreasure(CHEST.id); });

    expect(
      pieceCalls(),
      'pieces banked for a chest the server still shows as unclaimed',
    ).toEqual([]);
  });

  /* The case that never threw, so the old code duplicated on it. */
  it('banks no card pieces when the server answered 500', async () => {
    await mountWithFailingCollect('error');

    await act(async () => { await api.collectTreasure(CHEST.id); });

    expect(
      pieceCalls(),
      'a rejected save still let the dependent grants through',
    ).toEqual([]);
  });

  /* The player keeps what they were shown either way - the credit is local and
     happens before any request, which is what makes retrying safe. */
  it('still credits the player on screen', async () => {
    await mountWithFailingCollect('offline');
    const before = api.playerData.resources.gold;

    await act(async () => { await api.collectTreasure(CHEST.id); });

    await waitFor(() => {
      expect(api.playerData.collectedTreasures).toContain(CHEST.id);
    });
    expect(api.playerData.resources.gold).toBeGreaterThanOrEqual(before);
  });
});

describe('a chest that was recorded', () => {
  it('banks its card pieces', async () => {
    globalThis.fetch = vi.fn((url) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
    }));
    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(api.playerData?.resources).toBeTruthy());

    await act(async () => { await api.collectTreasure(CHEST.id); });

    await waitFor(() => expect(pieceCalls().length).toBeGreaterThan(0));
    const sent = pieceCalls().map(([, init]) => JSON.parse(init.body));
    for (const [cardName, pieces] of Object.entries(chestCardPieces(CHEST))) {
      expect(sent).toContainEqual({ cardName, pieces });
    }
  });
});
