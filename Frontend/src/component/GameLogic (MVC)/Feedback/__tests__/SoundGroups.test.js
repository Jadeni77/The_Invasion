import { describe, it, expect } from 'vitest';
import { soundKeyFor, SOUND_KEYS, mixGainFor, MIX_TIERS } from '../SoundGroups.js';
import { SFX } from '../SfxLibrary.js';

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

describe('mix tiers', () => {
  it('puts constant sounds in the quiet tier', () => {
    expect(mixGainFor('projectile')).toBe(0.4);
    expect(mixGainFor('hit')).toBe(0.4);
    expect(mixGainFor('energy')).toBe(0.4);
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
});
