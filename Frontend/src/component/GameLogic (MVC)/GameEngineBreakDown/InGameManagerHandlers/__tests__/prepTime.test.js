/*
 * The prep time before wave 1 is the prep time, on every level.
 *
 * `reset()` cleared the wave counters and the spawn clock but left
 * `lastWaveStartTime` holding a timestamp from the level just played, while
 * GameEngine reset the game clock to zero alongside it. The comparison that
 * releases wave 1 is `now - lastWaveStartTime >= PREP_TIME_MS`, so on the
 * second level of a session it read `0 - 90000 >= 10000` - false, and stayed
 * false until the clock climbed past the stale value.
 *
 * A player who finished a level 90 seconds in then stood on an empty board for
 * a hundred seconds waiting for the first zombie. The first level of a session
 * was always correct, which is what made it look intermittent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveManager, PREP_TIME_MS } from '../WaveManager.js';

/** A WaveManager on a level, spawning nothing real. */
function manager() {
  const gameEngine = {
    enemies: [], defenders: [], explosions: [],
    showWaveAnnouncement: vi.fn(),
    emitFeedback: vi.fn(),
  };
  const wm = new WaveManager(gameEngine);
  wm.gameEngine = gameEngine;
  wm.config = {
    waves: 3,
    maxActiveEnemies: 10,
    enemySpawnInterval: 1000,
    waveConfigurations: [
      { enemyCount: 5, spawnInterval: 1000, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
      { enemyCount: 5, spawnInterval: 1000, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
      { enemyCount: 5, spawnInterval: 1000, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
    ],
  };
  wm.spawnEnemy = vi.fn();
  return wm;
}

/** A manager standing where it stands at the start of a level. */
function atLevelStart() {
  const wm = manager();
  wm.currentWave = 0;
  wm.waveActive = false;
  wm.lastWaveStartTime = 0;
  return wm;
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('the wait before wave 1', () => {
  it('is a real wait, or this guard is about nothing', () => {
    expect(PREP_TIME_MS).toBeGreaterThan(0);
  });

  it('holds wave 1 back until the prep time has passed', () => {
    const wm = atLevelStart();

    expect(wm.shouldStartNextWave(0, 0)).toBe(false);
    expect(wm.shouldStartNextWave(PREP_TIME_MS - 1, 0)).toBe(false);
    expect(wm.shouldStartNextWave(PREP_TIME_MS, 0)).toBe(true);
  });

  /*
   * The level that exposed it. GameEngine resets the game clock to zero when a
   * level starts, so anything reset() leaves holding an old timestamp is
   * compared against a clock that has gone backwards.
   */
  it('is the same wait on the second level of a session', () => {
    const wm = manager();

    // Play a level: wave 3 started ninety seconds in.
    wm.currentWave = 3;
    wm.lastWaveStartTime = 90_000;

    // The level ends. GameEngine resets the clock, then the wave manager.
    wm.reset(false);

    expect(wm.shouldStartNextWave(0, 0), 'wave 1 must not be owed 100 seconds').toBe(false);
    expect(wm.shouldStartNextWave(PREP_TIME_MS, 0), 'and must arrive on time').toBe(true);
  });

  it('does not release wave 1 early on the second level either', () => {
    const wm = manager();
    wm.currentWave = 3;
    wm.lastWaveStartTime = 90_000;

    wm.reset(false);

    expect(wm.shouldStartNextWave(PREP_TIME_MS - 1, 0)).toBe(false);
  });

  it('leaves nothing from the last level in its spawn clock either', () => {
    const wm = manager();
    wm.lastWaveStartTime = 90_000;
    wm.lastSpawnTime = 88_000;
    wm.nextSpawnDelay = 5_000;

    wm.reset(false);

    for (const field of ['lastWaveStartTime', 'lastSpawnTime', 'nextSpawnDelay']) {
      expect(wm[field], `${field} survived the reset`).toBe(0);
    }
  });
});
