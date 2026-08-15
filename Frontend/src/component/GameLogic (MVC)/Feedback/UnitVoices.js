import { SFX } from './SfxLibrary.js';

/**
 * One signature recipe per sound key (see SoundGroups.js), not per unit.
 *
 * Several units resolve to the same sound key by design - a Shooter and a
 * Skeleton firing a basic projectile share the 'projectile' entry below. Hit
 * and death sounds are DERIVED from the signature (see VARIANTS) rather than
 * authored separately. Recipe shape matches SfxLibrary.
 *
 * WEIGHT COMES FROM WAVEFORM, LENGTH AND LEVEL - NOT FROM PITCH. A heavy sound
 * is a sawtooth or a noise burst, held longer and played louder; it is never
 * simply the same sound an octave down. The first pass of this table reached
 * for pitch, and the whole death family plus the Mortar landed between 25Hz
 * and 90Hz, which is inaudible on a laptop speaker - the owner playtested it
 * and reported no death sound and no Mortar at all.
 *
 * The constraint is hardest on the `noise: true` entries. AudioManager renders
 * those as white noise through a BANDPASS whose centre sweeps freqStart ->
 * freqEnd, so that sweep is not the fundamental of the sound, it is the whole
 * of it: nothing outside the passband survives to be heard. A 130Hz triangle
 * still speaks through its harmonics, but a noise burst centred at 60Hz has
 * nothing left above the speaker's rolloff. Every noise recipe below therefore
 * keeps its ENTIRE sweep - after variant scaling - above roughly 200Hz. See
 * UnitVoices.test.js, which derives that check from the unit exports.
 */
export const UNIT_VOICES = {
  projectile:       { wave: 'square',   freqStart: 640,  freqEnd: 880,  duration: 0.06, gain: 0.18, noise: false },
  artillery:        { wave: 'sawtooth', freqStart: 520,  freqEnd: 300,  duration: 0.14, gain: 0.40, noise: true  },
  mortar:           { wave: 'sawtooth', freqStart: 380,  freqEnd: 220,  duration: 0.30, gain: 0.50, noise: true  },
  sniper:           { wave: 'square',   freqStart: 1400, freqEnd: 700,  duration: 0.05, gain: 0.30, noise: false },
  magic:            { wave: 'triangle', freqStart: 1100, freqEnd: 1500, duration: 0.12, gain: 0.22, noise: false },
  fire:             { wave: 'sawtooth', freqStart: 520,  freqEnd: 240,  duration: 0.40, gain: 0.50, noise: true  },
  heal:             { wave: 'sine',     freqStart: 660,  freqEnd: 990,  duration: 0.18, gain: 0.28, noise: false },
  melee:            { wave: 'triangle', freqStart: 340,  freqEnd: 220,  duration: 0.10, gain: 0.30, noise: true  },
  summon:           { wave: 'triangle', freqStart: 200,  freqEnd: 130,  duration: 0.30, gain: 0.35, noise: false },
  hit:              { wave: 'triangle', freqStart: 320,  freqEnd: 240,  duration: 0.07, gain: 0.25, noise: false },
  // The death family reads light -> heavy by falling pitch, rising length and
  // rising level together. Every entry is authored so that the death variant's
  // 0.8 scale still leaves it clear of the speaker rolloff.
  'death-small':    { wave: 'sawtooth', freqStart: 650,  freqEnd: 400,  duration: 0.12, gain: 0.25, noise: true  },
  'death-medium':   { wave: 'sawtooth', freqStart: 550,  freqEnd: 340,  duration: 0.20, gain: 0.35, noise: true  },
  'death-defender': { wave: 'sawtooth', freqStart: 480,  freqEnd: 290,  duration: 0.35, gain: 0.40, noise: true  },
  titan:            { wave: 'sawtooth', freqStart: 400,  freqEnd: 270,  duration: 0.40, gain: 0.55, noise: true  },
  boss:             { wave: 'sawtooth', freqStart: 420,  freqEnd: 280,  duration: 0.50, gain: 0.60, noise: true  },
};

