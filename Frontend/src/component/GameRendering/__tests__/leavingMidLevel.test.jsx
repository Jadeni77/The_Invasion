/*
 * Leaving a level in progress costs something, and the player is told.
 *
 * There is no resuming: a refresh drops the run and the energy spent to start
 * it is gone. The quit button said "Quitting will remove all resources gain
 * from this level", which is both vague and silent about the energy - the part
 * that cannot be got back. A refresh said nothing whatsoever.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLeaveWarning } from '../useLeaveWarning.js';
import { energyCostOf, LEVEL_ENERGY_COST } from '../../GameLogic (MVC)/GameContext';

/** Fire a cancelable beforeunload and report whether anything objected. */
function unloadIsBlocked() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the refresh warning', () => {
  it('objects while a level is in progress', () => {
    renderHook(() => useLeaveWarning(true));

    expect(unloadIsBlocked(), 'a refresh mid-level should ask first').toBe(true);
  });

  it('stays out of the way everywhere else', () => {
    renderHook(() => useLeaveWarning(false));

    expect(unloadIsBlocked(), 'nothing to lose in the lobby').toBe(false);
  });

  it('stops objecting the moment the level ends', () => {
    const { rerender } = renderHook(({ active }) => useLeaveWarning(active), {
      initialProps: { active: true },
    });
    expect(unloadIsBlocked()).toBe(true);

    rerender({ active: false });

    expect(unloadIsBlocked(), 'the run is over; let them go').toBe(false);
  });

  it('lets go when the board unmounts', () => {
    const { unmount } = renderHook(() => useLeaveWarning(true));
    expect(unloadIsBlocked()).toBe(true);

    unmount();

    expect(unloadIsBlocked(), 'a stale listener would block every later reload').toBe(false);
  });
});

describe('what a level costs to start', () => {
  /* The quit dialog quotes this number, so it has one owner. */
  it('is free for level 1 and endless', () => {
    expect(energyCostOf(1)).toBe(0);
    expect(energyCostOf(999)).toBe(0);
  });

  it('costs the standard amount for everything else', () => {
    for (const levelId of [2, 3, 10, 20]) {
      expect(energyCostOf(levelId)).toBe(LEVEL_ENERGY_COST);
    }
  });

  it('charges something, or the warning is about nothing', () => {
    expect(LEVEL_ENERGY_COST).toBeGreaterThan(0);
  });
});
