import { SFX } from './SfxLibrary.js';

/* One signature recipe per sound key (see SoundGroups.js), not per unit. */
export const UNIT_VOICES = {
  projectile:       { wave: 'square',   freqStart: 640,  freqEnd: 880,  duration: 0.06, gain: 0.18, noise: false },
  artillery:        { wave: 'sawtooth', freqStart: 520,  freqEnd: 300,  duration: 0.14, gain: 0.40, noise: true  },
  /*
   * The Mortar is artillery - 天鹰火炮 / 玉米加农炮 - and artillery is three things at
   * once, which is why this is the one layered voice here.
   */
  mortar: {
    wave: 'sawtooth', freqStart: 3200, freqEnd: 900, duration: 0.05, gain: 0.28, noise: true,
    layers: [
      { offset: 0.008, wave: 'sawtooth', freqStart: 600, freqEnd: 250, duration: 0.22, gain: 0.60, noise: false },
      { offset: 0.030, wave: 'sawtooth', freqStart: 700, freqEnd: 300, duration: 0.45, gain: 0.20, noise: true },
    ],
  },
  /*
   * The shell landing - the payoff half of the Mortar's two sounds, and per
   * the owner ("the impact is the payoff") the more important half.
   */
  'mortar-impact': {
    wave: 'sawtooth', freqStart: 2800, freqEnd: 900, duration: 0.05, gain: 0.34, noise: true,
    layers: [
      { offset: 0.010, wave: 'sawtooth', freqStart: 520, freqEnd: 260, duration: 0.30, gain: 0.55, noise: false },
      { offset: 0.030, wave: 'sawtooth', freqStart: 650, freqEnd: 300, duration: 0.35, gain: 0.22, noise: true },
    ],
  },
  sniper:           { wave: 'square',   freqStart: 1400, freqEnd: 700,  duration: 0.05, gain: 0.30, noise: false },
  magic:            { wave: 'triangle', freqStart: 1100, freqEnd: 1500, duration: 0.12, gain: 0.22, noise: false },
  fire:             { wave: 'sawtooth', freqStart: 520,  freqEnd: 240,  duration: 0.40, gain: 0.50, noise: true  },
  heal:             { wave: 'sine',     freqStart: 660,  freqEnd: 990,  duration: 0.18, gain: 0.28, noise: false },
  melee:            { wave: 'triangle', freqStart: 340,  freqEnd: 220,  duration: 0.10, gain: 0.30, noise: true  },
  summon:           { wave: 'triangle', freqStart: 330,  freqEnd: 220,  duration: 0.30, gain: 0.35, noise: false },
  hit:              { wave: 'triangle', freqStart: 320,  freqEnd: 240,  duration: 0.07, gain: 0.25, noise: false },
  /*
   * The impact: ONE sound for all three waves, with the three waves authored
   * into it as layers at the offsets the waves actually land on.
   */
  'quake-impact': {
    wave: 'sawtooth', freqStart: 3400, freqEnd: 1000, duration: 0.07, gain: 0.60, noise: true,
    layers: [
      { offset: 0.015, wave: 'sawtooth', freqStart: 420, freqEnd: 260, duration: 0.38, gain: 0.58, noise: false },
      {
        offset: 0.020, wave: 'sawtooth', freqStart: 310, freqEnd: 260, duration: 0.45, gain: 0.50, noise: true,
        modulationHz: 5, modulationDepth: 0.65,
      },
      { offset: 0.050, wave: 'sawtooth', freqStart: 520, freqEnd: 270, duration: 0.60, gain: 0.16, noise: true },
      { offset: 0.200, wave: 'sawtooth', freqStart: 1000, freqEnd: 400, duration: 0.22, gain: 0.30, noise: true },
      { offset: 0.400, wave: 'sawtooth', freqStart: 800, freqEnd: 320, duration: 0.20, gain: 0.18, noise: true },
    ],
  },
  /*
   * The phase transition at 66% and 33% health: the Titan getting stronger,
   * and everything within 1500px stunned for five seconds.
   */
  'phase-change': {
    wave: 'sawtooth', freqStart: 320, freqEnd: 2400, duration: 0.28, gain: 0.32, noise: true,
    layers: [
      { offset: 0.050, wave: 'sawtooth', freqStart: 330, freqEnd: 660, duration: 0.60, gain: 0.52, noise: false },
      { offset: 0.280, wave: 'sawtooth', freqStart: 800, freqEnd: 300, duration: 0.50, gain: 0.22, noise: true },
    ],
  },
  // The death family reads light -> heavy by falling pitch, rising length and
  // rising level together. Every entry is authored so that the death variant's
  // 0.8 scale still leaves it clear of the speaker rolloff.
  'death-small':    { wave: 'sawtooth', freqStart: 650,  freqEnd: 400,  duration: 0.12, gain: 0.25, noise: true  },
  'death-medium':   { wave: 'sawtooth', freqStart: 550,  freqEnd: 340,  duration: 0.20, gain: 0.35, noise: true  },
  'death-defender': { wave: 'sawtooth', freqStart: 480,  freqEnd: 290,  duration: 0.35, gain: 0.40, noise: true  },
  titan:            { wave: 'sawtooth', freqStart: 400,  freqEnd: 270,  duration: 0.40, gain: 0.55, noise: true  },
  boss:             { wave: 'sawtooth', freqStart: 420,  freqEnd: 280,  duration: 0.50, gain: 0.60, noise: true  },
};

