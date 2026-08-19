/* Monotonic gameplay clock, advanced only while the game is actually running. */
/* The longest a single frame is allowed to count for. */
export const MAX_DELTA_MS = 1000;

export class GameClock {
  constructor() {
    this.elapsedMs = 0;
  }

  get now() {
    return this.elapsedMs;
  }

  /**
   * Advances by one frame's real elapsed time. Negative deltas are ignored and
   * large ones clamped, so a backgrounded tab resumes smoothly instead of
   * fast-forwarding the match.
   */
  advance(realDeltaMs) {
    if (!Number.isFinite(realDeltaMs) || realDeltaMs <= 0) return;
    this.elapsedMs += Math.min(realDeltaMs, MAX_DELTA_MS);
  }

  reset() {
    this.elapsedMs = 0;
  }
}
