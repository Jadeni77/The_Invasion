/* Synth recipes for every game sound. */
export const SFX = {
  // Placing a unit: short thunk, dropping an octave.
  defenderPlaced:   { wave: 'sine',     freqStart: 440, freqEnd: 220, duration: 0.12, gain: 0.5, noise: false },
  // Losing a unit: descending crumble.
  defenderDied:     { wave: 'sawtooth', freqStart: 540, freqEnd: 270, duration: 0.35, gain: 0.4, noise: true  },
  /*
   * Removing a deployed defender (the hammer/shovel tool): a dry,
   * wood-and-metal thunk of something being pried up and carted off.
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
  /*
   * Collecting a chest: a rising major arpeggio, C5-E5-G5-C6, with a short
   * sparkle on the top note.
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
  /*
   * Unlocking a defender: the same vocabulary made grander, because this is
   * the rarer event and should not sound like picking up gold.
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
  /* Wave incoming: a two-tone rising alert, E5 then B5 a fifth above. */
  waveStarted: {
    wave: 'square', freqStart: 660, freqEnd: 660, duration: 0.16, gain: 0.36, noise: false,
    layers: [
      { offset: 0.18, wave: 'square', freqStart: 990, freqEnd: 990, duration: 0.34, gain: 0.45, noise: false },
    ],
  },
  /*
   * Boss wave: the same alert vocabulary inverted - A4 then D4 below it, over
   * a sustained A3 that gives the sting its weight.
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

/*
 * Expands a recipe into the layers that will actually be rendered, base layer
 * first, each carrying an explicit `offset`.
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
