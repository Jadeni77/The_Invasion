/**
 * Synth recipes for every game sound. Pure data, no Web Audio types, so this
 * is testable without an AudioContext and tunable without touching playback.
 *
 * wave      - oscillator shape
 * freqStart - Hz at note start
 * freqEnd   - Hz at note end (a slide from freqStart)
 * duration  - seconds
 * gain      - peak gain, 0..1, before bus volumes are applied
 * noise     - when true, plays white noise through a bandpass whose centre
 *             sweeps freqStart -> freqEnd, instead of a tone
 * layers    - OPTIONAL. Further recipes played as part of the same sound, each
 *             with an `offset` in seconds from the trigger (default 0).
 *
 * ON LAYERS. AudioManager renders exactly one source per recipe: `noise: true`
 * plays the bandpassed noise burst INSTEAD of the oscillator, never both. That
 * is enough for a blip or a tick, and not enough for anything with a shape -
 * artillery is a sharp crack AND a midrange body AND a decaying tail, sounding
 * together, and no single source is all three. A layered recipe is still ONE
 * sound to everything downstream: one voice against MAX_VOICES and one dedupe
 * slot, not one per layer.
 *
 * A recipe without `layers` is a one-layer sound and behaves exactly as it
 * always has, which is why nothing below had to change to add the mechanism.
 *
 * ON PITCH, FOR THE WHOLE FILE. Typical laptop speakers roll off below roughly
 * 200Hz. Weight has to come from the transient and the midrange, not from
 * sub-bass: an earlier pass authored the Mortar and the death family between
 * 25Hz and 90Hz, which was silent in play while every test passed.
 *
 * Six recipes here were still under that floor after the death family was
 * fixed - defenderPlaced, defenderDied, enemyDied, bossDied, deployRejected
 * and levelLost - and were lifted together, each keeping the DIRECTION and,
 * where it survived the lift, the RATIO of its original sweep, so the
 * character is the one that was authored and only the register moved. The
 * floor is now enforced for every recipe and every layer in both tables by the
 * derived check in UnitVoices.test.js; it is not a per-sound judgement call.
 */
