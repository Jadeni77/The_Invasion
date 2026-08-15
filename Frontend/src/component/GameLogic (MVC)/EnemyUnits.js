// src/component/GameLogic (MVC)/EnemyUnits.js
// Data for different types of Enemy types


/*
TODO:
 1.把wrapper的东西合并在每一个enemy class里面
 2.AnimationManager可以留可以不留 （尽量保留
 3.看看能不能把每一个subclass constructor里面的image parameter用上，目前image parameter
 没有任何作用因为都是null value
 4.DrawEntities.js, CombatManager.js (done revert), GameEngine, DefenderUnits.js, EnemyUnit.js
 5.加油！
*/

import {DrawNegativeEffect} from "./GameEngineBreakDown/Draws/DrawNegativeEffect.js";
import { getSettings } from "./Feedback/SettingsStore.js";
import { isConsumableSpell } from "./DefenderUnits.js";

/**
 * Frames a ranged enemy holds its attack animation after firing.
 *
 * The animation is started by the shot itself (CombatManager) and released by
 * this countdown, because neither end can be done in one place: the flag has
 * to survive past the frame it was set on - GameEngine runs enemy.update()
 * BEFORE updateEnemyCombat, so clearing it in the same frame it was set means
 * determineAnimationState never sees it and the swing never renders - and it
 * has to expire on its own, or it latches on until the target leaves range and
 * the animation runs continuously again, which is the bug this replaces.
 *
 * Must stay comfortably below the enemy's firing cadence or the lock is
 * renewed before it expires and the latch comes back. 20 frames is ~333ms at
 * 60fps, against a Skeleton Shooter's 833ms cadence (attackRate 50), which
 * shows the front of its 10-frame/10fps attack sheet and still leaves ~30
 * frames of the cooldown visibly not attacking, so each shot reads as a
 * separate swing.
 *
 * ASSUMES 60fps. This is counted in frames while the cooldown canAttack
 * enforces is wall-clock (attackRate * 1000 / 60 ms), so the margin between
 * the two shrinks as frame time grows: at roughly 24fps or below, 20 frames
 * outlasts the 833ms cooldown and the animation latches on again. If the game
 * ever has to hold up at low frame rates, this wants to become a duration in
 * milliseconds rather than a frame count.
 */
export const ATTACK_ANIMATION_LOCK_FRAMES = 20;

export class Enemy {
  constructor(x, y, typeData = {}) {
    this.x = x;
    this.y = y;
    this.initialSpeed = typeData.speed || 0.8; // Use typeData.speed for initial speed
    this.speed = this.initialSpeed; // current speed and can be modify by rage or ability
    this.width = typeData.width || 30;
    this.height = typeData.height || 30;
    this.health = typeData.health || 100;
    this.maxHealth = typeData.health || 100;
    this.color = typeData.color || "darkgreen";
    this.name = typeData.name || "Basic Zombie";
    this.isAlive = true;
    this.id = Math.random();
    this.image = typeData.image; // Pixel style images are still image objects
    this.bounty = typeData.bounty || 10; // Reward when killing an enemy

    // Attack properties
    this.isAttacker = typeData.isAttacker || false;
    this.baseAttackDamage = typeData.attackDamage || 0;
    this.attackDamage = typeData.attackDamage || 0;
    this.attackRate = typeData.attackRate || 60; // frames per attack
    this.attackCountdown = this.attackRate;
    this.isAttacking = false; // if entity is engage in attack
    // Frames left to hold the attack animation after a shot; see
    // ATTACK_ANIMATION_LOCK_FRAMES. Only ranged enemies use it - a melee
    // enemy's swing is driven by its own damage tick in updateBehavior.
    this.attackAnimationLock = 0;

    this.isRanged = typeData.isRanged || false; //same as useProjectile check
    this.lastAttackTime = 0;
    this.attackRange = typeData.attackRange || 0;

    this.buffed = typeData.buffed || false;
    this.buffApplied = false;
    this.buffedBy = typeData.buffedBy || null;

    this.isSpawned = typeData.isSpawned || false;
    this.spawnBy = typeData.spawnBy || null;

    this.gameEngine = null;
    this.drawNegativeEffect = new DrawNegativeEffect(this);

    this.shouldFlip = typeData.name !== "Skeleton Shooter"
                      && typeData.name !== "Skeleton"
                      && typeData.name !== "Tank Zombie"
                      && typeData.name !== "Berserker"
                      && typeData.name !== "Mage"
                      && typeData.name !== "EMP"
                      && typeData.name !== "Titan";

    this.stunned = false;

    // Animation properties

    this.currentAnimation = 'idle';
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.animationFrames = null;
    this.animationConfig = null;

    this.isPlayingDeathAnimation = false;
    this.deathAnimationComplete = false;
    this.deathHandled = false; // Add this flag

    //negative effect
    this.slowed = false;
    this.slowDuration = 0;
    this.frozen = false;
    this.frozenDuration = 0;

    this.burning = false;
    this.burningDamage = 0;
    this.burningDuration = 0;


  }

  setAnimation(animationName) {
    if (this.currentAnimation !== animationName && this.animationFrames) {
      this.currentAnimation = animationName;
      this.animationFrame = 0;
      this.animationTimer = 0;

      // Mark when death animation starts
      if (animationName === 'death') {
        this.isPlayingDeathAnimation = true;
        console.log(`${this.name} started death animation`);

        // Check if we have death animation frames
        if (!this.animationFrames.death || this.animationFrames.death.length === 0) {
          console.warn(`${this.name} has no death animation frames!`);
          // Immediately mark as complete if no frames
          this.deathAnimationComplete = true;
        }
      }
    }
  }

  updateAnimation(deltaTime) {
    if (!this.animationConfig || !this.animationFrames) {
      return;
    }

    const config = this.animationConfig[this.currentAnimation];
    if (!config) {
      return;
    }

    // Debug death animation speed
    if (this.currentAnimation === 'death' && this.animationFrame === 0) {
      console.log(`Starting death animation: ${config.frameCount} frames at ${config.fps} fps = ${config.frameCount/config.fps} seconds`);
    }

    this.animationTimer += deltaTime;
    const frameDuration = 1000 / config.fps;

    if (this.animationTimer >= frameDuration) {
      this.animationTimer -= frameDuration; // Use subtraction instead of reset to maintain timing
      this.animationFrame++;

      if (this.animationFrame >= config.frameCount) {
        if (config.loop !== false) {
          this.animationFrame = 0;
        } else {
          this.animationFrame = config.frameCount - 1;

          // Mark death animation as complete
          if (this.currentAnimation === 'death') {
            console.log(`${this.name} death animation complete at frame ${this.animationFrame}`);
            this.deathAnimationComplete = true;
          }
        }
      }
    }
  }

  canAttack(currentTime) {
    if (!this.isAttacker) return false;
    return currentTime - this.lastAttackTime >= (this.attackRate * 1000) / 60;
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive || this.frozen || this.stunned) return;

    target.takeDamage(this.attackDamage);

