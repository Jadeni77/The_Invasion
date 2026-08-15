import { describe, it, expect, beforeEach } from 'vitest';
import {
  isConsumableSpell,
  FireBlast,
  IceBomb,
  BasicDefender,
  HealerDefender,
} from '../DefenderUnits.js';
import { setFrameDeltaMs } from '../Animation/FrameTime.js';

/**
 * These tests drive unit.update() by hand, standing in for GameEngine's loop,
 * and count ticks. Movement and every countdown now advance by whatever real
 * time the engine says the frame covered (Animation/FrameTime.js), so the loop
 * is pinned to 60Hz here to give those tick counts the fixed meaning they
 * always assumed.
 */
const FRAME_MS_60HZ = 1000 / 60;

beforeEach(() => {
  setFrameDeltaMs(FRAME_MS_60HZ);
});

const CARD = { level: 1, image: null };

describe('isConsumableSpell', () => {
  it('is true for Fire Blast', () => {
    expect(isConsumableSpell(new FireBlast(0, 0, CARD))).toBe(true);
  });

  it('is true for Ice Bomb', () => {
    expect(isConsumableSpell(new IceBomb(0, 0, CARD))).toBe(true);
  });

  it('is false for an ordinary defender', () => {
    expect(isConsumableSpell(new BasicDefender(0, 0, CARD))).toBe(false);
  });

  it('is false for a healer', () => {
    expect(isConsumableSpell(new HealerDefender(0, 0, CARD))).toBe(false);
  });

  it('is false for null or undefined without throwing', () => {
    expect(isConsumableSpell(null)).toBe(false);
    expect(isConsumableSpell(undefined)).toBe(false);
  });
});

describe('spell damage immunity', () => {
  it('Fire Blast ignores damage entirely', () => {
    const spell = new FireBlast(0, 0, CARD);
    const startingHealth = spell.health;

    const died = spell.takeDamage(500);

    expect(spell.health).toBe(startingHealth);
    expect(spell.isAlive).toBe(true);
    expect(died).toBe(false);
  });

  it('Ice Bomb ignores damage entirely', () => {
    const spell = new IceBomb(0, 0, CARD);
    const startingHealth = spell.health;

    spell.takeDamage(99999);

    expect(spell.health).toBe(startingHealth);
    expect(spell.isAlive).toBe(true);
  });

  it('Fire Blast survives repeated friendly-fire splash', () => {
    const spell = new FireBlast(0, 0, CARD);
    for (let i = 0; i < 20; i++) spell.takeDamage(300 * 0.3);
    expect(spell.isAlive).toBe(true);
  });

  it('an ordinary defender still takes damage', () => {
    const defender = new BasicDefender(0, 0, CARD);
    const startingHealth = defender.health;

    defender.takeDamage(10);

    expect(defender.health).toBe(startingHealth - 10);
    expect(defender.isAlive).toBe(true);
  });

  it('an ordinary defender still dies from enough damage', () => {
    const defender = new BasicDefender(0, 0, CARD);

    const died = defender.takeDamage(99999);

    expect(defender.health).toBe(0);
    expect(defender.isAlive).toBe(false);
    expect(died).toBe(true);
  });
});

describe('healer resurrection targeting', () => {
  /**
   * A level-5 healer with resurrection unlocked, primed to act on the very next
   * update().
   *
   * The healing and resurrection logic sits behind `this.healingCountdown--;
   * if (this.healingCountdown <= 0)`, and a healer starts at healingCountdown =
   * 120. Without priming it to 1, a single update() call decrements to 119 and
   * never reaches the resurrection block at all - so every "does not resurrect"
   * assertion would pass vacuously, proving nothing.
   */
  function createResurrectingHealer() {
    const healer = new HealerDefender(0, 0, { level: 5, image: null });
    healer.applySpecialAbilities();
    healer.gameEngine = { recentlyDiedDefenders: [], explosions: [] };
    healer.healingCountdown = 1;
    return healer;
  }

  /** Puts a unit in the state the resurrection filter looks for. */
  function kill(unit) {
    unit.isAlive = false;
    unit.health = 0;
    return unit;
  }

  it('has resurrection unlocked at level 5', () => {
    const healer = createResurrectingHealer();
    expect(healer.hasResurrection).toBe(true);
    expect(healer.canResurrect).toBe(true);
  });

  it('does not resurrect a spent Fire Blast', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new FireBlast(50, 50, CARD));

    healer.update([], [healer, spell]);

    expect(spell.health).toBe(0);
    expect(spell.isAlive).toBe(false);
    expect(spell.hasBeenResurrected).toBeFalsy();
    expect(healer.canResurrect).toBe(true); // charge not spent on a spell
  });

  it('does not resurrect a spent Ice Bomb', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new IceBomb(50, 50, CARD));

    healer.update([], [healer, spell]);

    expect(spell.health).toBe(0);
    expect(spell.hasBeenResurrected).toBeFalsy();
  });

  it('still resurrects an ordinary dead defender', () => {
    const healer = createResurrectingHealer();
    const defender = kill(new BasicDefender(50, 50, CARD));

    healer.update([], [healer, defender]);

    expect(defender.health).toBeGreaterThan(0);
    expect(defender.hasBeenResurrected).toBe(true);
  });

  it('picks the ordinary defender when a spell is also dead', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new FireBlast(50, 50, CARD));
    const defender = kill(new BasicDefender(60, 60, CARD));

    healer.update([], [healer, spell, defender]);

    expect(defender.health).toBeGreaterThan(0);
    expect(spell.health).toBe(0);
  });
});

describe('spell detonation is audible', () => {
  function createSpellWithEngine(SpellClass) {
    const spell = new SpellClass(0, 0, CARD);
    const emitted = [];
    spell.gameEngine = {
      emitFeedback: (event, payload) => emitted.push({ event, payload }),
      enemies: [],
      defenders: [],
      explosions: [],
      inGameScore: 0,
      enemiesKilled: 0,
      dropManager: { handleEnemyDeath: () => {} },
      waveManager: { totalEnemiesKilled: 0 },
    };
    return { spell, emitted };
  }

  it('Fire Blast emits projectile:fired when it detonates', () => {
    const { spell, emitted } = createSpellWithEngine(FireBlast);

    spell.activate();

    expect(emitted.some((e) => e.event === 'projectile:fired'
      && e.payload.defenderType === 'FireBlast')).toBe(true);
  });

  it('Ice Bomb emits projectile:fired when it detonates', () => {
    const { spell, emitted } = createSpellWithEngine(IceBomb);

    spell.activate();

    expect(emitted.some((e) => e.event === 'projectile:fired'
      && e.payload.defenderType === 'IceBomb')).toBe(true);
  });

  it('a spell without an engine reference does not throw when activated', () => {
    const spell = new FireBlast(0, 0, CARD);
    spell.gameEngine = null;
    expect(() => spell.activate()).not.toThrow();
  });
});
