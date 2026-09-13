/*
 * Guest mode makes the frontend's copy of the player authoritative, so every
 * write has to leave playerData in the state an account would have reached.
 *
 * Seven of the ten already did - they call setPlayerData before posting a
 * delta. Three did not: the stat counters and specialAchievements were only
 * ever read back from the server, and claim-achievement read its resources out
 * of the HTTP response. A guest would have banked none of it.
 *
 * These are the pure functions that close that gap.
 */
import { describe, it, expect } from 'vitest';
import {
  applyStats,
  applySpecialAchievement,
  applyClaimedAchievement,
} from '../GameContext.jsx';

const player = (overrides = {}) => ({
  resources: { gold: 100, iron: 10, grain: 30, water: 40, gem: 5 },
  totalEnemiesKilled: 0,
  totalDefendersDeployed: 0,
  totalEnergyCollected: 0,
  specialAchievements: [],
  claimedAchievements: [],
  ...overrides,
});

describe('stat counters', () => {
  it('accumulate rather than replace', () => {
    const once = applyStats(player(), { enemiesKilled: 5, defendersDeployed: 2, energyCollected: 9 });
    const twice = applyStats(once, { enemiesKilled: 3, defendersDeployed: 1, energyCollected: 4 });

    expect(twice.totalEnemiesKilled).toBe(8);
    expect(twice.totalDefendersDeployed).toBe(3);
    expect(twice.totalEnergyCollected).toBe(13);
  });

  it('treat a missing counter as zero rather than NaN', () => {
    const fresh = applyStats({ ...player(), totalEnemiesKilled: undefined }, { enemiesKilled: 4 });
    expect(fresh.totalEnemiesKilled).toBe(4);
  });
});

describe('special achievements', () => {
  it('records one that was just earned', () => {
    expect(applySpecialAchievement(player(), 'untouchable').specialAchievements)
      .toEqual(['untouchable']);
  });

  it('does not record the same one twice', () => {
    const once = applySpecialAchievement(player(), 'untouchable');
    expect(applySpecialAchievement(once, 'untouchable').specialAchievements)
      .toEqual(['untouchable']);
  });
});

describe('claiming an achievement', () => {
  it('credits the reward from local state, not from a server reply', () => {
    const after = applyClaimedAchievement(player(), 'endless_explorer', { gold: 500, gem: 5 });

    expect(after.resources.gold).toBe(600);
    expect(after.resources.gem).toBe(10);
    expect(after.claimedAchievements).toEqual(['endless_explorer']);
  });

  it('leaves resources the reward does not mention alone', () => {
    const after = applyClaimedAchievement(player(), 'x', { gold: 10 });
    expect(after.resources.iron).toBe(10);
    expect(after.resources.water).toBe(40);
  });

  it('does not pay the same achievement twice', () => {
    const once = applyClaimedAchievement(player(), 'x', { gold: 10 });
    const twice = applyClaimedAchievement(once, 'x', { gold: 10 });
    expect(twice.resources.gold).toBe(110);
    expect(twice.claimedAchievements).toEqual(['x']);
  });
});