/**
 * How each variant transforms a unit's signature.
 *
 * death's freqScale is a nudge, not a drop. At 0.5 - an octave down - a death
 * was pitched under the speaker before it was ever mixed, so the 2.5x length
 * and 1.15x level that are supposed to make it feel heavy had nothing left to
 * act on. 0.8 keeps the shift audible as a shift while leaving the sound in
 * the band a laptop can actually move air at.
 */
export const VARIANTS = {
  fire:  { freqScale: 1,   durationScale: 1,    gainScale: 1    },
  hit:   { freqScale: 1,   durationScale: 0.35, gainScale: 0.55 },
  melee: { freqScale: 1,   durationScale: 0.35, gainScale: 0.55 },
  death: { freqScale: 0.8, durationScale: 2.5,  gainScale: 1.15 },
};

/** Generic recipes used when a unit has no voice of its own. */
const FALLBACK = {
  fire:  SFX.projectileFired,
  hit:   SFX.enemyHit,
  death: SFX.enemyDied,
};

/**
 * Degenerate-value guard, deliberately NOT the audibility floor.
 *
 * At 20Hz this never engaged for any recipe in the table - the lowest value
 * the old table could derive was 25Hz - so it masked nothing, and raising it
 * to ~200Hz would be the wrong repair: clamping would flatten a noise recipe's
 * sweep into a single dull band and quietly hide the authoring mistake instead
 * of surfacing it. Audibility is a property each recipe carries, enforced by
 * the derived check in UnitVoices.test.js; this only stops a scale factor
 * driving a frequency to zero or negative.
 */
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
/** Longest a single voice - synthesized or sampled - may occupy a slot. */
export const MAX_DURATION = 2;
const MAX_GAIN = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves a sound key's voice for one variant.
 *
 * Unknown keys fall back to the generic recipe rather than going silent or
 * throwing - a unit added later is quieter than intended, never broken. In
 * production this branch is effectively unreachable: the only caller
 * (FeedbackManager.playUnitVoice) always passes a key already resolved by
 * soundKeyFor, which total-maps every unit name - known or not - onto one of
 * the 15 declared sound keys, all of which have a UNIT_VOICES entry. The
 * guard stays anyway as cheap insurance if that mapping ever stops being
 * total, and it is exercised directly by tests below.
 *
 * The optional signature parameter exists for testing derivation against a
 * known input; production callers pass two arguments.
 *
 * There used to be a fourth `fallbackRecipe` parameter letting a caller pick
 * which generic sound played for an unrecognised unit - it let an
 * unrecognised defender fall back to SFX.defenderDied instead of the enemy
 * squelch. It was removed because soundKeyFor now handles that distinction
 * upstream (a recognised defender resolves to the fully-populated
 * 'death-defender' key), so the parameter was never reached from
 * FeedbackManager and had become dead, misleading API surface.
 */
export function resolveVoice(soundKey, variant, signature = UNIT_VOICES[soundKey]) {
  const scale = VARIANTS[variant] ?? VARIANTS.fire;

  if (!signature) {
    // Copy rather than hand back the shared FALLBACK object by reference, so
    // a careless downstream mutation can't corrupt the shared recipe.
    return { ...(FALLBACK[variant] ?? FALLBACK.fire) };
  }

  return {
    wave: signature.wave,
    noise: signature.noise,
    freqStart: clamp(signature.freqStart * scale.freqScale, MIN_FREQ, MAX_FREQ),
    freqEnd: clamp(signature.freqEnd * scale.freqScale, MIN_FREQ, MAX_FREQ),
    duration: clamp(signature.duration * scale.durationScale, 0.01, MAX_DURATION),
    gain: clamp(signature.gain * scale.gainScale, 0.001, MAX_GAIN),
  };
}
