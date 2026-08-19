import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SAMPLE_URLS } from '../UnitSamples.js';
import { SAMPLE_PROVENANCE, EAGLE_ARTILLERY_PREFIX, EARTHQUAKE_SOURCE } from '../SampleProvenance.js';
import { soundKeyFor } from '../SoundGroups.js';
import * as DefenderModule from '../../DefenderUnits.js';
import * as EnemyModule from '../../EnemyUnits.js';
import { stripComments } from '../../../../test/sourceFiles.js';

/*
 * Enforces the owner's rule, verbatim: "I want the landing sound from eagle
 * artillery...
 */

const here = dirname(fileURLToPath(import.meta.url));

/** True only for `class` declarations, not plain exported functions. */
function isClass(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

const BASE_CLASSES = ['DefenderUnit', 'Enemy'];

function classNamesFrom(unitModule) {
  return Object.keys(unitModule)
    .filter((name) => isClass(unitModule[name]))
    .filter((name) => !BASE_CLASSES.includes(name));
}

const ALL_UNIT_CLASS_NAMES = [...classNamesFrom(DefenderModule), ...classNamesFrom(EnemyModule)];

/*
 * Every variant name soundKeyFor branches on, derived from its own source (the
 * same technique UnitSamples.test.js's sample-transform guard uses), plus
 * 'fire' and 'death' - the two unit-sensitive variants every real unit reaches
 * through the module's default/death branches rather than a literal `variant
 * === 'fire'` check.
 */
const soundGroupsSource = stripComments(readFileSync(join(here, '..', 'SoundGroups.js'), 'utf8'));
function branchedVariants(source) {
  return [...new Set([...source.matchAll(/variant === ['"]([a-z-]+)['"]/g)].map((m) => m[1]))];
}
const VARIANTS_TO_CHECK = [...new Set(['fire', 'death', ...branchedVariants(soundGroupsSource)])];

/*
 * event -> variant, derived from FeedbackManager.js's own `on(event, ...)`
 * table.
 */
function eventToVariantMap(source) {
  const starts = [...source.matchAll(/\bon\('([\w:]+)',/g)].map((m) => ({ event: m[1], index: m.index }));
  const mapping = {};
  for (let i = 0; i < starts.length; i++) {
    const { event, index } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : source.length;
    const block = source.slice(index, end);
    const match = block.match(/playUnitVoice\([^,]+,\s*'([a-z-]+)'/);
    if (match) mapping[event] = match[1];
  }
  return mapping;
}

const feedbackManagerSource = readFileSync(join(here, '..', 'FeedbackManager.js'), 'utf8');
const defenderUnitsSource = readFileSync(join(here, '../../DefenderUnits.js'), 'utf8');
const enemyUnitsSource = readFileSync(join(here, '../../EnemyUnits.js'), 'utf8');
const EVENT_TO_VARIANT = eventToVariantMap(feedbackManagerSource);

/*
 * Whether soundKeyFor resolves `variant` to the SAME key no matter which real
 * unit is asked.
 */
function isUnitAgnosticVariant(variant) {
  const keys = new Set(ALL_UNIT_CLASS_NAMES.map((name) => soundKeyFor(name, variant)));
  return keys.size === 1;
}

/**
 * Every real unit class that can reach `soundKey`, combining both mechanisms
 * above.
 */
function reachableUnitsFor(soundKey) {
  const reachable = new Set();

  for (const unitName of ALL_UNIT_CLASS_NAMES) {
    for (const variant of VARIANTS_TO_CHECK) {
      if (isUnitAgnosticVariant(variant)) continue; // answered below instead
      if (soundKeyFor(unitName, variant) === soundKey) reachable.add(unitName);
    }
  }

  for (const [event, variant] of Object.entries(EVENT_TO_VARIANT)) {
    if (!isUnitAgnosticVariant(variant)) continue;
    if (soundKeyFor('__probe_unit_name__', variant) !== soundKey) continue;

    const literal = `'${event}'`;
    // Mortar lives in DefenderUnits.js, TitanEnemy in EnemyUnits.js - the only
    // two units this rule names. If the literal event string this variant
    // maps to appears in a file, some class in that file can trigger it.
    if (defenderUnitsSource.includes(literal)) reachable.add('Mortar');
    if (enemyUnitsSource.includes(literal)) reachable.add('TitanEnemy');
  }

  return reachable;
}

describe('no cross-contamination between Eagle Artillery and Earthquake sample sources', () => {
  /** Every sound key with a real committed sample file, derived from disk. */
  const committedSampleKeys = Object.keys(SAMPLE_URLS);

  it('finds at least one real committed sample, so this guard is not vacuous', () => {
    expect(committedSampleKeys.length).toBeGreaterThan(0);
  });

  it('derives a non-empty variant list, so reachableUnitsFor is not vacuous', () => {
    expect(VARIANTS_TO_CHECK).toEqual(
      expect.arrayContaining(['fire', 'impact', 'phase', 'landing', 'melee', 'hit', 'death']),
    );
  });

  it('derives the event -> variant routes this guard depends on, so it is not vacuous', () => {
    expect(EVENT_TO_VARIANT).toMatchObject({
      'defender:shellLanded': 'landing',
      'enemy:groundPoundImpact': 'impact',
      'enemy:phaseChange': 'phase',
    });
    // The wind-up event this guard used to also derive a route for,
    // 'enemy:groundPoundCharge' -> 'charge', is gone along with the sound it
    // played: EnemyUnits.performGroundPound no longer emits it and
    // FeedbackManager no longer routes it, so it no longer appears here.
    expect(EVENT_TO_VARIANT).not.toHaveProperty('enemy:groundPoundCharge');
  });

  it('declares a source pack for every committed sample', () => {
    // Rejects: a new sample file dropped in without a provenance entry, which
    // would leave it unchecked by every test below.
    for (const key of committedSampleKeys) {
      expect(SAMPLE_PROVENANCE, `${key} has no declared source pack`).toHaveProperty(key);
    }
  });

  it.each(committedSampleKeys)(
    '%s is reachable only by the unit its declared source pack belongs to',
    (key) => {
      const source = SAMPLE_PROVENANCE[key];
      const reachableBy = reachableUnitsFor(key);

      if (source?.startsWith(EAGLE_ARTILLERY_PREFIX)) {
        expect(
          reachableBy.has('TitanEnemy'),
          `${key} is Eagle Artillery content but is reachable by TitanEnemy: ${[...reachableBy].join(', ')}`,
        ).toBe(false);
      }
      if (source === EARTHQUAKE_SOURCE) {
        expect(
          reachableBy.has('Mortar'),
          `${key} is Earthquake_Spell content but is reachable by Mortar: ${[...reachableBy].join(', ')}`,
        ).toBe(false);
      }
    },
  );

  it('confirms mortar-impact (Eagle Artillery) is reachable by the Mortar', () => {
    // Sanity check on reachableUnitsFor itself: the guard above only proves an
    // ABSENCE (not reachable by the wrong unit); this proves the mechanism
    // finds a real PRESENCE too, so a helper that always returned an empty
    // set would not slip this file through vacuously.
    expect(reachableUnitsFor('mortar-impact').has('Mortar')).toBe(true);
  });

  it('confirms quake-impact (Earthquake_Spell) is reachable by the Titan', () => {
    expect(reachableUnitsFor('quake-impact').has('TitanEnemy')).toBe(true);
  });

  it('confirms the Mortar and the Titan never reach the same committed sample key', () => {
    for (const key of committedSampleKeys) {
      const reachableBy = reachableUnitsFor(key);
      const both = reachableBy.has('TitanEnemy') && reachableBy.has('Mortar');
      expect(both, `${key} is reachable by both Mortar and TitanEnemy`).toBe(false);
    }
  });
});
