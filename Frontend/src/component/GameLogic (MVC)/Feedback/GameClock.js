/**
 * Monotonic gameplay clock, advanced only while the game is actually running.
 *
 * Wave timing must not use Date.now(): update() is skipped while paused and
 * during hit-stop, so wall-clock time would keep running and produce a burst
 * of waves on resume.
 */
/**
 * The longest a single frame is allowed to count for.
 *
 * Exported because animation has to clamp identically - see
 * Animation/FrameTime.js. Two clamping policies would mean a tab restored after
 * a minute away resumes its sprites and its cooldowns at different points.
 */
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
