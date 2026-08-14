import { describe, it, expect, vi } from 'vitest';
import { Sniper, Mortar, GrenadeDefender, HealerDefender } from '../DefenderUnits.js';

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
