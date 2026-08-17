import { isConsumableSpell } from '../../DefenderUnits.js';
import { colors } from '../../../../style/tokens.js';

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
        for (const defender of defenders) {
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
                            this.gameEngine.emitFeedback?.('projectile:fired', {
                                defenderType: defender.constructor.name,
                            });
                            // The swing belongs to the shot leaving, not to the
                            // arrow landing. This branch never calls attack() -
                            // the projectile's onHit does, up to a second later -
                            // so without this a Shooter played no attack animation
                            // at all until its arrow arrived. Every other defender
                            // starts its own swing inside attack(), which for them
                            // IS the moment of the shot.
                            defender.isAttacking = true;
                            defender.beginAttackAnimation?.();
                            defender.lastAttackTime = now;
                        } else {
                            defender.attack(target, now);
                        }
                    } else {
                        defender.attack(target, now); // Defender performs its attack
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
        for (const enemy of enemies) {
            if (!enemy.isAttacker || !enemy.isAlive || enemy.frozen) continue;

            if (enemy.isAttacker && enemy.canAttack(now)) {
                const target = this.findTargetForEnemy(enemy, defenders);
                if (target) {
                    if (enemy.isRanged) {
                        this.gameEngine.enemyProjectiles.push({
                                                                  startX: enemy.x + enemy.width / 2,
                                                                  startY: enemy.y + enemy.height / 2,
                                                                  target: target,
                                                                  speed: 8,
                                                                  damage: enemy.attackDamage,
                                                                  color: colors.accentDanger,
                                                                  attacker: enemy,
                                                                  onHit: () => {
                                                                      enemy.attack(target, now);
                                                                  }});
                        enemy.lastAttackTime = now;
                        // The animation is driven from the actual shot, not from a
                        // separate countdown - two independent timers is why the
                        // skeleton's attack and its projectile never lined up.
                        // beginAttackAnimation restarts the sheet and sizes one
                        // full pass to fit inside the firing cadence;
                        // Enemy.update() runs that down via
                        // runDownAttackAnimation(), because a flag cleared in this
                        // same frame would be gone before the enemy's next
                        // determineAnimationState.
                        enemy.isAttacking = true;
                        enemy.beginAttackAnimation?.();
                        this.gameEngine.emitFeedback?.('enemy:fired', {
                            unitType: enemy.constructor.name,
                        });
                    } else {
                        enemy.attack(target, now);
                        // The one call site that is unambiguously a melee strike -
                        // the ranged branch above never reaches it, and the onHit
                        // callback that also calls attack() is a landing arrow.
                        // Some enemies (Necromancer, Swarm Witch) apply melee
                        // damage through here and nowhere else, so without this
                        // their strikes are silent.
                        //
                        // BossEnemy also deals damage on the base updateBehavior
                        // countdown and so emits twice per attack cycle, far too
                        // far apart to dedupe; see known-issue 14, which is the
                        // authoritative account and is fixed by having one damage
                        // path, not by anything at this site.
                        //
                        // stunned is checked because attack() bails out on it
                        // before dealing damage, while this loop only filters
                        // frozen: without the guard a stunned enemy would announce
                        // a swing that never happened.
                        if (!enemy.stunned) {
                            this.gameEngine.emitFeedback?.('enemy:melee', {
                                unitType: enemy.constructor.name,
                            });
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

        const canvasWidth = this.gameEngine.canvasWidth || 800;

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;
            //skip off screen enemy
            if (enemy.x < -50 || enemy.x > canvasWidth + 50) continue;

            // Calculate distance from defender's center to enemy's center
            const distance = Math.hypot(
                defender.x + defender.width / 2 - (enemy.x + enemy.width / 2),
                defender.y + defender.height / 2 - (enemy.y + enemy.height / 2)
            );

            if (distance <= defender.range && distance < closestDistance) {
                closestEnemy = enemy;
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

        for (const defender of defenders) {
            if (!defender.isAlive) continue;
            // Enemies walk past consumable spells as though the cell were empty.
            // Stopping to attack something invulnerable reads as a stuck enemy.
            if (isConsumableSpell(defender)) continue;

            const distance = Math.hypot(
                enemy.x + enemy.width / 2 - (defender.x + defender.width / 2),
                enemy.y + enemy.height / 2 - (defender.y + defender.height / 2)
            );

            if (distance <= enemy.attackRange && distance < closestDistance) {
                closestDefender = defender;
                closestDistance = distance;
            }
        }
        return closestDefender;
    }
}