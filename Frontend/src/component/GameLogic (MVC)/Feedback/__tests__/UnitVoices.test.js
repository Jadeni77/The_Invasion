import { describe, it, expect } from 'vitest';
import { Mortar } from '../../DefenderUnits.js';
import * as EnemyModule from '../../EnemyUnits.js';
import * as DefenderModule from '../../DefenderUnits.js';
import { UNIT_VOICES, VARIANTS, resolveVoice } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';
import { soundKeyFor, SOUND_KEYS } from '../SoundGroups.js';

describe('voice coverage', () => {
  it('has exactly one voice per declared sound key, no more and no less', () => {
    // Two-directional check against the real SOUND_KEYS export, not a
    // hand-copied literal: a SOUND_KEYS entry missing from UNIT_VOICES would
    // silently play the generic synth fallback in game (e.g. a Task-3 key
    // added to SOUND_KEYS without a matching voice); a UNIT_VOICES entry
    // absent from SOUND_KEYS - e.g. a typo'd key like 'death-mediumm' - would
    // sit there dead, reachable by nothing. A hand-copied duplicate list
    // (this test's previous form) could drift from SOUND_KEYS in either
    // direction without the suite noticing either problem.
    expect(Object.keys(UNIT_VOICES).sort()).toEqual([...SOUND_KEYS].sort());
  });

  it('game-event sounds are served by SFX, not the voice table', () => {
    for (const id of Object.keys(SFX)) {
      expect(UNIT_VOICES).not.toHaveProperty(id);
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

describe('sounds the spec promises are distinguishable actually differ', () => {
  /**
   * With no sample files committed, every sound in the game IS its synthesized
   * recipe, so a distinction that holds only in soundKeyFor is not audible on
   * its own: two keys can resolve correctly and still carry byte-identical
   * recipes. The suite used to check only the key layer, and making
   * death-small identical to death-medium (or mortar to artillery, or boss to
   * death-medium, or summon to melee) left it green - so criteria 3 and 4
   * could fail in play with every test passing.
   *
   * These pin the distinctions the spec's success criteria name, not all 105
   * pairs: an arbitrary future regrouping of two sounds the spec never
   * promised to separate should not have to fight the suite.
   */
  const SPEC_DISTINCTIONS = [
    // Criterion 3: Mortar, Sniper, Titan and Boss stay individually recognisable.
    ['mortar', 'artillery'],
    ['mortar', 'sniper'],
    ['sniper', 'projectile'],
    ['titan', 'death-medium'],
    ['boss', 'death-medium'],
    ['titan', 'boss'],
    // Criterion 4: a small enemy and a medium enemy die with different weight.
    ['death-small', 'death-medium'],
    ['death-small', 'death-defender'],
    ['death-medium', 'death-defender'],
  ];

  it.each(SPEC_DISTINCTIONS)('%s and %s are not the same sound', (a, b) => {
    expect(UNIT_VOICES[a]).not.toEqual(UNIT_VOICES[b]);
  });

  it.each(SPEC_DISTINCTIONS)('%s and %s still differ once resolved for playback', (a, b) => {
    // The recipes could differ in a field the variant scaling then flattens,
    // so check the thing actually handed to the audio layer.
    for (const variant of ['fire', 'death']) {
      expect(resolveVoice(a, variant), `${a}/${b} as ${variant}`)
        .not.toEqual(resolveVoice(b, variant));
    }
  });

  it('death weight is ordered, not merely different', () => {
    // Criterion 4 is about audible WEIGHT: a small enemy must die lighter than
    // a medium one, and a Titan heavier than both. Inequality alone would be
    // satisfied by a small death that is longer and louder than a Titan's.
    const weight = (key) => {
      const recipe = resolveVoice(key, 'death');
      return { duration: recipe.duration, gain: recipe.gain, freq: recipe.freqStart };
    };
    const small = weight('death-small');
    const medium = weight('death-medium');
    const titan = weight('titan');

    expect(small.duration).toBeLessThan(medium.duration);
    expect(small.gain).toBeLessThan(medium.gain);
    expect(medium.duration).toBeLessThan(titan.duration);
    expect(medium.gain).toBeLessThan(titan.gain);
    // Heavier things sound lower.
    expect(titan.freq).toBeLessThan(medium.freq);
    expect(medium.freq).toBeLessThan(small.freq);
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

    // Read off VARIANTS rather than repeating the numbers: this test is about
    // resolveVoice applying the declared scales, not about what they are. The
    // values themselves are constrained by the audibility block at the end of
    // this file, which is where a change to them should have to argue its case.
    expect(death.freqStart).toBeCloseTo(signature.freqStart * VARIANTS.death.freqScale);
    expect(death.freqEnd).toBeCloseTo(signature.freqEnd * VARIANTS.death.freqScale);
    expect(death.duration).toBeCloseTo(signature.duration * VARIANTS.death.durationScale);
    expect(death.gain).toBeCloseTo(signature.gain * VARIANTS.death.gainScale);
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

describe('the melee variant', () => {
  it('is shorter and quieter than the same sound played at full length', () => {
    // Rejects: a missing VARIANTS.melee entry. resolveVoice would silently
    // fall through to VARIANTS.fire and a swing would play at full duration
    // and full gain - and EVERY other test in this suite would still pass,
    // because the sound key still resolves and the recipe is still well
    // formed. This comparison is the only thing that notices.
    const fire = resolveVoice('melee', 'fire');
    const melee = resolveVoice('melee', 'melee');

    expect(melee.duration).toBeLessThan(fire.duration);
    expect(melee.gain).toBeLessThan(fire.gain);
  });

  it('derives from the melee signature by the declared scale factors', () => {
    const signature = UNIT_VOICES.melee;
    const melee = resolveVoice('melee', 'melee');

    expect(melee.duration).toBeCloseTo(signature.duration * 0.35);
    expect(melee.gain).toBeCloseTo(signature.gain * 0.55);
    expect(melee.freqStart).toBe(signature.freqStart);
    expect(melee.freqEnd).toBe(signature.freqEnd);
    expect(melee.wave).toBe(signature.wave);
    expect(melee.noise).toBe(signature.noise);
  });

  it('stays inside the valid ranges for every sound key', () => {
    for (const name of Object.keys(UNIT_VOICES)) {
      const recipe = resolveVoice(name, 'melee');
      expect(recipe.duration, `${name} duration`).toBeGreaterThan(0);
      expect(recipe.duration, `${name} duration`).toBeLessThanOrEqual(2);
      expect(recipe.gain, `${name} gain`).toBeGreaterThan(0);
      expect(recipe.gain, `${name} gain`).toBeLessThanOrEqual(1);
    }
  });
});

describe('resolveVoice has no caller-supplied fallback override', () => {
  // resolveVoice used to take a fourth `fallbackRecipe` parameter so a caller
  // could pick which generic sound played for an unrecognised unit - e.g. an
  // unrecognised defender falling back to SFX.defenderDied instead of the
  // enemy squelch. That parameter was removed: it was only ever reached when
  // playUnitVoice passed a raw, unresolved unit name, but playUnitVoice now
  // always resolves through soundKeyFor first (Task 2), which total-maps
  // every unit - recognised or not - onto one of the 15 declared sound keys,
  // all of which have a UNIT_VOICES entry. A recognised defender therefore
  // reaches its own distinct sound via soundKeyFor mapping it to the
  // fully-populated 'death-defender' key (see SoundGroups.test.js's
  // 'defenders share one death sound'), not via an override at this layer.
  // resolveVoice itself now has exactly one generic fallback per variant,
  // with no way for a caller to redirect it.
  //
  // Two tests that used to sit here were removed on review: one asserted the
  // same generic-fallback fact already covered by 'falls back to a generic
  // recipe for an unknown unit' above (line 100-104); the other compared
  // resolveVoice('sniper', 'death', undefined, X) to resolveVoice('sniper',
  // 'death') using identical first three arguments on both sides, so it could
  // not fail under any implementation, including one that fully restored
  // fallbackRecipe. Only a test that can fail earns its place.
  it('ignores a stray extra argument rather than reviving the removed override', () => {
    // Rejects: an implementation that reads a 4th parameter back in (e.g. if
    // someone reintroduces `fallbackRecipe` to fix a future bug without
    // re-checking whether it is still needed). If resolveVoice honoured a 4th
    // argument again, this would return SFX.defenderDied instead of the
    // generic SFX.enemyDied and the test would fail.
    expect(resolveVoice('NoSuchDefender', 'death', undefined, SFX.defenderDied)).toEqual(
      SFX.enemyDied,
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
  // The config key this test's premise rests on - vite.config.js's
  // `esbuild: { keepNames: true }` - is asserted in viteConfig.test.js, which
  // needs module mocks this file should not carry. A vitest run is never
  // minified, so nothing here can see that key go missing.
  it('recognises a real Mortar instance and does not fall back to the generic sound', () => {
    const mortar = new Mortar(0, 0, { level: 1, image: null });

    const soundKey = soundKeyFor(mortar.constructor.name, 'death');
    const death = resolveVoice(soundKey, 'death');

    expect(mortar.constructor.name).toBe('Mortar');
    expect(soundKey).toBe('death-defender');
    expect(death).not.toEqual(SFX.enemyDied);
    expect(death.wave).toBe(UNIT_VOICES['death-defender'].wave);
    expect(death.noise).toBe(UNIT_VOICES['death-defender'].noise);
    expect(death.freqStart).toBeCloseTo(
      UNIT_VOICES['death-defender'].freqStart * VARIANTS.death.freqScale,
    );
  });
});

/**
 * Playtest fix, bug 2: the owner reported no enemy death sound and no Mortar
 * sound. Neither was missing - both were being rendered below the frequency a
 * laptop speaker reproduces.
 *
 * This matters far more for the death family and the big guns than for
 * anything else in the table, because they are the `noise: true` recipes.
 * AudioManager.createNoiseSource renders those as white noise through a
 * BANDPASS filter whose centre sweeps freqStart -> freqEnd, so the sweep is
 * not merely the fundamental - it is the entire spectrum of the sound. A tone
 * recipe pitched at 130Hz still speaks through its harmonics; a bandpassed
 * noise burst centred at 30Hz has nothing above the cutoff to be heard by.
 *
 * The floor below is written as a literal on purpose. Reading it out of
 * UnitVoices.js would make this test pass against whatever value the module
 * happened to hold, which is the failure mode that let 60Hz ship.
 */
describe('noise voices stay above what a laptop speaker reproduces', () => {
  const LAPTOP_SPEAKER_FLOOR_HZ = 200;

  /** Every unit class either module exports, as the game names it in a sound event. */
  const unitNames = [...Object.entries(EnemyModule), ...Object.entries(DefenderModule)]
    .filter(([, exported]) => typeof exported === 'function' && exported.prototype)
    .map(([name]) => name);

  /**
   * Every (sound key, variant) pair the game can actually reach, derived by
   * running soundKeyFor over those exports. Checking the raw cross product of
   * UNIT_VOICES x VARIANTS instead would flag combinations no unit produces -
   * 'melee' played as a death, say - and force the table to satisfy a
   * constraint the game never exercises.
   */
  const reachable = [];
  for (const unitName of unitNames) {
    for (const variant of Object.keys(VARIANTS)) {
      const key = soundKeyFor(unitName, variant);
      if (!reachable.some(([k, v]) => k === key && v === variant)) reachable.push([key, variant]);
    }
  }

  it('derives the whole death family from the unit exports', () => {
    // Guards the derivation: a filter that matched nothing would make every
    // it.each below vacuous.
    const deathKeys = reachable.filter(([, variant]) => variant === 'death').map(([key]) => key);
    expect([...deathKeys].sort()).toEqual(
      ['boss', 'death-defender', 'death-medium', 'death-small', 'titan'],
    );
  });

  const reachableNoiseVoices = reachable.filter(([key]) => UNIT_VOICES[key].noise);

  it.each(reachableNoiseVoices)('%s played as a %s sweeps entirely above the floor', (key, variant) => {
    const voice = resolveVoice(key, variant);

    expect(voice.freqStart, `${key}/${variant} freqStart`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
    expect(voice.freqEnd, `${key}/${variant} freqEnd`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
  });

  it('the Mortar the owner could not hear is audible', () => {
    // Named separately from the it.each above because this is the reported
    // symptom, and because mortar takes no variant scaling - it was inaudible
    // in its raw recipe, independently of the death variant.
    const mortar = resolveVoice(soundKeyFor('Mortar', 'fire'), 'fire');

    expect(mortar.freqEnd).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
  });

  it('a death sounds heavy because it is long and loud, not because it is subsonic', () => {
    // Rejects: restoring weight by dropping freqScale again. Length and level
    // are what a laptop speaker can actually deliver; an octave down is not.
    expect(VARIANTS.death.durationScale).toBeGreaterThan(1);
    expect(VARIANTS.death.gainScale).toBeGreaterThan(1);
    expect(VARIANTS.death.freqScale).toBeLessThan(1);
    expect(VARIANTS.death.freqScale).toBeGreaterThanOrEqual(0.75);
  });

  it('keeps the death family ordered from lightest to heaviest', () => {
    const weight = (key) => resolveVoice(key, 'death');
    const lightToHeavy = ['death-small', 'death-medium', 'death-defender'];

    for (let i = 1; i < lightToHeavy.length; i++) {
      const lighter = weight(lightToHeavy[i - 1]);
      const heavier = weight(lightToHeavy[i]);
      const label = `${lightToHeavy[i - 1]} vs ${lightToHeavy[i]}`;

      expect(heavier.duration, label).toBeGreaterThan(lighter.duration);
      expect(heavier.gain, label).toBeGreaterThan(lighter.gain);
      expect(heavier.freqStart, label).toBeLessThan(lighter.freqStart);
    }

    // Titan and Boss are the heaviest deaths in the game, but they are not
    // ordered against each other: the spec asks only that both outweigh an
    // ordinary death, and they get there differently - the Titan by pitch, the
    // Boss by length and level.
    const defender = weight('death-defender');
    for (const key of ['titan', 'boss']) {
      const heaviest = weight(key);
      expect(heaviest.duration, key).toBeGreaterThan(defender.duration);
      expect(heaviest.gain, key).toBeGreaterThan(defender.gain);
      expect(heaviest.freqStart, key).toBeLessThan(defender.freqStart);
    }
  });
});
