// WaveManager.js - Enhanced Wave System
/* The floor on how often enemies may arrive, in milliseconds. */
const MIN_SPAWN_INTERVAL_MS = 200;

/** How long the player gets to arrange defenders before the first wave. */
export const PREP_TIME_MS = 10_000;

export class WaveManager {
    constructor(levelConfig, spawnEnemyCallback, gameEngine) {
        this.config = levelConfig;
        this.spawnEnemy = spawnEnemyCallback;
        this.gameEngine = gameEngine;

        // Core wave tracking
        this.currentWave = 0;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.totalEnemiesKilled = 0;

        // Timing
        this.lastSpawnTime = 0;
        this.waveStartTime = 0;
        this.waveCooldown = 0;
        this.nextSpawnDelay = 0;

        // Wave state
        this.waveActive = false;
        this.allWavesComplete = false;
        this.isEndlessMode = levelConfig.isEndless || false;

        // Spawn patterns
        this.currentSpawnPattern = null;
        this.patternIndex = 0;

        // Boss tracking
        this.bossSpawned = false;
        this.currentBoss = null;

        this.waveInterval = 15000;
        this.lastWaveStartTime = 0;
        this.autoStartNextWave = true; // Enable continuous spawning

        this.waveFullySpawned = false;
        this.minTimeBetweenWaves = 3000;
        this.maxTimeBetweenWaves = 15000;

    }

    update(now, enemyCount, gameOver) {
        if (gameOver || this.allWavesComplete) return;

        if (this.shouldStartNextWave(now, enemyCount)) {
            this.startNextWave();
            this.lastWaveStartTime = now;
        }

        // Continue spawning current wave enemies
        if (this.waveActive) {
            const waveConfig = this.getCurrentWaveConfig();

            // Keep spawning until we hit the wave's enemy count
            if (waveConfig && this.waveEnemiesSpawned < waveConfig.enemyCount) {
                    this.spawnWaveEnemies(now, enemyCount, waveConfig);
            } else if (waveConfig && this.waveEnemiesSpawned >= waveConfig.enemyCount
                       && !this.waveFullySpawned) {
                this.waveFullySpawned = true;
                console.log(`Wave ${this.currentWave} fully spawned with ${this.waveEnemiesSpawned} enemies`);
                // Check if all enemies for all waves have been spawned (for level completion)
                //check if last wave
                if (!this.isEndlessMode && this.currentWave >= this.config.waves) {
               //     if (this.enemiesSpawnedThisLevel >= this.config.totalEnemiesToSpawn) {
                        this.allWavesComplete = true;
                        this.autoStartNextWave = false;
                        console.log("All enemies spawned for level!");
             //       }
                }
            }
        }
    }

    shouldStartNextWave(now, enemyCount) {
        if (this.currentWave === 0) return now - this.lastWaveStartTime >= PREP_TIME_MS;
        if (!this.isEndlessMode && this.currentWave >= this.config.waves) return false;

        const timeSinceLastWave = now - this.lastWaveStartTime;
        const waveConfig = this.getCurrentWaveConfig();
        // 1. Current wave is fully spawned AND no enemies remain (immediate progression)
        // 2. OR minimum time passed AND enemies below threshold
        // 3. OR maximum time has passed (force progression)
        if (waveConfig && this.waveEnemiesSpawned >= waveConfig.enemyCount) {
            // Wave fully spawned
            if (enemyCount === 0 && timeSinceLastWave >= this.minTimeBetweenWaves) {
                console.log("Wave cleared! Starting next wave immediately.");
                return true;
            }
            // Few enemies remain and enough time passed
            if (enemyCount <= 2 && timeSinceLastWave >= this.minTimeBetweenWaves * 2) {
                console.log("Few enemies remain, progressing to next wave.");
                return true;
            }
        }
        if (timeSinceLastWave >= this.maxTimeBetweenWaves) {
            console.log("Max time reached, forcing next wave.");
            return true;
        }
        return false;
    }