    //range attacks are handle by gameEngine in the draw Projectile method
    this.lastAttackTime = currentTime;
  }

  /**
   * Movement and Attack Logic
   * @param {Array<DefenderUnit>} defenderUnits - Array of active defender units
   */
  update(defenderUnits) {
    if (!this.isAlive) {
      if (this.currentAnimation !== 'death') {
        this.setAnimation('death');
      }
      // Update animation but don't do anything else
      this.updateAnimation(16);
      return;
    }

    this.runDownAttackAnimationLock();

    this.updateBehavior(defenderUnits);

    this.updateMovementSpeed();

    // Determine animation state
    this.determineAnimationState();

    // Update animation
    this.updateAnimation(16);

    // Handle movement
    this.handleMovement();
  }

  /**
   * Runs down the attack-animation lock a shot started, and drops out of the
   * attack animation when it expires.
   *
   * Lives here rather than in RangeEnemy because CombatManager sets the lock
   * on ANY enemy taking its ranged branch - it keys on isRanged, and MageEnemy
   * is kept out of that branch only by its canAttack() override. A lock that
   * can be set by a base-class rule has to be released by one too, or the
   * next ranged enemy that does not extend RangeEnemy latches its attack
   * animation on forever.
   *
   * A no-op for melee enemies: nothing sets their lock, and their swing is
   * driven by the damage tick in updateBehavior instead.
   */
  runDownAttackAnimationLock() {
    if (this.attackAnimationLock <= 0) return;

    this.attackAnimationLock--;
    if (this.attackAnimationLock === 0) {
      this.isAttacking = false;
    }
  }

  updateBehavior(defenderUnits) {
    // Default behavior for basic enemies
    let targetDefender = null;

    if (this.isAttacker) {
      targetDefender = defenderUnits.find((defender) => {
        return (
            defender.isAlive &&
            !isConsumableSpell(defender) &&
            this.x + this.width >= defender.x &&
            this.x <= defender.x + defender.width &&
            this.y + this.height >= defender.y &&
            this.y <= defender.y + defender.height
        );
      });

      if (targetDefender && !this.frozen && !this.stunned) {
        this.speed = 0;
        this.isAttacking = true;
        this.attackCountdown--;

        if (this.attackCountdown <= 0) {
          targetDefender.takeDamage(this.attackDamage);
          // Emitted here, on the damage tick, rather than in attack(): this is
          // the site the visible swing is restarted from, and it fires once per
          // tick instead of once per frame in contact. attack() would be wrong
          // twice over - CombatManager calls it from a ranged projectile's
          // onHit as well, so every landing arrow would claim to be a swing.
          this.gameEngine?.emitFeedback?.('enemy:melee', { unitType: this.constructor.name });
          this.attackCountdown = this.attackRate;
          // Restart the attack animation so the visible swing lines up with damage ticks
          if (this.currentAnimation === 'attack') {
            this.animationFrame = 0;
            this.animationTimer = 0;
          }
        }
      } else {
        this.isAttacking = false;
        this.attackCountdown = this.attackRate;
      }
    }
  }

  /**
   * Handle the movement base on special effects given by defender
   */
  updateMovementSpeed() {
    // Start with base speed
    let currentSpeed = this.initialSpeed;

    // Apply status effects
    if (this.frozen || this.stunned) {
      this.speed = 0;
      return;
    } else if (this.slowed) {
      currentSpeed = this.initialSpeed * 0.5;
    }

    // Apply buff ONLY if not already applied
    if (this.buffed && !this.buffApplied) {
      // Mark as applied to prevent re-application
      this.buffApplied = true;
      // Store the buffed values
      this.attackDamage = this.baseAttackDamage * 1.3;
      currentSpeed = currentSpeed * 1.2;
    } else if (!this.buffed && this.buffApplied) {
      // Remove buff if no longer buffed
      this.buffApplied = false;
      this.attackDamage = this.baseAttackDamage;
    }

    // Set the final speed
    if (this.buffApplied) {
      this.speed = currentSpeed * 1.2;
    } else {
      this.speed = currentSpeed;
    }
  }

  /**
   * Determine animation state based on current status
   */
  determineAnimationState() {
    if (this.frozen || this.stunned) {
      this.setAnimation('idle');
    } else if (this.isAttacking) {
      this.setAnimation('attack');
    } else if (this.speed > 0) {
      this.setAnimation('move');
    } else {
      this.setAnimation('idle');
    }
  }

  handleMovement() {
    if (!this.isAttacking && !this.frozen && !this.stunned) {
      this.x += this.speed;
    }
  }

  draw(ctx) {
    ctx.save();

    // ADD THESE LINES - Critical for pixel art!
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Your flip code if you have it
    if (this.shouldFlip) {
      ctx.scale(-1, 1);
      ctx.translate(-this.x * 2 - this.width, 0);
    }


    if (this.animationFrames && this.animationFrames[this.currentAnimation]) {
      const frames = this.animationFrames[this.currentAnimation];
      if (frames && frames[this.animationFrame]) {
        try {
          ctx.drawImage(
              frames[this.animationFrame],
              this.x,
              this.y,
              this.width,
              this.height
          );
        } catch (e) {
          console.error('Failed to draw frame:', e);
          this.drawFallback(ctx);
        }
      } else {
        console.warn(`No frame for ${this.currentAnimation}[${this.animationFrame}]`);
        this.drawFallback(ctx);
      }
    } else {
      this.drawFallback(ctx);
    }

    ctx.restore();

    if (this.isAlive) {
      // Unit name text
      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(
          this.name.substring(0, this.name.length),
          this.x + 2,
          this.y + this.height + 15
      );

      // Health bar and value
      if (this.health < this.maxHealth && getSettings().display.showHealthBars) {
        ctx.fillStyle = "red";
        ctx.fillRect(this.x, this.y - 10, this.width, 5);
        ctx.fillStyle = "lime";
        const healthWidth = (this.health / this.maxHealth) * this.width;
        ctx.fillRect(this.x, this.y - 10, healthWidth, 5);
        ctx.fillText(this.health.toFixed(0), this.x + this.width / 2, this.y - 15);
      }
      this.drawNegativeEffect.drawAllEffect(ctx);
    }
  }

  drawFallback(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw unit type initial
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.charAt(0), this.x + 5, this.y + 15);
  }

  takeDamage(amount, _ignoreArmor = false) {
    //console.log(`${this.name} took damage: ${amount}`);
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true; // Indicate that enemy died
    }
    return false; // Indicate that enemy did not die
  }

  findClosestDefender(defenderUnits) {
    let closest = null;
    let minDistance = Infinity;

    for (const defender of defenderUnits) {
      if (!defender.isAlive) continue;
      if (isConsumableSpell(defender)) continue;

      const distance = this.getDistanceTo(defender);
      if (distance < minDistance) {
        minDistance = distance;
        closest = defender;
      }
    }
    return closest;
  }

  getDistanceTo(target) {
    return Math.hypot(
        this.x + this.width / 2 - (target.x + target.width / 2),
        this.y + this.height / 2 - (target.y + target.height / 2)
    );
  }

  setGameEngine(engine) {
   // console.log(`Setting gameEngine for ${this.name}`);
    this.gameEngine = engine;
  }
}

export class BasicEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Basic Zombie",
      speed: 0.8,
      health: 100,
      color: "darkgreen",
      width: 80,
      height: 64,
      image: image,
      bounty: 10,
      isAttacker: true, // Basic Zombie attacks
      attackDamage: 30,
      attackRate: 60,
    });
  }
}

export class FastEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Fast Zombie",
      speed: 1.5, // Faster
      health: 80, // Less health
      color: "darkorange",
      width: 64,
      height: 64,
      image: image,
      bounty: 15,
      isAttacker: false, // This one just tries to cross
      attackDamage: 0,
    });
  }
}

