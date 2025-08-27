// WaveManager.js - Enhanced Wave System
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
        this.lastWaveStartTime = Date.now();
        this.autoStartNextWave = true; // Enable continuous spawning

    }

    update(now, enemyCount, gameOver) {
        if (gameOver || this.allWavesComplete) return;

        //check if its time to start next wave
        if (!this.isEndlessMode && this.currentWave < this.config.waves) {
            const timeSinceLastWave = now - this.lastWaveStartTime;
            if (timeSinceLastWave >= this.waveInterval && this.autoStartNextWave) {
                this.startNextWave();
                this.lastWaveStartTime = now;
            }
        } else if (this.isEndlessMode && this.autoStartNextWave) {
            //shorter interval for endless
            const endlessInterval = Math.max(15000, 30000 - (this.currentWave * 500));
            const timeSinceLastWave = now - this.lastWaveStartTime;
            if (timeSinceLastWave >= endlessInterval) {
                this.startNextWave();
                this.lastWaveStartTime = now;
            }
        }

        //: Continue spawning current wave enemies
        if (this.waveActive) {
            const waveConfig = this.getCurrentWaveConfig();

            // Don't wait for enemies to be defeated - just keep spawning
            if (this.waveEnemiesSpawned < waveConfig.enemyCount) {
                this.spawnWaveEnemies(now, enemyCount, waveConfig);
            }
        }

        // Old wave completion check (now optional, just for bonuses)
        if (this.waveCooldown > 0) {
            this.waveCooldown--;
            if (this.waveCooldown <= 0 && !this.autoStartNextWave) {
                // Only use this if autoStartNextWave is disabled
                this.startNextWave();
            }
        }
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

    spawnWaveEnemies(now, enemyCount, waveConfig) {
        // Check spawn conditions
        if (this.waveEnemiesSpawned >= waveConfig.enemyCount) return;
        if (now - this.lastSpawnTime < this.nextSpawnDelay) return;

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
                this.enemiesSpawnedThisLevel++;
            }, i * 200);
            this.waveEnemiesSpawned++;
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
                this.enemiesSpawnedThisLevel++;
            }, i * 300);
            this.waveEnemiesSpawned++;
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
                this.enemiesSpawnedThisLevel++;
            }, i * 100);

            this.waveEnemiesSpawned++;
        }
        this.nextSpawnDelay = waveConfig.spawnInterval * 1.5;
    }

    spawnBossPattern(waveConfig) {
        if (!this.bossSpawned) {
            // Spawn boss with minions
            this.spawnEnemy(waveConfig.bossType);
            this.bossSpawned = true;
            this.waveEnemiesSpawned++;
            this.enemiesSpawnedThisLevel++;

            // Spawn minions
            const minionCount = Math.min(4, waveConfig.enemyCount - 1);
            for (let i = 0; i < minionCount; i++) {
                setTimeout(() => {
                    this.spawnEnemy('Mini');
                    this.enemiesSpawnedThisLevel++;
                }, (i + 1) * 500);
                this.waveEnemiesSpawned++;
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
                this.enemiesSpawnedThisLevel++;
            }, index * 400);
            this.waveEnemiesSpawned++;
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

    startNextWave() {
        this.currentWave++;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
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
        if (this.gameEngine && this.gameEngine.showWaveAnnouncement) {
            this.gameEngine.showWaveAnnouncement(this.currentWave, waveConfig.isBossWave);
        }
    }

    reset() {
        this.currentWave = 0;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.totalEnemiesKilled = 0;
        this.waveCooldown = 60; // 1 second initial delay
        this.lastSpawnTime = 0;
        this.nextSpawnDelay = 0;
        this.waveActive = false;
        this.allWavesComplete = false;
        this.bossSpawned = false;
        this.currentBoss = null;
        this.patternIndex = 0;

        this.startNextWave();
    }

    // Call this when an enemy is killed
    onEnemyKilled(enemy) {
        this.waveEnemiesKilled++;
        this.totalEnemiesKilled++;

        if (enemy === this.currentBoss) {
            this.currentBoss = null;
            // Award boss kill bonus
            if (this.gameEngine) {
                const bossBonus = this.currentWave * 50;
                this.gameEngine.inGameScore += bossBonus;
                this.gameEngine.updateScoreCb(this.gameEngine.inGameScore);
            }
        }
    }

    // Get current wave status for UI
    getWaveStatus() {
        return {
            currentWave: this.currentWave,
            enemiesSpawned: this.waveEnemiesSpawned,
            enemiesKilled: this.waveEnemiesKilled,
            totalKilled: this.totalEnemiesKilled,
            isActive: this.waveActive,
            cooldown: this.waveCooldown,
            isEndless: this.isEndlessMode,
            isBossWave: this.bossSpawned
        };
    }
}