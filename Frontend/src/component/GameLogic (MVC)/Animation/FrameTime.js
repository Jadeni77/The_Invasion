/*
 * How much real time the frame currently being processed represents, in the
 * two units gameplay needs it in: milliseconds, and 60fps frames.
 */
import { MAX_DELTA_MS } from '../Feedback/GameClock.js';

/*
 * The frame length every speed and countdown constant in this codebase
 * assumes.
 */
export const AUTHORED_FRAME_MS = 1000 / 60;

let currentFrameDeltaMs = 0;

/* Records the real time the current frame covers. */
export function setFrameDeltaMs(realDeltaMs) {
  currentFrameDeltaMs =
    Number.isFinite(realDeltaMs) && realDeltaMs > 0
      ? Math.min(realDeltaMs, MAX_DELTA_MS)
      : 0;
}

/** The real time the current frame covers, in milliseconds. */
export function frameDeltaMs() {
  return currentFrameDeltaMs;
}

/* The current frame measured in the 60fps frames the game's constants are in. */
export function frameScale() {
  return currentFrameDeltaMs / AUTHORED_FRAME_MS;
}

/*
 * Whether a countdown stepping from `before` to `after` crossed a multiple of
 * `period` - the fractional-safe replacement for `if (countdown % period ===
 * 0)`.
 */
export function crossedPeriod(before, after, period) {
  return Math.ceil(before / period) !== Math.ceil(after / period);
}
