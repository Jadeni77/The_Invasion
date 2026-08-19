/* Attack-animation playback, derived from how often the unit actually attacks. */

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

/* How long one full pass over an attack sheet should take. */
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
