/*
 * A guest's whole account is one localStorage key, so the rules about reading
 * it have to be strict: a save written by a future version of the game, or by
 * a browser extension, or half-written when a tab was killed, must produce a
 * fresh start rather than a crash on the loading screen.
 *
 * Two pieces of server logic live here too. upgradeEnergyRecharge and
 * PlayerRank run inside getOrCreatePlayer, which a guest never calls - miss
 * the first and a guest's energy never refills, so the game stops after a few
 * levels with no way to continue.
 */
import { describe, it, expect } from 'vitest';
import {
  GUEST_SAVE_KEY,
  readGuestSave,
  writeGuestSave,
  clearGuestSave,
  hasGuestSave,
  newGuestPlayer,
  applyEnergyRecharge,
  rankForCompletedLevels,
} from '../guestSave.js';

describe('the guest slot', () => {
  it('round-trips a save', () => {
    const player = { ...newGuestPlayer(), completedLevels: [1, 2, 3] };
    writeGuestSave(player);
    expect(readGuestSave().completedLevels).toEqual([1, 2, 3]);
  });

  it('reports empty before anything is written', () => {
    expect(hasGuestSave()).toBe(false);
    expect(readGuestSave()).toBeNull();
  });

  it('reports full once something is', () => {
    writeGuestSave(newGuestPlayer());
    expect(hasGuestSave()).toBe(true);
  });

  it('forgets the save when cleared', () => {
    writeGuestSave(newGuestPlayer());
    clearGuestSave();
    expect(hasGuestSave()).toBe(false);
    expect(readGuestSave()).toBeNull();
  });

  it('starts fresh rather than throwing on a save it cannot parse', () => {
    localStorage.setItem(GUEST_SAVE_KEY, 'not json {{{');
    expect(readGuestSave()).toBeNull();
  });

  it('starts fresh on a version it does not recognise', () => {
    localStorage.setItem(GUEST_SAVE_KEY, JSON.stringify({
      schemaVersion: 999,
      player: { completedLevels: [1, 2, 3] },
    }));
    expect(readGuestSave()).toBeNull();
  });
});

describe('a new guest', () => {
  it('starts on level 1 with nothing finished', () => {
    const fresh = newGuestPlayer();
    expect(fresh.unlockedLevels).toEqual([1]);
    expect(fresh.completedLevels).toEqual([]);
  });

  it('is a different object each time, so two guests cannot share state', () => {
    const a = newGuestPlayer();
    a.completedLevels.push(1);
    expect(newGuestPlayer().completedLevels).toEqual([]);
  });
});

describe('energy recharging while nobody was playing', () => {
  const at = (energy, lastMs) => ({
    resources: { lobbyEnergy: energy, maxLobbyEnergy: 100, lastEnergyRechargeTime: lastMs },
  });

  it('grants one energy per whole minute elapsed', () => {
    const now = 10 * 60 * 1000;
    const after = applyEnergyRecharge(at(50, 0), now);
    expect(after.resources.lobbyEnergy).toBe(60);
  });

  it('never exceeds the cap', () => {
    const now = 10_000 * 60 * 1000;
    expect(applyEnergyRecharge(at(50, 0), now).resources.lobbyEnergy).toBe(100);
  });

  it('grants nothing before a full minute has passed', () => {
    const after = applyEnergyRecharge(at(50, 0), 59_000);
    expect(after.resources.lobbyEnergy).toBe(50);
  });

  it('moves the clock forward only when it granted something', () => {
    const unchanged = applyEnergyRecharge(at(50, 0), 59_000);
    expect(unchanged.resources.lastEnergyRechargeTime).toBe(0);

    const granted = applyEnergyRecharge(at(50, 0), 60_000);
    expect(granted.resources.lastEnergyRechargeTime).toBe(60_000);
  });
});

describe('the rank a guest has earned', () => {
  const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

  it('matches PlayerRank at every threshold', () => {
    expect(rankForCompletedLevels([])).toBe('Novice');
    expect(rankForCompletedLevels(upTo(1))).toBe('Volunteer');
    expect(rankForCompletedLevels(upTo(5))).toBe('Recruit');
    expect(rankForCompletedLevels(upTo(10))).toBe('Defender');
    expect(rankForCompletedLevels(upTo(15))).toBe('Veteran');
    expect(rankForCompletedLevels(upTo(20))).toBe('Commander');
  });

  it('ignores endless, which is not a campaign level', () => {
    expect(rankForCompletedLevels([1, 2, 999])).toBe('Volunteer');
  });

  it('counts a level finished twice only once', () => {
    expect(rankForCompletedLevels([1, 1, 1, 1, 1])).toBe('Volunteer');
  });
});