    getCurrentWaveConfig() {
        if (this.isEndlessMode) {
            return this.generateEndlessWaveConfig();
        }

        const waves = this.config.waveConfigurations || this.config.waves;
        if (typeof waves === 'number') {
            // Simple wave config - generate based on wave number
            return this.generateSimpleWaveConfig();
        }

        return waves[this.currentWave - 1] || this.generateSimpleWaveConfig();
    }

    generateSimpleWaveConfig() {
        const baseEnemies = Math.ceil(this.config.totalEnemiesToSpawn / this.config.waves);
        const waveMultiplier = 1 + (this.currentWave - 1) * 0.2;

        return {
            enemyCount: Math.floor(baseEnemies * waveMultiplier),
            spawnInterval: Math.max(500, this.config.enemySpawnInterval - (this.currentWave * 100)),
            enemyTypes: this.config.availableEnemyTypes,
            spawnPattern: 'standard'
        };
    }

    generateEndlessWaveConfig() {
        // Endless mode scaling
        const difficulty = Math.floor((this.currentWave - 1) / 5) + 1;
        const enemyCount = 10 + (this.currentWave * 3) + (difficulty * 5);
        const spawnInterval = Math.max(300, 2000 - (difficulty * 200));

        // Every 5 waves, add harder enemy types
        let availableTypes = ['Basic Zombie', 'Fast Zombie'];
        if (this.currentWave >= 5) availableTypes.push('Tank Zombie', 'Skeleton Shooter');
        if (this.currentWave >= 10) availableTypes.push('Exploder', 'Shielder');
        if (this.currentWave >= 15) availableTypes.push('Healer', 'EMP');
        if (this.currentWave >= 20) availableTypes.push('Vampire', 'Ghost');
        if (this.currentWave >= 25) availableTypes.push('Berserker', 'Assassin');
        if (this.currentWave >= 30) availableTypes.push('Mage', 'Necromancer');
        if (this.currentWave >= 40) availableTypes.push('Titan');

        // Boss waves every 10 waves
        const isBossWave = this.currentWave % 10 === 0;

        return {
            enemyCount,
            spawnInterval,
            enemyTypes: availableTypes,
            spawnPattern: isBossWave ? 'boss' : this.getRandomPattern(),
            isBossWave,
            bossType: isBossWave ? this.getBossType() : null,
            difficultyMultiplier: 1 + (difficulty * 0.5)
        };
    }

