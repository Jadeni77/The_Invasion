/**
 * This class represent the wave system in the in game state and contains
 * logic of how to handle enemy spawn within a wave system.
 */
export class WaveManager {
    constructor(levelConfig, spawnEnemyCallback, ) {
        this.config = levelConfig;
        this.spawnEnemy = spawnEnemyCallback;
        this.currentWave = 1;
        this.waveEnemiesSpawned = 0;
        this.waveCooldown = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.lastEnemySpawnTime = 0;
    }

    /**
     * Logic to handle wave cooldown and enemy spawning.
     * @param now the current real time.
     * @param enemyCount the amount of enemy in total
     * @param gameOver boolean of whether the game is ended
     */
    update(now, enemyCount, gameOver) {
        if (gameOver) return;
        //calculate enemy per waves
        const enemiesPerWave = Math.ceil(this.config.totalEnemiesToSpawn
                                         / this.config.waves);

        //check if the current wave is complete
        if (this.waveEnemiesSpawned >= enemiesPerWave && enemyCount === 0) {
            if (this.currentWave < this.config.waves) {
                //start cooldown for the next wave
                if (this.waveCooldown === 0) {
                    this.waveCooldown = 180;
                    console.log(`Wave ${this.currentWave} complete! Next wave in 3 seconds...`);
                }
                return;
            }
        }
        //handle wave cooldown
        if (this.waveCooldown > 0) {
            this.waveCooldown--;
            if (this.waveCooldown === 0) {
                //start next wave
                this.currentWave++;
                this.waveEnemiesSpawned = 0;
                console.log(`Starting Wave ${this.currentWave}!`);
            }
            return;
        }
        //spawn enemy
        if (this.enemiesSpawnedThisLevel < this.config.totalEnemiesToSpawn &&
            now - this.lastEnemySpawnTime > this.config.enemySpawnInterval &&
            enemyCount < this.config.maxActiveEnemies) {
            this.lastEnemySpawnTime = now;

            const enemyType = this.config.availableEnemyTypes[
                Math.floor(Math.random() * this.config.availableEnemyTypes.length)];
            this.spawnEnemy(enemyType);
            this.enemiesSpawnedThisLevel++;
            this.waveEnemiesSpawned++;
        }
    }

    /**
     * Reset the wave system.
     */
    reset() {
        this.currentWave = 1;
        this.waveEnemiesSpawned = 0;
        this.waveCooldown = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.lastEnemySpawnTime = 0;
    }

}