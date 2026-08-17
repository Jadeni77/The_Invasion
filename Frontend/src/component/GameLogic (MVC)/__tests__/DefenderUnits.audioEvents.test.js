import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sniper, Mortar, GrenadeDefender, HealerDefender, FrostArcher, DefenderUnit } from '../DefenderUnits.js';
import * as DefenderModule from '../DefenderUnits.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';
import { setFrameDeltaMs } from '../Animation/FrameTime.js';

/**
 * Task 3 (per-unit audio, fix wave): before this change, only BasicDefender
 * (via CombatManager, gated on useProjectile) and FrostArcher emitted
 * 'projectile:fired'. Sniper, Mortar, GrenadeDefender and HealerDefender each
 * perform their attack through a different path - immediate damage, a
 * locally-tracked shell, an immediate explosion, and a heal tick respectively
 * - and none of them emitted anything, so the spec's motivating example
 * (telling a Sniper from a Mortar) was impossible. These tests prove each
 * unit now emits its own event, carrying its own constructor name, at the
 * moment it actually acts.
 */
const CARD = { level: 1, image: null };

function createTarget(overrides = {}) {
  return {
    x: 100, y: 100, width: 40, height: 40, id: 'target',
    isAlive: true, isSpawned: false,
    takeDamage: vi.fn(() => false),
    ...overrides,
  };
}

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

describe('Sniper emits its own firing event', () => {
  it('applies damage directly (no projectile object) yet still emits projectile:fired', () => {
    const sniper = new Sniper(0, 0, CARD);
    sniper.gameEngine = { emitFeedback: vi.fn(), enemies: [], gameOver: false };
    const target = createTarget();

    sniper.attack(target, 1000);

    expect(target.takeDamage).toHaveBeenCalled();
    expect(sniper.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'projectile:fired',
      { defenderType: 'Sniper' },
    );
  });

  it('does not throw when attacking without a gameEngine reference', () => {
    const sniper = new Sniper(0, 0, CARD);
    // Sniper.attack() already bails out early with no gameEngine at all (it
    // needs the engine for scoring/explosions), so nothing should throw.
    expect(() => sniper.attack(createTarget(), 1000)).not.toThrow();
  });
});

describe('Mortar emits its own firing event', () => {
  function createMortarTarget() {
    // Mortar center sits at (32, 32) for a 64x64 unit at (0,0); this target's
    // center lands ~400px away, comfortably inside the default 250-700 valid
    // attack ring so isValidTarget() passes.
    return { x: 400, y: 0, width: 64, height: 64, isAlive: true };
  }

  it('queues a locally-tracked shell (no gameEngine.projectiles entry) yet still emits projectile:fired', () => {
    const mortar = new Mortar(0, 0, CARD);
    mortar.gameEngine = { emitFeedback: vi.fn() };
    const target = createMortarTarget();

    mortar.attack(target, 1000);

    expect(mortar.pendingShells).toHaveLength(1);
    expect(mortar.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'projectile:fired',
      { defenderType: 'Mortar' },
    );
  });

  it('does not emit when the target is outside the valid ring (attack never actually fires)', () => {
    const mortar = new Mortar(0, 0, CARD);
    mortar.gameEngine = { emitFeedback: vi.fn() };
    const tooClose = { x: 10, y: 10, width: 64, height: 64, isAlive: true };

    mortar.attack(tooClose, 1000);

    expect(mortar.gameEngine.emitFeedback).not.toHaveBeenCalled();
  });

  it('does not throw when attacking without a gameEngine reference', () => {
    const mortar = new Mortar(0, 0, CARD);
    expect(() => mortar.attack(createMortarTarget(), 1000)).not.toThrow();
  });
});

/**
 * The other half of the Mortar's two sounds: it fired with a sound and landed
 * with nothing (createExplosion emitted no feedback event at all). The
 * landing must lead the shared 'hit' sound that follows it for every enemy
 * the splash catches (GameEngine.addDefenderExplosion's 'enemy:hit' emits),
 * so it is emitted BEFORE addDefenderExplosion is called, not after.
 */
