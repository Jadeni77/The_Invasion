import { describe, it, expect } from 'vitest';
import {
  isConsumableSpell,
  FireBlast,
  IceBomb,
  BasicDefender,
  HealerDefender,
} from '../DefenderUnits.js';

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
