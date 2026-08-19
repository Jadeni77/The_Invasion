import { useEffect, useState } from "react";

/* How often the countdown is re-read. Not how much it advances - see below. */
const TICK_MS = 100;

/**
 * Subtract real elapsed time from every running cooldown.
 *
 * Returns the same object when nothing was running, so a board with no card on
 * cooldown does not re-render ten times a second for no change.
 */
export function tickCooldowns(cooldowns, elapsedMs) {
  let changed = false;
  const next = { ...cooldowns };

  for (const id of Object.keys(next)) {
    if (next[id] > 0) {
      next[id] = Math.max(0, next[id] - elapsedMs);
      changed = true;
    }
  }

  return changed ? next : cooldowns;
}

/**
 * Card cooldowns, counted down on the clock rather than on the tick count.
 *
 * Subtracting a fixed step per interval assumes the interval fires on schedule,
 * which browsers do not promise: a background tab is clamped to one tick a
 * second, and a heavy wave drops ticks outright. Every tick lost was time the
 * countdown never spent, so a 15s cooldown quietly took far longer than the 15
 * it displayed.
 *
 * `paused` holds the countdown without charging it for the pause: the clock
 * reading advances while the cooldowns do not.
 */
export function useCardCooldowns(paused = false) {
  const [cooldowns, setCooldowns] = useState({});

  useEffect(() => {
    let last = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;

      if (paused) return;

      setCooldowns((prev) => tickCooldowns(prev, elapsed));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [paused]);

  return [cooldowns, setCooldowns];
}
