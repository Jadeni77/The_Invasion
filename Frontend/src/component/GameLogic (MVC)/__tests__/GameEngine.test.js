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

    expect(engine.feedbackBus.emit).toHaveBeenCalledTimes(1);
    expect(engine.feedbackBus.emit).toHaveBeenCalledWith('enemy:died', {
      isBoss: false, x: 10, y: 20,
    });
  });

  it('still emits for a genuinely different enemy', () => {
    const engine = createFakeEngine();
    const enemyA = { isBoss: false, x: 1, y: 2 };
    const enemyB = { isBoss: true, x: 3, y: 4 };

    engine.emitEnemyDeathFeedback(enemyA);
    engine.emitEnemyDeathFeedback(enemyA); // repeat: suppressed
    engine.emitEnemyDeathFeedback(enemyB); // different enemy: not suppressed

    expect(engine.feedbackBus.emit).toHaveBeenCalledTimes(2);
    expect(engine.feedbackBus.emit).toHaveBeenNthCalledWith(1, 'enemy:died', {
      isBoss: false, x: 1, y: 2,
    });
    expect(engine.feedbackBus.emit).toHaveBeenNthCalledWith(2, 'enemy:died', {
      isBoss: true, x: 3, y: 4,
    });
  });

  it('is a no-op when no enemy is given', () => {
    const engine = createFakeEngine();
    engine.emitEnemyDeathFeedback(null);
    expect(engine.feedbackBus.emit).not.toHaveBeenCalled();
  });
});
