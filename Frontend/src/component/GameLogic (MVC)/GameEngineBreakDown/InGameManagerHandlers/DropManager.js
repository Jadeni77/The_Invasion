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
                /*
                 * 8, not 5.
                 *
                 * At a 35% drop chance, 5 energy per drop is 1.75 expected energy
                 * per kill against a 20-energy defender - so a Shooter had to kill
                 * eleven enemies to pay for itself, on a board where an Exploder
                 * one-shots it. Eight brings that to seven kills, which still asks
                 * the defender to earn its place without making losses
                 * unrecoverable.
                 */
                this.gameEngine.dropEnergy(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    8
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