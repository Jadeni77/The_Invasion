import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../GameEngine.js';

/**
 * emitEnemyDeathFeedback is tested in isolation, without constructing a full
 * GameEngine (which needs canvas/level-config wiring). Pulling the real
 * prototype methods onto a minimal object keeps this in sync with the actual
 * implementation instead of re-describing its logic.
 */
function createFakeEngine() {
  return {
    feedbackBus: { emit: vi.fn() },
    emitFeedback: GameEngine.prototype.emitFeedback,
    emitEnemyDeathFeedback: GameEngine.prototype.emitEnemyDeathFeedback,
  };
}

describe('GameEngine.emitEnemyDeathFeedback', () => {
  it('emits enemy:died at most once per enemy, even when called twice', () => {
    const engine = createFakeEngine();
    const enemy = { isBoss: false, x: 10, y: 20 };

    engine.emitEnemyDeathFeedback(enemy);
    engine.emitEnemyDeathFeedback(enemy);

    // Per-unit voices (Task 3): the payload now carries unitType, taken from
    // enemy.constructor.name. These fixtures are plain object literals, so
    // that name is 'Object' rather than a real unit class.
    expect(engine.feedbackBus.emit).toHaveBeenCalledTimes(1);
    expect(engine.feedbackBus.emit).toHaveBeenCalledWith('enemy:died', {
      unitType: 'Object', isBoss: false, x: 10, y: 20,
    });
  });

  it('still emits for a genuinely different enemy', () => {
    const engine = createFakeEngine();
    const enemyA = { isBoss: false, x: 1, y: 2 };
    const enemyB = { isBoss: true, x: 3, y: 4 };

    engine.emitEnemyDeathFeedback(enemyA);
    engine.emitEnemyDeathFeedback(enemyA); // repeat: suppressed
    engine.emitEnemyDeathFeedback(enemyB); // different enemy: not suppressed

    // Per-unit voices (Task 3): unitType is included in the payload (see comment above).
    expect(engine.feedbackBus.emit).toHaveBeenCalledTimes(2);
    expect(engine.feedbackBus.emit).toHaveBeenNthCalledWith(1, 'enemy:died', {
      unitType: 'Object', isBoss: false, x: 1, y: 2,
    });
    expect(engine.feedbackBus.emit).toHaveBeenNthCalledWith(2, 'enemy:died', {
      unitType: 'Object', isBoss: true, x: 3, y: 4,
    });
  });

  it('is a no-op when no enemy is given', () => {
    const engine = createFakeEngine();
    engine.emitEnemyDeathFeedback(null);
    expect(engine.feedbackBus.emit).not.toHaveBeenCalled();
  });
});

/**
 * collectEnergy is tested the same way: real prototype method pulled onto a
 * minimal fake with just the fields it touches, plus fake EnergyDrop-shaped
 * objects (checkCollection/collectAnimation/startCollectionAnimation/amount).
 */
function createFakeEnergyEngine() {
  return {
    energyDrops: [],
    inGameEnergy: 0,
    energyCollected: 0,
    emitFeedback: vi.fn(),
    updateEnergyCb: vi.fn(),
    collectEnergy: GameEngine.prototype.collectEnergy,
  };
}

describe('GameEngine.collectEnergy', () => {
  it('does not award energy or consume the click for a drop already flying to the bar', () => {
    const engine = createFakeEnergyEngine();
    const drop = {
      collectAnimation: true, // already in-flight (e.g. autoCollectEnergy)
      amount: 10,
      checkCollection: vi.fn(() => true), // pure geometry says the click lands on it
      startCollectionAnimation: vi.fn(),
    };
    engine.energyDrops = [drop];

    const collected = engine.collectEnergy(100, 100);

    expect(collected).toBe(false);
    expect(engine.inGameEnergy).toBe(0);
    expect(drop.startCollectionAnimation).not.toHaveBeenCalled();
  });

  it('still collects a drop that is not yet animating', () => {
    const engine = createFakeEnergyEngine();
    const drop = {
      collectAnimation: false,
      amount: 10,
      checkCollection: vi.fn(() => true),
      startCollectionAnimation: vi.fn(),
    };
    engine.energyDrops = [drop];

    const collected = engine.collectEnergy(100, 100);

    expect(collected).toBe(true);
    expect(engine.inGameEnergy).toBe(10);
    expect(drop.startCollectionAnimation).toHaveBeenCalledOnce();
  });
});

