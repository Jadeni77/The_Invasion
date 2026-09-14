/*
 * The frontend and the backend both decide what a win pays, and they disagreed.
 *
 * PlayerService.completeLevel awards `stars == 3 ? 1 : 0` gems. The frontend
 * awarded Math.ceil(getLevelRewardMultiplier(level)), which is 4 on levels
 * 18-20 - so a 3-star win there credited 4 gems optimistically and the refetch
 * took 3 of them straight back while the player watched.
 *
 * These tests pin the frontend to the backend's number. If the economy is ever
 * rebalanced, both sides move together or this fails.
 */
import { describe, it, expect } from 'vitest';
import { winRewards } from '../GameContext.jsx';

describe('what a win pays', () => {
  it('awards exactly one gem for three stars, on every level', () => {
    expect(winRewards(1000, 3).gem).toBe(1);
  });

  it('awards no gems below three stars', () => {
    expect(winRewards(1000, 2).gem).toBe(0);
    expect(winRewards(1000, 1).gem).toBe(0);
  });

  it('scales the other resources with the score', () => {
    expect(winRewards(1000, 0)).toMatchObject({
      gold: 200, iron: 100, grain: 200, water: 200,
    });
  });

  it('rounds down rather than handing out fractions', () => {
    expect(winRewards(5, 0)).toMatchObject({ gold: 1, iron: 0 });
  });
});
