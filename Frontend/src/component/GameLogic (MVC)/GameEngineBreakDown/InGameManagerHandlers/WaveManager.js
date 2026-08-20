// WaveManager.js - Enhanced Wave System
/* The floor on how often enemies may arrive, in milliseconds. */
const MIN_SPAWN_INTERVAL_MS = 200;

/** How long the player gets to arrange defenders before the first wave. */
export const PREP_TIME_MS = 10_000;

/**
 * The gap between one wave finishing its arrival and the next beginning.
 *
 * A set amount of time, and nothing shortens it. Waves used to arrive on
 * whichever of three racing conditions won: the board being clear three seconds
 * after the wave started, two or fewer enemies left after six, or fifteen
 * seconds elapsed regardless. The first of those fires the instant the last
 * enemy dies, so killing the one zombie in level 1's opening wave summoned the
 * next immediately - while the countdown on screen still read ten.
 *
 * A countdown cannot be honest about a race. This is the whole rule now.
 */
export const WAVE_GAP_MS = 8_000;

/** Score for clearing a wave, per wave number: wave 3 pays 30. */
export const WAVE_CLEAR_SCORE = 10;

/** Energy dropped for clearing a wave, plus one per wave number. */
export const WAVE_CLEAR_ENERGY = 5;

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

        this.lastWaveStartTime = 0;

        this.waveFullySpawned = false;

        /* When the next wave is due, or null while one is still arriving. Set
           once, from WAVE_GAP_MS, and never moved. */
        this.nextWaveAt = null;
    }

    update(now, enemyCount, gameOver) {
        if (gameOver || this.allWavesComplete) return;

        if (this.shouldStartNextWave(now)) {
            this.startNextWave();
            this.lastWaveStartTime = now;
            this.nextWaveAt = null;
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
                        console.log("All enemies spawned for level!");
             //       }
                } else {
                    /* The only place the gap is set: the moment this wave stops
                       arriving. Not when the board clears, so the number on
                       screen is the number the player waits. */
                    this.nextWaveAt = now + WAVE_GAP_MS;
                }
            }

            /* Everything the wave sent is dead, so the wave is over and gets
               paid for. Once only, and it is completeWave's `waveActive = false`
               that sees to that - this whole block is inside `if (waveActive)`.
               A second latch alongside it would be redundant and, worse,
               untestable: removing it would change nothing observable. */
            if (this.waveFullySpawned && enemyCount === 0) {
                this.completeWave();
            }
        }
    }

    /**
     * Whether the next wave is due.
     *
     * One rule per state, and no races. Wave 1 waits out the prep; every wave
     * after it waits the gap armed when the previous one finished arriving.
     *
     * What this deliberately no longer does is cut a wave short. Progression
     * used to be forced fifteen seconds after a wave STARTED, whether or not it
     * had finished spawning - and startNextWave resets the spawn counter, so the
     * enemies a slow wave had not yet put on the board were simply never spawned.
     * A level could quietly deliver fewer enemies than it declared.
     */
    shouldStartNextWave(now) {
        if (this.currentWave === 0) return now - this.lastWaveStartTime >= PREP_TIME_MS;
        if (!this.isEndlessMode && this.currentWave >= this.config.waves) return false;

        return this.nextWaveAt !== null && now >= this.nextWaveAt;
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

        /* Counted across the pattern, because the gap is per enemy and only
           the pattern knows how many it spawned - rush rolls 3 to 5. Every
           pattern increments this synchronously; the setTimeouts inside them
           stagger the sprite, not the count. */
        const spawnedBefore = this.waveEnemiesSpawned;

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
         * `spawnInterval` is seconds per ENEMY, so a pattern that puts four on
         * the board waits four of them before the next.
         *
         * Each pattern used to set this itself, by a factor that had nothing to
         * do with what it spawned: rush put down 3-5 and waited x2, surround put
         * down 3 and waited x1.5, formation put down 4 and waited x3. A wave
         * declaring 2000ms therefore meant 2s, 3s, 4s, 6s or 10s depending on a
         * pattern chosen elsewhere in the same config, and the authored number
         * meant nothing on its own.
         */
        const spawned = Math.max(1, this.waveEnemiesSpawned - spawnedBefore);
        this.nextSpawnDelay = Math.max(
            MIN_SPAWN_INTERVAL_MS,
            waveConfig.spawnInterval * spawned,
        );
    }

    spawnStandardPattern(waveConfig) {
        const enemyType = this.selectEnemyType(waveConfig.enemyTypes);
        this.spawnEnemy(enemyType);
        this.waveEnemiesSpawned++;
        this.enemiesSpawnedThisLevel++;
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
        console.log(`Wave ${this.currentWave} cleared!`);

        if (!this.gameEngine) return;

        /* Pays for clearing rather than for waiting. The gap between waves is
           fixed now, so without this there was nothing to gain by killing the
           last enemy promptly - and this code existed all along, written and
           tested and called from nowhere, so the reward had never once been
           paid. */
        const bonus = this.currentWave * WAVE_CLEAR_SCORE;
        this.gameEngine.inGameScore += bonus;
        this.gameEngine.updateScoreCb?.(this.gameEngine.inGameScore);

        /* Dropped at the centre, so it has to be collected rather than granted -
           the same bargain as every other energy pickup. */
        this.gameEngine.dropEnergy?.(
            this.gameEngine.canvasWidth / 2,
            this.gameEngine.canvasHeight / 2,
            WAVE_CLEAR_ENERGY + this.currentWave,
        );
    }

    // announce (default true) gates only the wave:started horn/banner - the
    // wave counters themselves always advance. reset() no longer calls this at
    // all, so the horn cannot land on top of a win or loss sting: every wave,
    // wave 1 included, now begins from update() when its time actually comes.
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

    /*
     * Back to the start of a level, wave 1 NOT yet begun.
     *
     * This used to end by calling startNextWave, which took currentWave to 1
     * before anything ran - and `shouldStartNextWave` only consults PREP_TIME_MS
     * while currentWave is 0. So the named prep value was unreachable, and the
     * real wait was a `lastSpawnTime = now + 5000` in GameEngine.resetGame:
     * five seconds, from a number nobody had chosen.
     *
     * Wave 1 now begins from `update`, like every other wave, which is also
     * what makes its horn play when the wave actually arrives.
     */
    reset() {
        this.currentWave = 0;
        this.waveEnemiesSpawned = 0;
        this.waveEnemiesKilled = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.totalEnemiesKilled = 0;
        this.lastSpawnTime = 0;
        this.nextSpawnDelay = 0;
        this.waveActive = false;
        this.allWavesComplete = false;
        this.bossSpawned = false;
        this.currentBoss = null;
        this.patternIndex = 0;

        /* Reset with the rest of the clock. Left holding a timestamp from the
           level just played, it was compared against a game clock that had gone
           back to zero - `0 - 90000 >= 10000` is false, so wave 1 was owed a
           hundred seconds on the second level of a session. */
        this.lastWaveStartTime = 0;

        /* Nothing is due until a wave has arrived and finished. */
        this.nextWaveAt = null;
        this.waveFullySpawned = false;
    }

    /**
     * Seconds until the next wave arrives, or 0 when nothing is being waited on.
     *
     * DrawUIs has always called this to draw the "Next Wave" countdown, and for
     * a long time it did not exist - so the countdown never drew at all.
     *
     * Now it reads the one clock that decides: the prep before wave 1, or the
     * gap after a wave finishes arriving. It returns 0 while a wave is still
     * spawning, and the UI draws nothing then, because enemies are arriving
     * already and there is no wait to report.
     *
     * Every number this returns is a number the wave honours. The version before
     * this counted toward a fifteen-second cap that three other rules could beat
     * to the punch, so it read ten while the wave began.
     */
    getTimeUntilNextWave() {
        if (this.allWavesComplete) return 0;

        const now = this.gameEngine?.gameClock?.now ?? 0;

        if (this.currentWave === 0) {
            return Math.max(0, Math.ceil((PREP_TIME_MS - (now - this.lastWaveStartTime)) / 1000));
        }

        if (this.nextWaveAt === null) return 0;
        return Math.max(0, Math.ceil((this.nextWaveAt - now) / 1000));
    }

}