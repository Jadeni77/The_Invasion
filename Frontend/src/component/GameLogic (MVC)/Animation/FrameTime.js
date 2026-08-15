/**
 * How much real time the frame currently being processed represents, in the two
 * units gameplay needs it in: milliseconds, and 60fps frames.
 *
 * Sprite animation used to advance by a hardcoded nominal 60fps frame, once per
 * requestAnimationFrame callback. The loop is uncapped, so on a 120Hz ProMotion
 * display that ran every sheet at double speed, and a drop to 30fps ran it at
 * half - while combat, which reads GameClock, kept its real-time cadence either
 * way. The swing and the shot it depicts then drift apart by an amount that
 * depends on the player's refresh rate, which is why the report was "the attacks
 * are not consistent... idk if i am lagging or what".
 *
 * Movement and every countdown outside GameClock had the same defect and are
 * converted by frameScale() below.
 *
 * Published once per frame by GameEngine.update() rather than threaded through
 * every unit: the two unit hierarchies call updateAnimation() from some thirty
 * places across a dozen update() overrides, and movement and the countdowns add
 * some fifty more sites across a dozen more update() and updateBehavior()
 * overrides. Widening all of those signatures to carry a number would be a far
 * larger change than the bug warrants. This follows the module-singleton shape
 * the codebase already uses for Feedback/SettingsStore.js.
 *
 * The default of zero is deliberate: a caller that has not been told how much
 * time passed should freeze, not guess. Guessing is the bug.
 */
import { MAX_DELTA_MS } from '../Feedback/GameClock.js';

/**
 * The frame length every speed and countdown constant in this codebase assumes.
 *
 * Not a resurrection of the GAME_FRAME_MS that 0b7bc21 deleted, which claimed to
 * be how long a frame *is* - that was the bug, and on a 120Hz display it was
 * wrong by a factor of two. This is a unit of authorship, not a measurement: an
 * enemy's `speed: 0.8` means 0.8 pixels per 1/60s and an `attackRate: 90` means
 * 90 sixtieths of a second, because that is what they were tuned against.
 * Dividing the real delta by it converts a measured frame into those units, so
 * the authored numbers keep meaning what their authors meant.
 */
export const AUTHORED_FRAME_MS = 1000 / 60;

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

/**
 * The current frame measured in the 60fps frames the game's constants are in.
 *
 * Multiply any authored per-frame quantity by this instead of applying it whole:
 *
 *   this.x += this.speed * frameScale();
 *   this.attackCountdown -= frameScale();
 *
 * At exactly 60fps this is exactly 1 - `x / x` is 1 for any finite non-zero x -
 * so `speed * frameScale()` is bit-for-bit `speed` and a machine running at the
 * rate the game was tuned for behaves identically to before the conversion. That
 * exactness is the whole safety argument for the change: at 60fps it is a no-op,
 * and only other refresh rates move.
 *
 * Derived from frameDeltaMs() rather than from a delta of its own so it inherits
 * GameClock's MAX_DELTA_MS clamp: without it, a tab left in the background for a
 * minute would come back to a single frame worth thousands of authored frames
 * and teleport every enemy across the field.
 */
export function frameScale() {
  return currentFrameDeltaMs / AUTHORED_FRAME_MS;
}

/**
 * Whether a countdown stepping from `before` to `after` crossed a multiple of
 * `period` - the fractional-safe replacement for `if (countdown % period === 0)`.
 *
 * A frame-counted countdown decremented by exactly 1 could test for a periodic
 * tick by landing exactly on a multiple. A real-time countdown steps by a
 * fraction and lands on one essentially never, so the tick would simply stop
 * happening. Reproduces the integer behaviour exactly: stepping 31 -> 30 fires,
 * 30 -> 29 does not, 1 -> 0 fires. A step large enough to skip several periods
 * fires once, not once per period, because the tick is an event and not an
 * accumulation.
 */
export function crossedPeriod(before, after, period) {
  return Math.ceil(before / period) !== Math.ceil(after / period);
}
