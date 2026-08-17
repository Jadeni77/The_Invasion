import { describe, it, expect } from 'vitest';
import { Mortar } from '../../DefenderUnits.js';
import * as EnemyModule from '../../EnemyUnits.js';
import * as DefenderModule from '../../DefenderUnits.js';
import { UNIT_VOICES, VARIANTS, MAX_DURATION, resolveVoice } from '../UnitVoices.js';
import { SFX, recipeLayers, recipeSpan } from '../SfxLibrary.js';
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

describe('resolveVoice carries layers through', () => {
  /**
   * resolveVoice builds its result field by field, so anything it does not
   * name is DROPPED. A layered signature whose layers it forgot would resolve
   * to its base layer alone - a Mortar reduced to its crack, with no body and
   * no tail - and every existing test here would still pass, because they all
   * read the top-level fields.
   */
  const LAYERED = {
    wave: 'square', freqStart: 800, freqEnd: 400, duration: 0.10, gain: 0.5, noise: true,
    layers: [{ offset: 0.04, wave: 'sawtooth', freqStart: 600, freqEnd: 300, duration: 0.2, gain: 0.4, noise: false }],
  };

  it('returns the layers untouched for the fire variant', () => {
    expect(resolveVoice('__layered__', 'fire', LAYERED)).toEqual(LAYERED);
  });

  it('scales each layer by the variant, exactly as it scales the base', () => {
    const death = resolveVoice('__layered__', 'death', LAYERED);
    const [layer] = death.layers;
    const scale = VARIANTS.death;

    expect(death.layers).toHaveLength(1);
    expect(layer.freqStart).toBeCloseTo(600 * scale.freqScale);
    expect(layer.freqEnd).toBeCloseTo(300 * scale.freqScale);
    expect(layer.duration).toBeCloseTo(0.2 * scale.durationScale);
    expect(layer.gain).toBeCloseTo(0.4 * scale.gainScale);
    expect(layer.wave).toBe('sawtooth');
    expect(layer.noise).toBe(false);
  });

  it('scales a layer offset with the duration, keeping the sound in proportion', () => {
    // A stretched sound whose offsets stayed fixed would bunch every layer up
    // against the front and lose its shape.
    const death = resolveVoice('__layered__', 'death', LAYERED);
    expect(death.layers[0].offset).toBeCloseTo(0.04 * VARIANTS.death.durationScale);
  });

  it('does not invent a layers key on an unlayered signature', () => {
    // Guards `expect(resolveVoice('sniper','fire')).toEqual(UNIT_VOICES.sniper)`
    // against passing only because toEqual ignores an undefined property.
    expect(Object.keys(resolveVoice('sniper', 'fire'))).not.toContain('layers');
  });

  it('does not alias the signature’s layer objects', () => {
    const resolved = resolveVoice('__layered__', 'fire', LAYERED);
    resolved.layers[0].gain = 999;
    expect(LAYERED.layers[0].gain).toBe(0.4);
  });

  it('leaves the generic fallback unlayered for an unknown unit', () => {
    expect(resolveVoice('NoSuchUnit', 'fire')).not.toHaveProperty('layers');
  });
});

