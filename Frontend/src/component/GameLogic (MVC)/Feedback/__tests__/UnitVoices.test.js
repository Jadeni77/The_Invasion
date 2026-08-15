import { describe, it, expect } from 'vitest';
import { Mortar } from '../../DefenderUnits.js';
import { UNIT_VOICES, resolveVoice } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';
import { soundKeyFor } from '../SoundGroups.js';

/**
 * Every sound key soundKeyFor can resolve a unit to (SoundGroups.SOUND_KEYS
 * minus the game-event keys served by SFX rather than the voice table).
 */
const UNIT_SOUND_KEYS = [
  'projectile', 'artillery', 'mortar', 'sniper', 'magic', 'fire', 'heal',
  'melee', 'summon', 'hit', 'death-small', 'death-medium', 'death-defender',
  'titan', 'boss',
];

describe('voice coverage', () => {
  it('every unit sound key has a voice', () => {
    const missing = UNIT_SOUND_KEYS.filter((key) => !UNIT_VOICES[key]);
    expect(missing, `keys without a voice: ${missing.join(', ')}`).toEqual([]);
  });

  it('game-event sounds are served by SFX, not the voice table', () => {
    for (const key of ['energy', 'base-damaged', 'won', 'lost']) {
      expect(UNIT_VOICES).not.toHaveProperty(key);
    }
  });
});

describe('voice recipes are valid', () => {
  it.each(Object.entries(UNIT_VOICES))('%s is well formed', (name, recipe) => {
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(recipe.wave);
    expect(recipe.freqStart).toBeGreaterThan(0);
    expect(recipe.freqEnd).toBeGreaterThan(0);
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(1);
    expect(typeof recipe.noise).toBe('boolean');
  });
});

describe('resolveVoice', () => {
  it('returns the signature unchanged for the fire variant', () => {
    expect(resolveVoice('sniper', 'fire')).toEqual(UNIT_VOICES.sniper);
  });

  it('shortens and quietens the hit variant', () => {
    const signature = UNIT_VOICES.sniper;
    const hit = resolveVoice('sniper', 'hit');

    expect(hit.duration).toBeCloseTo(signature.duration * 0.35);
    expect(hit.gain).toBeCloseTo(signature.gain * 0.55);
    expect(hit.freqStart).toBe(signature.freqStart);
  });

  it('pitches down and stretches the death variant', () => {
    const signature = UNIT_VOICES.sniper;
    const death = resolveVoice('sniper', 'death');

    expect(death.freqStart).toBeCloseTo(signature.freqStart * 0.5);
    expect(death.freqEnd).toBeCloseTo(signature.freqEnd * 0.5);
    expect(death.duration).toBeCloseTo(signature.duration * 2.5);
    expect(death.gain).toBeCloseTo(signature.gain * 1.15);
  });

  it('keeps the waveform and noise flag across variants', () => {
    const signature = UNIT_VOICES.mortar;
    for (const variant of ['fire', 'hit', 'death']) {
      const recipe = resolveVoice('mortar', variant);
      expect(recipe.wave).toBe(signature.wave);
      expect(recipe.noise).toBe(signature.noise);
    }
  });

  it('never derives a recipe outside the valid ranges', () => {
    for (const name of Object.keys(UNIT_VOICES)) {
      for (const variant of ['fire', 'hit', 'death']) {
        const recipe = resolveVoice(name, variant);
        expect(recipe.duration, `${name}/${variant} duration`).toBeGreaterThan(0);
        expect(recipe.duration, `${name}/${variant} duration`).toBeLessThanOrEqual(2);
        expect(recipe.gain, `${name}/${variant} gain`).toBeGreaterThan(0);
        expect(recipe.gain, `${name}/${variant} gain`).toBeLessThanOrEqual(1);
        expect(recipe.freqStart, `${name}/${variant} freqStart`).toBeGreaterThanOrEqual(20);
        expect(recipe.freqEnd, `${name}/${variant} freqEnd`).toBeGreaterThanOrEqual(20);
        expect(recipe.freqStart, `${name}/${variant} freqStart`).toBeLessThanOrEqual(20000);
      }
    }
  });

  it('clamps a signature that would derive out of range', () => {
    // duration 1.5 * 2.5 = 3.75, above the 2s ceiling; gain 0.95 * 1.15 = 1.09, above 1.
    const extreme = { wave: 'sine', freqStart: 30, freqEnd: 25, duration: 1.5, gain: 0.95, noise: false };
    const death = resolveVoice('__test__', 'death', extreme);

    expect(death.duration).toBe(2);
    expect(death.gain).toBe(1);
    expect(death.freqEnd).toBeGreaterThanOrEqual(20);
  });

  it('falls back to a generic recipe for an unknown unit', () => {
    expect(resolveVoice('NoSuchUnit', 'fire')).toEqual(SFX.projectileFired);
    expect(resolveVoice('NoSuchUnit', 'hit')).toEqual(SFX.enemyHit);
    expect(resolveVoice('NoSuchUnit', 'death')).toEqual(SFX.enemyDied);
  });

  it('does not throw on a null or undefined unit name', () => {
    expect(() => resolveVoice(null, 'death')).not.toThrow();
    expect(() => resolveVoice(undefined, 'fire')).not.toThrow();
  });

  it('falls back to the fire variant for an unknown variant name', () => {
    expect(resolveVoice('sniper', 'nonsense')).toEqual(UNIT_VOICES.sniper);
  });

  it('returns a copy of the fallback recipe, not the shared SFX object', () => {
    const fallback = resolveVoice('NoSuchUnit', 'death');
    expect(fallback).not.toBe(SFX.enemyDied);

    fallback.gain = 999;
    expect(SFX.enemyDied.gain).not.toBe(999);
  });
});

