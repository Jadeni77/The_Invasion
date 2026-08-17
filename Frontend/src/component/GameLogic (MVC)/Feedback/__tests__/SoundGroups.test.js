import { describe, it, expect } from 'vitest';
import { soundKeyFor, SOUND_KEYS, mixGainFor, MIX_TIERS } from '../SoundGroups.js';
import { SFX } from '../SfxLibrary.js';
import * as DefenderUnits from '../../DefenderUnits.js';
import * as EnemyUnits from '../../EnemyUnits.js';

/** Base classes are abstract - they never reach a feedback event on their own. */
const BASE_CLASSES = ['DefenderUnit', 'Enemy'];

/** True only for `class` declarations, not plain exported functions. */
function isClass(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

/**
 * Every concrete class name exported by one unit module.
 *
 * The isClass filter matters: DefenderUnits.js also exports the plain function
 * isConsumableSpell, which a bare `typeof === 'function'` check would count as
 * a unit and then demand a sound key for.
 */
function classNamesFrom(unitModule) {
  return Object.keys(unitModule)
    .filter((name) => isClass(unitModule[name]))
    .filter((name) => !BASE_CLASSES.includes(name));
}

const DEFENDER_CLASS_NAMES = classNamesFrom(DefenderUnits);
const ALL_UNIT_CLASS_NAMES = [...DEFENDER_CLASS_NAMES, ...classNamesFrom(EnemyUnits)];

describe('archetype grouping', () => {
  it('gives a Shooter and a Skeleton the same firing sound', () => {
    expect(soundKeyFor('BasicDefender', 'fire')).toBe('projectile');
    expect(soundKeyFor('RangeEnemy', 'fire')).toBe('projectile');
  });

  it('groups the magic users together', () => {
    expect(soundKeyFor('FrostArcher', 'fire')).toBe('magic');
    expect(soundKeyFor('IceBomb', 'fire')).toBe('magic');
    expect(soundKeyFor('MageEnemy', 'fire')).toBe('magic');
  });

  it('gives artillery its own group', () => {
    expect(soundKeyFor('GrenadeDefender', 'fire')).toBe('artillery');
  });

  it('groups the summoners together', () => {
    // Rejects: SwarmLeader missing from FIRE_GROUPS. It summons on a timer and
    // splits into five on death, but without an entry it falls through to the
    // default and its summons play the generic arrow sound.
    expect(soundKeyFor('NecromancerEnemy', 'fire')).toBe('summon');
    expect(soundKeyFor('SplitterEnemy', 'fire')).toBe('summon');
    expect(soundKeyFor('SwarmLeader', 'fire')).toBe('summon');
  });

  it('groups healers on both sides', () => {
    expect(soundKeyFor('HealerDefender', 'fire')).toBe('heal');
    expect(soundKeyFor('HealerEnemy', 'fire')).toBe('heal');
  });
});

describe('signature overrides', () => {
  it.each([
    ['Mortar', 'fire', 'mortar'],
    ['Sniper', 'fire', 'sniper'],
    ['TitanEnemy', 'death', 'titan'],
    ['BossEnemy', 'death', 'boss'],
  ])('%s keeps its own %s sound', (unit, variant, expected) => {
    expect(soundKeyFor(unit, variant)).toBe(expected);
  });

  it('a signature unit does not fall back to its category', () => {
    expect(soundKeyFor('Mortar', 'fire')).not.toBe('artillery');
    expect(soundKeyFor('TitanEnemy', 'death')).not.toBe('death-medium');
  });
});

describe('death tiering', () => {
  it.each(['BasicEnemy', 'FastEnemy', 'MiniEnemy', 'SwarmLeader'])(
    '%s dies small', (unit) => {
      expect(soundKeyFor(unit, 'death')).toBe('death-small');
    },
  );

  it.each(['TankEnemy', 'ShieldEnemy', 'BerserkerEnemy', 'NecromancerEnemy'])(
    '%s dies medium', (unit) => {
      expect(soundKeyFor(unit, 'death')).toBe('death-medium');
    },
  );

  it('defenders share one death sound', () => {
    expect(soundKeyFor('BasicDefender', 'death')).toBe('death-defender');
    expect(soundKeyFor('Mortar', 'death')).toBe('death-defender');
  });

  it('small, medium and Titan deaths are all different', () => {
    const keys = new Set([
      soundKeyFor('BasicEnemy', 'death'),
      soundKeyFor('TankEnemy', 'death'),
      soundKeyFor('TitanEnemy', 'death'),
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('resolution safety', () => {
  it('every resolved key is a declared key', () => {
    const units = [
      'BasicDefender', 'Mortar', 'Sniper', 'FrostArcher', 'HealerDefender',
      'BasicEnemy', 'TankEnemy', 'TitanEnemy', 'BossEnemy', 'MageEnemy',
    ];
    for (const unit of units) {
      for (const variant of ['fire', 'hit', 'death']) {
        expect(SOUND_KEYS, `${unit}/${variant}`).toContain(soundKeyFor(unit, variant));
      }
    }
  });

  it('an unknown unit resolves to a usable key rather than undefined', () => {
    expect(SOUND_KEYS).toContain(soundKeyFor('NoSuchUnit', 'death'));
    expect(SOUND_KEYS).toContain(soundKeyFor('NoSuchUnit', 'fire'));
  });

  it('does not throw on a null or undefined unit name', () => {
    expect(() => soundKeyFor(null, 'death')).not.toThrow();
    expect(() => soundKeyFor(undefined, 'fire')).not.toThrow();
  });

  it('every hit resolves to the shared hit sound', () => {
    expect(soundKeyFor('TankEnemy', 'hit')).toBe('hit');
    expect(soundKeyFor('TitanEnemy', 'hit')).toBe('hit');
  });
});

describe('soundKeyFor covers every real unit class', () => {
  // 'resolution safety' above only checks a hand-picked sample of names, and
  // 'every resolved key is a declared key' would stay green even if a whole
  // new class were added and never wired into FIRE_GROUPS/DEFENDERS/etc,
  // because soundKeyFor's default branches always return SOME valid key.
  // These two tests instead derive the roster from the real class exports, so
  // adding a unit class and forgetting to register it here is caught by the
  // suite rather than by a player hearing the wrong sound.

  it('resolves every concrete unit class to a declared sound key for all three variants', () => {
    // Rejects: soundKeyFor returning undefined/null, or returning a typo'd
    // string absent from SOUND_KEYS, for any real class - not just the
    // hand-picked sample above. It would NOT catch a defender class missing
    // from DEFENDERS: the default death branch still returns 'death-medium',
    // which IS a declared key, so this assertion alone is satisfied either
    // way. That gap is exactly what the next test closes.
    for (const name of ALL_UNIT_CLASS_NAMES) {
      for (const variant of ['fire', 'hit', 'death']) {
        expect(SOUND_KEYS, `${name}/${variant}`).toContain(soundKeyFor(name, variant));
      }
    }
  });

  it('resolves every DefenderUnits class to the shared death-defender sound on death', () => {
    // Rejects: a new defender class (e.g. a hypothetical LaserDefender) added
    // to DefenderUnits.js without a matching entry in SoundGroups.DEFENDERS.
    // Without that registration, soundKeyFor's default branch treats the name
    // as an unrecognised enemy and returns 'death-medium' instead of
    // 'death-defender' - a valid key, so the previous test would not notice,
    // but this assertion checks the SPECIFIC expected key and would fail.
    const wrong = DEFENDER_CLASS_NAMES.filter((name) => soundKeyFor(name, 'death') !== 'death-defender');
    expect(wrong, `defenders not resolving to death-defender: ${wrong.join(', ')}`).toEqual([]);
  });
});

describe('the melee variant', () => {
  it('resolves to the shared melee sound whichever enemy struck', () => {
    // Rejects: soundKeyFor with no `melee` early return. Without it a swing
    // falls through to the firing branch, so a Vampire's claw plays the
    // generic arrow sound and a Necromancer's plays its summon incantation.
    expect(soundKeyFor('VampireEnemy', 'melee')).toBe('melee');
    expect(soundKeyFor('BasicEnemy', 'melee')).toBe('melee');
    expect(soundKeyFor('AssassinEnemy', 'melee')).toBe('melee');
    expect(soundKeyFor('NecromancerEnemy', 'melee')).toBe('melee');
  });

  it('gives an unknown unit the melee sound too, rather than a firing sound', () => {
    expect(soundKeyFor('NoSuchEnemy', 'melee')).toBe('melee');
  });

  it('is a declared key with a mix tier, like every other sound', () => {
    expect(SOUND_KEYS).toContain(soundKeyFor('BasicEnemy', 'melee'));
    expect(MIX_TIERS).toHaveProperty('melee');
  });

  it('leaves the same units\' firing and death sounds alone', () => {
    // A blanket early return placed above the death branch would swallow
    // deaths as well; these stay put.
    expect(soundKeyFor('NecromancerEnemy', 'fire')).toBe('summon');
    expect(soundKeyFor('AssassinEnemy', 'fire')).toBe('projectile');
    expect(soundKeyFor('BasicEnemy', 'death')).toBe('death-small');
  });

  it('does not throw on a null or undefined unit name', () => {
    expect(() => soundKeyFor(null, 'melee')).not.toThrow();
    expect(() => soundKeyFor(undefined, 'melee')).not.toThrow();
  });
});

describe('mix tiers', () => {
  it('puts constant sounds in the quiet tier', () => {
    expect(mixGainFor('projectile')).toBe(0.4);
    expect(mixGainFor('hit')).toBe(0.4);
    expect(mixGainFor('energyCollected')).toBe(0.4);
  });

  it('puts big moments in the loud tier', () => {
    expect(mixGainFor('boss')).toBe(1.0);
    expect(mixGainFor('baseDamaged')).toBe(1.0);
    expect(mixGainFor('levelWon')).toBe(1.0);
  });

  it('tiers game-event sounds by their SfxLibrary id', () => {
    // These play through playSfx, not unit resolution. If the ids drift from
    // SfxLibrary the tier silently stops applying, so assert against the real
    // library rather than string literals alone.
    for (const id of ['energyCollected', 'baseDamaged', 'levelWon', 'levelLost']) {
      expect(SFX, `${id} missing from SfxLibrary`).toHaveProperty(id);
      expect(MIX_TIERS, `${id} has no tier`).toHaveProperty(id);
    }
  });

  it('puts everything else in the mid tier', () => {
    expect(mixGainFor('death-small')).toBe(0.7);
    expect(mixGainFor('artillery')).toBe(0.7);
  });

  it('projectiles are quieter than deaths, which are quieter than boss deaths', () => {
    expect(mixGainFor('projectile')).toBeLessThan(mixGainFor('death-small'));
    expect(mixGainFor('death-small')).toBeLessThan(mixGainFor('boss'));
  });

  it('defaults an unknown key to the mid tier rather than silence', () => {
    expect(mixGainFor('nonsense')).toBe(0.7);
  });

  it('gives removing a defender a heavier tier than placing one', () => {
    // Rejects: copying defenderPlaced's QUIET tier verbatim. Placing happens
    // constantly during setup and should stay in the background; removing is
    // a deliberate, consequential choice (giving up a placed unit) and is
    // meant to read as such, per the owner's ask - "probably not the quiet
    // tier."
    expect(SFX).toHaveProperty('defenderRemoved');
    expect(MIX_TIERS).toHaveProperty('defenderRemoved');
    expect(mixGainFor('defenderRemoved')).toBeGreaterThan(mixGainFor('defenderPlaced'));
  });

  it('every declared key has a tier', () => {
    for (const key of SOUND_KEYS) {
      expect(MIX_TIERS, `no tier for ${key}`).toHaveProperty(key);
    }
  });
});

describe('playSfx also gets a tier', () => {
  it('a game event resolves a multiplier without going through unit resolution', () => {
    // base damage is one of the loudest moments in the game; if playSfx ignored
    // the tier it would sit at the same level as a projectile.
    expect(mixGainFor('baseDamaged')).toBeGreaterThan(mixGainFor('projectile'));
  });

  it('every tier key is reachable by something', () => {
    // A tier only applies if something looks it up by this exact key. Two routes
    // are legitimate: a key soundKeyFor can return, or an SfxLibrary id played
    // through playSfx. A key that is neither silently does nothing.
    const unreachable = Object.keys(MIX_TIERS).filter(
      (key) => !SOUND_KEYS.includes(key) && !Object.hasOwn(SFX, key),
    );
    expect(unreachable, `unreachable tier keys: ${unreachable.join(', ')}`).toEqual([]);
  });
});

describe('the Titan ability variants', () => {
  /**
   * The Titan's ground pound and phase transition were silent in play. They
   * resolve by VARIANT rather than by unit, the way hit and melee do, because
   * what the player needs to recognise is the ABILITY - a heavy wind-up, that
   * thing landing, a boss escalating - not which unit produced it.
   */
  it.each([
    ['charge', 'quake-charge'],
    ['impact', 'quake-impact'],
    ['phase', 'phase-change'],
  ])('resolves the %s variant to the %s sound', (variant, expected) => {
    // Rejects: a missing branch in soundKeyFor. Without one the variant falls
    // through to the firing branch and a board-wide earthquake plays the
    // generic arrow - audible, wrong, and easy to miss in a busy wave.
    expect(soundKeyFor('TitanEnemy', variant)).toBe(expected);
    expect(soundKeyFor('TitanEnemy', variant)).not.toBe('projectile');
  });

  it('gives the three abilities three different sounds', () => {
    const keys = new Set(['charge', 'impact', 'phase'].map((v) => soundKeyFor('TitanEnemy', v)));
    expect(keys.size).toBe(3);
  });

  it('leaves the Titan\'s firing, melee, hit and death sounds alone', () => {
    // A branch placed above the death branch would swallow deaths as well.
    expect(soundKeyFor('TitanEnemy', 'death')).toBe('titan');
    expect(soundKeyFor('TitanEnemy', 'hit')).toBe('hit');
    expect(soundKeyFor('TitanEnemy', 'melee')).toBe('melee');
  });

  it('puts all three in the loud tier, with the big moments', () => {
    // These are the two most consequential things that happen to a player's
    // board - 135 damage inside 350px, and a five-second disable inside
    // 1500px - so they belong at baseDamaged's level, not at an attack's.
    for (const variant of ['charge', 'impact', 'phase']) {
      expect(mixGainFor(soundKeyFor('TitanEnemy', variant)), variant).toBe(mixGainFor('baseDamaged'));
    }
  });

  it('does not throw on a null or undefined unit name', () => {
    for (const variant of ['charge', 'impact', 'phase']) {
      expect(() => soundKeyFor(null, variant)).not.toThrow();
      expect(() => soundKeyFor(undefined, variant)).not.toThrow();
    }
  });
});