/**
 * resetGame is tested the same way: real prototype method pulled onto a
 * minimal fake with just the fields it touches, so we don't need to stand up
 * a full GameEngine (canvas, level configs, animations, ...).
 */
function createFakeResetEngine(overrides = {}) {
  return {
    currentLevelConfig: { initialEnergy: 100 },
    gameClock: { reset: vi.fn(), now: 0 },
    waveManager: null,
    gridManager: null,
    juiceManager: null,
    updateEnergyCb: vi.fn(),
    updateScoreCb: vi.fn(),
    updateBaseHealthCb: vi.fn(),
    stopLoop: vi.fn(),
    resetGame: GameEngine.prototype.resetGame,
    ...overrides,
  };
}

describe('GameEngine.resetGame', () => {
  it('resets the juiceManager when one is attached', () => {
    const juiceManager = { reset: vi.fn() };
    const engine = createFakeResetEngine({ juiceManager });
    engine.resetGame();
    expect(juiceManager.reset).toHaveBeenCalledOnce();
  });

  it('does not throw when juiceManager is null', () => {
    const engine = createFakeResetEngine({ juiceManager: null });
    expect(() => engine.resetGame()).not.toThrow();
  });

  it('defaults to announcing wave 1 (genuine new-level start via initialize())', () => {
    const waveManager = { reset: vi.fn(), lastSpawnTime: 0 };
    const engine = createFakeResetEngine({ waveManager });
    engine.resetGame();
    expect(waveManager.reset).toHaveBeenCalledWith(true);
  });

  it('passes announceWaveStart=false through so end-of-level cleanup stays silent', () => {
    const waveManager = { reset: vi.fn(), lastSpawnTime: 0 };
    const engine = createFakeResetEngine({ waveManager });
    engine.resetGame(false);
    expect(waveManager.reset).toHaveBeenCalledWith(false);
  });
});

describe('sizeUnitToGrid', () => {
  function engineWithCell(gridSize) {
    return {
      gridManager: gridSize === null ? null : { gridSize },
      sizeUnitToGrid: GameEngine.prototype.sizeUnitToGrid,
      checkCollision: GameEngine.prototype.checkCollision,
    };
  }

  it('sizes a unit to the cell when the cell is small', () => {
    const engine = engineWithCell(48);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(48);
    expect(unit.height).toBe(48);
  });

  it('sizes a unit up to a larger cell too', () => {
    const engine = engineWithCell(80);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(80);
    expect(unit.height).toBe(80);
  });

  it('returns the unit so it can be used inline', () => {
    const engine = engineWithCell(60);
    const unit = { width: 64, height: 64 };

    expect(engine.sizeUnitToGrid(unit)).toBe(unit);
  });

  it('leaves the unit alone when no grid manager is attached', () => {
    const engine = engineWithCell(null);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(64);
  });
});

describe('adjacent deployment at small cell sizes', () => {
  /**
   * Reproduces the reported bug directly: two units in neighbouring cells.
   * checkCollision is strict AABB, so units that exactly touch do not collide.
   */
  function placeInCell(engine, cellIndex, cellSize, unitSize) {
    const cellX = cellIndex * cellSize;
    return {
      x: cellX + (cellSize - unitSize) / 2,
      y: 0,
      width: unitSize,
      height: unitSize,
    };
  }

  const engine = { checkCollision: GameEngine.prototype.checkCollision };

  it('64px units in 60px cells DO overlap - this is the bug', () => {
    const a = placeInCell(engine, 0, 60, 64);
    const b = placeInCell(engine, 1, 60, 64);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(true);
  });

  it('cell-sized units in 60px cells do NOT overlap - this is the fix', () => {
    const a = placeInCell(engine, 0, 60, 60);
    const b = placeInCell(engine, 1, 60, 60);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(false);
  });

  it('cell-sized units do not overlap at the minimum cell size either', () => {
    const a = placeInCell(engine, 0, 40, 40);
    const b = placeInCell(engine, 1, 40, 40);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(false);
  });
});
