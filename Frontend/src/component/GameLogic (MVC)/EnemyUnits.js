// src/component/GameLogic (MVC)/EnemyUnits.js
// Data for different types of Enemy types

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
    this.attackDamage = typeData.attackDamage || 0;
    this.attackRate = typeData.attackRate || 60; // frames per attack
    this.attackCountdown = this.attackRate;
    this.isAttacking = false; // if entity is engage in attack

    this.isRanged = false;
    this.lastAttackTime = 0;
    this.attackRange = typeData.attackRange || 50;
  }

  canAttack(currentTime) {
    if (!this.isAttacker) return;
    return currentTime - this.lastAttackTime >= (this.attackRate * 1000) / 60;
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    if (!this.isRanged) {
      target.takeDamage(this.attackDamage);
    }
    //range attacks are handle by gameEnging in the draw Projectile method
    this.lastAttackTime = currentTime;
  }

  /**
   * Movement and Attack Logic
   * @param {Array<DefenderUnit>} defenderUnits - Array of active defender units
   */
  update(defenderUnits) {
    if (!this.isAlive) return;

    if (this.health <= 0) {
      this.isAlive = false;
      this.speed = 0;
      return;
    }
    let targetDefender = null;

    if (this.isAttacker) {
      // Find the first defender in its path/collision range
      targetDefender = defenderUnits.find((defender) => {
        return (
          // <--- CRITICAL FIX: Added return statement
          defender.isAlive &&
          this.x + this.width >= defender.x && // Enemy's right edge past defender's left edge
          this.x <= defender.x + defender.width && // Enemy's left edge before defender's right edge
          this.y + this.height >= defender.y && // Enemy's bottom edge past defender's top edge
          this.y <= defender.y + defender.height // Enemy's top edge before defender's bottom edge
        );
      });

      if (targetDefender) {
        this.speed = 0; // Stop moving when attacking
        this.isAttacking = true;

        this.attackCountdown--;

        if (this.attackCountdown <= 0) {
          targetDefender.takeDamage(this.attackDamage);
          this.attackCountdown = this.attackRate; // Reset attack cooldown
        }
      } else {
        this.speed = this.initialSpeed; // Resume movement if no target
        this.isAttacking = false;
        this.attackCountdown = this.attackRate; // Reset cooldown when not attacking
      }
    }

    // Move only if not attacking or if not an attacker type
    if (!this.isAttacking) {
      this.x += this.speed;
    }
  }

  draw(ctx) {
    if (!this.isAlive) return;

    // Use fallback if image fails to load
    if (this.image && this.image.complete && this.image.naturalHeight !== 0) {
      try {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      } catch (e) {
        this.drawFallback(ctx);
      }
    } else {
      this.drawFallback(ctx);
    }

    // Health bar
    ctx.fillStyle = "red";
    ctx.fillRect(this.x, this.y - 10, this.width, 5); // Background of health bar
    ctx.fillStyle = "lime";
    const healthWidth = (this.health / this.maxHealth) * this.width;
    ctx.fillRect(this.x, this.y - 10, healthWidth, 5); // Current health

    // Debug Text (can be removed for production)
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.fillText(this.health.toFixed(0), this.x, this.y - 15); // Show health value
    ctx.fillText(this.name.substring(0, 8), this.x, this.y + this.height + 10);
  }

  drawFallback(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw unit type initial
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.charAt(0), this.x + 5, this.y + 15);
  }

  takeDamage(amount) {
    console.log(
      `${this.name} taking ${amount} damage at position (${this.x}, ${this.y})`
    );
    console.trace(); // This will show the call stack

    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true; // Indicate that enemy died
    }
    return false; // Indicate that enemy did not die
  }

  activateSpecialAbility(gameEntities) {
    // Default does not have any but can be overridden
  }
}

export class BasicEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Basic Zombie",
      speed: 0.8,
      health: 100,
      color: "darkgreen",
      width: 30,
      height: 30,
      image: image,
      bounty: 10,
      isAttacker: true, // Basic Zombie attacks
      attackDamage: 10,
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
      width: 25,
      height: 25,
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
      health: 400,
      width: 40,
      height: 40,
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
  }

  takeDamage(amount) {
    // 50% damage reduction always
    const actualDamage = amount * 0.5;
    const died = super.takeDamage(actualDamage); // Call parent takeDamage with reduced amount

    if (
      this.isAlive &&
      !this.raged &&
      this.health / this.maxHealth <= this.rageThreshold
    ) {
      this.speed *= this.rageSpeedMultiplier;
      this.attackDamage *= this.rageDamageMultiplier; // Re-enabled as Enemy now has attackDamage
      this.raged = true;
      console.log(`${this.name} is enraged! Speed: ${this.speed.toFixed(1)}`);
      // TODO: Add visual effect (e.g., change color to brighter red, pulsating) or sound effect
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
      width: 35,
      height: 35,
      color: "purple",
      image: image,
      bounty: 20,
      isAttacker: false, // Primary interaction is explosion, not regular attack
      attackDamage: 0,
    });
    this.explosionRadius = 100;
    this.explosionDamage = 200;
    this.shouldExplode = false; // Flag to tell GameEngine to handle explosion
  }

  // Explode on death
  takeDamage(amount) {
    const died = super.takeDamage(amount);
    if (died) {
      this.shouldExplode = true; // Mark for explosion
    }
    return died;
  }

  // This method should be called by GameEngine's update loop if BombEnemy needs to explode when near a defender
  // even if it hasn't died yet.
  activateSpecialAbility(defenders) {
    // Check if alive AND not already marked for explosion
    if (!this.isAlive || this.shouldExplode) return;

    // If close then explode
    const nearestDefender = defenders.find(
      (defender) => defender.isAlive &&
        Math.hypot(this.x - defender.x, this.y - defender.y) <
          this.explosionRadius / 2); //reduce range for explosion detection
    if (nearestDefender) {
      console.log(`${this.name} self-destructs near a defender!`);
      this.shouldExplode = true; // Mark for explosion
      this.isAlive = false; // Enemy is consumed by the explosion
      this.health = 0;
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
      width: 30,
      height: 30,
      color: "White",
      image: image,
      bounty: 15,
      isAttacker: true,
      attackDamage: 20,
      attackRate: 50
    });
    this.attackRange = 100;
    this.lastAttackTime = 0;
    this.isRanged = true;
  }

  update(defenderUnits) {
    if (!this.isAlive) return;

    if (this.health <= 0) {
      this.isAlive = false;
      this.health = 0;
      return;
    }

    //find closest defender within range
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.speed = 0;
    } else {
      this.x += this.speed;
    }
  }

  findClosestDefender(defenderUnits) {
    let closest = null;
    let minDistance = Infinity;

    for (const defender of defenderUnits) {
      if (!defender.isAlive) continue;

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
        this.x + this.width / 2 - (target + target.width / 2),
        this.y + this.height / 2 - (target + target.height / 2)
    );
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= (this.attackRate * 1000) / 60;
  }

  attack(target, currentTime) {
    // Just update attack time - GameEngine will create the projectile
    this.lastAttackTime = currentTime;
  }
}
