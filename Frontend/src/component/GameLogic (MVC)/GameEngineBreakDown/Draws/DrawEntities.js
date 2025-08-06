export class DrawEntities {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }

    /** Draws all active defender units. */
    drawDefenders(ctx) {
        for (const defender of this.gameEngine.defenders) {
            if (defender.isAlive) {
                defender.draw(ctx);
            }
        }
    }

    /** Draws all active enemy units. */
    drawEnemies(ctx) {
        for (const enemy of this.gameEngine.enemies) {
            if (enemy.isAlive) {
                enemy.draw(ctx);
            }
        }
    }

    /** Draws all active projectiles. */
    drawProjectiles(ctx) {
        ctx.fillStyle = "#FF0000"; // Red projectiles
        //draw defender projectiles
        for (const projectile of this.gameEngine.projectiles) {
            // Projectile is drawn at its current startX/startY
            ctx.beginPath();
            ctx.arc(projectile.startX, projectile.startY, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        // Draw enemy projectiles
        for (const projectile of this.gameEngine.enemyProjectiles) {
            ctx.fillStyle = projectile.color || "#FF0000"; // Red for enemies
            ctx.beginPath();
            ctx.arc(projectile.startX, projectile.startY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawEnergyDrops(ctx) {
        for (const drop of this.gameEngine.energyDrops) {
            drop.draw(ctx);
        }
    }

    drawCardPieceDrops(ctx) {
        for (const drop of this.gameEngine.cardPieceDrops) {
            drop.draw(ctx);
        }
    }
}