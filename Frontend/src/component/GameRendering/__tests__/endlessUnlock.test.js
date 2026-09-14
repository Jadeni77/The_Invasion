/*
 * Five places decided when endless mode opens, and they did not agree.
 *
 * isEndlessUnlocked checked ten completed levels. Its own comment said
 * twenty, so did the locked-gate message in startLevel, so did the map's
 * rainbow edge from node 20, and so did the optimistic push of 999 into
 * unlockedLevels. Endless therefore opened ten levels before anything in the
 * game claimed it would.
 *
 * Ten is the intended rule - endless is a mid-campaign release valve - so the
 * words moved rather than the gate. These tests hold the rule still.
 */
import { describe, it, expect } from 'vitest';
import { isEndlessUnlocked } from '../MapLayout.jsx';

const player = (overrides = {}) => ({
  completedLevels: [],
  levelStars: Array(20).fill(0),
  ...overrides,
});

describe('when endless mode opens', () => {
  it('stays shut at nine completed levels', () => {
    const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(isEndlessUnlocked(player({ completedLevels: nine }))).toBe(false);
  });

  it('opens at ten', () => {
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(isEndlessUnlocked(player({ completedLevels: ten }))).toBe(true);
  });

  it('also opens on fifty stars, for a player who replayed rather than advanced', () => {
    const stars = Array(20).fill(0);
    for (let i = 0; i < 17; i++) stars[i] = 3;
    expect(isEndlessUnlocked(player({ levelStars: stars }))).toBe(true);
  });

  it('does not consult a field the player object has never had', () => {
    // isEndlessUnlocked used to test playerData.achievements, but toPlayerData
    // emits claimedAchievements and specialAchievements and never `achievements`.
    // The branch was dead. This proves removing it changed nothing.
    const withVeteran = player({ achievements: ['veteran_defender'] });
    expect(isEndlessUnlocked(withVeteran)).toBe(false);
  });
});