describe('resolveVoice fallback override (unknown-unit sound selection)', () => {
  it('uses the caller-supplied fallback recipe for an unknown unit, ignoring the variant default', () => {
    const recipe = resolveVoice('NoSuchDefender', 'death', undefined, SFX.defenderDied);
    expect(recipe).toEqual(SFX.defenderDied);
    expect(recipe).not.toEqual(SFX.enemyDied);
  });

  it('hands back a copy of the supplied fallback, not the shared object', () => {
    const recipe = resolveVoice('NoSuchDefender', 'death', undefined, SFX.defenderDied);
    expect(recipe).not.toBe(SFX.defenderDied);

    recipe.gain = 999;
    expect(SFX.defenderDied.gain).not.toBe(999);
  });

  it('keeps the enemy fallback (SFX.enemyDied) when no override is supplied', () => {
    expect(resolveVoice('NoSuchEnemy', 'death')).toEqual(SFX.enemyDied);
  });

  it('a known unit ignores the fallback override entirely, since it never needs it', () => {
    expect(resolveVoice('sniper', 'death', undefined, SFX.defenderDied)).toEqual(
      resolveVoice('sniper', 'death'),
    );
  });
});

describe('resolveVoice against a real instance (production minification guard)', () => {
  /**
   * Every other test in this file derives the lookup key from a string
   * literal, which is exactly why 340 green tests were once compatible with
   * the feature being a complete no-op: esbuild's production minifier renames
   * classes (`Mortar` -> `Ef`), so `constructor.name` no longer matches, and
   * every unit silently falls back to the generic sound. `keepNames: true` in
   * vite.config.js is what prevents that renaming.
   *
   * Now that UNIT_VOICES is keyed by sound key rather than unit class name,
   * the class-name lookup this guards against lives in soundKeyFor
   * (SoundGroups.js), not in resolveVoice directly - so this test exercises
   * the full production path (soundKeyFor then resolveVoice) against a REAL
   * instance's constructor.name rather than a literal that can't drift.
   */
  it('recognises a real Mortar instance and does not fall back to the generic sound', () => {
    const mortar = new Mortar(0, 0, { level: 1, image: null });

    const soundKey = soundKeyFor(mortar.constructor.name, 'death');
    const death = resolveVoice(soundKey, 'death');

    expect(mortar.constructor.name).toBe('Mortar');
    expect(soundKey).toBe('death-defender');
    expect(death).not.toEqual(SFX.enemyDied);
    expect(death.wave).toBe(UNIT_VOICES['death-defender'].wave);
    expect(death.noise).toBe(UNIT_VOICES['death-defender'].noise);
    expect(death.freqStart).toBeCloseTo(UNIT_VOICES['death-defender'].freqStart * 0.5);
  });
});
