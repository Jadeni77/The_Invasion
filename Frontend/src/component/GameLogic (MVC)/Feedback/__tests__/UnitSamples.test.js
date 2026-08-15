import { describe, it, expect } from 'vitest';
import {
  sampleNameFromPath,
  SAMPLE_VARIANTS,
  unknownSampleNames,
} from '../UnitSamples.js';

describe('sampleNameFromPath', () => {
  it.each([
    ['/src/assets/audio/units/Mortar.ogg', 'Mortar'],
    ['/src/assets/audio/units/Sniper.wav', 'Sniper'],
    ['/src/assets/audio/units/TitanEnemy.mp3', 'TitanEnemy'],
    ['../../assets/audio/units/BasicEnemy.ogg', 'BasicEnemy'],
  ])('maps %s to %s', (path, expected) => {
    expect(sampleNameFromPath(path)).toBe(expected);
  });

  it('keeps a name containing dots intact apart from the extension', () => {
    expect(sampleNameFromPath('/a/b/My.Unit.ogg')).toBe('My.Unit');
  });
});

describe('SAMPLE_VARIANTS', () => {
  it('plays fire untransformed', () => {
    expect(SAMPLE_VARIANTS.fire).toEqual({ playbackRate: 1, gainScale: 1, durationScale: 1 });
  });

  it('makes hit shorter and quieter at normal pitch', () => {
    expect(SAMPLE_VARIANTS.hit.playbackRate).toBe(1);
    expect(SAMPLE_VARIANTS.hit.gainScale).toBe(0.55);
    expect(SAMPLE_VARIANTS.hit.durationScale).toBe(0.35);
  });

  it('pitches death down, which also lengthens it', () => {
    expect(SAMPLE_VARIANTS.death.playbackRate).toBe(0.75);
    expect(SAMPLE_VARIANTS.death.durationScale).toBe(1);
  });

  it('makes melee shorter and quieter at normal pitch, like a hit', () => {
    // Rejects: a missing SAMPLE_VARIANTS.melee entry. FeedbackManager falls
    // back to SAMPLE_VARIANTS.fire for an unknown variant, so a supplied
    // melee sample would play at full length and full gain while the
    // synthesized path stayed short - the two sources would not match.
    expect(SAMPLE_VARIANTS.melee).toEqual({ playbackRate: 1, gainScale: 0.55, durationScale: 0.35 });
    expect(SAMPLE_VARIANTS.melee.durationScale).toBeLessThan(SAMPLE_VARIANTS.fire.durationScale);
    expect(SAMPLE_VARIANTS.melee.gainScale).toBeLessThan(SAMPLE_VARIANTS.fire.gainScale);
  });

  it('every variant is within valid multiplier ranges', () => {
    for (const [name, t] of Object.entries(SAMPLE_VARIANTS)) {
      expect(t.playbackRate, `${name} playbackRate`).toBeGreaterThan(0);
      expect(t.gainScale, `${name} gainScale`).toBeGreaterThan(0);
      expect(t.gainScale, `${name} gainScale`).toBeLessThanOrEqual(1);
      expect(t.durationScale, `${name} durationScale`).toBeGreaterThan(0);
    }
  });
});

describe('unknownSampleNames', () => {
  // UNIT_VOICES is keyed by sound key (Task 2), not by unit class name, so a
  // supplied filename is now checked against sound keys like 'mortar' and
  // 'titan' rather than 'Mortar'/'TitanEnemy'.
  it('accepts names that match sound keys', () => {
    expect(unknownSampleNames(['mortar', 'sniper', 'titan'])).toEqual([]);
  });

  it('reports a misnamed file so a typo is visible', () => {
    expect(unknownSampleNames(['mortar', 'Zombie'])).toEqual(['Zombie']);
  });

  it('is case sensitive, because sound keys are', () => {
    expect(unknownSampleNames(['Mortar'])).toEqual(['Mortar']);
  });

  it('returns an empty array for no input', () => {
    expect(unknownSampleNames([])).toEqual([]);
  });
});
