/*
 * A boss is a boss whichever enemy drew the role.
 *
 * The buff used to be a flat multiple of the type's own health, which made a
 * boss out of a Titan and nothing out of the rest: a boss Vampire came out at
 * 225 health, inside one defender volley. The floor is the fix, and it has to
 * hold for every type in the registry - including the next one added, which is
 * why this walks the roster rather than naming the type that failed.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine.js';

const GRID = 100;

/** Enough of an engine to spawn into, and nothing more. */
function spawner() {
  const engine = Object.create(GameEngine.prototype);
  engine.enemies = [];
  engine.enemyClasses = new GameEngine().enemyClasses;
  engine.gridManager = {
    getEnemySpawnX: () => 1200,
    getRandomSpawnRow: () => 0,
    getRowCenterY: () => 300,
    gridSize: GRID,
  };
  engine.animationManager = null;
  return engine;
}

/** The one of `type` just spawned, boss or not. */
function spawn(engine, type, options) {
  engine.spawnEnemyOfType(type, options);
  return engine.enemies[engine.enemies.length - 1];
}

const engine = spawner();
const TYPES = Object.keys(engine.enemyClasses);

describe('the enemy roster', () => {
  it('is really there, so the walk below is not vacuous', () => {
    expect(TYPES.length).toBeGreaterThan(10);
    expect(TYPES).toContain('Vampire');
    expect(TYPES).toContain('Titan');
  });
});

describe('a boss, whatever type it is', () => {
  const BOSS_FLOOR = 1500;

  it.each(TYPES)('gives %s at least a boss’s worth of health', (type) => {
    const boss = spawn(spawner(), type, { isBoss: true });

    expect(boss.maxHealth).toBeGreaterThanOrEqual(BOSS_FLOOR);
    expect(boss.health).toBe(boss.maxHealth); // Arrives full, not part-damaged.
  });

  it.each(TYPES)('leaves %s alone when it is not the boss', (type) => {
    const plain = spawn(spawner(), type, {});
    const base = new engine.enemyClasses[type](0, 0, null);

    expect(plain.maxHealth).toBe(base.maxHealth);
    expect(plain.isBoss).toBeFalsy();
  });

  it('still scales up the types that already clear the floor', () => {
    const titan = spawn(spawner(), 'Titan', { isBoss: true });
    const base = new engine.enemyClasses.Titan(0, 0, null);

    // A floor that swallowed the big types would flatten Titan to 1500.
    expect(titan.maxHealth).toBe(base.maxHealth * 2);
    expect(titan.maxHealth).toBeGreaterThan(BOSS_FLOOR);
  });

  it('hits harder and pays out more than its plain form', () => {
    const boss = spawn(spawner(), 'Vampire', { isBoss: true });
    const plain = spawn(spawner(), 'Vampire', {});

    expect(boss.attackDamage).toBeGreaterThan(plain.attackDamage);
    expect(boss.bounty).toBeGreaterThan(plain.bounty);
  });
});