    getRandomPattern() {
        const patterns = ['standard', 'rush', 'mixed', 'formation', 'surround'];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    getBossType() {
        const wave = this.currentWave;
        if (wave === 10) return 'Tank Zombie';
        if (wave === 20) return 'Vampire';
        if (wave === 30) return 'Mage';
        if (wave === 40) return 'Necromancer';
        if (wave >= 50) return 'Titan';
        return 'Tank Zombie';
    }

    /* How many enemies may be alive at once, and how fast they may arrive. */
    activeEnemyCap() {
        return this.config?.maxActiveEnemies ?? Infinity;
    }

    activeEnemyCount() {
        const enemies = this.gameEngine?.enemies ?? [];
        return enemies.reduce((n, enemy) => n + (enemy.isAlive ? 1 : 0), 0);
    }

    spawnWaveEnemies(now, enemyCount, waveConfig) {
        // Check spawn conditions
        if (this.waveEnemiesSpawned >= waveConfig.enemyCount) return;
        if (now - this.lastSpawnTime < this.nextSpawnDelay) return;

        /*
         * Back-pressure. Without this the spawn gate only ever asked "has
         * enough time passed", so a level whose waves ask for a 40ms interval
         * put twenty-five enemies a second on the board no matter how many
         * were already there.
         */
        if (this.activeEnemyCount() >= this.activeEnemyCap()) return;

        // Execute spawn pattern
        switch (waveConfig.spawnPattern) {
            case 'rush':
                this.spawnRushPattern(waveConfig);
                break;
            case 'formation':
                this.spawnFormationPattern(waveConfig);
                break;
            case 'surround':
                this.spawnSurroundPattern(waveConfig);
                break;
            case 'boss':
                this.spawnBossPattern(waveConfig);
                break;
            case 'mixed':
                this.spawnMixedPattern(waveConfig);
                break;
            default:
                this.spawnStandardPattern(waveConfig);
        }

        this.lastSpawnTime = now;

        /*
         * Applied after the pattern, because each pattern sets nextSpawnDelay
         * itself - some as a multiple of the authored interval. Clamping here is
         * the one place all six patterns pass through.
         */
        this.nextSpawnDelay = Math.max(MIN_SPAWN_INTERVAL_MS, this.nextSpawnDelay);
    }

    spawnStandardPattern(waveConfig) {
        const enemyType = this.selectEnemyType(waveConfig.enemyTypes);
        this.spawnEnemy(enemyType);
        this.waveEnemiesSpawned++;
        this.enemiesSpawnedThisLevel++;
        this.nextSpawnDelay = waveConfig.spawnInterval;
    }

    spawnRushPattern(waveConfig) {
        // Spawn 3-5 fast enemies at once
        const count = Math.min(3 + Math.floor(Math.random() * 3),
                               waveConfig.enemyCount - this.waveEnemiesSpawned);
        for (let i = 0; i < count; i++) {
            const fastTypes = waveConfig.enemyTypes.filter(t =>
                                                               t.includes('Fast') || t.includes('Assassin') || t === 'Mini');
            const type = fastTypes.length > 0 ?
                         this.selectEnemyType(fastTypes) :
                         this.selectEnemyType(waveConfig.enemyTypes);

            setTimeout(() => {
                this.spawnEnemy(type)
            }, i * 200);
            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;
        }
        this.nextSpawnDelay = waveConfig.spawnInterval * 2;
    }

    spawnFormationPattern(waveConfig) {
        // Spawn enemies in organized groups
        const formationSize = Math.min(4, waveConfig.enemyCount - this.waveEnemiesSpawned);
        const leaderType = 'Tank Zombie';
        const followerType = 'Basic Zombie';

        // Spawn leader
        this.spawnEnemy(leaderType);
        this.waveEnemiesSpawned++;
        this.enemiesSpawnedThisLevel++;

        // Spawn followers
        for (let i = 1; i < formationSize; i++) {
            setTimeout(() => {
                this.spawnEnemy(followerType);
            }, i * 300);
            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;
        }
        this.nextSpawnDelay = waveConfig.spawnInterval * 3;
    }

    spawnSurroundPattern(waveConfig) {
        // Spawn enemies from multiple lanes simultaneously
        const lanes = 3; // Assuming 3 lanes
        for (let i = 0; i < lanes; i++) {
            if (this.waveEnemiesSpawned >= waveConfig.enemyCount) break;

            const enemyType = this.selectEnemyType(waveConfig.enemyTypes);
            setTimeout(() => {
                this.spawnEnemy(enemyType);
            }, i * 100);

            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;
        }
        this.nextSpawnDelay = waveConfig.spawnInterval * 1.5;
    }

    spawnBossPattern(waveConfig) {
        if (!this.bossSpawned) {
            // Spawn boss with minions
            this.spawnEnemy(waveConfig.bossType, { isBoss: true });
            this.bossSpawned = true;
            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;

            // Spawn minions
            const minionCount = Math.min(4, waveConfig.enemyCount - 1);
            for (let i = 0; i < minionCount; i++) {
                setTimeout(() => {
                    this.spawnEnemy('Tank Zombie');
                }, (i + 1) * 500);
                this.waveEnemiesSpawned++;
                this.enemiesSpawnedThisLevel++;
            }
            this.nextSpawnDelay = waveConfig.spawnInterval * 5;
        } else {
            // Continue spawning regular enemies after boss
            this.spawnStandardPattern(waveConfig);
        }
    }

    spawnMixedPattern(waveConfig) {
        // Mix of different enemy types
        const spawnCount = Math.min(2, waveConfig.enemyCount - this.waveEnemiesSpawned);
        const types = new Set();

        // Ensure variety
        while (types.size < spawnCount && types.size < waveConfig.enemyTypes.length) {
            types.add(this.selectEnemyType(waveConfig.enemyTypes));
        }

        Array.from(types).forEach((type, index) => {
            setTimeout(() => {
                this.spawnEnemy(type);
            }, index * 400);
            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;
        });

        this.nextSpawnDelay = waveConfig.spawnInterval * 1.5;
    }

    selectEnemyType(availableTypes) {
        // Weight selection based on wave progress
        const weights = availableTypes.map((type, index) => {
            // Later enemies have higher weight in later waves
            return 1 + (index * this.currentWave * 0.1);
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < availableTypes.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return availableTypes[i];
            }
        }

        return availableTypes[availableTypes.length - 1];
    }

    isWaveComplete(waveConfig, enemyCount) {
        // Wave is complete when all enemies are spawned and defeated
        return this.waveEnemiesSpawned >= waveConfig.enemyCount && enemyCount === 0;
    }

    completeWave() {
        this.waveActive = false;
        console.log(`Wave ${this.currentWave} complete!`);

        // Award wave completion bonus
        if (this.gameEngine) {
            const bonus = this.currentWave * 10;
            this.gameEngine.inGameScore += bonus;
            this.gameEngine.updateScoreCb(this.gameEngine.inGameScore);

            // Drop bonus energy
            const centerX = this.gameEngine.canvasWidth / 2;
            const centerY = this.gameEngine.canvasHeight / 2;
            this.gameEngine.dropEnergy(centerX, centerY, 5 + this.currentWave);
        }

        // Check if all waves complete
        if (!this.isEndlessMode && this.currentWave >= this.config.waves) {
            this.allWavesComplete = true;
            return;
        }

        if (this.isEndlessMode && this.gameEngine && this.gameEngine.updateEndlessWaveCb) {
            this.gameEngine.updateEndlessWaveCb(this.currentWave);
        }

        // Set cooldown for next wave
        this.waveCooldown = this.getWaveCooldown();
        console.log(`Next wave in ${this.waveCooldown / 60} seconds...`);
    }

    getWaveCooldown() {
        // Shorter cooldowns in endless mode
        if (this.isEndlessMode) {
            return Math.max(60, 180 - (this.currentWave * 2)); // 1-3 seconds
        }
        return 180; // 3 seconds for normal mode
    }

    // announce (default true) gates only the wave:started horn/banner - the
    // wave counters themselves always advance. Passed through from reset()
    // so cleanup-only resets (end of level) don't fire the wave horn on top
    // of the win/loss sting, while genuine wave advances (from update(), or
    // reset() at the start of a new level) still announce.
    startNextWave(announce = true) {
        // Don't exceed max waves for normal mode
        if (!this.isEndlessMode && this.currentWave >= this.config.waves) {
            return;
        }
        this.currentWave++;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.waveFullySpawned = false;
        this.bossSpawned = false;
        this.waveActive = true;
        this.waveStartTime = Date.now();

        const waveConfig = this.getCurrentWaveConfig();
        console.log(`Starting Wave ${this.currentWave}!`, waveConfig);

        // Trigger the endless wave update through GameEngine
        if (this.config.isEndless && this.gameEngine && this.gameEngine.updateEndlessWaveCb) {
            this.gameEngine.updateEndlessWaveCb(this.currentWave);
        }

        // Show wave announcement
        if (announce && this.gameEngine && this.gameEngine.showWaveAnnouncement) {
            this.gameEngine.showWaveAnnouncement(this.currentWave, waveConfig.isBossWave);
        }
    }

    reset(announceWaveStart = true) {
        this.currentWave = 0;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.totalEnemiesKilled = 0;
        this.waveCooldown = 240; // 1 second initial delay
        this.lastSpawnTime = 0;
        this.nextSpawnDelay = 0;
        this.waveActive = false;
        this.allWavesComplete = false;
        this.bossSpawned = false;
        this.currentBoss = null;
        this.patternIndex = 0;

        this.startNextWave(announceWaveStart);
    }

}