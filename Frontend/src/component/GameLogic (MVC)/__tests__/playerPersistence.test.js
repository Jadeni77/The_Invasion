/*
 * There were sixteen fetch calls spread through a 1,289-line file, and guest
 * mode needed every one of them to have a local alternative. Guarding each
 * call site would have put the decision in sixteen places, and the seventeenth
 * write path added later would have forgotten it - failing as a guest whose
 * progress simply does not save, which is the worst way for this to break.
 *
 * So the decision lives here, once. These tests hold the two halves of that
 * contract: an account still talks to the backend, and a guest never does.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPersistence } from '../playerPersistence.js';
import { writeGuestSave, newGuestPlayer } from '../guestSave.js';

const OPERATIONS = [
  ['completeLevel', { levelId: 3, score: 100, stars: 2 }],
  ['updateStats', { enemiesKilled: 1, defendersDeployed: 1, energyCollected: 1 }],
  ['updateResources', { gold: 10 }],
  ['unlockDefender', 'Sniper'],
  ['unlockSpecialAchievement', 'untouchable'],
  ['collectTreasure', 'chest-1'],
  ['claimAchievement', 'endless_explorer'],
  ['endlessScore', 12],
];

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.setItem('auth_token', 'a-token');
});

describe('an account', () => {
  it('sends every write to the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const persistence = createPersistence('account');

    for (const [name, arg] of OPERATIONS) {
      await persistence[name](arg, 1);
    }

    expect(fetchMock).toHaveBeenCalledTimes(OPERATIONS.length);
  });

  it('carries the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await createPersistence('account').updateResources({ gold: 1 });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer a-token');
  });

  it('swallows a network failure rather than taking the run down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createPersistence('account').updateResources({ gold: 1 }))
      .resolves.not.toThrow();
  });
});

describe('a guest', () => {
  it('never touches the network, on any operation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const persistence = createPersistence('guest');

    for (const [name, arg] of OPERATIONS) {
      await persistence[name](arg, 1);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /*
   * A guest has to report a write as done, because callers gate on the answer.
   * collectTreasure's dependent grants are skipped when the chest was not
   * recorded; a guest resolving anything falsy here would silently stop
   * banking their own card pieces while the resources landed.
   */
  it('reports every write as done, so callers that gate on the result proceed', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const persistence = createPersistence('guest');

    for (const [name, arg] of OPERATIONS) {
      await expect(persistence[name](arg, 1), `${name} did not report success`)
        .resolves.toBe(true);
    }
  });

  it('loads the player out of the slot', async () => {
    const saved = { ...newGuestPlayer(), completedLevels: [1, 2] };
    writeGuestSave(saved);
    vi.stubGlobal('fetch', vi.fn());

    const loaded = await createPersistence('guest').loadPlayer();

    expect(loaded.completedLevels).toEqual([1, 2]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts a new guest when the slot is empty', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const loaded = await createPersistence('guest').loadPlayer();
    expect(loaded.completedLevels).toEqual([]);
  });

  it('recharges energy earned while the game was closed', async () => {
    const stale = newGuestPlayer();
    stale.resources.lobbyEnergy = 10;
    stale.resources.lastEnergyRechargeTime = Date.now() - 5 * 60 * 1000;
    writeGuestSave(stale);
    vi.stubGlobal('fetch', vi.fn());

    const loaded = await createPersistence('guest').loadPlayer();

    expect(loaded.resources.lobbyEnergy).toBe(15);
  });

  it('cannot import, having nowhere to import to', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(createPersistence('guest').importGuestSave(newGuestPlayer()))
      .resolves.toBe(false);
  });
});
