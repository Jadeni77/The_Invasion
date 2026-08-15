import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { GameClock } from '../Feedback/GameClock.js';
import { Enemy } from '../EnemyUnits.js';
import { BasicDefender } from '../DefenderUnits.js';
import { setFrameDeltaMs } from '../Animation/FrameTime.js';

/**
 * Playtest report: "the attacks are not consistent... idk if i am lagging or what."
 *
 * The reporter was not lagging - the game was running fast. 0b7bc21 moved sprite
 * animation onto real elapsed time, and combat cooldowns were already there via
 * GameClock, but movement and a long tail of countdowns were still counted once
 * per rendered frame. The loop is uncapped requestAnimationFrame, so on a 120Hz
 * ProMotion display every enemy walked and every projectile flew at double its
 * intended speed while the firing cadence stayed correct.
 *
 * Two properties are under test here, and they pull in opposite directions:
 *
 *  1. IDENTITY AT 60fps. Every speed and countdown constant in this codebase was
 *     authored against a 60fps frame, so this is a bug fix and not a rebalance
 *     only if 60fps behaviour is reproduced exactly - not close, not within a
 *     tolerance, but to the last bit. These tests compare against a reference
 *     computed by the very repeated addition the frame-counted code performed,
 *     with toBe. They pass both before and after the conversion; that is the
 *     point of them.
 *
 *  2. REFRESH-RATE INDEPENDENCE. One real second of frames must advance the game
 *     by one real second of gameplay whether that second contained 120, 60 or 30
 *     of them.
 */

/** The refresh rates worth caring about: ProMotion, standard, and a bad drop. */
const FRAME_MS = {
  '120Hz (ProMotion)': 1000 / 120,
  '60Hz': 1000 / 60,
  '30fps (dropping frames)': 1000 / 30,
};

const FRAME_MS_60HZ = 1000 / 60;

/**
 * A GameEngine reduced to the frame loop and the systems that move things.
 *
 * update() and the update methods under test are the real prototype methods -
 * what is being tested is how they turn elapsed real time into displacement -
 * with the subsystems that have nothing to do with movement stubbed out.
 */
function createFrameEngine(overrides = {}) {
  return {
    // State GameEngine.update() reads.
    gameOver: false,
    isPaused: false,
    lastFrameTime: null,
    gameClock: new GameClock(),
    juiceManager: null,
    currentLevelConfig: null,
    drawUIs: null,
    waveManager: { update: () => {}, totalEnemiesKilled: 0 },
    combatManager: {
      updateDefenderCombat: () => {},
      updateEnemyCombat: () => {},
    },
    dropManager: { handleEnemyDeath: () => {} },
    gridManager: { getGridCell: () => null },

    // Entity lists and the callbacks the update methods reach for.
    enemies: [],
    defenders: [],
    recentlyDiedDefenders: [],
    projectiles: [],
    enemyProjectiles: [],
    spellProjectiles: [],
    explosions: [],
    energyDrops: [],
    cardPieceDrops: [],
    // Off the map: these tests are about how far things travel, not about what
    // happens when they arrive.
    defenseLineX: Number.POSITIVE_INFINITY,
    baseHealth: 1000,
    baseDamageTaken: 0,
    inGameScore: 0,
    enemiesKilled: 0,
    canvasWidth: 800,
    emitFeedback: () => {},
    updateScoreCb: () => {},
    updateBaseHealthCb: () => {},

    // The real thing.
    update: GameEngine.prototype.update,
    updateEnemies: GameEngine.prototype.updateEnemies,
    updateDefenders: GameEngine.prototype.updateDefenders,
    updateProjectiles: GameEngine.prototype.updateProjectiles,
    updateEnemyProjectiles: GameEngine.prototype.updateEnemyProjectiles,
    updateSpellProjectiles: GameEngine.prototype.updateSpellProjectiles,
    updateExplosions: GameEngine.prototype.updateExplosions,
    handleEnemyDeath: GameEngine.prototype.handleEnemyDeath,
    emitEnemyDeathFeedback: GameEngine.prototype.emitEnemyDeathFeedback,
    markDefenderDead: () => {},

    // Out of scope for movement timing.
    updateEnergyDrops: () => {},
    updateCardPieceDrops: () => {},
    checkGameConditions: () => {},

    ...overrides,
  };
}

