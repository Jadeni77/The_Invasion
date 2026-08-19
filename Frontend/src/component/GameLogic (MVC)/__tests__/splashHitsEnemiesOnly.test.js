/*
 * A defender's blast is for the enemy standing in it.
 *
 * It used to take 30% off every defender inside the radius too, which taxed the
 * formation the game teaches - wall in front, splash behind - and said nothing
 * on screen, so it read as a bug rather than as a cost. It also got worse the
 * more the player invested: once explosionRadius started scaling with level, a
 * level-5 Mortar covered 3.7x the area of a level-1 one.
 *
 * The enemy's own explosions must keep hurting defenders, so both directions
 * are asserted here - deleting the wrong loop would otherwise pass.
 */
import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../GameEngine.js';

const CENTRE = { x: 500, y: 300 };
const RADIUS = 150;

/** Something with a hit box, at a distance from the blast centre. */
function unitAt(distance) {
  return {
    isAlive: true,
    name: 'unit',
    width: 40,
    height: 40,
    x: CENTRE.x + distance - 20,
    y: CENTRE.y - 20,
    health: 500,
    maxHealth: 500,
    bounty: 0,
    isSpawned: false,
    takeDamage: vi.fn(() => false),
  };
}

/** Enough of an engine to detonate something in. */
function engineWith({ enemies = [], defenders = [] } = {}) {
  const engine = Object.create(GameEngine.prototype);
  engine.gameOver = false;
  engine.enemies = enemies;
  engine.defenders = defenders;
  engine.explosions = [];
  engine.inGameScore = 0;
  engine.enemiesKilled = 0;
  engine.updateScoreCb = vi.fn();
  engine.emitFeedback = vi.fn();
  engine.emitEnemyDeathFeedback = vi.fn();
  engine.dropManager = { handleEnemyDeath: vi.fn() };
  return engine;
}

describe('a defender explosion', () => {
  it('damages an enemy inside it', () => {
    const enemy = unitAt(50);
    const engine = engineWith({ enemies: [enemy] });

    engine.addDefenderExplosion(CENTRE.x, CENTRE.y, 100, RADIUS);

    expect(enemy.takeDamage).toHaveBeenCalled();
  });

  it('spares a defender standing in the same blast', () => {
    const enemy = unitAt(50);
    const ally = unitAt(50);
    const engine = engineWith({ enemies: [enemy], defenders: [ally] });

    engine.addDefenderExplosion(CENTRE.x, CENTRE.y, 100, RADIUS);

    expect(enemy.takeDamage, 'the enemy is the point of the blast').toHaveBeenCalled();
    expect(ally.takeDamage, 'friendly fire is gone').not.toHaveBeenCalled();
  });

  it('spares a defender at the centre of the blast', () => {
    const ally = unitAt(0);
    const engine = engineWith({ defenders: [ally] });

    engine.addDefenderExplosion(CENTRE.x, CENTRE.y, 500, RADIUS);

    expect(ally.takeDamage).not.toHaveBeenCalled();
  });

  it('spares a defender however wide the blast grows with level', () => {
    // The upgraded Mortar's radius, which is where this hurt most.
    const ally = unitAt(180);
    const engine = engineWith({ defenders: [ally] });

    engine.addDefenderExplosion(CENTRE.x, CENTRE.y, 216, 192);

    expect(ally.takeDamage).not.toHaveBeenCalled();
  });

  it('leaves an enemy outside the radius alone', () => {
    const far = unitAt(RADIUS + 200);
    const engine = engineWith({ enemies: [far] });

    engine.addDefenderExplosion(CENTRE.x, CENTRE.y, 100, RADIUS);

    expect(far.takeDamage).not.toHaveBeenCalled();
  });
});

describe('an enemy explosion', () => {
  it('still damages a defender inside it', () => {
    const ally = unitAt(50);
    const engine = engineWith({ defenders: [ally] });

    engine.addEnemyExplosion(CENTRE.x, CENTRE.y, 80, RADIUS);

    expect(ally.takeDamage).toHaveBeenCalledWith(80);
  });

  it('leaves a defender outside the radius alone', () => {
    const far = unitAt(RADIUS + 200);
    const engine = engineWith({ defenders: [far] });

    engine.addEnemyExplosion(CENTRE.x, CENTRE.y, 80, RADIUS);

    expect(far.takeDamage).not.toHaveBeenCalled();
  });
});
