import { describe, it, expect, beforeEach } from 'vitest';
import { GameClock } from '../GameClock.js';

describe('GameClock', () => {
  let clock;

  beforeEach(() => {
    clock = new GameClock();
  });

  it('starts at zero', () => {
    expect(clock.now).toBe(0);
  });

  it('accumulates advanced time', () => {
    clock.advance(16);
    clock.advance(16);
    expect(clock.now).toBe(32);
  });

  it('does not advance when it is not told to', () => {
    clock.advance(16);
    expect(clock.now).toBe(16);
    expect(clock.now).toBe(16);
  });

  it('ignores negative deltas, which a clock adjustment could produce', () => {
    clock.advance(100);
    clock.advance(-50);
    expect(clock.now).toBe(100);
  });

  it('clamps absurd deltas so a backgrounded tab cannot jump the clock', () => {
    clock.advance(60_000);
    expect(clock.now).toBeLessThanOrEqual(1000);
  });

  it('resets to zero', () => {
    clock.advance(500);
    clock.reset();
    expect(clock.now).toBe(0);
  });
});
