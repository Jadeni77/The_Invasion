import { describe, it, expect } from 'vitest';
import * as DefenderUnits from '../../DefenderUnits.js';
import * as EnemyUnits from '../../EnemyUnits.js';
import { UNIT_VOICES, resolveVoice } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';

/** Base classes are abstract - they never reach a feedback event on their own. */
const BASE_CLASSES = ['DefenderUnit', 'Enemy'];

/** True only for `class` declarations, not plain exported functions. */
function isClass(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

/**
 * Every concrete unit class the game can instantiate.
 *
 * The isClass filter matters: DefenderUnits.js also exports the plain function
 * isConsumableSpell, which a bare `typeof === 'function'` check would count as a
 * unit and then demand a voice for.
 */
function allUnitNames() {
  const modules = { ...DefenderUnits, ...EnemyUnits };
  return Object.keys(modules)
    .filter((name) => isClass(modules[name]))
    .filter((name) => !BASE_CLASSES.includes(name));
}

describe('voice coverage', () => {
  it('every concrete unit class has a voice', () => {
    const missing = allUnitNames().filter((name) => !UNIT_VOICES[name]);
    expect(missing, `units without a voice: ${missing.join(', ')}`).toEqual([]);
  });

  it('covers all 29 units', () => {
    expect(allUnitNames()).toHaveLength(29);
  });

  it('defines no voice for a class that does not exist', () => {
    const known = new Set(allUnitNames());
    const extra = Object.keys(UNIT_VOICES).filter((name) => !known.has(name));
    expect(extra, `voices for unknown classes: ${extra.join(', ')}`).toEqual([]);
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
    expect(resolveVoice('Sniper', 'fire')).toEqual(UNIT_VOICES.Sniper);
  });

  it('shortens and quietens the hit variant', () => {
    const signature = UNIT_VOICES.Sniper;
    const hit = resolveVoice('Sniper', 'hit');

    expect(hit.duration).toBeCloseTo(signature.duration * 0.35);
    expect(hit.gain).toBeCloseTo(signature.gain * 0.55);
    expect(hit.freqStart).toBe(signature.freqStart);
  });

  it('pitches down and stretches the death variant', () => {
    const signature = UNIT_VOICES.Sniper;
    const death = resolveVoice('Sniper', 'death');

    expect(death.freqStart).toBeCloseTo(signature.freqStart * 0.5);
    expect(death.freqEnd).toBeCloseTo(signature.freqEnd * 0.5);
    expect(death.duration).toBeCloseTo(signature.duration * 2.5);
    expect(death.gain).toBeCloseTo(signature.gain * 1.15);
  });

  it('keeps the waveform and noise flag across variants', () => {
    const signature = UNIT_VOICES.Mortar;
    for (const variant of ['fire', 'hit', 'death']) {
      const recipe = resolveVoice('Mortar', variant);
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
    expect(resolveVoice('Sniper', 'nonsense')).toEqual(UNIT_VOICES.Sniper);
  });
});