/** Drives an engine at a fixed refresh rate against a mocked wall clock. */
function createFrameDriver(engine, frameMs) {
  let nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

  const driver = {
    get wallClockMs() {
      return nowMs;
    },
    tick() {
      nowMs += frameMs;
      engine.update();
    },
    /**
     * Runs the loop's very first frame, which every measurement below excludes.
     *
     * A frame's length is measured against the previous frame, so the first one
     * has nothing to measure against and covers zero time by definition - the
     * same rule GameClock and sprite animation have followed since 0b7bc21.
     * Nothing observable turns on it (it is one frame at game start and one on
     * resume from pause), but it is not a whole frame of movement either, so
     * measuring across it would compare a startup artifact rather than the
     * conversion.
     */
    warmUp() {
      driver.tick();
      return driver;
    },
    /** Runs exactly the number of whole frames that fill durationMs. */
    runFor(durationMs) {
      const frames = Math.round(durationMs / frameMs);
      for (let i = 0; i < frames; i++) driver.tick();
    },
  };
  return driver;
}

/**
 * Runs one frame that covers exactly one sixtieth of a second.
 *
 * The identity property is about a frame that *measures* exactly 1000/60 ms:
 * frameScale() is then exactly 1, because x / x is 1 for any finite non-zero x,
 * and every `speed * frameScale()` is bit-for-bit `speed`. Driving this through
 * GameEngine.update()'s own performance.now() arithmetic would not test that -
 * a mocked clock advanced by repeated += 1000/60 accumulates rounding, so the
 * measured delta comes out an ulp off and the scale lands at 0.9999999999999998
 * instead of 1. That is a property of the fixture, not of the game.
 *
 * So the delta is published directly, the way AttackAnimation.test.js and
 * EnemyUnits.audioEvents.test.js already do, and the frame's real update methods
 * are called in GameEngine.update()'s own order. The refresh-rate independence
 * suite below drives the real update() end to end, where that ulp is irrelevant.
 */
function tickExactly60Hz(engine) {
  setFrameDeltaMs(FRAME_MS_60HZ);
  engine.gameClock.advance(FRAME_MS_60HZ);
  const now = engine.gameClock.now;

  engine.updateProjectiles();
  engine.updateEnemyProjectiles();
  engine.updateSpellProjectiles();
  engine.updateDefenders(now);
  engine.updateEnemies(now);
  engine.updateExplosions();
}

/** A plain walking enemy with no sprite data, so nothing but movement runs. */
function createWalker(speed = 0.8) {
  const enemy = new Enemy(0, 100, { speed, health: 1000, width: 40, height: 40 });
  // Enemy's constructor reads `typeData.speed || 0.8`, so a requested speed of
  // zero silently becomes the default. Assign it past the constructor.
  enemy.initialSpeed = speed;
  enemy.speed = speed;
  return enemy;
}

/** A melee enemy parked on a defender, so its attack countdown runs. */
function createMeleeContact(attackRate) {
  const enemy = new Enemy(0, 0, {
    isAttacker: true,
    attackDamage: 1,
    attackRate,
    speed: 1,
    width: 40,
    height: 40,
    health: 100000,
  });
  const defender = new BasicDefender(0, 0, { level: 1, image: null });
  defender.health = 1e9;
  defender.maxHealth = 1e9;
  return { enemy, defender };
}

