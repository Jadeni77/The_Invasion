import { SFX } from './SfxLibrary.js';

/**
 * One signature recipe per unit - that unit's voice.
 *
 * Hit and death sounds are DERIVED from the signature (see VARIANTS) rather than
 * authored separately, so a unit is recognisable as itself whether it is firing,
 * being hit, or dying. Recipe shape matches SfxLibrary.
 *
 * Barricade, EnergyGenerator, FireBlast and IceBomb never fire a projectile, so
 * their signatures are tuned for how the derived death variant reads.
 */
export const UNIT_VOICES = {
  // --- Defenders ---
  BasicDefender:    { wave: 'square',   freqStart: 640,  freqEnd: 880,  duration: 0.06, gain: 0.18, noise: false },
  HealerDefender:   { wave: 'sine',     freqStart: 660,  freqEnd: 990,  duration: 0.18, gain: 0.28, noise: false },
  GrenadeDefender:  { wave: 'sawtooth', freqStart: 220,  freqEnd: 110,  duration: 0.14, gain: 0.40, noise: true  },
  BarricadeDefender:{ wave: 'triangle', freqStart: 160,  freqEnd: 120,  duration: 0.20, gain: 0.30, noise: false },
  EnergyGenerator:  { wave: 'sine',     freqStart: 520,  freqEnd: 780,  duration: 0.16, gain: 0.22, noise: false },
  Sniper:           { wave: 'square',   freqStart: 1400, freqEnd: 700,  duration: 0.05, gain: 0.30, noise: false },
  Mortar:           { wave: 'sawtooth', freqStart: 120,  freqEnd: 60,   duration: 0.30, gain: 0.50, noise: true  },
  FrostArcher:      { wave: 'triangle', freqStart: 1100, freqEnd: 1500, duration: 0.12, gain: 0.22, noise: false },
  FireBlast:        { wave: 'sawtooth', freqStart: 300,  freqEnd: 80,   duration: 0.40, gain: 0.50, noise: true  },
  IceBomb:          { wave: 'sine',     freqStart: 900,  freqEnd: 300,  duration: 0.35, gain: 0.40, noise: true  },

  // --- Enemies ---
  BasicEnemy:       { wave: 'sawtooth', freqStart: 300,  freqEnd: 180,  duration: 0.12, gain: 0.25, noise: true  },
  FastEnemy:        { wave: 'square',   freqStart: 520,  freqEnd: 380,  duration: 0.08, gain: 0.20, noise: false },
  TankEnemy:        { wave: 'sawtooth', freqStart: 150,  freqEnd: 90,   duration: 0.22, gain: 0.40, noise: true  },
  BombEnemy:        { wave: 'sawtooth', freqStart: 260,  freqEnd: 70,   duration: 0.30, gain: 0.45, noise: true  },
  RangeEnemy:       { wave: 'triangle', freqStart: 420,  freqEnd: 300,  duration: 0.10, gain: 0.22, noise: false },
  ShieldEnemy:      { wave: 'square',   freqStart: 260,  freqEnd: 200,  duration: 0.16, gain: 0.30, noise: true  },
  HealerEnemy:      { wave: 'sine',     freqStart: 600,  freqEnd: 420,  duration: 0.16, gain: 0.25, noise: false },
  SplitterEnemy:    { wave: 'sawtooth', freqStart: 380,  freqEnd: 220,  duration: 0.14, gain: 0.28, noise: true  },
  MiniEnemy:        { wave: 'square',   freqStart: 700,  freqEnd: 560,  duration: 0.07, gain: 0.16, noise: false },
  SwarmLeader:      { wave: 'sawtooth', freqStart: 340,  freqEnd: 240,  duration: 0.18, gain: 0.30, noise: true  },
  EMPEnemy:         { wave: 'square',   freqStart: 800,  freqEnd: 200,  duration: 0.20, gain: 0.30, noise: false },
  VampireEnemy:     { wave: 'triangle', freqStart: 340,  freqEnd: 200,  duration: 0.20, gain: 0.28, noise: false },
  GhostEnemy:       { wave: 'sine',     freqStart: 500,  freqEnd: 260,  duration: 0.28, gain: 0.22, noise: false },
  BerserkerEnemy:   { wave: 'sawtooth', freqStart: 240,  freqEnd: 140,  duration: 0.20, gain: 0.42, noise: true  },
  NecromancerEnemy: { wave: 'triangle', freqStart: 200,  freqEnd: 130,  duration: 0.30, gain: 0.35, noise: false },
  AssassinEnemy:    { wave: 'square',   freqStart: 900,  freqEnd: 500,  duration: 0.07, gain: 0.25, noise: false },
  MageEnemy:        { wave: 'sine',     freqStart: 700,  freqEnd: 460,  duration: 0.22, gain: 0.30, noise: false },
  TitanEnemy:       { wave: 'sawtooth', freqStart: 100,  freqEnd: 50,   duration: 0.40, gain: 0.55, noise: true  },
  BossEnemy:        { wave: 'sawtooth', freqStart: 130,  freqEnd: 55,   duration: 0.50, gain: 0.60, noise: true  },
};

/** How each variant transforms a unit's signature. */
export const VARIANTS = {
  fire:  { freqScale: 1,   durationScale: 1,    gainScale: 1    },
  hit:   { freqScale: 1,   durationScale: 0.35, gainScale: 0.55 },
  death: { freqScale: 0.5, durationScale: 2.5,  gainScale: 1.15 },
};

/** Generic recipes used when a unit has no voice of its own. */
const FALLBACK = {
  fire:  SFX.projectileFired,
  hit:   SFX.enemyHit,
  death: SFX.enemyDied,
};

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
/** Longest a single voice - synthesized or sampled - may occupy a slot. */
export const MAX_DURATION = 2;
const MAX_GAIN = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves a unit's voice for one variant.
 *
 * Unknown unit names fall back to the generic recipe rather than going silent or
 * throwing - a unit added later is quieter than intended, never broken.
 *
 * The optional signature parameter exists for testing derivation against a known
 * input; production callers pass two arguments (or four, to override the
 * fallback).
 *
 * The optional fallbackRecipe parameter lets a caller pick which generic sound
 * plays for an unrecognised unit. Without it, every unknown unit's death plays
 * SFX.enemyDied - which is wrong for a defender: an unrecognised defender
 * should fall back to SFX.defenderDied, not the enemy squelch. Callers that
 * omit it keep today's behaviour (FALLBACK keyed by variant).
 */
export function resolveVoice(unitName, variant, signature = UNIT_VOICES[unitName], fallbackRecipe) {
  const scale = VARIANTS[variant] ?? VARIANTS.fire;

  if (!signature) {
    // Copy rather than hand back the shared SFX/FALLBACK object by reference,
    // so a careless downstream mutation can't corrupt the shared recipe.
    return { ...(fallbackRecipe ?? FALLBACK[variant] ?? FALLBACK.fire) };
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
