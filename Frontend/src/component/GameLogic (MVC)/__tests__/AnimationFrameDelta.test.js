import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { GameClock } from '../Feedback/GameClock.js';
import { RangeEnemy } from '../EnemyUnits.js';
import { BasicDefender } from '../DefenderUnits.js';
import * as AttackPlayback from '../Animation/AttackPlayback.js';
import { attackAnimationDurationMs } from '../Animation/AttackPlayback.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';
import { AssetManifest } from '../../../assets/AssetManifest.js';

/* Playtest report: "the attacks are not consistent... */

/** The refresh rates worth caring about: ProMotion, standard, and a bad drop. */
const FRAME_MS = {
  '120Hz (ProMotion)': 1000 / 120,
  '60Hz': 1000 / 60,
  '30fps (dropping frames)': 1000 / 30,
};

/** Sprite data in the shape GameEngine hands a unit after loading. */
function withManifestAnimations(unit, category, manifestName) {
  const config = AssetManifest[category][manifestName].config;
  unit.animationConfig = config;
  unit.animationFrames = Object.fromEntries(
    Object.entries(config).map(([animation, { frameCount }]) => [
      animation,
      Array.from({ length: frameCount }, (_, index) => `${animation}:${index}`),
    ]),
  );
  return unit;
}

/* A GameEngine reduced to the frame loop. */
function createFrameEngine() {
  const engine = {
    // State GameEngine.update() reads.
    gameOver: false,
    isPaused: false,
    lastFrameTime: null,
    gameClock: new GameClock(),
    juiceManager: null,
    currentLevelConfig: null,
    drawUIs: null,
    waveManager: { update: () => {} },

    // State the units and CombatManager reach back for.
    enemies: [],
    defenders: [],
    projectiles: [],
    enemyProjectiles: [],
    explosions: [],
    canvasWidth: 800,
    emitFeedback: () => {},

    update: GameEngine.prototype.update,

    // The lists also hold the plain target fixtures the unit under test is
    // shooting at, which have no update() of their own.
    updateDefenders() {
      for (const defender of this.defenders) defender.update?.(this.enemies, this.defenders);
    },
    updateEnemies() {
      for (const enemy of this.enemies) enemy.update?.(this.defenders);
    },

    // Out of scope for animation timing.
    updateProjectiles: () => {},
    updateEnemyProjectiles: () => {},
    updateSpellProjectiles: () => {},
    updateEnergyDrops: () => {},
    updateCardPieceDrops: () => {},
    updateExplosions: () => {},
    checkGameConditions: () => {},
  };
  return engine;
}

/** Drives an engine at a fixed refresh rate against a mocked wall clock. */
function createFrameDriver(engine, frameMs) {
  let nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

  return {
    get wallClockMs() {
      return nowMs;
    },
    tick() {
      nowMs += frameMs;
      engine.update();
    },
  };
}

/**
 * How long, in wall-clock ms, the unit spends showing its attack sheet when the
 * loop runs at frameMs per frame.
 */
function timeAttackAnimation({ frameMs, build }) {
  const engine = createFrameEngine();
  const { unit, startAttack } = build(engine);
  const driver = createFrameDriver(engine, frameMs);

  driver.tick(); // First frame of the loop: no time has elapsed yet.
  startAttack();
  expect(unit.isAttacking, 'the attack never started').toBe(true);

  const startedAtMs = driver.wallClockMs;
  const budgetMs = 5000;
  while (unit.isAttacking && driver.wallClockMs - startedAtMs < budgetMs) driver.tick();

  expect(unit.isAttacking, 'the sheet never finished').toBe(false);
  return driver.wallClockMs - startedAtMs;
}