/* How each variant transforms a unit's signature. */
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

/* Degenerate-value guard, deliberately NOT the audibility floor. */
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
/** Longest a single voice - synthesized or sampled - may occupy a slot. */
export const MAX_DURATION = 2;
const MAX_GAIN = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* Resolves a sound key's voice for one variant. */
export function resolveVoice(soundKey, variant, signature = UNIT_VOICES[soundKey]) {
  const scale = VARIANTS[variant] ?? VARIANTS.fire;

  if (!signature) {
    // Copy rather than hand back the shared FALLBACK object by reference, so
    // a careless downstream mutation can't corrupt the shared recipe.
    return { ...(FALLBACK[variant] ?? FALLBACK.fire) };
  }

  return {
    ...scaleRecipe(signature, scale),
    // Only when the signature has layers: adding `layers: undefined` to every
    // other voice would put a meaningless key on 14 of the 15 entries.
    ...(signature.layers ? { layers: signature.layers.map((layer) => scaleLayer(layer, scale)) } : {}),
  };
}

/** Applies one variant's scale factors to a single recipe (or layer). */
function scaleRecipe(recipe, scale) {
  return {
    wave: recipe.wave,
    noise: recipe.noise,
    freqStart: clamp(recipe.freqStart * scale.freqScale, MIN_FREQ, MAX_FREQ),
    freqEnd: clamp(recipe.freqEnd * scale.freqScale, MIN_FREQ, MAX_FREQ),
    duration: clamp(recipe.duration * scale.durationScale, 0.01, MAX_DURATION),
    gain: clamp(recipe.gain * scale.gainScale, 0.001, MAX_GAIN),
    // Only when the source declares amplitude modulation (see quake-impact's
    // rumble layer and AudioManager.scheduleModulatedEnvelope): adding
    // `modulationHz: undefined` to every other recipe and layer would put a
    // meaningless key on all of them, the same reasoning `layers` below
    // already follows. Passed through UNSCALED - rate and depth are not a
    // function of pitch or duration scaling.
    ...(recipe.modulationHz ? { modulationHz: recipe.modulationHz, modulationDepth: recipe.modulationDepth } : {}),
  };
}

/*
 * As scaleRecipe, plus the offset - which scales with DURATION, not with time
 * unscaled.
 */
function scaleLayer(layer, scale) {
  return {
    ...scaleRecipe(layer, scale),
    offset: clamp((layer.offset ?? 0) * scale.durationScale, 0, MAX_DURATION),
  };
}
