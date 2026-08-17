import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  sampleNameFromPath,
  SAMPLE_VARIANTS,
  unknownSampleNames,
} from '../UnitSamples.js';
import { stripComments } from '../../../../test/sourceFiles.js';

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

describe('the Titan ability variants (charge, impact, phase)', () => {
  // Prior to this task these three had no SAMPLE_VARIANTS entry at all, so
  // playUnitVoice's `SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire`
  // fallback would hand any future sample dropped under quake-charge,
  // quake-impact or phase-change the untouched fire transform: full gain,
  // full length. The suite passed throughout because no such sample existed
  // to expose it - the exact "melee-variant trap" this file's SAMPLE_VARIANTS
  // header now calls out.

  it('gives the impact a lower gainScale than fire, so a hot-mastered sample is not louder than the "too loud" synth version', () => {
    // Rejects: leaving SAMPLE_VARIANTS.impact at gainScale 1 (fire's value).
    // Earthquake_Spell.ogg measures ~0dB peak; at SAMPLE_BASE_GAIN 0.7 * the
    // LOUD mix tier (1.0) * gainScale 1, that is louder than the synth
    // quake-impact recipe the owner already played and called too loud (its
    // loudest layer peaks at 0.58-0.60). 0.6 keeps the sample in that
    // neighbourhood instead of at the file's own hot peak.
    expect(SAMPLE_VARIANTS.impact.gainScale).toBeLessThan(SAMPLE_VARIANTS.fire.gainScale);
    expect(SAMPLE_VARIANTS.impact.gainScale).toBe(0.6);
  });

  it('keeps the charge quieter than the impact, the relationship the synth recipe authors', () => {
    // UNIT_VOICES['quake-charge'].gain (0.30) sits below quake-impact's
    // (0.60) on purpose - "the wind-up should read as the thing before the
    // thing" (UnitVoices.js). The sample transform preserves that ordering
    // rather than making both equally loud.
    expect(SAMPLE_VARIANTS.charge.gainScale).toBeLessThan(SAMPLE_VARIANTS.impact.gainScale);
    expect(SAMPLE_VARIANTS.charge.gainScale).toBe(0.45);
  });

  it('gives phase-change the same conservative gain, ahead of any sample being supplied for it', () => {
    // No phase-change sample ships with this task (see the audio README) -
    // but the LOUD-tier-meets-hot-sample problem this fixes is a property of
    // the tier, not of any one file, so the entry exists ahead of whoever
    // adds that sample later rather than being deferred to them.
    expect(SAMPLE_VARIANTS.phase.gainScale).toBe(0.6);
  });

  it('does not truncate charge, impact or phase - their files were pre-trimmed with ffmpeg, not scaled here', () => {
    // durationScale < 1 makes playSample fade continuously across the WHOLE
    // truncated length (see AudioManager.playSample's `durationScale < 1`
    // branch) rather than holding level and releasing only over a short
    // tail - right for a sound meant to mask a 35%-length cut (hit), wrong
    // for one meant to hold its own shape for the better part of a second.
    // The 3.91s Earthquake_Spell.ogg and 3.06s EagleArtillery_Charge.ogg were
    // trimmed to their ability windows (~1.2s, ~0.45s) before being
    // committed, so durationScale here stays 1 - full length, held-then-
    // released - like fire and death.
    expect(SAMPLE_VARIANTS.charge.durationScale).toBe(1);
    expect(SAMPLE_VARIANTS.impact.durationScale).toBe(1);
    expect(SAMPLE_VARIANTS.phase.durationScale).toBe(1);
  });

  it('does not pitch-shift charge, impact or phase', () => {
    expect(SAMPLE_VARIANTS.charge.playbackRate).toBe(1);
    expect(SAMPLE_VARIANTS.impact.playbackRate).toBe(1);
    expect(SAMPLE_VARIANTS.phase.playbackRate).toBe(1);
  });

  it('stays within the valid multiplier ranges, like every other variant', () => {
    // The generic "every variant is within valid multiplier ranges" test
    // above already walks Object.entries(SAMPLE_VARIANTS), so it covers
    // these three automatically once they exist - this pins the fact that it
    // does, rather than only relying on it silently.
    expect(Object.keys(SAMPLE_VARIANTS)).toEqual(
      expect.arrayContaining(['charge', 'impact', 'phase']),
    );
  });
});

describe('every variant soundKeyFor special-cases has a sample transform', () => {
  /**
   * Derived by reading SoundGroups.js itself rather than copying its branch
   * list into a second, hand-written array here - which is exactly the kind
   * of second list that drifted from the first and produced this bug in the
   * first place (see this file's SAMPLE_VARIANTS header). Every guard found
   * wanting on this branch failed on *scope* - which variants it checked -
   * never on the matching logic once pointed at the right ones; this ties
   * the scope to the real source instead of to anyone's memory of it.
   */
  const here = dirname(fileURLToPath(import.meta.url));
  const soundGroupsSource = stripComments(readFileSync(join(here, '..', 'SoundGroups.js'), 'utf8'));

  function branchedVariants(source) {
    return [...new Set(
      [...source.matchAll(/variant === ['"]([a-z-]+)['"]/g)].map((m) => m[1]),
    )];
  }

  const variants = branchedVariants(soundGroupsSource);

  it('finds the branches this guard depends on, so it is not vacuous', () => {
    // Pins the derived set: if soundKeyFor's branches are reformatted in a
    // way the regex stops matching, this fails loudly instead of the
    // it.each below silently shrinking to nothing.
    expect(variants.sort()).toEqual(['charge', 'death', 'hit', 'impact', 'melee', 'phase']);
  });

  it.each(branchedVariants(soundGroupsSource))('%s has a SAMPLE_VARIANTS entry', (variant) => {
    // Rejects exactly the bug this task started from: quake-charge,
    // quake-impact and phase-change were three of soundKeyFor's own branches
    // with no matching SAMPLE_VARIANTS entry, so
    // `SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire` silently fell back
    // to fire's identity transform - full gain, full length - for any sample
    // later dropped under those keys. Removing any one entry here
    // reproduces that failure exactly (verified by mutation).
    expect(SAMPLE_VARIANTS, `SAMPLE_VARIANTS.${variant} is missing`).toHaveProperty(variant);
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
