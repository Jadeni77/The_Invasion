/**
 * The spawn gate has back-pressure, and a floor on how fast enemies arrive.
 *
 * Two authored values were being ignored in opposite directions:
 *
 * `maxActiveEnemies` is set for every level - 1 at level 1, rising to 50 in
 * endless - and was read by NOTHING. Nothing anywhere limited how many enemies
 * could be alive at once.
 *
 * The per-wave `spawnInterval` was honoured exactly as written, and twenty of the
 * 138 authored waves ask for under 200ms: level 18 descends to 60ms, level 19
 * floors at 60ms, and level 20 has a wave at **40ms** - twenty-five enemies per
 * second. No arrangement of defenders answers that.
 *
 * Together they are most of why the owner reported that the game "spawn so often"
 * and was "hard to defend".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaveManager } from '../WaveManager.js';

/** A WaveManager wired to a fake engine, spawning nothing real. */
function managerWith({ maxActiveEnemies, aliveEnemies = 0 }) {
  const enemies = Array.from({ length: aliveEnemies }, () => ({ isAlive: true }));
  const gameEngine = { enemies, defenders: [], explosions: [] };
  const wm = new WaveManager(gameEngine);
  wm.gameEngine = gameEngine;
  wm.config = { maxActiveEnemies, enemySpawnInterval: 1000 };
  wm.spawnEnemy = vi.fn();
  return wm;
}

const WAVE = {
  enemyCount: 50,
  spawnInterval: 40,
  enemyTypes: ['Basic Zombie'],
  spawnPattern: 'standard',
};

describe('the active-enemy cap', () => {
  let wm;
  beforeEach(() => { vi.restoreAllMocks(); });

  it('reads maxActiveEnemies from the level config', () => {
    wm = managerWith({ maxActiveEnemies: 12 });
    expect(wm.activeEnemyCap()).toBe(12);
  });

  it('counts only living enemies', () => {
    wm = managerWith({ maxActiveEnemies: 12, aliveEnemies: 3 });
    wm.gameEngine.enemies.push({ isAlive: false }, { isAlive: false });
    expect(wm.activeEnemyCount()).toBe(3);
  });

  it('spawns when the board has room', () => {
    wm = managerWith({ maxActiveEnemies: 5, aliveEnemies: 2 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    wm.spawnWaveEnemies(10_000, 50, WAVE);
    expect(wm.spawnEnemy).toHaveBeenCalled();
  });

  it('refuses to spawn once the board is at the cap', () => {
    wm = managerWith({ maxActiveEnemies: 5, aliveEnemies: 5 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    wm.spawnWaveEnemies(10_000, 50, WAVE);
    expect(wm.spawnEnemy, 'the cap was authored for every level and enforced nowhere')
      .not.toHaveBeenCalled();
  });

  it('holds the wave rather than dropping it - nothing is spawned early or lost', () => {
    // A held spawn must not consume the wave's budget, or a capped level would
    // finish having sent fewer enemies than it owes.
    wm = managerWith({ maxActiveEnemies: 2, aliveEnemies: 2 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    const before = wm.waveEnemiesSpawned;
    wm.spawnWaveEnemies(10_000, 50, WAVE);
    expect(wm.waveEnemiesSpawned).toBe(before);
  });

  it('treats a missing cap as no cap, so nothing regresses on a config without one', () => {
    wm = managerWith({ maxActiveEnemies: undefined, aliveEnemies: 999 });
    expect(wm.activeEnemyCap()).toBe(Infinity);
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    wm.spawnWaveEnemies(10_000, 50, WAVE);
    expect(wm.spawnEnemy).toHaveBeenCalled();
  });
});

describe('the spawn interval floor', () => {
  it('never leaves a delay below 200ms, however fast the wave asked', () => {
    const wm = managerWith({ maxActiveEnemies: 99 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    // 40ms is the real value authored in level 20.
    wm.spawnWaveEnemies(10_000, 50, { ...WAVE, spawnInterval: 40 });
    expect(wm.nextSpawnDelay, '40ms is 25 enemies a second').toBeGreaterThanOrEqual(200);
  });

  it('leaves a slower authored interval alone', () => {
    const wm = managerWith({ maxActiveEnemies: 99 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    wm.spawnWaveEnemies(10_000, 50, { ...WAVE, spawnInterval: 1800 });
    expect(wm.nextSpawnDelay).toBe(1800);
  });

  it('applies the floor to patterns that multiply the interval too', () => {
    // Each pattern sets nextSpawnDelay itself, some as a multiple; the clamp sits
    // where all of them pass through rather than in any one of them.
    const wm = managerWith({ maxActiveEnemies: 99 });
    wm.lastSpawnTime = 0;
    wm.nextSpawnDelay = 0;
    wm.spawnWaveEnemies(10_000, 50, { ...WAVE, spawnInterval: 40, spawnPattern: 'mixed' });
    expect(wm.nextSpawnDelay).toBeGreaterThanOrEqual(200);
  });
});
