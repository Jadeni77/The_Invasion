/**
 * How much real time the frame currently being processed represents.
 *
 * Sprite animation used to advance by a hardcoded nominal 60fps frame, once per
 * requestAnimationFrame callback. The loop is uncapped, so on a 120Hz ProMotion
 * display that ran every sheet at double speed, and a drop to 30fps ran it at
 * half - while combat, which reads GameClock, kept its real-time cadence either
 * way. The swing and the shot it depicts then drift apart by an amount that
 * depends on the player's refresh rate, which is why the report was "the attacks
 * are not consistent... idk if i am lagging or what".
 *
 * Published once per frame by GameEngine.update() rather than threaded through
 * every unit: the two unit hierarchies call updateAnimation() from some thirty
 * places across a dozen update() overrides, and widening all of those signatures
 * to carry a number would be a far larger change than the bug warrants. This
 * follows the module-singleton shape the codebase already uses for
 * Feedback/SettingsStore.js.
 *
 * The default of zero is deliberate: a caller that has not been told how much
 * time passed should freeze, not guess. Guessing is the bug.
 */
import { MAX_DELTA_MS } from '../Feedback/GameClock.js';

let currentFrameDeltaMs = 0;

/**
 * Records the real time the current frame covers.
 *
 * Clamped by GameClock's own bound rather than one of its own, so animation and
 * gameplay resume from the same point after a backgrounded tab; negative and
 * non-finite deltas, which a clock adjustment can produce, count as no time at
 * all.
 */
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
