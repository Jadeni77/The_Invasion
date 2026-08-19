import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaveManager, PREP_TIME_MS } from '../WaveManager.js';

function createLevelConfig(overrides = {}) {
    return {
        waves: 3,
        totalEnemiesToSpawn: 30,
        enemySpawnInterval: 1500,
        availableEnemyTypes: ['Basic Zombie', 'Fast Zombie'],
        isEndless: false,
        ...overrides,
    };
}

describe('WaveManager', () => {
    let waveManager;
    let spawnCallback;
    let mockGameEngine;

    beforeEach(() => {
        spawnCallback = vi.fn();
        mockGameEngine = {
            canvasWidth: 800,
            canvasHeight: 600,
            inGameScore: 0,
            updateScoreCb: vi.fn(),
            dropEnergy: vi.fn(),
            updateEndlessWaveCb: vi.fn(),
            showWaveAnnouncement: vi.fn(),
        };
        waveManager = new WaveManager(createLevelConfig(), spawnCallback, mockGameEngine);
    });

    describe('constructor', () => {
        it('should initialize with wave 0', () => {
            expect(waveManager.currentWave).toBe(0);
        });

        it('should start inactive', () => {
            expect(waveManager.waveActive).toBe(false);
            expect(waveManager.allWavesComplete).toBe(false);
        });

        it('should detect endless mode from config', () => {
            const endlessWM = new WaveManager(
                createLevelConfig({ isEndless: true }), spawnCallback, mockGameEngine
            );
            expect(endlessWM.isEndlessMode).toBe(true);
        });
    });

    describe('startNextWave', () => {
        it('should increment currentWave', () => {
            waveManager.startNextWave();
            expect(waveManager.currentWave).toBe(1);
        });

        it('should reset wave counters', () => {
            waveManager.waveEnemiesSpawned = 5;
            waveManager.waveEnemiesKilled = 3;
            waveManager.startNextWave();
            expect(waveManager.waveEnemiesSpawned).toBe(0);
            expect(waveManager.waveEnemiesKilled).toBe(0);
        });

        it('should set waveActive to true', () => {
            waveManager.startNextWave();
            expect(waveManager.waveActive).toBe(true);
        });

        it('should not exceed max waves in normal mode', () => {
            waveManager.currentWave = 3; // already at max
            waveManager.startNextWave();
            expect(waveManager.currentWave).toBe(3); // unchanged
        });

        it('should allow unlimited waves in endless mode', () => {
            const endlessWM = new WaveManager(
                createLevelConfig({ isEndless: true, waves: 3 }), spawnCallback, mockGameEngine
            );
            endlessWM.currentWave = 50;
            endlessWM.startNextWave();
            expect(endlessWM.currentWave).toBe(51);
        });

        it('should announce the wave by default', () => {
            waveManager.startNextWave();
            expect(mockGameEngine.showWaveAnnouncement).toHaveBeenCalledWith(1, undefined); // wave 1 is not a boss wave
        });

        it('should still advance the wave counter when announce=false, but not call showWaveAnnouncement', () => {
            waveManager.startNextWave(false);
            expect(waveManager.currentWave).toBe(1);
            expect(waveManager.waveActive).toBe(true);
            expect(mockGameEngine.showWaveAnnouncement).not.toHaveBeenCalled();
        });
    });

    describe('shouldStartNextWave', () => {
        /*
         * Derived from PREP_TIME_MS, not restated. This pair named "1 second"
         * because that was the value; a test that hardcodes a number the code
         * owns fails on a deliberate change and says nothing about whether the
         * change was right - which has happened five times in this project
         * now.
         */
        it('starts the first wave once the prep time has elapsed', () => {
            waveManager.lastWaveStartTime = 0;
            expect(waveManager.shouldStartNextWave(PREP_TIME_MS + 1, 0)).toBe(true);
        });

        it('does not start the first wave before then', () => {
            waveManager.lastWaveStartTime = 0;
            expect(waveManager.shouldStartNextWave(PREP_TIME_MS - 1, 0)).toBe(false);
        });

        it('gives the player long enough to actually deploy something', () => {
            // One second - the old value - is not enough to read a card, choose one
            // and click a cell. The number matters, so it is asserted, not just
            // derived away.
            expect(PREP_TIME_MS).toBeGreaterThanOrEqual(5000);
        });

        it('should not start wave beyond max in normal mode', () => {
            waveManager.currentWave = 3; // equals config.waves
            expect(waveManager.shouldStartNextWave(999999, 0)).toBe(false);
        });

        it('should force next wave after maxTimeBetweenWaves', () => {
            waveManager.currentWave = 1;
            waveManager.waveActive = true;
            waveManager.lastWaveStartTime = 0;
            // getCurrentWaveConfig needs a valid wave
            waveManager.waveEnemiesSpawned = 0;
            expect(waveManager.shouldStartNextWave(waveManager.maxTimeBetweenWaves + 1, 5)).toBe(true);
        });
    });

    describe('generateSimpleWaveConfig', () => {
        it('should return a config with enemyCount, spawnInterval, and enemyTypes', () => {
            waveManager.currentWave = 1;
            const config = waveManager.generateSimpleWaveConfig();
            expect(config.enemyCount).toBeGreaterThan(0);
            expect(config.spawnInterval).toBeGreaterThan(0);
            expect(config.enemyTypes).toEqual(['Basic Zombie', 'Fast Zombie']);
        });

        it('should increase enemy count for later waves', () => {
            waveManager.currentWave = 1;
            const config1 = waveManager.generateSimpleWaveConfig();
            waveManager.currentWave = 3;
            const config3 = waveManager.generateSimpleWaveConfig();
            expect(config3.enemyCount).toBeGreaterThan(config1.enemyCount);
        });

        it('should decrease spawn interval for later waves (faster spawning)', () => {
            waveManager.currentWave = 1;
            const config1 = waveManager.generateSimpleWaveConfig();
            waveManager.currentWave = 5;
            const config5 = waveManager.generateSimpleWaveConfig();
            expect(config5.spawnInterval).toBeLessThanOrEqual(config1.spawnInterval);
        });

        it('should enforce minimum spawn interval of 500ms', () => {
            waveManager.currentWave = 100;
            const config = waveManager.generateSimpleWaveConfig();
            expect(config.spawnInterval).toBeGreaterThanOrEqual(500);
        });
    });

    describe('generateEndlessWaveConfig', () => {
        let endlessWM;

        beforeEach(() => {
            endlessWM = new WaveManager(
                createLevelConfig({ isEndless: true }), spawnCallback, mockGameEngine
            );
        });

        it('should scale enemy count with wave number', () => {
            endlessWM.currentWave = 1;
            const config1 = endlessWM.generateEndlessWaveConfig();
            endlessWM.currentWave = 10;
            const config10 = endlessWM.generateEndlessWaveConfig();
            expect(config10.enemyCount).toBeGreaterThan(config1.enemyCount);
        });

        it('should unlock new enemy types at wave thresholds', () => {
            endlessWM.currentWave = 1;
            const early = endlessWM.generateEndlessWaveConfig();
            endlessWM.currentWave = 15;
            const mid = endlessWM.generateEndlessWaveConfig();
            expect(mid.enemyTypes.length).toBeGreaterThan(early.enemyTypes.length);
        });

        it('should mark every 10th wave as boss wave', () => {
            endlessWM.currentWave = 10;
            const config = endlessWM.generateEndlessWaveConfig();
            expect(config.isBossWave).toBe(true);
            expect(config.spawnPattern).toBe('boss');
        });

        it('should not mark non-10th waves as boss waves', () => {
            endlessWM.currentWave = 7;
            const config = endlessWM.generateEndlessWaveConfig();
            expect(config.isBossWave).toBe(false);
        });
    });

    describe('getBossType', () => {
        it('should return Tank Zombie for wave 10', () => {
            waveManager.currentWave = 10;
            expect(waveManager.getBossType()).toBe('Tank Zombie');
        });

        it('should return Vampire for wave 20', () => {
            waveManager.currentWave = 20;
            expect(waveManager.getBossType()).toBe('Vampire');
        });

        it('should return Titan for wave 50+', () => {
            waveManager.currentWave = 50;
            expect(waveManager.getBossType()).toBe('Titan');
        });
    });

    describe('selectEnemyType', () => {
        it('should return a type from the available types', () => {
            waveManager.currentWave = 1;
            const types = ['Basic Zombie', 'Fast Zombie', 'Tank Zombie'];
            const selected = waveManager.selectEnemyType(types);
            expect(types).toContain(selected);
        });

        it('should always return a valid type', () => {
            waveManager.currentWave = 5;
            for (let i = 0; i < 20; i++) {
                const selected = waveManager.selectEnemyType(['Basic Zombie', 'Fast Zombie']);
                expect(['Basic Zombie', 'Fast Zombie']).toContain(selected);
            }
        });
    });

    describe('isWaveComplete', () => {
        it('should return true when all enemies spawned and none remain', () => {
            waveManager.waveEnemiesSpawned = 10;
            expect(waveManager.isWaveComplete({ enemyCount: 10 }, 0)).toBe(true);
        });

        it('should return false when enemies still alive', () => {
            waveManager.waveEnemiesSpawned = 10;
            expect(waveManager.isWaveComplete({ enemyCount: 10 }, 3)).toBe(false);
        });

        it('should return false when not all enemies spawned', () => {
            waveManager.waveEnemiesSpawned = 5;
            expect(waveManager.isWaveComplete({ enemyCount: 10 }, 0)).toBe(false);
        });
    });

    describe('completeWave', () => {
        it('should set waveActive to false', () => {
            waveManager.waveActive = true;
            waveManager.currentWave = 1;
            waveManager.completeWave();
            expect(waveManager.waveActive).toBe(false);
        });

        it('should award score bonus based on wave number', () => {
            waveManager.currentWave = 3;
            waveManager.completeWave();
            expect(mockGameEngine.inGameScore).toBe(30); // wave 3 * 10
            expect(mockGameEngine.updateScoreCb).toHaveBeenCalledWith(30);
        });

        it('should mark allWavesComplete when last wave is done', () => {
            waveManager.currentWave = 3; // config.waves = 3
            waveManager.completeWave();
            expect(waveManager.allWavesComplete).toBe(true);
        });

        it('should not mark complete if more waves remain', () => {
            waveManager.currentWave = 1;
            waveManager.completeWave();
            expect(waveManager.allWavesComplete).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset all counters and leave wave 1 not yet begun', () => {
            waveManager.currentWave = 5;
            waveManager.totalEnemiesKilled = 20;
            waveManager.allWavesComplete = true;
            waveManager.reset();
            // Wave 0: the prep time before wave 1 is the only thing that can
            // release it, and it is only consulted while currentWave is 0.
            // reset() used to jump straight to 1, which made PREP_TIME_MS
            // unreachable and left a hardcoded five-second delay in charge.
            expect(waveManager.currentWave).toBe(0);
            expect(waveManager.totalEnemiesKilled).toBe(0);
            expect(waveManager.allWavesComplete).toBe(false);
            expect(waveManager.waveActive).toBe(false);
        });

        /*
         * The claim the old announce flag existed to protect: no wave horn on
         * top of the win or loss sting. It holds by construction now - reset
         * starts no wave, so there is no announcement to suppress.
         */
        it('should announce nothing, so no horn lands on a win or loss sting', () => {
            waveManager.reset();
            expect(mockGameEngine.showWaveAnnouncement).not.toHaveBeenCalled();
        });

        it('should announce wave 1 when the wave actually arrives', () => {
            waveManager.reset();

            waveManager.update(PREP_TIME_MS, 0, false);

            expect(waveManager.currentWave).toBe(1);
            expect(mockGameEngine.showWaveAnnouncement).toHaveBeenCalled();
        });

        it('should clear the wave clock, not just the counters', () => {
            waveManager.lastWaveStartTime = 90_000;

            waveManager.reset();

            // Compared against a game clock that resets to zero alongside it.
            expect(waveManager.lastWaveStartTime).toBe(0);
        });
    });

    describe('getWaveCooldown', () => {
        it('should return 180 for normal mode', () => {
            expect(waveManager.getWaveCooldown()).toBe(180);
        });

        it('should return shorter cooldown for endless mode', () => {
            const endlessWM = new WaveManager(
                createLevelConfig({ isEndless: true }), spawnCallback, mockGameEngine
            );
            endlessWM.currentWave = 1;
            expect(endlessWM.getWaveCooldown()).toBeLessThanOrEqual(180);
        });

        it('should enforce minimum of 60 for endless mode', () => {
            const endlessWM = new WaveManager(
                createLevelConfig({ isEndless: true }), spawnCallback, mockGameEngine
            );
            endlessWM.currentWave = 100;
            expect(endlessWM.getWaveCooldown()).toBeGreaterThanOrEqual(60);
        });
    });

    describe('update', () => {
        it('should not do anything when game is over', () => {
            waveManager.update(1000, 0, true);
            expect(waveManager.currentWave).toBe(0);
        });

        it('should not do anything when all waves complete', () => {
            waveManager.allWavesComplete = true;
            waveManager.update(1000, 0, false);
            expect(waveManager.currentWave).toBe(0);
        });
    });

    describe('spawnWaveEnemies clock domain', () => {
        // Regression test for a bug where GameEngine.resetGame() set
        // waveManager.lastSpawnTime = Date.now() + 5000 (wall-clock scale,
        // ~1.7e12) while `now` is injected from the gameplay clock, which
        // starts at 0 and only advances by real per-frame deltas (see
        // Feedback/GameClock.js). That mismatch made `now - lastSpawnTime`
        // permanently negative, so spawnWaveEnemies's guard
        // (`if (now - this.lastSpawnTime < this.nextSpawnDelay) return;`)
        // never let an enemy spawn. lastSpawnTime must always live in the
        // same clock domain as `now`.
        const waveConfig = {
            enemyCount: 5,
            spawnInterval: 500,
            enemyTypes: ['Basic Zombie'],
            spawnPattern: 'standard',
        };

        it('spawns once now passes a gameplay-clock-relative lastSpawnTime + nextSpawnDelay', () => {
            waveManager.lastSpawnTime = 5000; // e.g. gameClock.now (0) + 5000, as GameEngine.resetGame() sets it
            waveManager.nextSpawnDelay = 500;
            waveManager.waveEnemiesSpawned = 0;

            waveManager.spawnWaveEnemies(5501, 0, waveConfig); // gameplay-clock-relative now, past 5000 + 500

            expect(spawnCallback).toHaveBeenCalled();
            expect(waveManager.waveEnemiesSpawned).toBe(1);
        });

        it('never spawns if lastSpawnTime is wall-clock-scale while now is gameplay-clock-scale', () => {
            waveManager.lastSpawnTime = Date.now(); // ~1.7e12 - the pre-fix bug's value
            waveManager.nextSpawnDelay = 500;
            waveManager.waveEnemiesSpawned = 0;

            waveManager.spawnWaveEnemies(5501, 0, waveConfig); // gameplay-clock-relative now stays tiny by comparison

            expect(spawnCallback).not.toHaveBeenCalled();
            expect(waveManager.waveEnemiesSpawned).toBe(0);
        });
    });
});