describe('the Mortar\'s shell landing emits its own event', () => {
  function createMortarTarget() {
    return { x: 400, y: 0, width: 64, height: 64, isAlive: true };
  }

  function eventsNamed(engine, name) {
    return engine.emitFeedback.mock.calls.filter((call) => call[0] === name);
  }

  it('emits defender:shellLanded exactly when the shell actually lands', () => {
    const mortar = new Mortar(0, 0, CARD);
    const engine = { emitFeedback: vi.fn(), addDefenderExplosion: vi.fn(), explosions: [] };
    mortar.gameEngine = engine;
    mortar.attack(createMortarTarget(), 1000);

    for (let i = 0; i < 1000 && mortar.pendingShells.length > 0; i++) mortar.update([], []);

    expect(mortar.pendingShells).toHaveLength(0); // sanity: it really landed
    expect(eventsNamed(engine, 'defender:shellLanded')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'defender:shellLanded',
      { defenderType: 'Mortar' },
    );
  });

  it('does not emit the landing sound before the shell lands', () => {
    // Verified by mutation: temporarily moving the emit into attack() (fired
    // the instant the shell launches, instead of when it lands) makes this
    // fail, as does removing the guard entirely and emitting on every
    // update() tick.
    const mortar = new Mortar(0, 0, CARD);
    const engine = { emitFeedback: vi.fn(), addDefenderExplosion: vi.fn(), explosions: [] };
    mortar.gameEngine = engine;
    mortar.attack(createMortarTarget(), 1000);

    // Drive update() one tick at a time up to (but not past) the instant
    // before landing, derived from the shell's own remaining flight time
    // rather than a hand-computed frame count.
    let guard = 0;
    while (mortar.pendingShells.length > 0 && mortar.pendingShells[0].timeRemaining > 1 && guard < 1000) {
      mortar.update([], []);
      guard++;
    }

    expect(mortar.pendingShells).toHaveLength(1); // still in flight
    expect(eventsNamed(engine, 'defender:shellLanded')).toHaveLength(0);
  });

  it('never fires the landing sound for an attack that never launches a shell', () => {
    const mortar = new Mortar(0, 0, CARD);
    const engine = { emitFeedback: vi.fn(), addDefenderExplosion: vi.fn(), explosions: [] };
    mortar.gameEngine = engine;
    const tooClose = { x: 10, y: 10, width: 64, height: 64, isAlive: true };

    mortar.attack(tooClose, 1000);
    for (let i = 0; i < 300; i++) mortar.update([], []);

    expect(eventsNamed(engine, 'defender:shellLanded')).toHaveLength(0);
  });

  it('emits the landing sound before addDefenderExplosion applies splash damage, so it leads the hit sound rather than trailing it', () => {
    // Verified by mutation: swapping the two statements' order in
    // createExplosion makes this fail.
    const mortar = new Mortar(0, 0, CARD);
    const engine = { emitFeedback: vi.fn(), addDefenderExplosion: vi.fn(), explosions: [] };
    mortar.gameEngine = engine;

    mortar.createExplosion(100, 100);

    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'defender:shellLanded',
      { defenderType: 'Mortar' },
    );
    expect(engine.addDefenderExplosion).toHaveBeenCalled();
    const emitOrder = engine.emitFeedback.mock.invocationCallOrder[0];
    const explosionOrder = engine.addDefenderExplosion.mock.invocationCallOrder[0];
    expect(emitOrder).toBeLessThan(explosionOrder);
  });

  it('does not throw when landing without a gameEngine reference', () => {
    const mortar = new Mortar(0, 0, CARD);
    expect(() => mortar.createExplosion(100, 100)).not.toThrow();
  });
});

