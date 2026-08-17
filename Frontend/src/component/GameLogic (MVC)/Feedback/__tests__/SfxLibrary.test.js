import { describe, it, expect } from 'vitest';
import { SFX, SFX_IDS, recipeLayers, recipeSpan } from '../SfxLibrary.js';

const REQUIRED_IDS = [
  'defenderPlaced', 'defenderDied', 'defenderRemoved', 'projectileFired', 'enemyHit',
  'enemyDied', 'bossDied', 'energyCollected', 'deployRejected',
  'baseDamaged', 'waveStarted', 'bossWaveStarted', 'levelWon', 'levelLost',
];

describe('SfxLibrary', () => {
  it('defines every sound the event catalog requires', () => {
    for (const id of REQUIRED_IDS) {
      expect(SFX, `missing sound: ${id}`).toHaveProperty(id);
    }
  });

  it('exposes SFX_IDS matching the SFX keys', () => {
    expect([...SFX_IDS].sort()).toEqual(Object.keys(SFX).sort());
  });

  it.each(Object.entries(SFX))('recipe %s is well formed', (id, recipe) => {
    expect(Number.isFinite(recipe.freqStart), `${id} freqStart`).toBe(true);
    expect(Number.isFinite(recipe.freqEnd), `${id} freqEnd`).toBe(true);
    expect(recipe.freqStart).toBeGreaterThan(0);
    expect(recipe.freqEnd).toBeGreaterThan(0);
    expect(recipe.freqStart).toBeLessThan(20000);
    expect(recipe.freqEnd).toBeLessThan(20000);
  });

  it.each(Object.entries(SFX))('recipe %s has a sane duration and gain', (id, recipe) => {
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.duration, `${id} must stay short enough not to overlap itself`).toBeLessThanOrEqual(2);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(1);
  });

  it.each(Object.entries(SFX))('recipe %s uses a valid oscillator type', (id, recipe) => {
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(recipe.wave);
  });
});

describe('recipeLayers', () => {
  /**
   * The one expansion both AudioManager and the audibility checks read, so a
   * layer the tests inspect is provably the same layer the player hears. A
   * second, test-local expansion would be free to disagree with playback -
   * which is the shape of bug that let an inaudible Mortar ship green.
   */
  const SINGLE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  it('reads a recipe with no layers as a single layer on the trigger', () => {
    expect(recipeLayers(SINGLE)).toEqual([{ ...SINGLE, offset: 0 }]);
  });

  it('puts the base recipe first and does not leave `layers` inside it', () => {
    const layered = { ...SINGLE, layers: [{ ...SINGLE, offset: 0.1, gain: 0.2 }] };
    const [base, second] = recipeLayers(layered);

    expect(base).not.toHaveProperty('layers');
    expect(base.offset).toBe(0);
    expect(base.gain).toBe(0.5);
    expect(second.offset).toBe(0.1);
    expect(second.gain).toBe(0.2);
  });

  it('defaults a layer that declares no offset to the trigger', () => {
    const [, second] = recipeLayers({ ...SINGLE, layers: [{ ...SINGLE }] });
    expect(second.offset).toBe(0);
  });

  it('treats an empty layers array as a single layer', () => {
    expect(recipeLayers({ ...SINGLE, layers: [] })).toEqual([{ ...SINGLE, offset: 0 }]);
  });

  it('returns nothing for a missing recipe rather than throwing', () => {
    expect(recipeLayers(undefined)).toEqual([]);
    expect(recipeLayers(null)).toEqual([]);
  });

  it('does not mutate or alias the recipe it was given', () => {
    const layer = { ...SINGLE, offset: 0.1 };
    const layered = { ...SINGLE, layers: [layer] };

    const expanded = recipeLayers(layered);
    expanded[0].gain = 999;
    expanded[1].gain = 999;

    expect(layered.gain).toBe(0.5);
    expect(layer.gain).toBe(0.5);
    expect(layered.layers).toHaveLength(1);
  });
});

describe('recipeSpan', () => {
  const SINGLE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  it('is the recipe duration when there are no layers', () => {
    expect(recipeSpan(SINGLE)).toBeCloseTo(0.2);
  });

  it('runs to the end of the LAST layer to finish, not the last declared', () => {
    // Rejects taking the final entry's end, or the base duration: the voice
    // slot has to be held until nothing is still sounding.
    const span = recipeSpan({
      ...SINGLE,
      layers: [
        { ...SINGLE, offset: 0.05, duration: 0.6 },
        { ...SINGLE, offset: 0.10, duration: 0.1 },
      ],
    });
    expect(span).toBeCloseTo(0.65);
  });

  it('is the base duration when every layer finishes sooner', () => {
    expect(recipeSpan({ ...SINGLE, layers: [{ ...SINGLE, offset: 0.01, duration: 0.05 }] }))
      .toBeCloseTo(0.2);
  });

  it('is zero for a missing recipe rather than NaN or -Infinity', () => {
    expect(recipeSpan(undefined)).toBe(0);
  });
});

