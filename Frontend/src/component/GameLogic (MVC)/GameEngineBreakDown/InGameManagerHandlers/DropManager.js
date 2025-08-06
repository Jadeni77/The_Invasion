/**
 * This class represent the energy and card piece dropping logic
 * and is used during the in game state
 */
export class DropManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.energyDropChance = 0.35; //35% drop
        this.cardPieceDropChance = 0.15; //15%
    }

    /**
     * Helper method to transfer data into DropEnergy method
     * with the given enemy's position
     * @param enemy the enemy given
     */
    handleEnemyDeath(enemy) {
        if (!enemy.isSpawned) {
            if (Math.random() < this.energyDropChance) {
                this.gameEngine.dropEnergy(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    5
                );
            }
            if (Math.random() < this.cardPieceDropChance) {
                this.gameEngine.dropCardPieces(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2
                );
            }
        }
    }
}