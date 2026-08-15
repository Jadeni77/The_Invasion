/**
 * Attack-animation playback, derived from how often the unit actually attacks.
 *
 * Every other animation a unit has - idle, move, death - plays at its authored
 * fps and is done. An attack sheet cannot, because it has a second clock to
 * agree with: the firing cooldown. Author the sheet longer than the cadence,
 * as the Skeleton Shooter's is (10 frames at 10fps = 1000ms against an 833ms
 * cadence), and playing it at its authored speed leaves it still mid-swing when
 * the next shot arrives, so it never finishes and never leaves the attack
 * state. That is what the previous fix - a fixed ATTACK_ANIMATION_LOCK_FRAMES
 * countdown - was working around, and it worked around it by cutting the sheet
 * off after about a third of its frames.
 *
 * The rule here plays the WHOLE sheet, exactly once per attack, over
 * min(authored duration, cadence):
 *
 *   - sheet longer than the cadence  -> compressed to fit, finishing as the
 *     next shot is due, so every frame is seen and nothing latches on;
 *   - sheet shorter than the cadence -> left at its authored speed and handed
 *     back to idle. NOT stretched across the cadence: a Mortar reloads for six
 *     seconds and a 3-frame sheet spread over that is slow motion, not a
 *     firing animation.
 *
 * Deriving from the cadence also means a unit that changes its own fire rate -
 * BasicDefender halves it at level 3 - keeps its animation in step for free.
 * Both sides of the game use this: enemies through EnemyUnits.js, defenders
 * through DefenderUnits.js.
 */

/** An animation config's own length in ms, or null if it declares no timing. */
function authoredDurationMs(config) {
  if (!config) return null;
  const { frameCount, fps } = config;
  if (!(frameCount > 0) || !(fps > 0)) return null;
  return (frameCount / fps) * 1000;
}

/** A usable cadence in ms, or null - a unit with no fire rate has no cadence. */
function usableCadenceMs(cadenceMs) {
  return Number.isFinite(cadenceMs) && cadenceMs > 0 ? cadenceMs : null;
}

/**
 * How long one full pass over an attack sheet should take.
 *
 * Falls back to whichever of the two is known when the other is not, so a unit
 * whose sprites failed to load still releases its attack state on the cadence
 * rather than latching on, and a unit with no cadence still plays its sheet.
 * Returns null only when neither is known.
 */
export function attackAnimationDurationMs(config, cadenceMs) {
  const authored = authoredDurationMs(config);
  const cadence = usableCadenceMs(cadenceMs);

  if (authored === null) return cadence;
  if (cadence === null) return authored;
  return Math.min(authored, cadence);
}

/** How long each frame of an attack sheet holds, or null if it cannot be derived. */
export function attackFrameDurationMs(config, cadenceMs) {
  const duration = attackAnimationDurationMs(config, cadenceMs);
  if (duration === null || !config || !(config.frameCount > 0)) return null;
  return duration / config.frameCount;
}

/**
 * How long a frame of `animationName` holds for a unit whose attack cadence is
 * cadenceMs. Only the attack sheet is cadence-derived; everything else plays as
 * authored.
 */
export function frameDurationMs(animationName, config, cadenceMs) {
  if (animationName === 'attack') {
    const derived = attackFrameDurationMs(config, cadenceMs);
    if (derived !== null) return derived;
  }
  return config && config.fps > 0 ? 1000 / config.fps : null;
}