/**
 * Every sound authored with the layering mechanism, wherever it lives. Derived
 * by walking the two recipe tables, so a layered sound added to either one is
 * covered the day it is written - a hand-maintained list is exactly what would
 * have let the 25-90Hz Mortar sit unchecked.
 */
describe('layered recipes are well formed', () => {
  const layered = Object.entries(SFX).filter(([, recipe]) => recipe.layers);

  it('finds the layered game-event sounds, so the checks below are not vacuous', () => {
    expect(layered.map(([id]) => id).sort()).toEqual(['bossWaveStarted', 'defenderRemoved', 'waveStarted']);
  });

  it.each(layered)('%s: every layer is a valid recipe with a sane offset', (id, recipe) => {
    for (const layer of recipeLayers(recipe)) {
      expect(['sine', 'square', 'sawtooth', 'triangle'], `${id} wave`).toContain(layer.wave);
      expect(layer.freqStart, `${id} freqStart`).toBeGreaterThan(0);
      expect(layer.freqEnd, `${id} freqEnd`).toBeGreaterThan(0);
      expect(layer.duration, `${id} duration`).toBeGreaterThan(0);
      expect(layer.gain, `${id} gain`).toBeGreaterThan(0);
      expect(layer.gain, `${id} gain`).toBeLessThanOrEqual(1);
      expect(typeof layer.noise, `${id} noise`).toBe('boolean');
      expect(layer.offset, `${id} offset`).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(layered)('%s still fits inside one voice slot end to end', (id, recipe) => {
    // A layered sound holds its slot for its whole span, not its base
    // duration, so the 2s ceiling has to be judged against the span.
    expect(recipeSpan(recipe), id).toBeLessThanOrEqual(2);
  });
});

/**
 * The wave stings are ALERTS: they say "something is coming". The owner's
 * verdict on the old waveStarted - a 180->240Hz sawtooth drone with no
 * transient - was that it sounded like flatulence and made nothing feel
 * critical, which is a fair description of a slow rise on a buzzy wave at the
 * bottom of what a laptop reproduces.
 *
 * These assert the SHAPE that carries alert meaning - separated notes, a
 * stepped interval, a direction - not the exact pitches, so the sounds stay
 * tunable. Every note's pitch is pinned above the speaker floor by
 * UnitVoices.test.js's derived layer check.
 */
describe('the wave stings read as alerts', () => {
  const notesOf = (id) => recipeLayers(SFX[id]).sort((a, b) => a.offset - b.offset);

  it.each(['waveStarted', 'bossWaveStarted'])('%s is a multi-note figure, not one drone', (id) => {
    expect(notesOf(id).length).toBeGreaterThan(1);
  });

  it.each(['waveStarted', 'bossWaveStarted'])('%s articulates its notes in sequence', (id) => {
    // A stepped figure reads as a signal; simultaneous notes read as a chord,
    // and a single sustained tone reads as the drone being replaced.
    const notes = notesOf(id);
    expect(notes[0].offset).toBe(0);
    expect(notes.at(-1).offset).toBeGreaterThan(0);
    // The first note has finished, or nearly, before the next one speaks.
    expect(notes[1].offset).toBeGreaterThanOrEqual(notes[0].duration);
  });

  it('waveStarted steps UP, the conventional "incoming" figure', () => {
    const [first, second] = notesOf('waveStarted');
    expect(second.freqStart).toBeGreaterThan(first.freqStart);
    // A step, not a slide: each note holds its pitch, so the figure reads as
    // two tones rather than the old continuous sweep.
    expect(first.freqEnd).toBe(first.freqStart);
    expect(second.freqEnd).toBe(second.freqStart);
  });

  it('bossWaveStarted steps DOWN, so the two stings cannot be confused', () => {
    // Same alert vocabulary, opposite direction: a rising figure announces a
    // wave, a falling one announces the thing you should be afraid of.
    const [first, second] = notesOf('bossWaveStarted');
    expect(second.freqStart).toBeLessThan(first.freqStart);
  });

  it('bossWaveStarted is the longer and heavier of the two', () => {
    expect(recipeSpan(SFX.bossWaveStarted)).toBeGreaterThan(recipeSpan(SFX.waveStarted));
    expect(recipeLayers(SFX.bossWaveStarted).length)
      .toBeGreaterThan(recipeLayers(SFX.waveStarted).length);
  });

  it('neither sting is the slow low sawtooth rise the owner rejected', () => {
    // Rejects a revert. The old pair were sawtooths whose every pitch sat at
    // or under 240Hz and which swept continuously across most of a second.
    for (const id of ['waveStarted', 'bossWaveStarted']) {
      const notes = recipeLayers(SFX[id]);
      expect(Math.max(...notes.map((n) => n.freqStart)), id).toBeGreaterThan(240);
      expect(notes.some((n) => n.freqStart !== n.freqEnd), `${id} still sweeps`).toBe(false);
    }
  });
});