describe('GrenadeDefender emits its own firing event', () => {
  it('triggers an immediate explosion (no projectile object) yet still emits projectile:fired', () => {
    const grenadier = new GrenadeDefender(0, 0, CARD);
    grenadier.gameEngine = {
      emitFeedback: vi.fn(),
      addDefenderExplosion: vi.fn(),
      explosions: [],
    };
    const target = createTarget();

    grenadier.attack(target, 1000);

    expect(grenadier.gameEngine.addDefenderExplosion).toHaveBeenCalled();
    expect(grenadier.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'projectile:fired',
      { defenderType: 'GrenadeDefender' },
    );
  });

  it('does not throw when attacking without a gameEngine reference (and does not attempt to explode)', () => {
    const grenadier = new GrenadeDefender(0, 0, CARD);
    expect(() => grenadier.attack(createTarget(), 1000)).not.toThrow();
  });
});

describe('HealerDefender emits its own firing event on a successful heal', () => {
  /** Primes the healer so the very next update() reaches the heal logic. */
  function createReadyHealer() {
    const healer = new HealerDefender(0, 0, CARD);
    healer.gameEngine = { emitFeedback: vi.fn(), explosions: [] };
    healer.healingCountdown = 1;
    return healer;
  }

  it('heals an ally via update() (no attack() override, no projectile) yet still emits projectile:fired', () => {
    const healer = createReadyHealer();
    const ally = {
      id: 'ally', isAlive: true, health: 50, maxHealth: 100,
      x: 0, y: 0, width: 64, height: 64,
    };

    healer.update([], [healer, ally]);

    expect(ally.health).toBeGreaterThan(50);
    expect(healer.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'projectile:fired',
      { defenderType: 'HealerDefender' },
    );
  });

  it('does not emit when there is nobody to heal (no heal, no event)', () => {
    const healer = createReadyHealer();

    healer.update([], [healer]);

    expect(healer.gameEngine.emitFeedback).not.toHaveBeenCalled();
  });

  it('does not throw when healing without a gameEngine reference', () => {
    const healer = new HealerDefender(0, 0, CARD);
    healer.healingCountdown = 1;
    const ally = {
      id: 'ally', isAlive: true, health: 50, maxHealth: 100,
      x: 0, y: 0, width: 64, height: 64,
    };

    expect(() => healer.update([], [healer, ally])).not.toThrow();
  });
});

/**
 * Fix round 1: enemy:hit's `damage` field is not cosmetic - GameEngine feeds
 * it straight into juice.addDamageNumber(x, y, damage), the floating number
 * the player reads on screen. Sniper and FrostArcher both emitted
 * this.attackDamage there, ignoring the actual damage applied a couple of
 * lines above (crit multiplier for Sniper, PermaFrost bonus for FrostArcher).
 * These tests force the bonus path deterministically - no reliance on a
 * random crit roll - and assert the emitted damage matches what was really
 * dealt, not the unit's base stat.
 */
describe('enemy:hit carries the real damage dealt, not the base stat', () => {
  it('Sniper emits the post-crit damage when a critical hit occurs', () => {
    const sniper = new Sniper(0, 0, CARD);
    sniper.gameEngine = { emitFeedback: vi.fn(), enemies: [], gameOver: false };
    const target = createTarget();

    // Force the crit roll deterministically instead of relying on chance.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      sniper.attack(target, 1000);
    } finally {
      randomSpy.mockRestore();
    }

    const expectedDamage = sniper.attackDamage * sniper.critMultiplier;
    expect(expectedDamage).not.toBe(sniper.attackDamage); // sanity: crit actually changes the value
    expect(sniper.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'enemy:hit',
      expect.objectContaining({ damage: expectedDamage }),
    );
  });

  it('FrostArcher emits attackDamage + PermaFrost bonus against an already-slowed target', () => {
    const archer = new FrostArcher(0, 0, { level: 3, image: null });
    archer.applySpecialAbilities(); // unlocks PermaFrost at level 3
    expect(archer.hasPermaFrost).toBe(true);
    archer.gameEngine = { emitFeedback: vi.fn(), explosions: [] };

    const enemy = {
      x: 100, y: 100, width: 40, height: 40, isAlive: true,
      slowed: true, frozen: false,
      takeDamage: vi.fn(() => false),
    };

    archer.onProjectileHit(enemy);

    const extraDamage = archer.attackDamage * 0.5;
    const expectedDamage = archer.attackDamage + extraDamage;
    expect(expectedDamage).not.toBe(archer.attackDamage); // sanity: bonus actually changes the value
    expect(archer.gameEngine.emitFeedback).toHaveBeenCalledWith(
      'enemy:hit',
      expect.objectContaining({ damage: expectedDamage }),
    );
  });
});