/** A projectile fixture and a stationary enemy for it to chase. */
function createShot(engine, speed = 5) {
  const target = createWalker(0);
  target.x = 1000;
  target.y = 100;
  const projectile = {
    startX: 0,
    startY: 100,
    speed,
    damage: 1,
    target,
    ignoreArmor: false,
  };
  engine.enemies.push(target);
  engine.projectiles.push(projectile);
  return { target, projectile };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('60fps identity: nothing changes at the rate every constant was authored for', () => {
  it('walks an enemy exactly as far as N += speed additions did', () => {
    const engine = createFrameEngine();
    const enemy = createWalker(0.8);
    engine.enemies.push(enemy);

    const startX = enemy.x;
    const ticks = 60;
    for (let i = 0; i < ticks; i++) tickExactly60Hz(engine);

    // The reference is the frame-counted code's arithmetic, performed the same
    // way and in the same order: repeated addition of the authored speed, not
    // ticks * speed, which is a different float.
    let expected = startX;
    for (let i = 0; i < ticks; i++) expected += 0.8;

    expect(enemy.x).toBe(expected);
  });

  it('runs a melee attack countdown down by exactly one per frame', () => {
    const engine = createFrameEngine();
    const { enemy, defender } = createMeleeContact(90);
    engine.enemies.push(enemy);
    engine.defenders.push(defender);

    for (let i = 0; i < 30; i++) tickExactly60Hz(engine);

    expect(enemy.attackCountdown).toBe(90 - 30);
  });

  it('lands exactly one melee damage tick per attackRate frames', () => {
    const engine = createFrameEngine();
    const { enemy, defender } = createMeleeContact(90);
    engine.enemies.push(enemy);
    engine.defenders.push(defender);

    const startHealth = defender.health;
    for (let i = 0; i < 270; i++) tickExactly60Hz(engine);

    // 270 frames / 90 frames per swing = 3 swings of 1 damage.
    expect(startHealth - defender.health).toBe(3);
  });

  it('expires a frozen enemy after exactly its authored number of frames', () => {
    const engine = createFrameEngine();
    const enemy = createWalker(0.8);
    enemy.frozen = true;
    enemy.frozenDuration = 180;
    enemy.speed = 0;
    engine.enemies.push(enemy);

    for (let i = 0; i < 179; i++) tickExactly60Hz(engine);
    expect(enemy.frozen).toBe(true);
    expect(enemy.frozenDuration).toBe(1);

    tickExactly60Hz(engine);
    expect(enemy.frozen).toBe(false);
  });

  it('burns a defender for exactly the same number of damage ticks', () => {
    const engine = createFrameEngine();
    const defender = new BasicDefender(0, 0, { level: 1, image: null });
    defender.health = 1e9;
    defender.maxHealth = 1e9;
    defender.burning = true;
    defender.burningDuration = 180;
    defender.burningDamage = 10;
    engine.defenders.push(defender);

    const startHealth = defender.health;
    for (let i = 0; i < 180; i++) tickExactly60Hz(engine);

    // burningDuration counts 179..0 and ticks whenever it lands on a multiple
    // of 30: 150, 120, 90, 60, 30, 0 - six ticks of 10 damage.
    expect(startHealth - defender.health).toBe(60);
    expect(defender.burning).toBe(false);
  });

  it('flies a projectile exactly as far as repeated += cos(angle) * speed did', () => {
    const engine = createFrameEngine();
    const { target, projectile } = createShot(engine, 5);

    const ticks = 40;
    for (let i = 0; i < ticks; i++) tickExactly60Hz(engine);

    // A faithful replay of updateProjectiles' frame-counted arithmetic,
    // including the diagonal: the target's centre is half its height below the
    // muzzle, so neither component is a whole step.
    let x = 0;
    let y = 100;
    for (let i = 0; i < ticks; i++) {
      const dx = target.x + target.width / 2 - x;
      const dy = target.y + target.height / 2 - y;
      if (Math.hypot(dx, dy) <= 5) break;
      const angle = Math.atan2(dy, dx);
      x += Math.cos(angle) * 5;
      y += Math.sin(angle) * 5;
    }

    expect(projectile.startX).toBe(x);
    expect(projectile.startY).toBe(y);
  });

  it('expires an explosion after exactly its authored number of frames', () => {
    const engine = createFrameEngine();
    engine.explosions.push({ x: 0, y: 0, radius: 10, damage: 0, timer: 20 });

    for (let i = 0; i < 19; i++) tickExactly60Hz(engine);
    expect(engine.explosions.length).toBe(1);

    tickExactly60Hz(engine);
    expect(engine.explosions.length).toBe(0);
  });
});

describe('refresh-rate independence: one real second is one real second', () => {
  /** Runs body(engine, driver) once per refresh rate and collects the results. */
  function acrossRefreshRates(body) {
    const results = {};
    for (const [label, frameMs] of Object.entries(FRAME_MS)) {
      const engine = createFrameEngine();
      const driver = createFrameDriver(engine, frameMs).warmUp();
      results[label] = body(engine, driver);
      vi.restoreAllMocks();
    }
    return results;
  }

  it('walks an enemy the same distance in one second at 120Hz, 60Hz and 30fps', () => {
    const travelled = acrossRefreshRates((engine, driver) => {
      const enemy = createWalker(0.8);
      engine.enemies.push(enemy);

      const startX = enemy.x;
      driver.runFor(1000);
      return enemy.x - startX;
    });

    // 0.8px per 60fps frame is 48px per second, at any refresh rate.
    for (const [label, distance] of Object.entries(travelled)) {
      expect(distance, `${label} travelled ${distance}px in one second`).toBeCloseTo(48, 9);
    }
  });

  it('lands a projectile at the same wall-clock time at 120Hz, 60Hz and 30fps', () => {
    const arrivalMs = acrossRefreshRates((engine, driver) => {
      createShot(engine, 5);

      const startMs = driver.wallClockMs;
      while (engine.projectiles.length > 0 && driver.wallClockMs - startMs < 20000) {
        driver.tick();
      }
      return driver.wallClockMs - startMs;
    });

    const reference = arrivalMs['60Hz'];
    for (const [label, ms] of Object.entries(arrivalMs)) {
      expect(
        Math.abs(ms - reference),
        `${label} landed the shot after ${ms}ms, 60Hz after ${reference}ms`,
      ).toBeLessThan(1000 / 30 + 1); // within one frame at the coarsest rate
    }
  });

  it('lands the same number of melee swings in one second at every rate', () => {
    const swings = acrossRefreshRates((engine, driver) => {
      // 30 frames per swing: two swings in a second, comfortably countable.
      const { enemy, defender } = createMeleeContact(30);
      engine.enemies.push(enemy);
      engine.defenders.push(defender);

      const startHealth = defender.health;
      driver.runFor(1000);
      return startHealth - defender.health;
    });

    const reference = swings['60Hz'];
    for (const [label, count] of Object.entries(swings)) {
      expect(
        count,
        `${label} landed ${count} swings in one second, 60Hz landed ${reference}`,
      ).toBe(reference);
    }
  });

  it('thaws a frozen enemy after the same wall-clock time at every rate', () => {
    const thawMs = acrossRefreshRates((engine, driver) => {
      const enemy = createWalker(0);
      enemy.frozen = true;
      enemy.frozenDuration = 180; // three seconds, as authored
      engine.enemies.push(enemy);

      const startMs = driver.wallClockMs;
      while (enemy.frozen && driver.wallClockMs - startMs < 20000) driver.tick();
      return driver.wallClockMs - startMs;
    });

    // A countdown can only expire on a frame boundary, so "the same time" means
    // the same time to within one frame at the coarsest rate under test.
    for (const [label, ms] of Object.entries(thawMs)) {
      expect(
        Math.abs(ms - 3000),
        `${label} thawed after ${ms}ms, not the authored 3000ms`,
      ).toBeLessThan(1000 / 30 + 1);
    }
  });

  it('expires an explosion after the same wall-clock time at every rate', () => {
    const expiryMs = acrossRefreshRates((engine, driver) => {
      engine.explosions.push({ x: 0, y: 0, radius: 10, damage: 0, timer: 20 });

      const startMs = driver.wallClockMs;
      while (engine.explosions.length > 0 && driver.wallClockMs - startMs < 20000) {
        driver.tick();
      }
      return driver.wallClockMs - startMs;
    });

    // 20 frames at 60fps is a third of a second, to within one frame at the
    // coarsest rate under test.
    for (const [label, ms] of Object.entries(expiryMs)) {
      expect(
        Math.abs(ms - 1000 / 3),
        `${label} expired the explosion after ${ms}ms`,
      ).toBeLessThan(1000 / 30 + 1);
    }
  });
});