describe('the Mortar sounds like artillery, not one burst', () => {
  /**
   * The owner asked for 天鹰火炮 / 玉米加农炮 - a launch, not a hiss. That shape
   * is a sharp transient, a midrange body that drops in pitch, and a tail that
   * decays after both. One source cannot be all three at once, which is the
   * whole reason layering exists, so these assert the SHAPE rather than the
   * exact numbers: retuning a gain should not have to fight the suite, but
   * flattening the Mortar back to a single burst should.
   */
  const mortar = () => resolveVoice(soundKeyFor('Mortar', 'fire'), 'fire');

  it('has a transient, a body and a tail', () => {
    expect(recipeLayers(mortar())).toHaveLength(3);
  });

  it('opens with the shortest, highest layer - the crack', () => {
    const [crack, ...rest] = recipeLayers(mortar());

    expect(crack.offset).toBe(0);
    expect(crack.noise, 'a crack is broadband, not a pitched note').toBe(true);
    for (const layer of rest) {
      expect(crack.duration, 'the crack must be the shortest layer').toBeLessThan(layer.duration);
      expect(crack.freqStart, 'the crack must be the highest layer').toBeGreaterThan(layer.freqStart);
    }
  });

  it('carries its body on a pitched layer that drops', () => {
    // The thing that reads as weight on a laptop: a tone whose harmonics
    // survive the rolloff, falling rather than rising. A noise-only Mortar is
    // the hiss the owner reported.
    const body = recipeLayers(mortar()).find((layer) => !layer.noise);

    expect(body, 'the Mortar needs a pitched layer').toBeDefined();
    expect(body.freqEnd).toBeLessThan(body.freqStart);
    expect(body.freqStart / body.freqEnd, 'the drop must be audible as a drop').toBeGreaterThan(1.5);
  });

  it('decays into a tail that outlasts everything else', () => {
    const layers = recipeLayers(mortar());
    const ends = layers.map((layer) => layer.offset + layer.duration);
    const tail = layers[ends.indexOf(Math.max(...ends))];

    expect(tail.offset, 'the tail follows the crack rather than opening the sound').toBeGreaterThan(0);
    expect(Math.max(...ends)).toBeGreaterThan(2 * Math.min(...ends));
  });

  it('still fits in one voice slot', () => {
    expect(recipeSpan(mortar())).toBeLessThanOrEqual(2);
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

  /**
   * The check that would have caught the original bug directly.
   *
   * The 25-90Hz Mortar and death family shipped because nothing asserted where
   * a recipe's energy actually sat - the suite only checked that frequencies
   * were positive and finite. Layering multiplies the exposure: a three-layer
   * sound has three chances to put its weight under the speaker, and two of
   * them are invisible to every existing check, which reads only the top-level
   * fields.
   *
   * Derived by walking BOTH recipe tables and expanding through the same
   * recipeLayers() AudioManager plays, so a layered sound added to either
   * table is covered the day it is written, and the layers checked here are
   * provably the layers rendered. The floor is a literal for the same reason
   * the block above gives: reading it from the module under test would make
   * the assertion true by construction.
   */
  const ALL_TABLES = { ...SFX, ...UNIT_VOICES };
  const layeredEntries = Object.entries(ALL_TABLES).filter(([, recipe]) => recipe.layers);

  /**
   * EVERY authored recipe, layered or not, in both tables.
   *
   * This started scoped to layered recipes only, which left seven
   * single-source sounds sitting at or below the rolloff - defenderPlaced,
   * defenderDied, enemyDied, bossDied, deployRejected, levelLost and summon.
   * They were inaudible on a laptop for exactly the reason the death sounds
   * were, and the owner would have hit them one at a time, each looking like a
   * fresh bug. The floor is a property of the whole sound set or it is not a
   * floor.
   *
   * Checked against AUTHORED values. The resolved-after-variant-scaling case
   * is a separate question and is covered by the reachable-pairs check above,
   * which is careful to test only the (key, variant) combinations the game can
   * actually produce - the raw cross product would demand that e.g. 'hit'
   * survive death-variant scaling, which nothing ever asks it to do.
   */
  const authoredLayers = Object.entries(ALL_TABLES)
    .flatMap(([id, recipe]) => recipeLayers(recipe).map((layer, index) => [
      recipeLayers(recipe).length > 1 ? `${id} layer ${index}` : id, layer,
    ]));

  it('covers every recipe in both tables, so nothing escapes the floor', () => {
    // Rejects a filter that silently stops matching, and pins the counts so a
    // recipe deleted rather than fixed - or a `layers` array quietly dropped -
    // is visible rather than just shrinking the it.each below.
    const extraLayers = Object.values(ALL_TABLES).reduce((n, recipe) => n + (recipe.layers?.length ?? 0), 0);

    expect(Object.keys(ALL_TABLES)).toHaveLength(Object.keys(SFX).length + Object.keys(UNIT_VOICES).length);
    expect(
      extraLayers,
      'waveStarted +1, bossWaveStarted +2, mortar +2, quake-charge +1, quake-impact +5, '
      + 'phase-change +2, defenderRemoved +1',
    ).toBe(14);
    expect(authoredLayers.length).toBe(Object.keys(ALL_TABLES).length + extraLayers);
  });

  it.each(authoredLayers)('%s is authored above the laptop speaker floor', (where, layer) => {
    expect(layer.freqStart, `${where} freqStart`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
    expect(layer.freqEnd, `${where} freqEnd`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
  });

  it('finds every layered sound in both tables, so the floor check is not vacuous', () => {
    // SFX and UNIT_VOICES share no key (asserted by 'game-event sounds are
    // served by SFX, not the voice table'), so merging them loses nothing.
    expect(layeredEntries.map(([id]) => id).sort())
      .toEqual([
        'bossWaveStarted', 'defenderRemoved', 'mortar', 'phase-change',
        'quake-charge', 'quake-impact', 'waveStarted',
      ]);
  });

  it.each(layeredEntries)('%s keeps every one of its layers above the floor', (id, recipe) => {
    const layers = recipeLayers(recipe);
    expect(layers.length, `${id} should have expanded to more than one layer`).toBeGreaterThan(1);

    for (const [index, layer] of layers.entries()) {
      const where = `${id} layer ${index} (${layer.noise ? 'noise' : layer.wave})`;
      expect(layer.freqStart, `${where} freqStart`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
      expect(layer.freqEnd, `${where} freqEnd`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
    }
  });

  it('keeps a layered unit voice above the floor after variant scaling too', () => {
    // resolveVoice can pitch a whole sound down (death scales by 0.8). A
    // layered voice that clears the floor as authored could still be dragged
    // under it once resolved, and only the resolved recipe is ever played.
    for (const [key, recipe] of Object.entries(UNIT_VOICES)) {
      if (!recipe.layers) continue;
      for (const variant of Object.keys(VARIANTS)) {
        for (const layer of recipeLayers(resolveVoice(key, variant))) {
          expect(layer.freqStart, `${key}/${variant} freqStart`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
          expect(layer.freqEnd, `${key}/${variant} freqEnd`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
        }
      }
    }
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

/**
 * The Titan's two AoE abilities, which the owner playtested as "no audio for
 * the earthquake attack, no audio for the phase change".
 *
 * These assert the SHAPE the recipes are supposed to have - a wind-up that
 * fits in the wind-up window and is quieter than what follows, an impact whose
 * three layers land where the three waves land, and two abilities a player can
 * tell apart without looking - rather than the exact numbers, so retuning a
 * gain does not have to fight the suite while flattening the design does.
 */
describe('the Titan abilities the owner could not hear', () => {
  /** performGroundPound's own schedule, which the impact recipe mirrors. */
  const CHARGE_SECONDS = 0.5;
  const WAVE_GAP_SECONDS = 0.2;

  const charge = () => resolveVoice(soundKeyFor('TitanEnemy', 'charge'), 'charge');
  const impact = () => resolveVoice(soundKeyFor('TitanEnemy', 'impact'), 'impact');
  const phase = () => resolveVoice(soundKeyFor('TitanEnemy', 'phase'), 'phase');

  it('gives the charge, the impact and the phase change three different sounds', () => {
    // Rejects a missing soundKeyFor branch, which would resolve any of them to
    // the generic 'projectile' and make a board-wide earthquake a bow twang.
    const keys = [
      soundKeyFor('TitanEnemy', 'charge'),
      soundKeyFor('TitanEnemy', 'impact'),
      soundKeyFor('TitanEnemy', 'phase'),
    ];

    expect(new Set(keys).size).toBe(3);
    expect(keys).not.toContain('projectile');
    for (const key of keys) expect(SOUND_KEYS).toContain(key);
  });

  it('finishes the charge inside the 500ms wind-up, before the first wave', () => {
    // A wind-up still sounding when the damage lands is not a wind-up.
    expect(recipeSpan(charge())).toBeLessThanOrEqual(CHARGE_SECONDS);
  });

  it('keeps the charge quieter than the impact it warns about', () => {
    const loudest = (recipe) => Math.max(...recipeLayers(recipe).map((layer) => layer.gain));
    expect(loudest(charge())).toBeLessThan(loudest(impact()));
  });

  it('rises through the charge, because the tension is the point', () => {
    for (const layer of recipeLayers(charge())) {
      expect(layer.freqEnd, 'every charge layer should sweep upward').toBeGreaterThan(layer.freqStart);
    }
  });

  it('carries one layer per earthquake wave, at the offsets the waves land on', () => {
    // Rejects: collapsing the impact to a single burst, which would lose the
    // three-wave rhythm that is the clearest thing about the attack, and
    // rejects offsets drifting away from performGroundPound's 200ms spacing.
    const offsets = recipeLayers(impact()).map((layer) => layer.offset);

    expect(offsets).toContain(WAVE_GAP_SECONDS);
    expect(offsets).toContain(WAVE_GAP_SECONDS * 2);
  });

  it('lets each wave recede rather than repeating at full level', () => {
    // The rings expand AWAY from the player's defenders; three copies at one
    // level is what emitting per wave would have sounded like.
    //
    // Finds the body by its shape (the one pitched layer) rather than a fixed
    // array index: the rebuild (Task 2) added a rumble and a debris layer
    // between the crack and the two waves, so a hard-coded index would now
    // point at the wrong layer even though the receding-waves invariant it
    // was protecting still holds.
    const layers = recipeLayers(impact());
    const body = layers.find((layer) => !layer.noise);
    const waves = layers.filter((layer) => layer.offset >= WAVE_GAP_SECONDS);

    expect(waves).toHaveLength(2);
    expect(body.gain).toBeGreaterThan(waves[0].gain);
    expect(waves[0].gain).toBeGreaterThan(waves[1].gain);
  });

  it('gives the impact a pitched body, so it is a slam and not a hiss', () => {
    // The lesson the Mortar cost: a bandpassed noise burst alone has no note,
    // and the weight has to come from a harmonic stack that survives the
    // laptop rolloff.
    const body = recipeLayers(impact()).find((layer) => !layer.noise);

    expect(body, 'the ground pound needs a pitched layer').toBeDefined();
    expect(body.freqEnd).toBeLessThan(body.freqStart);
  });

  it('makes the phase change rise where the ground pound falls', () => {
    // The two loudest things a Titan does. If both fell, a player would have to
    // look at the screen to tell an escalation from an earthquake.
    const body = recipeLayers(phase()).find((layer) => !layer.noise);
    const slam = recipeLayers(impact()).find((layer) => !layer.noise);

    expect(body.freqEnd).toBeGreaterThan(body.freqStart);
    expect(slam.freqEnd).toBeLessThan(slam.freqStart);
  });

  it('keeps all three inside one voice slot', () => {
    for (const recipe of [charge(), impact(), phase()]) {
      expect(recipeSpan(recipe)).toBeLessThanOrEqual(MAX_DURATION);
    }
  });

  it('keeps every layer above the laptop speaker floor as actually resolved', () => {
    /**
     * The derived reachable-pairs check earlier in this file cannot see these:
     * it walks Object.keys(VARIANTS), and charge/impact/phase are deliberately
     * NOT declared there - they play at their authored level, which is what
     * resolveVoice's fallback to VARIANTS.fire already does. So the resolved
     * form of exactly these three sounds needs its own check, and the floor is
     * a literal here for the same reason it is everywhere else in this file.
     */
    const LAPTOP_SPEAKER_FLOOR_HZ = 200;

    for (const [key, variant] of [['quake-charge', 'charge'], ['quake-impact', 'impact'], ['phase-change', 'phase']]) {
      for (const [index, layer] of recipeLayers(resolveVoice(key, variant)).entries()) {
        expect(layer.freqStart, `${key} layer ${index} freqStart`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
        expect(layer.freqEnd, `${key} layer ${index} freqEnd`).toBeGreaterThanOrEqual(LAPTOP_SPEAKER_FLOOR_HZ);
      }
    }
  });

  it('plays at its authored level, because these variants scale nothing', () => {
    // Both render paths must agree on that: the synthesized path falls back to
    // VARIANTS.fire and the sample path to SAMPLE_VARIANTS.fire, and both of
    // those are identity. If a future variant entry scales one and not the
    // other, a supplied sample would not match its synthesized stand-in.
    expect(resolveVoice('quake-impact', 'impact')).toEqual(UNIT_VOICES['quake-impact']);
    expect(resolveVoice('phase-change', 'phase')).toEqual(UNIT_VOICES['phase-change']);
  });
});

/**
 * Task 2's rebuild: "a low, rumbling bass thud accompanied by a cracking,
 * stone-shattering echo" - the Clash of Clans earthquake feel, built without
 * any layer or recipe reaching below the 200Hz laptop-speaker floor (guarded
 * literally, and non-negotiably, by the block above). The rumble is built
 * from amplitude modulation (AudioManager.scheduleModulatedEnvelope) rather
 * than pitch, and the crack leads because it is the half of the brief that
 * actually reproduces on a small speaker.
 */
describe('the ground pound rebuilt: crack, rumble and debris, not a bass note', () => {
  const impact = () => resolveVoice(soundKeyFor('TitanEnemy', 'impact'), 'impact');

  it('leads with the stone-crack transient: offset zero, brightest and briefest layer', () => {
    // Rejects: reordering the recipe so a duller or slower layer opens the
    // sound, which would bury the one part of this design that reads clearly
    // on a laptop or phone speaker.
    const layers = recipeLayers(impact());
    const crack = layers[0];

    expect(crack.offset).toBe(0);
    expect(crack.noise, 'the crack is broadband, not a pitched note').toBe(true);
    for (const layer of layers.slice(1)) {
      expect(crack.duration, 'the crack must be the shortest layer').toBeLessThan(layer.duration);
      expect(crack.freqStart, 'the crack must be the brightest layer').toBeGreaterThan(layer.freqStart);
    }
  });

  it('carries a mid-band rumble layer whose GAIN is modulated, not a static low band', () => {
    // Rejects two wrong implementations at once: (a) no modulated layer at
    // all - a static recipe faking "rumble" with prose alone - and (b) a
    // modulated layer that still reaches for sub-bass instead of using the
    // modulation to do the work, which is the exact mistake this file's
    // header exists to prevent.
    const layers = recipeLayers(impact());
    const rumble = layers.find((layer) => layer.modulationHz);

    expect(rumble, 'no amplitude-modulated layer found').toBeDefined();
    expect(rumble.modulationHz).toBeGreaterThan(0);
    expect(rumble.modulationDepth).toBeGreaterThan(0);
    expect(rumble.noise, 'the rumble is a noise band, not a pitched tone').toBe(true);
    expect(rumble.freqStart, 'the rumble must sit in the mid band, not the crack\'s top end').toBeLessThan(500);
    expect(rumble.freqEnd, 'the rumble must still clear the laptop floor').toBeGreaterThanOrEqual(200);
  });

  it('keeps a debris tail that outlasts every other layer, selling the aftermath', () => {
    // Rejects: a rebuild that adds the rumble but nothing to sell the
    // settling aftermath afterward - e.g. the sound ending the moment the
    // third wave's echo decays, with nothing scattering past it.
    const layers = recipeLayers(impact());
    const ends = layers.map((layer) => layer.offset + layer.duration);
    const tail = layers[ends.indexOf(Math.max(...ends))];

    expect(tail.duration, 'the tail should run long, not merely start late').toBeGreaterThan(0.3);
    expect(tail.gain, 'the tail must recede quietly, not compete with the crack or body').toBeLessThan(0.3);
    expect(tail.offset, 'the tail should begin with the impact, not after a gap').toBeLessThan(0.2);
  });

  it('still gives the impact exactly one pitched, falling body layer - the Mortar\'s lesson', () => {
    // Rejects: "solving" the rumble by turning the pitched body into another
    // noise layer, which would leave the slam with no note at all (a hiss),
    // or by adding a SECOND pitched layer, which would break every test
    // upstream that finds "the" body by filtering for the one non-noise layer.
    const nonNoise = recipeLayers(impact()).filter((layer) => !layer.noise);

    expect(nonNoise).toHaveLength(1);
    expect(nonNoise[0].freqEnd).toBeLessThan(nonNoise[0].freqStart);
  });

  it('leaves quake-charge exactly as authored - only the impact was rebuilt', () => {
    // Rejects: incidentally touching the charge while rebuilding the impact.
    // The charge keeps its role unchanged - it fires at the wind-up, 500ms
    // before damage, and is the player's only window to react.
    expect(UNIT_VOICES['quake-charge']).toEqual({
      wave: 'sawtooth', freqStart: 260, freqEnd: 400, duration: 0.42, gain: 0.30, noise: false,
      layers: [
        { offset: 0.060, wave: 'sawtooth', freqStart: 380, freqEnd: 1500, duration: 0.40, gain: 0.20, noise: true },
      ],
    });
  });
});

/**
 * resolveVoice must carry amplitude modulation through the same way it
 * carries `layers` through (see 'resolveVoice carries layers through'
 * above): scaleRecipe builds its result field by field, so a field it does
 * not explicitly forward is silently dropped, which would strip modulation
 * from the rumble the moment it passed through resolveVoice - exactly the
 * kind of bug that shipped the Mortar with no body layer.
 */
describe('resolveVoice carries amplitude modulation through', () => {
  const MODULATED_LAYERED = {
    wave: 'sawtooth', freqStart: 800, freqEnd: 400, duration: 0.10, gain: 0.5, noise: true,
    layers: [
      {
        offset: 0.02, wave: 'sawtooth', freqStart: 300, freqEnd: 260, duration: 0.4, gain: 0.4, noise: true,
        modulationHz: 5, modulationDepth: 0.6,
      },
    ],
  };

  it('keeps modulationHz and modulationDepth on a layer that declares them', () => {
    const resolved = resolveVoice('__modulated__', 'fire', MODULATED_LAYERED);
    expect(resolved.layers[0].modulationHz).toBe(5);
    expect(resolved.layers[0].modulationDepth).toBe(0.6);
  });

  it('does not invent a modulationHz key on a layer that never declared one', () => {
    // Rejects: unconditionally spreading `modulationHz: undefined` onto every
    // recipe and layer, which would put a meaningless key on all fourteen
    // other UNIT_VOICES entries - the same reasoning `layers` above already
    // follows.
    const plain = resolveVoice('sniper', 'fire');
    expect(Object.keys(plain)).not.toContain('modulationHz');
  });

  it('carries the real quake-impact rumble layer\'s modulation through resolveVoice', () => {
    // Exercises the actual production data, not just a synthetic fixture.
    const resolved = resolveVoice('quake-impact', 'impact');
    const rumble = resolved.layers.find((layer) => layer.modulationHz);
    expect(rumble).toBeDefined();
    expect(rumble.modulationHz).toBe(UNIT_VOICES['quake-impact'].layers.find((l) => l.modulationHz).modulationHz);
  });
});