export class TankEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Tank Zombie",
      speed: 0.5, // Slower
      health: 1200,
      width: 90,
      height: 64,
      color: "darkred",
      image: image,
      bounty: 30,
      isAttacker: true, // This one attacks
      attackDamage: 30, // High base damage
      attackRate: 90, // Slower attack speed (1.5 seconds)
    });
    this.raged = false;
    this.rageThreshold = 0.5; // Rage when health drops below 50%
    this.rageSpeedMultiplier = 2.0; // Double speed when raged
    this.rageDamageMultiplier = 1.5; // 50% more attack damage when raged

    this.hasArmor = true;
    this.armorReduction = 0.5
  }

  takeDamage(amount, ignoreArmor) {
    // 50% damage reduction always
    const actualDamage = (this.hasArmor && !ignoreArmor)
                         ? amount * this.armorReduction : amount;

    const died = super.takeDamage(actualDamage, ignoreArmor);

    if (this.isAlive && !this.raged && this.health / this.maxHealth <= this.rageThreshold) {
      this.speed *= this.rageSpeedMultiplier;
      this.attackDamage *= this.rageDamageMultiplier; // Re-enabled as Enemy now has attackDamage
      this.raged = true;
      console.log(`${this.name} is enraged! Speed: ${this.speed.toFixed(1)}`);
      this.color = "orange"; // Simple visual change
    }
    return died;
  }
}

export class BombEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Exploder",
      speed: 1.2,
      health: 120,
      width: 64,
      height: 64,
      color: "purple",
      image: image,
      bounty: 20,
      isAttacker: false, // Primary interaction is explosion, not regular attack
      attackDamage: 200,
    });
    this.explosionRadius = 100;
    this.shouldExplode = false; // Flag to tell GameEngine to handle explosion
    this.exploderBySelf = false;
  }

  // Explode on death
  takeDamage(amount, ignoreArmor = false) {
    const died = super.takeDamage(amount, ignoreArmor);
    if (died && !this.shouldExplode) {
      this.shouldExplode = true; // Mark for explosion
      this.exploderBySelf = false;

      this.gameEngine.explosions.push({
                                        x: this.x + this.width / 2,
                                        y: this.y + this.height / 2,
                                        damage: 0,
                                        radius: this.explosionRadius / 2,
                                        timer: 40,
                                        color: this.color,
                                        innerColor: "magenta",
                                        particleColor: "rgba(148, 0, 211, 0.9)",
                                        style: "shockwave",
                                        type: "enemy",
                                        source: "exploder",
                                        explodeBy: "exploder"
                                      });
    }
    return died;
  }

  updateBehavior(defenderUnits) {
    super.updateBehavior(defenderUnits);
    if (!this.isAlive || this.shouldExplode) return;

    // If close then explode
    const nearestDefender = defenderUnits.find(
        (defender) => defender.isAlive &&
                      !isConsumableSpell(defender) &&
                      Math.hypot(this.x - defender.x, this.y - defender.y) <
                      this.explosionRadius / 2); //reduce range for explosion detection
    if (nearestDefender && !this.frozen && !this.stunned) {
      console.log(`${this.name} self-destructs near a defender!`);
      console.log(`${this.name} deal ${this.attackDamage}`)
      this.shouldExplode = true; // Mark for explosion
      this.exploderBySelf = true;
      this.isAlive = false; // Enemy is consumed by the explosion
      this.health = 0;
      this.gameEngine.explosions.push({
                                        x: this.x + this.width / 2,
                                        y: this.y + this.height / 2,
                                        damage: 0,
                                        radius: this.explosionRadius,
                                        timer: 40,
                                        color: this.color,
                                        innerColor: "magenta",
                                        particleColor: "rgba(148, 0, 211, 0.9)",
                                        style: "shockwave",
                                        type: "enemy",
                                        source: "exploder",
                                        explodeBy: "exploder"
                                      });
    }
  }

  draw(ctx) {
    super.draw(ctx);
    if (this.isAlive && this.health / this.maxHealth < 0.4) {
      // Health less than 40%
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + Math.sin(Date.now() / 100) * 5, // Pulsating effect
          0,
          Math.PI * 2
      );
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)"; // Yellow pulsating border
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export class RangeEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Skeleton Shooter",
      speed: 0.8,
      health: 150,
      width: 96,
      height: 64,
      color: "White",
      image: image,
      bounty: 15,
      isAttacker: true,
      attackDamage: 20,
      attackRate: 50,
      attackRange: 150,
      isRanged: true
    });
    this.useProjectile = true;
    this.lastAttackTime = 0;
    this.isMoving = true;
  }

  updateBehavior(defenderUnits) {
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && !this.frozen && !this.stunned &&
        this.getDistanceTo(targetDefender) <= this.attackRange) {
      // Stop to shoot, but let CombatManager decide when a shot actually happens -
      // it owns the real cooldown. Setting isAttacking here made the animation play
      // continuously while a defender was in range; the swing is started by the
      // shot and ended by the lock Enemy.runDownAttackAnimationLock counts down.
      this.isMoving = false;
    } else {
      this.isMoving = true;
      this.isAttacking = false;
      this.attackAnimationLock = 0;
    }
  }

  handleMovement() {
    if (this.isMoving && !this.frozen && !this.stunned) {
      this.x += this.speed;
    }
  }
}


export class ShieldEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Shielder",
      speed: 0.8,
      health: 200,
      width: 90,
      height: 64,
      color: 'darkgray',
      image: image,
      bounty: 25,
      isAttacker: true,
      attackDamage: 15,
      attackRate: 80,
      attackRange: 40
    });
    this.shieldHealth = 100;
    this.maxShieldHealth = 100;
    this.shieldActive = true;
    this.blockChance = 0.7; // to block frontal projectile damage
  }

  takeDamage(amount, ignoreArmor = false) {
    if (this.shieldActive && Math.random() < this.blockChance) {
      this.shieldHealth -= amount;
      if (this.shieldHealth <= 0) {
        this.shieldActive = false;
        const excess = Math.abs(this.shieldHealth);
        this.shieldHealth = 0;
        return super.takeDamage(excess, ignoreArmor);
      }
      return false; //didnt die
    }
    return super.takeDamage(amount, ignoreArmor);
  }

  draw(ctx) {
    super.draw(ctx);

    // Draw shield if active
    if (this.shieldActive) {
      ctx.strokeStyle = "silver";
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x - 5, this.y, 5, this.height);

      // Shield health bar
      ctx.fillStyle = "blue";
      ctx.fillRect(this.x - 8, this.y - 15, 3, this.height);
      ctx.fillStyle = "lightblue";
      const shieldHealthHeight = (this.shieldHealth / this.maxShieldHealth) * this.height;
      ctx.fillRect(this.x - 8, this.y - 15 + (this.height - shieldHealthHeight), 3, shieldHealthHeight);
    }
  }
}

