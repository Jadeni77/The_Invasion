import { describe, it, expect, vi } from 'vitest';
import {
  BasicEnemy, RangeEnemy, VampireEnemy, BerserkerEnemy, AssassinEnemy,
  MageEnemy, NecromancerEnemy, SplitterEnemy,
} from '../EnemyUnits.js';
import { BasicDefender } from '../DefenderUnits.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';

/**
 * Task 4: enemy melee, spells and summons were silent, and the enemy attack
 * animation was driven by a frame countdown of its own while the projectile
 * was fired on CombatManager's time-based cooldown - two clocks that drift
 * apart immediately, so a skeleton's swing never lined up with its shot.
 *
 * Every emit below is placed at the site where the action actually happens,
 * because that is the only placement that survives the two ways enemies deal
 * damage: CombatManager calls enemy.attack() BOTH for a genuine melee strike
 * AND from a ranged projectile's onHit callback, so an emit inside the base
 * Enemy.attack() would announce a melee swing every time an arrow landed.
 */
const CARD = { level: 1, image: null };

/** Records every emitFeedback call so a test can count events by name. */
function createEngine(extra = {}) {
  return {
    emitFeedback: vi.fn(),
    enemies: [],
    enemyProjectiles: [],
    spellProjectiles: [],
    explosions: [],
    defenders: [],
    ...extra,
  };
}

function eventsNamed(engine, name) {
  return engine.emitFeedback.mock.calls.filter((call) => call[0] === name);
}

/** A defender-shaped target sitting exactly on top of the given unit. */
function overlappingTarget(unit) {
  return {
    x: unit.x, y: unit.y, width: unit.width, height: unit.height,
    isAlive: true, health: 100, maxHealth: 100,
    takeDamage: vi.fn(() => false),
  };
}

describe('melee strikes are audible', () => {
  /** A melee enemy primed so its very next update() lands a damage tick. */
  function createPrimedMelee(engine) {
    const enemy = new BasicEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.attackCountdown = 1;
    return enemy;
  }

  it('emits enemy:melee on the damage tick, carrying the enemy type', () => {
    const engine = createEngine();
    const enemy = createPrimedMelee(engine);
    const defender = overlappingTarget(enemy);

    enemy.update([defender]);

    expect(defender.takeDamage).toHaveBeenCalledWith(enemy.attackDamage);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'BasicEnemy' },
    );
  });

  it('emits once per damage tick, not once per frame spent in contact', () => {
    // Rejects: an emit placed beside `this.isAttacking = true` rather than
    // beside the takeDamage call. That version fires ~60 times a second while
    // an enemy stands on a defender - a buzz, not a swing.
    const engine = createEngine();
    const enemy = createPrimedMelee(engine);
    const defender = overlappingTarget(enemy);

    for (let i = 0; i < 40; i++) enemy.update([defender]);

    expect(defender.takeDamage).toHaveBeenCalledTimes(1);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(1);
  });

  it('stays silent on the frames between damage ticks', () => {
    const engine = createEngine();
    const enemy = new BasicEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.attackCountdown = 5;
    const defender = overlappingTarget(enemy);

    for (let i = 0; i < 4; i++) enemy.update([defender]);

    expect(defender.takeDamage).not.toHaveBeenCalled();
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });

  it('does not throw when the enemy has no engine reference', () => {
    const enemy = new BasicEnemy(0, 0, null);
    enemy.attackCountdown = 1;

    expect(() => enemy.update([overlappingTarget(enemy)])).not.toThrow();
  });

  it('a landing arrow is a hit, not a melee swing', () => {
    // THE placement test. CombatManager calls enemy.attack() from two sites:
    // the melee branch, and the ranged projectile's onHit callback. An emit
    // inside Enemy.attack() therefore makes a skeleton emit 'enemy:fired' on
    // release and 'enemy:melee' when the arrow lands - wrong sound, wrong
    // moment. This drives the projectile through its real onHit and requires
    // silence from the melee channel.
    const engine = createEngine();
    const skeleton = new RangeEnemy(0, 0, null);
    skeleton.gameEngine = engine;
    const defender = { x: 60, y: 0, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    expect(engine.enemyProjectiles).toHaveLength(1);
    engine.enemyProjectiles[0].onHit();

    expect(defender.takeDamage).toHaveBeenCalled(); // the arrow really landed
    expect(eventsNamed(engine, 'enemy:fired')).toHaveLength(1);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });

  it('VampireEnemy emits its own melee event - its attack() never calls super', () => {
    const engine = createEngine();
    const vampire = new VampireEnemy(0, 0, null);
    vampire.gameEngine = engine;
    const target = overlappingTarget(vampire);

    vampire.attack(target, 1000);

    expect(target.takeDamage).toHaveBeenCalled();
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'VampireEnemy' },
    );
  });

  it('BerserkerEnemy emits its own melee event - its attack() never calls super', () => {
    const engine = createEngine();
    const berserker = new BerserkerEnemy(0, 0, null);
    berserker.gameEngine = engine;
    const target = overlappingTarget(berserker);

    berserker.attack(target, 1000);

    expect(target.takeDamage).toHaveBeenCalled();
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'BerserkerEnemy' },
    );
  });

  it('AssassinEnemy emits for its one critical strike, and only once', () => {
    // The assassination applies damage inside updateBehavior, bypassing both
    // Enemy.attack and the base countdown, so it needs an emit of its own.
    // After hasStruck it delegates to the base behaviour, which is covered by
    // the damage-tick emit - the second update must not add another event.
    const engine = createEngine();
    const assassin = new AssassinEnemy(0, 0, null);
    assassin.gameEngine = engine;
    const defender = new BasicDefender(0, 0, CARD);

    assassin.updateBehavior([defender]);
    assassin.updateBehavior([defender]);

    expect(assassin.hasStruck).toBe(true);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'AssassinEnemy' },
    );
  });

  it('the assassin says nothing when its strike never happens', () => {
    const engine = createEngine();
    const assassin = new AssassinEnemy(0, 0, null);
    assassin.gameEngine = engine;

    assassin.updateBehavior([]); // nobody to strike

    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });
});