export const SFX = {
  // Placing a unit: short thunk, dropping an octave.
  defenderPlaced:   { wave: 'sine',     freqStart: 440, freqEnd: 220, duration: 0.12, gain: 0.5, noise: false },
  // Losing a unit: descending crumble.
  defenderDied:     { wave: 'sawtooth', freqStart: 540, freqEnd: 270, duration: 0.35, gain: 0.4, noise: true  },
  /**
   * Removing a deployed defender (the hammer/shovel tool): a dry,
   * wood-and-metal thunk of something being pried up and carted off. This is
   * a GAME EVENT, not a unit voice - the player did this, not the unit - so
   * it lives here and plays through playSfx, the same way defenderPlaced
   * does, rather than through playUnitVoice/resolveVoice.
   *
   * Two layers because the owner named two materials: the base is the wood -
   * a dull, falling knock - and the layer is the metal - a brief bright
   * scrape/clink landing just after, as the hardware comes free. Short and
   * dry throughout: nothing here rings or decays slowly, because this is a
   * removal, not a death.
   */
  defenderRemoved: {
    wave: 'triangle', freqStart: 360, freqEnd: 215, duration: 0.10, gain: 0.5, noise: false,
    layers: [
      { offset: 0.015, wave: 'sawtooth', freqStart: 1800, freqEnd: 650, duration: 0.05, gain: 0.30, noise: true },
    ],
  },
  // Firing: quick upward blip.
  projectileFired:  { wave: 'square',   freqStart: 640, freqEnd: 880, duration: 0.06, gain: 0.18, noise: false },
  // Enemy taking damage: dull tick.
  enemyHit:         { wave: 'triangle', freqStart: 320, freqEnd: 240, duration: 0.07, gain: 0.25, noise: false },
  // Enemy death: short noisy squelch, falling a fifth over an octave.
  enemyDied:        { wave: 'sawtooth', freqStart: 660, freqEnd: 220, duration: 0.22, gain: 0.4, noise: true  },
  // Boss death: long roar, falling two octaves.
  bossDied:         { wave: 'sawtooth', freqStart: 880, freqEnd: 220, duration: 0.9,  gain: 0.6, noise: true  },
  // Collecting energy: bright rising ping.
  energyCollected:  { wave: 'sine',     freqStart: 880, freqEnd: 1320, duration: 0.15, gain: 0.35, noise: false },
  /**
   * Collecting a chest: a rising major arpeggio, C5-E5-G5-C6, with a short
   * sparkle on the top note.
   *
   * Stepped notes rather than a slide, for the reason waveStarted was rebuilt
   * that way - a glide reads as a machine, discrete notes read as a fanfare.
   * The whole figure sits between 523Hz and 4.2kHz, so nothing here depends on
   * bass a laptop cannot reproduce (see ON PITCH above).
   */
  treasureCollected: {
    wave: 'sine', freqStart: 523, freqEnd: 659, duration: 0.12, gain: 0.30, noise: false,
    layers: [
      { offset: 0.10, wave: 'sine', freqStart: 659, freqEnd: 784, duration: 0.12, gain: 0.30, noise: false },
      { offset: 0.20, wave: 'sine', freqStart: 784, freqEnd: 1047, duration: 0.26, gain: 0.34, noise: false },
      // The shimmer on arrival. Bandpassed noise, quiet enough to be texture on
      // the top note rather than a hiss of its own.
      { offset: 0.20, wave: 'sine', freqStart: 2600, freqEnd: 4200, duration: 0.16, gain: 0.10, noise: true },
    ],
  },
  /**
   * Unlocking a defender: the same vocabulary made grander, because this is the
   * rarer event and should not sound like picking up gold. Square instead of
   * sine for a brassier fanfare body, four notes instead of three, and the top
   * note (E6) held four times as long as the steps leading to it.
   */
  defenderUnlocked: {
    wave: 'square', freqStart: 523, freqEnd: 523, duration: 0.13, gain: 0.30, noise: false,
    layers: [
      { offset: 0.13, wave: 'square', freqStart: 784, freqEnd: 784, duration: 0.13, gain: 0.32, noise: false },
      { offset: 0.26, wave: 'square', freqStart: 1047, freqEnd: 1047, duration: 0.15, gain: 0.34, noise: false },
      { offset: 0.42, wave: 'square', freqStart: 1319, freqEnd: 1319, duration: 0.44, gain: 0.36, noise: false },
      { offset: 0.42, wave: 'sine', freqStart: 3000, freqEnd: 5000, duration: 0.30, gain: 0.12, noise: true },
    ],
  },
  // Rejected action: dull buzz.
  deployRejected:   { wave: 'square',   freqStart: 280, freqEnd: 240, duration: 0.14, gain: 0.25, noise: false },
  // Base hit: urgent alarm.
  baseDamaged:      { wave: 'sawtooth', freqStart: 440, freqEnd: 220, duration: 0.4,  gain: 0.55, noise: false },
  /**
   * Wave incoming: a two-tone rising alert, E5 then B5 a fifth above.
   *
   * Replaces a 180->240Hz sawtooth that swept slowly across 0.7s with no
   * transient. The owner's verdict on that was "like somebody farting... it
   * doesnt seem to make things critical", which is an accurate reading of what
   * it was: a low buzzy drone rising gradually is close to a literal recipe
   * for the sound he named, and it sat right at the edge of what a laptop
   * reproduces besides.
   *
   * An alert is not a drone. What carries the meaning is stepped notes rather
   * than a slide, a clear rise, and pitches high enough to cut through a busy
   * wave - the same reasons real warning signals are two-tone. Squares because
   * their harmonic density is what survives a small speaker.
   */
  waveStarted: {
    wave: 'square', freqStart: 660, freqEnd: 660, duration: 0.16, gain: 0.36, noise: false,
    layers: [
      { offset: 0.18, wave: 'square', freqStart: 990, freqEnd: 990, duration: 0.34, gain: 0.45, noise: false },
    ],
  },
  /**
   * Boss wave: the same alert vocabulary inverted - A4 then D4 below it, over
   * a sustained A3 that gives the sting its weight.
   *
   * The old sting was a 110->90Hz sawtooth, whose fundamental sits under the
   * laptop rolloff throughout. That one was not silent the way a bandpassed
   * noise burst would be - a sawtooth still speaks through its harmonics - but
   * it arrived as a thin buzz with its body missing, and it shared the slow
   * low falling-sawtooth character the owner rejected in waveStarted. Redone
   * for the same reasons, in the same language, so a player learns one shape:
   * rising means a wave, falling means the thing to be afraid of. The weight
   * comes from the low note being sustained and stacked, not from pitching the
   * sting into the floor - A3 at 220Hz is the lowest note here.
   */
  bossWaveStarted: {
    wave: 'sawtooth', freqStart: 440, freqEnd: 440, duration: 0.30, gain: 0.42, noise: false,
    layers: [
      { offset: 0.32, wave: 'sawtooth', freqStart: 330, freqEnd: 330, duration: 0.38, gain: 0.40, noise: false },
      { offset: 0.32, wave: 'sawtooth', freqStart: 220, freqEnd: 220, duration: 0.85, gain: 0.38, noise: false },
    ],
  },
  // Victory: rising fanfare note.
  levelWon:         { wave: 'triangle', freqStart: 523, freqEnd: 1046, duration: 0.8, gain: 0.5, noise: false },
  // Defeat: descending tone - an octave down, mirroring levelWon's octave up.
  levelLost:        { wave: 'triangle', freqStart: 440, freqEnd: 220, duration: 1.1,  gain: 0.5, noise: false },
};

export const SFX_IDS = Object.keys(SFX);

/**
 * Expands a recipe into the layers that will actually be rendered, base layer
 * first, each carrying an explicit `offset`.
 *
 * Exported rather than kept inside AudioManager because the audibility checks
 * have to inspect the SAME layers playback uses. A second, test-local
 * expansion would be free to disagree with the renderer, and that is the exact
 * shape of the bug this file's header describes: assertions that passed
 * against something other than what the player heard.
 *
 * A recipe with no `layers` expands to itself at offset 0, so every existing
 * single-source recipe flows through unchanged.
 */
export function recipeLayers(recipe) {
  if (!recipe) return [];
  const { layers, ...base } = recipe;
  return [
    { ...base, offset: 0 },
    ...(layers ?? []).map((layer) => ({ offset: 0, ...layer })),
  ];
}

/**
 * How long the whole sound occupies a voice slot: the end of the last layer to
 * finish, which is not necessarily the last one declared and is never just the
 * base duration.
 */
export function recipeSpan(recipe) {
  const layers = recipeLayers(recipe);
  if (layers.length === 0) return 0;
  return Math.max(...layers.map((layer) => layer.offset + layer.duration));
}
