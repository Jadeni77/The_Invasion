/**
 * This class represent the combat system of how defender and enemy interact
 * with each other.
 */
export class CombatManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }

    /**
     * Defender in game logic to handle attack and create projectile in the actual engine.
     * @param defenders the defender array given
     * @param enemies the enemy array given
     * @param now the current real time
     */
    updateDefenderCombat(defenders, enemies, now) {
        for (const defenderWrapper of defenders) {
            //get the actual class (handles both wrap and unwrap
            const isWrapped = defenderWrapper.defender !== undefined;
            const defender = isWrapped ? defenderWrapper.defender : defenderWrapper;


            if (!defender.isAlive || defender.disabled) continue;

            //handle defender attack if they can
            if (defender.attackDamage > 0 && defender.range > 0 && defender.canAttack(now)) {
                const target = this.findTargetForDefender(defender, enemies);
                if (target) {
                    // If the defender is ranged, create a projectile
                    if (defender.isRanged) {
                        if (defender.useProjectile) {
                            this.gameEngine.projectiles.push({
                            startX: defender.x + defender.width / 2,
                            startY: defender.y + defender.height / 2,
                            target: target, // Store reference to the target enemy
                            speed: 10,
                            damage: defender.attackDamage,
                            attacker: defender,
                            ignoreArmor: defender.hasArmorPiercing || false,
                            onHit: () => {
                                defender.attack(target, now);
                            }});
                            if (isWrapped) {
                                defenderWrapper.attack(target, now);
                            } else {
                                defender.lastAttackTime = now;
                            }
                        } else {
                            if (isWrapped) {
                                defenderWrapper.attack(target, now);
                            } else {
                                defender.attack(target, now);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Enemy in game logic to handle attack and create projectile in the actual engine.
     * @param defenders the defender array given
     * @param enemies the enemy array given
     * @param now the current real time
     */
    updateEnemyCombat(defenders, enemies, now) {
        for (const enemyWrapper of enemies) {
            const isWrapped = enemyWrapper.enemy !== undefined;
            const enemy = isWrapped ? enemyWrapper.enemy : enemyWrapper;

            if (!enemy.isAttacker || !enemy.isAlive) continue;

            if (enemy.isAttacker && enemy.canAttack(now)) {
                const target = this.findTargetForEnemy(enemy, defenders);
                if (target) {
                    if (enemy.isRanged) {
                        if (enemy.useProjectile) {
                            this.gameEngine.enemyProjectiles.push({
                                startX: enemy.x + enemy.width / 2,
                                startY: enemy.y + enemy.height / 2,
                                target: target,
                                speed: 8,
                                damage: enemy.attackDamage,
                                color: "#FF4444",
                                attacker: enemy,
                                onHit: () => {
                                enemy.attack(target, now);
                                }});
                            if (isWrapped) {
                                enemyWrapper.attack(target, now);
                            } else {
                                enemy.lastAttackTime = now;
                            }
                        } else {
                            if (isWrapped) {
                                enemyWrapper.attack(target, now);
                            } else {
                                enemy.lastAttackTime = now;
                            }
                        }
                    }
                }
            }
            }
        }

    /**
     * Finds the closest valid target (enemies) for given defender.
     * @param {DefenderUnit} defender - The defender unit looking for a target.
     * @param enemies - The enemies units being look for
     * @returns {Enemy|null} The closest enemy in range, or null if none found.
     */
    findTargetForDefender(defender, enemies) {
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (const enemyWrapper of enemies) {
            const enemy = enemyWrapper.enemy || enemyWrapper;
            if (!enemy.isAlive) continue;

            // Calculate distance from defender's center to enemy's center
            const distance = Math.hypot(
                defender.x + defender.width / 2 - (enemy.x + enemy.width / 2),
                defender.y + defender.height / 2 - (enemy.y + enemy.height / 2)
            );

            if (distance <= defender.range && distance < closestDistance) {
                closestEnemy = enemyWrapper;
                closestDistance = distance;
            }
        }
        return closestEnemy;
    }

    /**
     * Find the closest valid target (defenders) for given enemy.
     * @param enemy - The enemy unit looking for a target.
     * @param defenders - The defender nits being look for
     * @returns {null} The closest enemy in range, or null if none found.
     */
    findTargetForEnemy(enemy, defenders) {
        let closestDefender = null;
        let closestDistance = Infinity;

        for (const defenderWrapper of defenders) {
            const defender = defenderWrapper.defender || defenderWrapper;
            if (!defender.isAlive) continue;

            const distance = Math.hypot(
                enemy.x + enemy.width / 2 - (defender.x + defender.width / 2),
                enemy.y + enemy.height / 2 - (defender.y + defender.height / 2)
            );

            if (distance <= enemy.attackRange && distance < closestDistance) {
                closestDefender = defenderWrapper;
                closestDistance = distance;
            }
        }
        return closestDefender;
    }
}