describe('enemy spells are audible', () => {
  function createMage(engine, spellType) {
    const mage = new MageEnemy(0, 0, null);
    mage.gameEngine = engine;
    mage.spellType = spellType;
    mage.currentTarget = overlappingTarget(mage);
    return mage;
  }

  it.each(['fireball', 'icebolt'])('emits enemy:spell when the %s leaves the mage', (spell) => {
    const engine = createEngine();
    const mage = createMage(engine, spell);

    mage.performSpellAttack();

    expect(engine.spellProjectiles).toHaveLength(1);
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:spell',
      { unitType: 'MageEnemy' },
    );
  });

  it('emits once for a lightning strike however many defenders it chains to', () => {
    // Lightning deals its damage directly - no projectile - so it is silent
    // unless its own emit exists. Emitting per damaged defender would stack
    // several copies of one spell on top of each other.
    const engine = createEngine();
    const mage = createMage(engine, 'lightning');
    const neighbour = { ...overlappingTarget(mage), id: 'neighbour' };
    const second = { ...overlappingTarget(mage), id: 'second' };
    mage.currentTarget.id = 'primary';
    engine.defenders = [mage.currentTarget, neighbour, second];

    mage.performSpellAttack();

    expect(neighbour.takeDamage).toHaveBeenCalled(); // the chain really fired
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(1);
  });

  it('says nothing when the cast is abandoned because the target died', () => {
    const engine = createEngine();
    const mage = createMage(engine, 'fireball');
    mage.currentTarget.isAlive = false;

    mage.performSpellAttack();

    expect(engine.spellProjectiles).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(0);
  });
});

describe('enemy summons are audible', () => {
  it('the necromancer emits enemy:summon when a skeleton actually appears', () => {
    const engine = createEngine();
    const necromancer = new NecromancerEnemy(0, 0, null);
    necromancer.gameEngine = engine;

    necromancer.reviveSkeletons();

    expect(engine.enemies).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:summon',
      { unitType: 'NecromancerEnemy' },
    );
  });

  it('the necromancer says nothing while frozen, when no skeleton appears', () => {
    const engine = createEngine();
    const necromancer = new NecromancerEnemy(0, 0, null);
    necromancer.gameEngine = engine;
    necromancer.frozen = true;

    necromancer.reviveSkeletons();

    expect(engine.enemies).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(0);
  });

  it('a splitter emits one summon for the whole split, not one per mini', () => {
    // Three minis appear in the same instant; three events would be three
    // copies of one sound fighting each other. The split is one moment.
    const engine = createEngine();
    const splitter = new SplitterEnemy(0, 0, null);
    splitter.gameEngine = engine;

    splitter.takeDamage(9999); // dies, and splits on the way out

    expect(engine.enemies).toHaveLength(splitter.splitCount);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:summon',
      { unitType: 'SplitterEnemy' },
    );
  });

  it('a splitter that survives the hit summons nothing and says nothing', () => {
    const engine = createEngine();
    const splitter = new SplitterEnemy(0, 0, null);
    splitter.gameEngine = engine;

    splitter.takeDamage(1);

    expect(engine.enemies).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(0);
  });
});

describe('the attack animation follows the shot, not a countdown of its own', () => {
  /** A skeleton with a defender comfortably inside its 150px attack range. */
  function createSkeletonAndDefender() {
    const skeleton = new RangeEnemy(0, 0, null);
    const defender = new BasicDefender(50, 0, CARD);
    return { skeleton, defender };
  }

  it('does not play the attack animation just because a defender is in range', () => {
    // THE regression test. RangeEnemy.updateBehavior used to set isAttacking
    // on EVERY frame a defender was in range, so the swing ran continuously
    // and could not line up with anything. A fix that adds the new trigger in
    // CombatManager WITHOUT removing this one looks identical in a test that
    // only checks "firing sets isAttacking" - the animation is simply always
    // on - which is why this test asserts the negative over many frames.
    const { skeleton, defender } = createSkeletonAndDefender();

    for (let i = 0; i < 120; i++) skeleton.update([defender]);

    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.isMoving).toBe(false); // it does still stop to shoot
  });

  it('plays the attack animation on the frame the shot leaves', () => {
    const engine = createEngine();
    const { skeleton, defender } = createSkeletonAndDefender();
    skeleton.gameEngine = engine;
    const combat = new CombatManager(engine);

    skeleton.update([defender]);
    expect(skeleton.isAttacking).toBe(false); // nothing fired yet

    combat.updateEnemyCombat([defender], [skeleton], 1000);

    expect(engine.enemyProjectiles).toHaveLength(1);
    expect(skeleton.isAttacking).toBe(true);
  });

  it('returns to the walk animation once nothing is in range', () => {
    // Rejects: deleting RangeEnemy.updateBehavior's else branch along with the
    // countdown. Without it the enemy would walk forward stuck mid-swing.
    const { skeleton } = createSkeletonAndDefender();
    skeleton.isAttacking = true; // as though it had just fired

    skeleton.update([]);

    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.isMoving).toBe(true);
    expect(skeleton.x).toBeGreaterThan(0);
  });
});
