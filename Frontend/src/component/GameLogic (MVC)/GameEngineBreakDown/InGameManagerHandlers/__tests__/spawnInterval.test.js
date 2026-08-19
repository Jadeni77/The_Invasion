/*
 * `spawnInterval` is seconds per enemy, whatever pattern delivers them.
 *
 * Each pattern used to set the gap itself, by a factor unrelated to what it
 * spawned: rush put 3-5 on the board and waited x2, surround put 3 and waited
 * x1.5, formation put 4 and waited x3, boss put 5 and waited x5. A wave
 * declaring 2000ms therefore meant 2s, 3s, 4s, 6s or 10s depending on a pattern
 * chosen elsewhere in the same config, so the authored number meant nothing on
 * its own and tuning a wave did not do what it looked like it would.
 *
 * This walks the patterns rather than naming the factors, so a new pattern
 * cannot reintroduce one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveManager } from '../WaveManager.js';

const INTERVAL = 2000;
const PATTERNS = ['standard', 'rush', 'formation', 'surround', 'boss', 'mixed'];

function waveOf(spawnPattern) {
  return {
    enemyCount: 40,
    spawnInterval: INTERVAL,
    enemyTypes: ['Basic Zombie', 'Fast Zombie', 'Tank Zombie'],
    spawnPattern,
    bossType: 'Titan',
  };
}

/** A manager ready to spawn, with the board empty and the gate open. */
function ready() {
  const gameEngine = {
    enemies: [], defenders: [], explosions: [],
    showWaveAnnouncement: vi.fn(), emitFeedback: vi.fn(),
    gameClock: { now: 0 },
  };
  const wm = new WaveManager(gameEngine);
  wm.gameEngine = gameEngine;
  wm.config = { waves: 3, maxActiveEnemies: 100, enemySpawnInterval: INTERVAL };
  wm.spawnEnemy = vi.fn();
  wm.waveActive = true;
  wm.currentWave = 1;
  wm.lastSpawnTime = 0;
  wm.nextSpawnDelay = 0;
  return wm;
}

/** Spawn one event of `pattern`; report enemies added and the gap that follows. */
function spawnOnce(pattern) {
  const wm = ready();
  const before = wm.waveEnemiesSpawned;

  wm.spawnWaveEnemies(100_000, 0, waveOf(pattern));

  return { spawned: wm.waveEnemiesSpawned - before, delay: wm.nextSpawnDelay };
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('the gap after a spawn', () => {
  it('has patterns to check', () => {
    expect(PATTERNS.length).toBeGreaterThan(4);
  });

  it.each(PATTERNS)('is the interval once per enemy spawned: %s', (pattern) => {
    const { spawned, delay } = spawnOnce(pattern);

    expect(spawned, `${pattern} spawned nothing`).toBeGreaterThan(0);
    expect(delay, `${pattern} put ${spawned} on the board`).toBe(INTERVAL * spawned);
  });

  it.each(PATTERNS)('never leaves a group arriving faster per enemy than a single one: %s', (pattern) => {
    const single = spawnOnce('standard');
    const group = spawnOnce(pattern);

    const perEnemy = (r) => r.delay / r.spawned;
    expect(perEnemy(group)).toBe(perEnemy(single));
  });

  /* rush rolls its size, so a fixed factor could never have matched it. */
  it('tracks rush however many it happens to roll', () => {
    for (const roll of [0, 0.5, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      const { spawned, delay } = spawnOnce('rush');
      expect(delay, `rush rolled ${spawned}`).toBe(INTERVAL * spawned);
      vi.restoreAllMocks();
    }
  });

  it('still refuses to go below the floor', () => {
    const wm = ready();
    wm.spawnWaveEnemies(100_000, 0, { ...waveOf('standard'), spawnInterval: 1 });

    expect(wm.nextSpawnDelay).toBeGreaterThan(1);
  });
});
