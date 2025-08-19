import {AnimatedEnemyWrapper} from "../../Animation/AnimatedEnemyWrapper.js";
import {AnimatedDefenderWrapper} from "../../Animation/AnimatedDefenderWrapper.js";

export class DrawEntities {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }

    /** Draws all active defender units. */
    drawDefenders(ctx) {
        for (const defender of this.gameEngine.defenders) {
            if (defender instanceof AnimatedDefenderWrapper) {
                defender.draw(ctx);
            }
            if (defender.isAlive) {
                defender.draw(ctx);
            }
        }
    }

    /** Draws all active enemy units. */
    drawEnemies(ctx) {
        for (const enemy of this.gameEngine.enemies) {
            if (enemy instanceof AnimatedEnemyWrapper) {
                enemy.draw(ctx);
            }
            //regular enemy
            else if (enemy.isAlive) {
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

    drawSpellProjectiles(ctx) {
        for (const spell of this.gameEngine.spellProjectiles) {
            // Draw trail
            for (let i = 0; i < spell.trail.length; i++) {
                const point = spell.trail[i];
                const alpha = point.timer / 20;

                if (spell.type === "fireball") {
                    // Fire trail
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.6;
                    const gradient = ctx.createRadialGradient(
                        point.x, point.y, 0,
                        point.x, point.y, 15
                    );
                    gradient.addColorStop(0, "yellow");
                    gradient.addColorStop(0.5, "orange");
                    gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 15 - i * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                } else if (spell.type === "icebolt") {
                    // Ice trail
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.6;
                    const gradient = ctx.createRadialGradient(
                        point.x, point.y, 0,
                        point.x, point.y, 12
                    );
                    gradient.addColorStop(0, "white");
                    gradient.addColorStop(0.5, "lightblue");
                    gradient.addColorStop(1, "rgba(173, 216, 230, 0)");
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 12 - i * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Draw main projectile
            ctx.save();

            if (spell.type === "fireball") {
                // Fireball core
                const gradient = ctx.createRadialGradient(
                    spell.currentX, spell.currentY, 0,
                    spell.currentX, spell.currentY, 20
                );
                gradient.addColorStop(0, "white");
                gradient.addColorStop(0.3, "yellow");
                gradient.addColorStop(0.7, "orange");
                gradient.addColorStop(1, "rgba(255, 0, 0, 0.5)");

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(spell.currentX, spell.currentY, 20, 0, Math.PI * 2);
                ctx.fill();

                // Flame particles
                for (let i = 0; i < 5; i++) {
                    const angle = (Date.now() / 100 + i * Math.PI / 2.5) % (Math.PI * 2);
                    const px = spell.currentX + Math.cos(angle) * 15;
                    const py = spell.currentY + Math.sin(angle) * 15;

                    ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (spell.type === "icebolt") {
                // Ice bolt core
                const gradient = ctx.createRadialGradient(
                    spell.currentX, spell.currentY, 0,
                    spell.currentX, spell.currentY, 18
                );
                gradient.addColorStop(0, "white");
                gradient.addColorStop(0.5, "lightblue");
                gradient.addColorStop(1, "rgba(135, 206, 235, 0.5)");

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(spell.currentX, spell.currentY, 18, 0, Math.PI * 2);
                ctx.fill();

                // Ice crystals
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 * i) / 6;
                    ctx.beginPath();
                    ctx.moveTo(spell.currentX, spell.currentY);
                    ctx.lineTo(
                        spell.currentX + Math.cos(angle) * 15,
                        spell.currentY + Math.sin(angle) * 15
                    );
                    ctx.stroke();
                }
            }

            ctx.restore();
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