export class HealerEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Healer",
      speed: 0.1,
      health: 80,
      width: 64,
      height: 64,
      color: 'lightgreen',
      image: image,
      bounty: 25,
      isAttacker: false,
      attackDamage: 0,
      attackRate: 0,
      attackRange: 0
    });
    this.healAmount = 20;
    this.healRange = 200;
    this.healCooldown = 240; //5 second
    this.currentHealCooldown = 0;
  }

  updateBehavior(defenderUnits) {
    super.updateBehavior(defenderUnits);

    if (!this.isAlive) return;

    //healing logic
    this.currentHealCooldown--;
    if (this.currentHealCooldown <= 0) {
      this.healNearbyEnemy();
      this.currentHealCooldown = this.healCooldown;
    }
  }

  healNearbyEnemy() {
    if (this.gameEngine) {
      const enemies = this.gameEngine.enemies;
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;

        const distance = Math.hypot(
            this.x + this.width / 2 - (enemy.x + enemy.width / 2),
            this.y + this.height / 2 - (enemy.y + enemy.height / 2)
        )
        if (distance <= this.healRange) {
          enemy.maxHealth += this.healAmount;
          enemy.health = Math.min(enemy.maxHealth, enemy.health + this.healAmount);
        }
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Healing aura effect
    if (this.currentHealCooldown > this.healCooldown - 20) {
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.healRange,
          0,
          Math.PI * 2
      );
      ctx.strokeStyle = `rgba(0, 255, 0, ${(this.healCooldown - this.currentHealCooldown) / 20})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export class SplitterEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Splitter",
      speed: 0.9,
      health: 120,
      width: 64,
      height: 64,
      color: 'purple',
      image: image,
      bounty: 15,
      isAttacker: true,
      attackDamage: 12,
      attackRate: 60,
      attackRange: 15
    });
    this.splitCount = 3;
    this.hasSplit = false;
  }

  takeDamage(amount, ignoreArmor = false) {
    const died = super.takeDamage(amount, ignoreArmor);
    if (died && !this.hasSplit) {
      this.splitIntoMinis();
      this.hasSplit = true;
    }
    return died;
  }

  splitIntoMinis() {
    if (!this.gameEngine) {
      console.warn("SplitterEnemy: No gameEngine reference!");
      return;
    }

    for (let i = 0; i < this.splitCount; i++) {
      console.log("Split into 3");
      const offsetX = (Math.random() - 0.5) * 80;
      const offsetY = (Math.random() - 0.5) * 40;

      const mini = new MiniEnemy(
          this.x + offsetX,
          this.y + offsetY,
          null // no images
      );
      mini.isSpawned = true;
      mini.spawnBy = this.id;

      // Attach animations to mini
      if (this.gameEngine.animationManager) {
        this.gameEngine.attachAnimationsToEnemy(mini, "Mini");
      }

      // Set game engine reference
      if (mini.setGameEngine) {
        mini.setGameEngine(this.gameEngine);
      }
      this.gameEngine.enemies.push(mini);
    }
    // One event for the whole split, not one per mini: all three appear in the
    // same instant, so three events would be three copies of one sound.
    this.gameEngine?.emitFeedback?.('enemy:summon', { unitType: this.constructor.name });
  }
}

//分裂者
export class MiniEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Mini",
      speed: 1.6,
      health: 40,
      width: 32,
      height: 32,
      color: 'mediumpurple',
      image: image,
      bounty: 5,
      isAttacker: true,
      attackDamage: 5,
      attackRate: 40,
      attackRange: 40
    });
  }
}

//每隔一段时间生成敌人 他的存在会让周围的敌人造成额外伤害和加速
export class SwarmLeader extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Swarm Witch",
      speed: 0.2,
      health: 180,
      width: 90,
      height: 64,
      color: 'darkred',
      image: image,
      bounty: 40,
      isAttacker: true,
      attackDamage: 20,
      attackRate: 70,
      attackRange: 140
    });
    this.spawnCooldown = 300; //5 sec
    this.currentSpawnCooldown = 150;
    this.buffRange = 100;
    this.speedBuff = 1.2;
    this.damageBuff = 1.3;
    this.isMoving = true;

    this.splitCount = 5;
    this.hasSplit = false;
    this.spawnItselfChance = 0.3;
    this.spawnTankChance = 0.5;

    this.buffedEnemies = new Set();
  }

  splitIntoSplitter() {
    if (!this.gameEngine) {
      console.warn("Swarm Witch: No gameEngine reference!");
      return;
    }
    console.log(`Split into ${this.splitCount}`);
    for (let i = 0; i < this.splitCount; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;

      const splitEnemy = new SplitterEnemy(
          this.x + offsetX,
          this.y + offsetY,
          null // no images
      );
      splitEnemy.isSpawned = true;
      splitEnemy.spawnBy = this.id;

      // Attach animations
      if (this.gameEngine.animationManager) {
        this.gameEngine.attachAnimationsToEnemy(splitEnemy, "Splitter");
      }

      // Set game engine reference
      if (splitEnemy.setGameEngine) {
        splitEnemy.setGameEngine(this.gameEngine);
      }

      this.gameEngine.enemies.push(splitEnemy);
    }
    // One event for the whole split, as for SplitterEnemy: five splitters
    // appearing at once are one moment, not five.
    this.gameEngine?.emitFeedback?.('enemy:summon', { unitType: this.constructor.name });
  }

  updateBehavior(defenderUnits) {
    if (!this.gameEngine) return;

    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && !this.frozen && !this.stunned &&
        this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
      this.isAttacking = true;
    } else {
      this.isMoving = true;
      this.isAttacking = false;
    }

    // Only spawn if not frozen/stunned
    if (!this.frozen && !this.stunned) {
      this.currentSpawnCooldown--;
      if (this.currentSpawnCooldown <= 0) {
        this.spawnEnemy();
        this.currentSpawnCooldown = this.spawnCooldown;
      }
      this.buffNearbyEnemies();
    }
  }

  handleMovement() {
    if (this.isMoving && !this.frozen && !this.stunned) {
      this.x += this.speed;
    }
  }

  spawnEnemy() {
    if (!this.gameEngine || this.frozen || this.stunned) return;

    let spawnEnemy = null;
    let enemyType = null;
    if (Math.random() < this.spawnTankChance && Math.random() > this.spawnItselfChance) {
      spawnEnemy = new TankEnemy(this.x - 30, this.y + (Math.random() - 0.5) * 40, null);
      enemyType = "Tank Zombie";
    } else if (Math.random() < this.spawnItselfChance) {
      spawnEnemy = new SwarmLeader(this.x - 30, this.y + (Math.random() - 0.5) * 40, null);
      enemyType = "Swarm Witch";
    } else {
      spawnEnemy = new BasicEnemy(this.x - 30, this.y + (Math.random() - 0.5) * 40, null);
      enemyType = "Basic Zombie";
    }
    spawnEnemy.isSpawned = true;
    spawnEnemy.spawnBy = this.id;

    // Attach animations to spawned enemy
    if (this.gameEngine.animationManager && enemyType) {
      this.gameEngine.attachAnimationsToEnemy(spawnEnemy, enemyType);
    }

    // Set game engine reference
    if (spawnEnemy.setGameEngine) {
      spawnEnemy.setGameEngine(this.gameEngine);
    }
    this.gameEngine.enemies.push(spawnEnemy);
    this.gameEngine?.emitFeedback?.('enemy:summon', { unitType: this.constructor.name });
  }

  buffNearbyEnemies() {
    if (!this.gameEngine || this.frozen || this.stunned) return;

    // First, remove buff from enemies that are too far away
    for (const enemyId of this.buffedEnemies) {
      const enemy = this.gameEngine.enemies.find(e => e.id === enemyId);
      if (enemy) {
        const distance = Math.hypot(
            this.x + this.width / 2 - (enemy.x + enemy.width / 2),
            this.y + this.height / 2 - (enemy.y + enemy.height / 2)
        );

        // Remove buff if out of range or dead
        if (distance > this.buffRange || !enemy.isAlive) {
          enemy.buffed = false;
          enemy.buffedBy = null;
          enemy.buffApplied = false;
          enemy.attackDamage = enemy.baseAttackDamage;
          enemy.speed = enemy.initialSpeed;
          this.buffedEnemies.delete(enemyId);
        }
      }
    }

    // Apply buff to nearby enemies
    for (const enemy of this.gameEngine.enemies) {
      if (enemy.id === this.id || !enemy.isAlive) continue;

      const distance = Math.hypot(
          this.x + this.width / 2 - (enemy.x + enemy.width / 2),
          this.y + this.height / 2 - (enemy.y + enemy.height / 2)
      );

      if (distance <= this.buffRange) {
        // Only apply buff if not already buffed by this SwarmLeader
        if (!this.buffedEnemies.has(enemy.id)) {
          // Store base values if this is the first buff
          if (!enemy.buffed) {
            enemy.baseAttackDamage = enemy.attackDamage;
            enemy.initialSpeed = enemy.speed;
          }
          enemy.buffed = true;
          enemy.buffedBy = this.id;
          this.buffedEnemies.add(enemy.id);

          // The actual buff multiplication will happen in updateMovementSpeed
          console.log(`Buffing ${enemy.name}: base damage ${enemy.baseAttackDamage} -> buffed damage will be ${enemy.baseAttackDamage * 1.3}`);
        }
      }
    }
  }

  // Override takeDamage to clean up buffs when SwarmLeader dies
  takeDamage(amount, ignoreArmor = false) {
    const died = super.takeDamage(amount, ignoreArmor);

    if (died && this.gameEngine && !this.hasSplit) {
      this.splitIntoSplitter();
      this.hasSplit = true;
      // Remove all buffs when SwarmLeader dies
      for (const enemyId of this.buffedEnemies) {
        const enemy = this.gameEngine.enemies.find(e => e.id === enemyId);
        if (enemy) {
          enemy.buffed = false;
          enemy.buffedBy = null;
          enemy.buffApplied = false;
          enemy.attackDamage = enemy.baseAttackDamage;
          enemy.speed = enemy.initialSpeed;
        }
      }
      this.buffedEnemies.clear();
    }

    return died;
  }

  draw(ctx) {
    super.draw(ctx);

    // Draw buff aura
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2,
            this.y + this.height / 2,
            this.buffRange,
            0,
            Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export class EMPEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "EMP",
      speed: 1.0,
      health: 180,
      width: 90,
      height: 64,
      color: 'cyan',
      image: image,
      bounty: 20,
      isAttacker: true,
      attackDamage: 5,
      attackRate: 60,
      attackRange: 50
    });
    this.empRadius = 120;
    this.disabledDuration = 180; //3 sec
    this.hasExploded = false;
  }

  takeDamage(amount, ignoreArmor = false) {
    const died = super.takeDamage(amount, ignoreArmor);
    if (died && !this.hasExploded) {
      this.triggerEMP();
      this.hasExploded = true;
    }
    return died;
  }

  triggerEMP() {
    if (!this.gameEngine) return;

    this.gameEngine.explosions.push({
                                      x: this.x + this.width / 2,
                                      y: this.y + this.height / 2,
                                      damage: 0,
                                      radius: this.empRadius,
                                      timer: 30,
                                      color: "cyan",
                                      innerColor: "white",
                                      particleColor: "rgba(0, 255, 255, 0.9)",
                                      style: "electric",
                                      type: "enemy",
                                      source: "emp",
                                      explodeBy: "EMP"
                                    });

    //disable nearby defender
    for (const defender of this.gameEngine.defenders) {
      if (!defender.isAlive) continue;

      const distance = Math.hypot(
          this.x + this.width / 2 - (defender.x + defender.width / 2),
          this.y + this.height / 2 - (defender.y + defender.height / 2)
      );
      if (distance <= this.empRadius) {
        defender.disabled = true;
        defender.disabledDuration = this.disabledDuration;
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Electricity effect
    if (Math.random() < 0.3) {
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + this.height / 2);
      ctx.lineTo(
          this.x + this.width + Math.random() * 10,
          this.y + Math.random() * this.height
      );
      ctx.stroke();
    }
  }
}

// attack will contain life steal
export class VampireEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Vampire",
      speed: 1.2,
      health: 90,
      width: 64,
      height: 64,
      color: 'darkred',
      image: image,
      bounty: 30,
      isAttacker: true,
      attackDamage: 15,
      attackRate: 50,
      attackRange: 120
    });
    this.lifeStealPercent = 1.0; //100% heal from attack damage
    this.isMoving = true;
  }

  updateBehavior(defenderUnits) {
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && !this.frozen && !this.stunned &&
        this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
      this.isAttacking = true;
    } else {
      this.isMoving = true;
      this.isAttacking = false;
    }
  }

  handleMovement() {
    if (this.isMoving && !this.frozen && !this.stunned) {
      this.x += this.speed;
    }
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive || this.frozen || this.stunned) return;

    const damageDealt = Math.min(target.health, this.attackDamage);
    target.takeDamage(this.attackDamage);
    // Vampire applies its own damage instead of calling super.attack(), so it
    // needs its own emit. It is melee-only, so this call site is never reached
    // from a projectile's onHit.
    this.gameEngine?.emitFeedback?.('enemy:melee', { unitType: this.constructor.name });

    //heal base on attack
    const healAmount = Math.floor(damageDealt * this.lifeStealPercent);
    this.health = Math.min(this.maxHealth, this.health + healAmount);

    this.lastAttackTime = currentTime;
  }

  draw(ctx) {
    super.draw(ctx);
    // Red glow effect when at high health
    if (this.health > this.maxHealth * 0.8) {
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 5,
          0,
          Math.PI * 2
      );
      ctx.strokeStyle = "rgba(139, 0, 0, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

export class GhostEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Ghost",
      speed: 1.0,
      health: 80,
      width: 100,
      height: 64,
      color: 'rgba(200, 200, 255, 0.6)',
      image: image,
      bounty: 25,
      isAttacker: false,
      attackDamage: 0,
      attackRate: 0,
      attackRange: 0
    });
    this.phaseShiftCooldown = 180; // 3 seconds
    this.currentPhaseShiftCooldown = 0;
    this.isPhased = false;
    this.phaseDuration = 150; // 2.5 second
    this.currentPhaseDuration = 0;
  }

  updateBehavior(defenderUnits) {
    super.updateBehavior(defenderUnits);

    if (!this.isAlive) return;

    //phase shift logic
    this.currentPhaseShiftCooldown--;
    if (this.currentPhaseShiftCooldown <= 0 && !this.isPhased) {
      //check if there is a defender to phase through
      const nearByDefender = defenderUnits.find(defender => {
        if (!defender.isAlive) return;
        const distance = Math.hypot(
            this.x + this.width / 2 - (defender.x + defender.width / 2),
            this.y + this.height / 2 - (defender.y + defender.height / 2)
        );
        return distance <= 200;
      });
      if (nearByDefender && !this.stunned && !this.frozen) {
        this.isPhased = true;
        this.currentPhaseDuration = this.phaseDuration;
        this.currentPhaseShiftCooldown = this.phaseShiftCooldown;
      }
    }
    //handle phase duration
    if (this.isPhased) {
      this.currentPhaseDuration--;
      if (this.currentPhaseDuration <= 0) {
        this.isPhased = false;
      }
    }
  }

  takeDamage(amount, ignoreArmor = false) {
    //70% to dodge attack
    if (this.isPhased && Math.random() < 0.7) {
      return false;
    }
    return super.takeDamage(amount, ignoreArmor);
  }

  draw(ctx) {
    super.draw(ctx);
    if (!this.isAlive) return;

    ctx.save();

    // Transparency effect when phased
    if (this.isPhased) {
      ctx.globalAlpha = 0.3;
    }

    ctx.restore();

    // Phase shift aura
    if (this.isPhased) {
      ctx.save();
      ctx.strokeStyle = "rgba(200, 200, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 10,
          0,
          Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }
}

export class BerserkerEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Berserker",
      speed: 0.6,
      health: 200,
      width: 100,
      height: 64,
      color: 'darkred',
      image: image,
      bounty: 35,
      isAttacker: true,
      attackDamage: 25,
      attackRate: 40,
      attackRange: 100
    });
    this.killCount = 0;
    this.damageBonus = 0;
    this.speedBonus = 0;
    this.healthBonus = 0;
    this.maxKillCount = 10;
    this.isMoving = true;
  }

  updateBehavior(defenderUnits) {
    if (!this.isAlive) return;

    if (this.health <= 0) {
      this.isAlive = false;
      this.health = 0;
      return;
    }
    //find closest defender within range
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && !this.frozen && !this.stunned &&
        this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
    } else {
      this.isMoving = true;
    }
    if (this.isMoving) {
      this.x += this.speed;
    }
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive || this.frozen || this.stunned) return;

    const totalDamage = this.attackDamage + this.damageBonus;
    const died = target.takeDamage(totalDamage);
    // Berserker also applies its own damage rather than calling super.attack().
    this.gameEngine?.emitFeedback?.('enemy:melee', { unitType: this.constructor.name });
    console.log(`Berserker does ${totalDamage}damage`);
    console.log(`Berserker move ${this.speed} speed`);
    console.log(`${this.killCount} killCount`)

    if (died && this.killCount < this.maxKillCount) {
      this.killCount++;
      this.damageBonus += 20;
      this.speedBonus += 0.3;
      this.healthBonus += 100;
      this.speed = this.initialSpeed + this.speedBonus;
      this.maxHealth += this.healthBonus;
      this.health = this.health + this.healthBonus;

      //visual feedback for a kill
      if (this.gameEngine) {
        this.gameEngine.explosions.push({
                                          x: this.x + this.width / 2,
                                          y: this.y + this.height / 2,
                                          damage: 0,
                                          radius: 40,
                                          timer: 50,
                                          color: "darkred",
                                          innerColor: "red",
                                          particleColor: "rgba(139, 0, 0, 0.8)",
                                          style: "rage",
                                          type: "effect",
                                          source: "berserker"})
      }
    }
    this.lastAttackTime = currentTime;
  }

  draw(ctx) {
    super.draw(ctx);
    //draw rage stack
    if (this.killCount > 0) {
      ctx.save();
      ctx.fillStyle = "red";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`x${this.killCount}`, this.x + this.width / 2, this.y - 20);

      // Rage aura
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + this.killCount * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 5 + this.killCount * 2,
          0,
          Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }
}

export class NecromancerEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Necromancer",
      speed: 0.2,
      health: 100,
      width: 90,
      height: 64,
      color: 'darkviolet',
      image: image,
      bounty: 35,
      isAttacker: true,
      attackDamage: 10,
      attackRate: 100,
      attackRange: 250
    });
    this.reviveCooldown = 360; //6 sec
    this.currentReviveCooldown = 120; //2 sec
    this.reviveCount = 0;
    this.isMoving = true;
  }

  updateBehavior(defenderUnits) {
    if (!this.gameEngine) return;

    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && !this.frozen && !this.stunned
        && this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
      this.isAttacking = true;
    } else {
      this.isMoving = true;
      this.isAttacking = false;
    }

    // Only revive if not frozen/stunned
    if (!this.frozen && !this.stunned) {
      this.currentReviveCooldown--;
      if (this.currentReviveCooldown <= 0) {
        this.reviveSkeletons();
        this.currentReviveCooldown = this.reviveCooldown;
      }
    }
  }

  handleMovement() {
    if (this.isMoving && !this.frozen && !this.stunned) {
      this.x += this.speed;
    }
  }

  reviveSkeletons() {
    if (!this.gameEngine || this.frozen || this.stunned) return;

    const reviveX = this.x + 50 - Math.random() * 100;
    const reviveY = this.y + (Math.random() - 0.5) * 100;

    const skeleton = new RangeEnemy(reviveX, reviveY, null);
    skeleton.name = "Skeleton";
    skeleton.health = 50;
    skeleton.attackDamage /= 2;
    skeleton.attackRange = 100;
    skeleton.maxHealth = 50;
    skeleton.color = "lightgray";
    skeleton.isSpawned = true;
    skeleton.spawnBy = this.id;

    if (this.gameEngine.animationManager) {
      this.gameEngine.attachAnimationsToEnemy(skeleton, "Skeleton Shooter");
    }

    // Set game engine reference
    if (skeleton.setGameEngine) {
      skeleton.setGameEngine(this.gameEngine);
    }

    this.gameEngine.enemies.push(skeleton);
    this.gameEngine?.emitFeedback?.('enemy:summon', { unitType: this.constructor.name });
    this.reviveCount++;

    this.gameEngine.explosions.push({
                                      x: reviveX + skeleton.width / 2,
                                      y: reviveY + skeleton.height / 2,
                                      damage: 0,
                                      radius: 50,
                                      timer: 30,
                                      color: "darkviolet",
                                      innerColor: "purple",
                                      particleColor: "rgba(148, 0, 211, 0.8)",
                                      style: "necromancy",
                                      type: "effect",
                                      source: "necromancer"
                                    });
  }

  draw(ctx) {
    super.draw(ctx);

    // Necromantic aura
    if (this.currentReviveCooldown < 60) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "darkviolet";
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.attackRange,
          0,
          Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Show revive count
    ctx.fillStyle = "purple";
    ctx.font = "10px Arial";
    ctx.fillText(`Revives: ${this.reviveCount}`, this.x, this.y - 20);
  }

}

export class AssassinEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Assassin",
      speed: 1.3,
      health: 70,
      width: 50,
      height: 32,
      color: 'black',
      image: image,
      bounty: 15,
      isAttacker: true,
      attackDamage: 60,
      attackRate: 60,
      attackRange: 30
    });
    this.isStealthed = true;
    this.stealthDuration = 360; //6sec
    this.currentStealthDuration = this.stealthDuration;
    this.hasStruck = false;
    this.dashSpeed = 3;
  }

  updateBehavior(defenderUnits) {
    if (!this.isAlive) return;

    if (this.health <= 0) {
      this.isAlive = false;
      this.speed = 0;
      return;
    }

    //stealth countdown
    if (this.isStealthed) {
      this.currentStealthDuration--;
      if (this.currentStealthDuration <= 0 ) {
        this.isStealthed = false;
      }
    }

    //find target for assassination
    if (!this.hasStruck && this.isAttacker) {
      const targetDefender = defenderUnits.find(defender => {
        return(
            defender.isAlive &&
            !isConsumableSpell(defender) &&
            this.x + this.width >= defender.x &&
            this.x <= defender.x + defender.width &&
            this.y + this.height >= defender.y &&
            this.y <= defender.y + defender.height
        );
      });

      if (targetDefender && !this.frozen && !this.stunned) {
        this.isAttacking = true;
        this.isStealthed = false;
        this.hasStruck = true;

        //critical strike damage
        const critDamage = this.attackDamage * 5;
        targetDefender.takeDamage(critDamage);
        // The assassination strikes from inside updateBehavior, bypassing both
        // attack() and the base countdown; hasStruck keeps it to one event.
        this.gameEngine?.emitFeedback?.('enemy:melee', { unitType: this.constructor.name });

        //strike effect
        if (this.gameEngine) {
          this.gameEngine.explosions.push({
                                            x: targetDefender.x + targetDefender.width / 2,
                                            y: targetDefender.y + targetDefender.height / 2,
                                            damage: 0,
                                            radius: 50,
                                            timer: 20,
                                            color: "darkred",
                                            innerColor: "black",
                                            particleColor: "rgba(139, 0, 0, 0.9)",
                                            style: "slash",
                                            type: "effect",
                                            source: "assassin"});
        }
      }
    } else {
      super.updateBehavior(defenderUnits);
    }
  }

  handleMovement() {
    if (!this.isAttacking && !this.frozen && !this.stunned) {
      this.x += this.isStealthed ? this.dashSpeed : this.speed;
    }
  }

  takeDamage(amount, ignoreArmor = false) {
    if (this.isStealthed) {
      return false; //100% dodge
    }
    //break stealth on damage
    if (this.isStealthed) {
      this.isStealthed = false;
    }
    super.takeDamage(amount, ignoreArmor);
  }

  draw(ctx) {
    super.draw(ctx);
    if (!this.isAlive) return;

    ctx.save();

    // Stealth effect
    if (this.isStealthed) {
      ctx.globalAlpha = 0.4;

      // Shadow trail
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.1 * (4 - i) / 4;
        if (this.image && this.image.complete) {
          ctx.drawImage(this.image, this.x - i * 10, this.y, this.width, this.height);
        } else {
          ctx.fillStyle = this.color;
          ctx.fillRect(this.x - i * 10, this.y, this.width, this.height);
        }
      }
      ctx.globalAlpha = 0.4;
    }
    ctx.restore();
  }
}

export class MageEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Mage",
      speed: 0.5,
      health: 90,
      width: 90,
      height: 64,
      color: 'blue',
      image: image,
      bounty: 15,
      isAttacker: true,
      attackDamage: 80,
      attackRate: 120,
      attackRange: 400,
      isRanged: true  // Keep this so CombatManager knows it's ranged
    });
    this.spellType = "fireball";
    this.currentSpellIndex = 0;
    this.spells = ["fireball", "icebolt", "lightning"];
    this.isMoving = true;
    this.isCasting = false;
    this.castingTimer = 0;
    this.currentTarget = null;

    // FIX: Track our own attack cooldown
    this.attackCooldown = 0;
  }

  updateBehavior(defenderUnits) {
    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
    }

    // Cancel casting if frozen/stunned
    if ((this.frozen || this.stunned) && this.isCasting) {
      this.isCasting = false;
      this.castingTimer = 0;
      this.isAttacking = false;
      return;
    }

    // Handle casting
    if (this.isCasting && !this.frozen && !this.stunned) {
      this.castingTimer--;
      if (this.castingTimer <= 0) {
        this.performSpellAttack();
        this.isCasting = false;
        this.isAttacking = false;
      }
      return;
    }

    // Don't find targets if frozen/stunned
    if (this.frozen || this.stunned) {
      this.isMoving = false;
      this.isAttacking = false;
      return;
    }

    // Find target
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
      this.currentTarget = targetDefender;

      if (this.attackCooldown <= 0 && !this.isCasting) {
        this.startCasting(targetDefender);
      }

      if (this.attackCooldown <= 30) {
        this.isAttacking = true;
      }
    } else {
      this.isMoving = true;
      this.currentTarget = null;
      this.isAttacking = false;
    }
  }

  handleMovement() {
    if (this.isMoving && !this.frozen && !this.stunned && !this.isCasting) {
      this.x += this.speed;
    }
  }

  // NEW: Separate method to start casting
  startCasting(target) {
    if (!this.isAlive || !target || !target.isAlive || this.frozen || this.stunned) return;

    this.isCasting = true;
    this.isAttacking = true;
    this.castingTimer = 30; // 0.5 second cast time
    this.currentTarget = target;
    this.attackCooldown = this.attackRate; // Reset cooldown

    // Cycle through spells
    this.spellType = this.spells[this.currentSpellIndex];
    this.currentSpellIndex = (this.currentSpellIndex + 1) % this.spells.length;

    console.log(`Mage starting to cast ${this.spellType} at ${target.name}`);
  }

  // Override canAttack to prevent CombatManager from handling our attacks
  canAttack(_currentTime) {
    // Return false so CombatManager doesn't try to create projectiles for us
    return false;
  }

  // Keep the original attack method in case something else calls it
  attack(target, _currentTime) {
    // Redirect to our casting system
    if (this.attackCooldown <= 0 && !this.isCasting) {
      this.startCasting(target);
    }
  }

  performSpellAttack() {
    if (!this.currentTarget || !this.currentTarget.isAlive || !this.gameEngine) return;

    console.log(`Mage casting ${this.spellType}!`);

    switch (this.spellType) {
      case "fireball":
        this.castFireball();
        break;
      case "icebolt":
        this.castIcebolt();
        break;
      case "lightning":
        this.castLightning();
        break;
    }
  }

  // Rest of the spell methods remain the same...
  castFireball() {
    if (!this.gameEngine || !this.currentTarget) return;

    const fireBall = {
      startX: this.x + this.width / 2,  // FIX: Start from mage position, not -50
      startY: this.y + this.height / 2,
      currentX: this.x + this.width / 2,
      currentY: this.y + this.height / 2,
      targetX: this.currentTarget.x + this.currentTarget.width / 2,
      targetY: this.currentTarget.y + this.currentTarget.height / 2,
      speed: 12,
      damage: this.attackDamage,
      type: "fireball",
      caster: this,
      target: this.currentTarget,
      trail: []
    };

    if (!this.gameEngine.spellProjectiles) {
      this.gameEngine.spellProjectiles = [];
    }
    this.gameEngine.spellProjectiles.push(fireBall);
    this.gameEngine?.emitFeedback?.('enemy:spell', { unitType: this.constructor.name });
  }

  castIcebolt() {
    if (!this.gameEngine || !this.currentTarget) return;

    const icebolt = {
      startX: this.x + this.width / 2,  // FIX: Start from mage position
      startY: this.y + this.height / 2,
      currentX: this.x + this.width / 2,
      currentY: this.y + this.height / 2,
      targetX: this.currentTarget.x + this.currentTarget.width / 2,
      targetY: this.currentTarget.y + this.currentTarget.height / 2,
      speed: 12,
      damage: this.attackDamage,
      type: "icebolt",
      caster: this,
      target: this.currentTarget,
      trail: []
    };

    if (!this.gameEngine.spellProjectiles) {
      this.gameEngine.spellProjectiles = [];
    }
    this.gameEngine.spellProjectiles.push(icebolt);
    this.gameEngine?.emitFeedback?.('enemy:spell', { unitType: this.constructor.name });
  }

  castLightning() {
    if (!this.gameEngine || !this.currentTarget) return;

    const targetX = this.currentTarget.x + this.currentTarget.width / 2;
    const targetY = this.currentTarget.y + this.currentTarget.height / 2;

    //lightning strike effect
    this.gameEngine.explosions.push({
                                      x: targetX,
                                      y: targetY,
                                      damage: 0,
                                      radius: 60,
                                      timer: 30,
                                      color: "purple",
                                      innerColor: "white",
                                      particleColor: "rgba(138, 43, 226, 0.9)",
                                      style: "lightning_strike",
                                      type: "effect",
                                      source: "mage"
                                    });

    this.currentTarget.takeDamage(this.attackDamage);
    // The third spell has no projectile to hang a sound on, so without this it
    // is the one cast the player cannot hear. Emitted once for the strike, not
    // once per chained defender - the chain is one spell, not several.
    this.gameEngine?.emitFeedback?.('enemy:spell', { unitType: this.constructor.name });

    //chaining
    for (const defender of this.gameEngine.defenders) {
      if (defender.id !== this.currentTarget.id && defender.isAlive) {
        const distance = Math.hypot(
            defender.x - this.currentTarget.x,
            defender.y - this.currentTarget.y
        );
        if (distance <= 150) {
          //create chaining visual effect
          setTimeout(() => {
            if (this.gameEngine) {
              this.gameEngine.explosions.push({
                                                x: defender.x + defender.width / 2,
                                                y: defender.y + defender.height / 2,
                                                damage: 0,
                                                radius: 40,
                                                timer: 20,
                                                color: "purple",
                                                innerColor: "white",
                                                particleColor: "rgba(138, 43, 226, 0.7)",
                                                style: "lightning_strike",
                                                type: "effect",
                                                source: "mage"

                                              });
            }
          }, 100);
          defender.takeDamage(this.attackDamage * 2);
        }
      }
    }

  }

  getSpellColor() {
    switch (this.spellType) {
      case "fireball": return "orange";
      case "icebolt": return "lightblue";
      case "lightning": return "purple";
      default: return "purple";
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Spell indicator
    ctx.save();
    ctx.fillStyle = this.getSpellColor();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(
        this.x + this.width / 2,
        this.y - 5,
        5,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Casting animation
    if (this.isCasting) {
      ctx.save();

      // Magical circle under mage
      const castProgress = 1 - (this.castingTimer / 30);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = this.getSpellColor();
      ctx.lineWidth = 2;

      // Inner circle
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width + 10 * castProgress,
          0,
          Math.PI * 2 * castProgress
      );
      ctx.stroke();

      // Outer circle
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width + 20 * castProgress,
          0,
          Math.PI * 2 * castProgress
      );
      ctx.stroke();

      // Runes or symbols
      const runeCount = 6;
      for (let i = 0; i < runeCount; i++) {
        const angle = (Math.PI * 2 * i) / runeCount - Math.PI / 2;
        const runeX = this.x + this.width / 2 + Math.cos(angle) * (this.width + 15 * castProgress);
        const runeY = this.y + this.height / 2 + Math.sin(angle) * (this.width + 15 * castProgress);

        ctx.fillStyle = this.getSpellColor();
        ctx.globalAlpha = castProgress;
        ctx.beginPath();
        ctx.arc(runeX, runeY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Aura when not moving
    if (!this.isMoving && !this.isCasting) {
      ctx.save();
      ctx.strokeStyle = this.getSpellColor();
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 10,
          0,
          Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }

}

/**
 * Little Boss
 */
export class TitanEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Titan",
      speed: 0.1,
      health: 5000,
      width: 180,
      height: 128,
      color: 'darkslategray',
      image: image,
      bounty: 100,
      isAttacker: true,
      attackDamage: 50,
      attackRate: 120,
      attackRange: 50
    });
    this.groundPoundCooldown = 300;
    this.currentGroundPoundCooldown = 150;
    this.isGroundPounding = false;
    this.earthquakeRadius = 350;
    this.immune = true;

    //phase at health thresholds
    this.phase = 1;
    this.hasArmor = true;
    this.armorDamageReduction = 0.2; //80% reduction

    this.baseSpeed = 0.1;
  }

  takeDamage(amount, ignoreArmor = false) {
    if (!this.gameEngine) return;
    //either take 20% or 50% damage
    const actualDamage = (this.hasArmor && !ignoreArmor) ?
                         amount * this.armorDamageReduction :
                         amount * 0.5;
    const died = super.takeDamage(actualDamage, ignoreArmor);

    //phase transition
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent <= 0.66 && this.phase === 1) {
      this.phase = 2;
      this.speed = this.baseSpeed * 1.3; //0.13
      this.attackDamage = 150;
      this.attackRate *= 0.8;
      console.log(`Titan enters Phase 2! Speed: ${this.speed}`);
      this.createPhaseTransition();
    } else if (healthPercent <= 0.33 && this.phase === 2) {
      this.phase = 3;
      this.speed = this.baseSpeed * 2; // 0.2
      this.attackDamage = 300;
      this.attackRate *= 0.8;
      this.hasArmor = false; //lose armor reduction
      console.log(`Titan enters Phase 3! Speed: ${this.speed}`);
      this.createPhaseTransition();
    }
    return died;
  }

  createPhaseTransition() {
    if (!this.gameEngine) return;
    console.log("Phase transition triggered!");

    //shockwave effect
    this.gameEngine.explosions.push({
                                      x: this.x + this.width / 2,
                                      y: this.y + this.height / 2,
                                      damage: 0,
                                      radius: 1500,
                                      timer: 40,
                                      color: "darkslategray",
                                      innerColor: "gray",
                                      particleColor: "rgba(105, 105, 105, 0.8)",
                                      style: "shockwave",
                                      type: "effect",
                                      source: "titan"
                                    });
    //stun nearby defender
    for (const defender of this.gameEngine.defenders) {
      const distance = Math.hypot(
          this.x + this.width / 2 - (defender.x + defender.width / 2),
          this.y + this.height / 2 - (defender.y + defender.height / 2)
      );
      if (distance <= 1500) {
        defender.disabled = true;
        defender.disabledDuration = 300; //5sec
        defender.takeDamage(40);
      }

    }
  }

  updateBehavior(defenderUnits) {
    super.updateBehavior(defenderUnits);
    console.log(`Titan move at ${this.speed} speed`);

    if (!this.isAlive || !this.gameEngine) return;

    this.currentGroundPoundCooldown--;
    if (this.currentGroundPoundCooldown <= 0 && !this.isGroundPounding) {
      const nearbyDefender = defenderUnits.find(defender => {
        if (!defender.isAlive) return;
        const distance = Math.hypot(
            this.x + this.width / 2 - (defender.x + defender.width / 2),
            this.y + this.height / 2 - (defender.y + defender.height / 2)
        );
        return distance <= this.earthquakeRadius;
      });
      if (nearbyDefender && !this.frozen) {
        this.performGroundPound();
      }
    }
  }

  performGroundPound() {
    if (!this.gameEngine) return;

    this.isGroundPounding = true;
    const originalSpeed = this.speed;
    this.speed = 0;

    //charge up animation
    setTimeout(() => {
      if (!this.isAlive || !this.gameEngine) return;
      //earthequake effect
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!this.gameEngine) return;
          const radius = this.earthquakeRadius * (i + 1) / 3;
          this.gameEngine.explosions.push({
                                            x: this.x + this.width / 2,
                                            y: this.y + this.height / 2,
                                            damage: 0,
                                            radius: radius,
                                            timer: 20,
                                            color: "brown",
                                            innerColor: "darkgoldenrod",
                                            particleColor: "rgba(139, 69, 19, 0.8)",
                                            style: "earthquake",
                                            type: "effect",
                                            source: "titan",
                                            wave: i //track which earthquake wave it is
                                          });

          //damage all defender in radius
          for (const defender of this.gameEngine.defenders) {
            if (!defender.isAlive) return;

            const distance = Math.hypot(
                this.x + this.width / 2 - (defender.x + defender.width / 2),
                this.y + this.height / 2 - (defender.y + defender.height / 2)
            );
            if (distance <= radius) {
              defender.takeDamage(45);
            }
          }
        }, i * 200);
      }
      //resume moving
      setTimeout(() => {
        this.isGroundPounding = false;
        this.speed = originalSpeed;
        this.currentGroundPoundCooldown = this.groundPoundCooldown;
        console.log(`Titan move at ${this.speed}`);
      }, 800);
    }, 500);
  }

  draw(ctx) {
    super.draw(ctx);

    // Phase indicator
    ctx.save();
    ctx.strokeStyle = this.phase === 3 ? "red" : this.phase === 2 ? "orange" : "gray";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);

    // Ground pound charge indicator
    if (this.isGroundPounding) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "brown";
      const chargeRadius = this.earthquakeRadius * Math.sin(Date.now() / 100);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          Math.abs(chargeRadius),
          0,
          Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();

    // Armor indicator
    if (this.hasArmor) {
      ctx.fillStyle = "silver";
      ctx.fillRect(this.x + this.width - 10, this.y, 8, 8);
    }
    // Phase indicator text
    ctx.fillStyle = this.phase === 3 ? "red" : this.phase === 2 ? "orange" : "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`P${this.phase}`, this.x + this.width / 2, this.y - 15);
  }
}

export class BossEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Marina",
      speed: 0, //TODO: Think of 僵王博士
      health: 80000,
      width: 100,
      height: 100,
      color: "",
      image: image,
      bounty: 1000,
      isAttacker: true, //not sure yet
      attackDamage: 1000, //not sure yet
      attackRate: 100, //not sure yet
      attackRange: 1000, //not sure yet
    });
    this.summon = null;
    this.destroy = null;
  }
}
