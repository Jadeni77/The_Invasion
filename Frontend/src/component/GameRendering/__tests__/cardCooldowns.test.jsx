/*
 * A cooldown counts seconds, not timer ticks.
 *
 * It used to subtract a flat 100ms per interval, which is only correct while
 * the browser fires that interval on schedule - and it does not: a background
 * tab is clamped to one tick a second, and a heavy wave drops ticks outright.
 * Every dropped tick was time the countdown never spent, so a card said 15s and
 * took longer. The clock is faked here separately from the timer so a tick can
 * be made to cover any amount of real time, which is exactly the case that was
 * broken and that no amount of "advance the timers" reproduces on its own.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCardCooldowns, tickCooldowns } from '../useCardCooldowns.js';

/** A clock that only moves when told, independent of how the timer fires. */
function fakeClock() {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  return {
    /** Move real time forward by `ms`, delivering it in `ticks` timer firings. */
    async advance(ms, ticks = Math.max(1, Math.round(ms / 100))) {
      for (let i = 0; i < ticks; i += 1) {
        now += ms / ticks;
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      }
    },
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the countdown', () => {
  it('spends the time that actually passed, not the ticks it was given', async () => {
    const clock = fakeClock();
    const { result } = renderHook(() => useCardCooldowns(false));

    act(() => { result.current[1]({ shooter: 15_000 }); });

    // Five seconds of real time, delivered in ONE tick - a throttled tab.
    await clock.advance(5_000, 1);

    expect(result.current[0].shooter).toBe(10_000);
  });

  it('reaches the same place however many ticks carried the time', async () => {
    const runs = [];
    for (const ticks of [1, 5, 50]) {
      const clock = fakeClock();
      const { result, unmount } = renderHook(() => useCardCooldowns(false));
      act(() => { result.current[1]({ shooter: 15_000 }); });

      await clock.advance(5_000, ticks);

      runs.push(result.current[0].shooter);
      unmount();
      vi.restoreAllMocks();
    }

    expect(new Set(runs).size, `ticks changed the outcome: ${runs.join(', ')}`).toBe(1);
  });

  it('finishes rather than going negative', async () => {
    const clock = fakeClock();
    const { result } = renderHook(() => useCardCooldowns(false));

    act(() => { result.current[1]({ shooter: 1_000 }); });
    await clock.advance(9_000, 3);

    expect(result.current[0].shooter).toBe(0);
  });

  it('holds while paused, and is not charged for the pause', async () => {
    const clock = fakeClock();
    const { result, rerender } = renderHook(({ paused }) => useCardCooldowns(paused), {
      initialProps: { paused: false },
    });

    act(() => { result.current[1]({ shooter: 15_000 }); });
    await clock.advance(2_000, 2);
    expect(result.current[0].shooter).toBe(13_000);

    rerender({ paused: true });
    await clock.advance(30_000, 5);
    expect(result.current[0].shooter, 'paused').toBe(13_000);

    rerender({ paused: false });
    await clock.advance(3_000, 3);
    expect(result.current[0].shooter, 'resumed, pause not charged').toBe(10_000);
  });
});

describe('the step itself', () => {
  it('leaves a card that is already ready alone', () => {
    expect(tickCooldowns({ shooter: 0 }, 500)).toEqual({ shooter: 0 });
  });

  it('hands back the same object when nothing is running', () => {
    const idle = { shooter: 0, mortar: 0 };

    // Identity, not equality: a fresh object here re-renders the whole board
    // ten times a second for no change.
    expect(tickCooldowns(idle, 500)).toBe(idle);
  });

  it('advances every running card by the same elapsed time', () => {
    expect(tickCooldowns({ a: 5_000, b: 2_000, c: 0 }, 1_500))
      .toEqual({ a: 3_500, b: 500, c: 0 });
  });
});