/**
 * Playtest fix, bug 1: the class list is DERIVED, not written out.
 *
 * The suite above names five defenders by hand. A hand-written list is exactly
 * how a silent unit survives: add an eleventh defender, forget to add it here,
 * and the gap is invisible. This block enumerates the module's own exports
 * instead, so any future ranged defender is covered the moment it is exported.
 *
 * It also drives the real CombatManager rather than calling attack() directly,
 * because "does the unit emit" and "does the path the game actually takes
 * reach the emit" are different questions - CombatManager's
 * `isRanged && useProjectile` branch is what made them different in the first
 * place, and only BasicDefender sets useProjectile.
 */
describe('every ranged defender the module exports emits when it fires', () => {
  /** Every concrete DefenderUnit subclass exported by DefenderUnits.js. */
  const exportedDefenderClasses = Object.entries(DefenderModule).filter(
    ([, exported]) =>
      typeof exported === 'function' && exported.prototype instanceof DefenderUnit,
  );

  const rangedDefenderClasses = exportedDefenderClasses.filter(
    ([, DefenderClass]) => new DefenderClass(0, 0, CARD).isRanged,
  );

  it('derives a non-trivial class list from the exports', () => {
    // Guards the derivation itself: a filter that silently matched nothing
    // would make every it.each below vacuous, which is the failure mode a
    // derived list is supposed to remove.
    const names = rangedDefenderClasses.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining(['BasicDefender', 'Sniper', 'Mortar', 'GrenadeDefender', 'FrostArcher']),
    );
  });

  function createEngine() {
    return {
      emitFeedback: vi.fn(),
      addDefenderExplosion: vi.fn(),
      projectiles: [],
      enemyProjectiles: [],
      explosions: [],
      enemies: [],
      canvasWidth: 800,
      gameOver: false,
    };
  }

  /**
   * Places a target at a distance every unit accepts: halfway between its
   * minimum range (Mortar refuses anything closer than minimumRange) and its
   * maximum. Derived from the unit's own stats so it stays correct if a unit
   * is rebalanced.
   */
  function targetInRangeOf(defender) {
    const distance = ((defender.minimumRange || 0) + defender.range) / 2;
    const centerX = defender.x + defender.width / 2 + distance;
    return {
      x: centerX - 20, y: defender.y + defender.height / 2 - 20,
      width: 40, height: 40, id: 'target',
      isAlive: true, isSpawned: false, frozen: false, slowed: false,
      health: 100, maxHealth: 100, attackDamage: 0,
      takeDamage: vi.fn(() => false),
    };
  }

  it.each(rangedDefenderClasses)(
    '%s emits exactly one projectile:fired for one attack',
    (name, DefenderClass) => {
      const engine = createEngine();
      const defender = new DefenderClass(0, 0, CARD);
      defender.gameEngine = engine;
      const target = targetInRangeOf(defender);
      engine.enemies = [target];

      const combat = new CombatManager(engine);
      // Far past any cooldown: lastAttackTime starts at 0.
      combat.updateDefenderCombat([defender], [target], 100000);

      const fired = engine.emitFeedback.mock.calls.filter(
        (call) => call[0] === 'projectile:fired',
      );
      expect(fired).toHaveLength(1);
      expect(fired[0][1]).toEqual({ defenderType: name });
    },
  );
});