/** The wall-clock length one pass over the sheet is supposed to take. */
function intendedAttackMs(category, manifestName, cadenceMs) {
  return attackAnimationDurationMs(
    AssetManifest[category][manifestName].config.attack,
    cadenceMs,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an attack sheet takes the same wall-clock time at any refresh rate', () => {
  it.each(Object.entries(FRAME_MS))(
    'plays the skeleton sheet over its full firing cadence at %s',
    (_label, frameMs) => {
      // The Skeleton Shooter's sheet (10 frames at 10fps = 1000ms) is longer than
      // its 833ms cadence, so playback compresses it to the cadence. That is a
      // wall-clock duration: at 120Hz the old nominal-frame stepping finished it
      // in ~417ms, at 30fps it took ~1667ms.
      const elapsedMs = timeAttackAnimation({
        frameMs,
        build: (engine) => {
          const skeleton = withManifestAnimations(
            new RangeEnemy(0, 0, null), 'enemies', 'Skeleton Shooter',
          );
          skeleton.gameEngine = engine;
          const defender = {
            x: 60, y: 0, width: 40, height: 40, isAlive: true,
            takeDamage: vi.fn(() => false),
          };
          engine.enemies = [skeleton];
          engine.defenders = [defender];

          return {
            unit: skeleton,
            startAttack: () =>
              new CombatManager(engine).updateEnemyCombat([defender], [skeleton], 1000),
          };
        },
      });

      const skeletonCadenceMs = (new RangeEnemy(0, 0, null).attackRate * 1000) / 60;
      const intendedMs = intendedAttackMs('enemies', 'Skeleton Shooter', skeletonCadenceMs);

      expect(elapsedMs).toBeGreaterThan(intendedMs - 2 * frameMs);
      expect(elapsedMs).toBeLessThan(intendedMs + 2 * frameMs);
    },
  );

  it.each(Object.entries(FRAME_MS))(
    'plays the Shooter sheet at its authored length at %s',
    (_label, frameMs) => {
      // The defender path is a separate implementation from the enemy one, so it
      // gets its own measurement. The Shooter's sheet (7 frames at 14fps = 500ms)
      // is shorter than its 1000ms cadence and so plays at its authored speed -
      // 500ms of real time, not 250ms at 120Hz.
      const elapsedMs = timeAttackAnimation({
        frameMs,
        build: (engine) => {
          const shooter = withManifestAnimations(
            new BasicDefender(0, 0, { level: 1, image: null }), 'defenders', 'Shooter',
          );
          shooter.gameEngine = engine;
          const target = {
            x: 150, y: 0, width: 40, height: 40, isAlive: true,
            takeDamage: vi.fn(() => false),
          };
          engine.defenders = [shooter];
          engine.enemies = [target];

          return {
            unit: shooter,
            startAttack: () =>
              new CombatManager(engine).updateDefenderCombat([shooter], [target], 100000),
          };
        },
      });

      const shooterCadenceMs =
        (new BasicDefender(0, 0, { level: 1, image: null }).fireRate * 1000) / 60;
      const intendedMs = intendedAttackMs('defenders', 'Shooter', shooterCadenceMs);

      expect(elapsedMs).toBeGreaterThan(intendedMs - 2 * frameMs);
      expect(elapsedMs).toBeLessThan(intendedMs + 2 * frameMs);
    },
  );
});

describe('animation consumes exactly the time the gameplay clock does', () => {
  /* A synthetic walk sheet, rather than a shipped one. */
  const PROBE_HOLD_MS = 100;
  const PROBE_CONFIG = {
    move: { frameCount: 30, frameWidth: 1, frameHeight: 1, fps: 1000 / PROBE_HOLD_MS },
  };

  /** Animation time consumed, and gameplay time consumed, by one frame of hitchMs. */
  function consumedByOneFrameOf(hitchMs) {
    const engine = createFrameEngine();
    const skeleton = new RangeEnemy(0, 0, null);
    skeleton.animationConfig = PROBE_CONFIG;
    skeleton.animationFrames = { move: Array.from({ length: 30 }, (_, i) => `move:${i}`) };
    skeleton.gameEngine = engine;
    engine.enemies = [skeleton];

    const animationMs = () => skeleton.animationFrame * PROBE_HOLD_MS + skeleton.animationTimer;

    const driver = createFrameDriver(engine, hitchMs);
    driver.tick(); // First frame of the loop: no elapsed time, settles the walk.
    expect(skeleton.currentAnimation).toBe('move');

    const before = { animationMs: animationMs(), gameplayMs: engine.gameClock.now };
    driver.tick(); // The frame under measurement.

    return {
      animationMs: animationMs() - before.animationMs,
      gameplayMs: engine.gameClock.now - before.gameplayMs,
    };
  }

  it.each(Object.entries(FRAME_MS))('advances the walk sheet by one real frame at %s', (_label, frameMs) => {
    const { animationMs, gameplayMs } = consumedByOneFrameOf(frameMs);

    expect(gameplayMs).toBeCloseTo(frameMs, 6); // the loop really did tick once
    expect(animationMs).toBeCloseTo(gameplayMs, 6);
  });

  it('clamps a backgrounded tab to the same bound the gameplay clock uses', () => {
    // Not a second clamping policy: GameClock already decides what a plausible
    // frame is, and animation has to agree with it, or the two drift apart in
    // the one situation - a tab restored after a minute away - where the drift
    // would be largest.
    const { animationMs, gameplayMs } = consumedByOneFrameOf(60_000);

    expect(gameplayMs).toBeLessThan(60_000); // premise: the clock clamps at all
    expect(animationMs).toBeCloseTo(gameplayMs, 6);
  });
});

describe('no nominal game frame is left to advance animation by', () => {
  it('no longer exports GAME_FRAME_MS', () => {
    // A nominal frame is the bug: any code that reaches for one is guessing at
    // how much time passed instead of being told.
    expect(AttackPlayback).not.toHaveProperty('GAME_FRAME_MS');
  });
});
