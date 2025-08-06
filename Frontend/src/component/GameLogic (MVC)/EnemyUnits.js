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

    this.isRanged = typeData.isRanged || false;
    this.lastAttackTime = 0;
    this.attackRange = typeData.attackRange || 0;

    this.buffed = typeData.buffed || false;
    this.buffedBy = typeData.buffedBy || null;

    this.isSpawned = typeData.isSpawned || false;
    this.spawnBy = typeData.spawnBy || null;

    this.gameEngine = null;
  }

  canAttack(currentTime) {
    if (!this.isAttacker) return false;
    return currentTime - this.lastAttackTime >= (this.attackRate * 1000) / 60;
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    target.takeDamage(this.attackDamage);

    //range attacks are handle by gameEngine in the draw Projectile method
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
    //if enemy is spawn unnaturally
    if (this.isSpawned) {
      ctx.save();

      // Draw a small symbol above the enemy
      ctx.fillStyle = "rgba(255, 0, 255, 0.8)"; // Purple
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("◈", this.x + this.width / 2, this.y - 15);

      // Alternative: Draw a border
      ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);

      ctx.restore();
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

  takeDamage(amount, ignoreArmor = false) {
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
        this.x + this.width / 2 - (target.x + target.width / 2),
        this.y + this.height / 2 - (target.y + target.height / 2)
    );
  }

  setGameEngine(engine) {
    console.log(`Setting gameEngine for ${this.name}`);
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

    this.hasArmor = true;
    this.armorReduction = 0.5
  }

  takeDamage(amount, ignoreArmor) {
    // 50% damage reduction always
    const actualDamage = (this.hasArmor && !ignoreArmor)
                         ? amount * this.armorReduction : amount;

    const died = super.takeDamage(actualDamage);

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
      width: 35,
      height: 35,
      color: "purple",
      image: image,
      bounty: 20,
      isAttacker: false, // Primary interaction is explosion, not regular attack
      attackDamage: 200,
    });
    this.explosionRadius = 100;
  //  this.explosionDamage = 200;
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
      console.log(`${this.name} deal ${this.attackDamage}`)
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
      attackRate: 50,
      attackRange: 150
    });
    this.lastAttackTime = 0;
    this.isRanged = true;
    this.isMoving = true;
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
      this.isMoving = false;
    } else {
      this.isMoving = true;
    }
    if (this.isMoving) {
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
      width: 35,
      height: 40,
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

  takeDamage(amount) {
    if (this.shieldActive && Math.random() < this.blockChance) {
      this.shieldHealth -= amount;
      if (this.shieldHealth <= 0) {
        this.shieldActive = false;
        const excess = Math.abs(this.shieldHealth);
        this.shieldHealth = 0;
        return super.takeDamage(excess);
      }
      return false; //didnt die
    }
    return super.takeDamage(amount);
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
      speed: 0.7,
      health: 80,
      width: 30,
      height: 35,
      color: 'lightgreen',
      image: image,
      bounty: 25,
      isAttacker: false,
      attackDamage: 0,
      attackRate: 0,
      attackRange: 0
    });
    this.healAmount = 20;
    this.healRange = 80;
    this.healCooldown = 120; //2 second
    this.currentHealCooldown = 0;
  }

  update(defenderUnits) {
     super.update(defenderUnits);

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
      width: 35,
      height: 35,
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

  takeDamage(amount) {
    const died = super.takeDamage(amount);
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
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;

      const mini = new MiniEnemy(
          this.x + offsetX,
          this.y + offsetY,
          null // no images
      );
      mini.isSpawned = true;
      mini.spawnBy = this.id;
      this.gameEngine.enemies.push(mini);
    }
  }
}

//分裂者
export class MiniEnemy extends Enemy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Mini",
      speed: 1.6,
      health: 40,
      width: 20,
      height: 20,
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
      width: 40,
      height: 45,
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
  }

  takeDamage(amount, ignoreArmor = false) {
    const died = super.takeDamage(amount, ignoreArmor);
    if (died && !this.hasSplit) {
      this.splitIntoSplitter();
      this.hasSplit = true;
    }
    return died;
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
      this.gameEngine.enemies.push(splitEnemy);
    }
  }

  update(defenderUnits) {
   //  super.update(defenderUnits);
    if (!this.isAlive || !this.gameEngine) return;

    if (this.health <= 0) {
      this.isAlive = false;
      this.health = 0;
      return;
    }
    //find closest defender within range
    const targetDefender = this.findClosestDefender(defenderUnits);

    if (targetDefender && this.getDistanceTo(targetDefender) <= this.attackRange) {
      this.isMoving = false;
    } else {
      this.isMoving = true;
    }
    if (this.isMoving) {
      this.x += this.speed;
    }

    //spawn enemy
    this.currentSpawnCooldown--;
     if (this.currentSpawnCooldown <= 0) {
       let spawnEnemy = null;
       if (Math.random() < this.spawnTankChance && Math.random() > this.spawnItselfChance) {
         spawnEnemy = new TankEnemy(
             this.x - 30,
             this.y + (Math.random() - 0.5) * 40,
             null);
       } else if (Math.random() < this.spawnItselfChance) {
         spawnEnemy = new SwarmLeader(
             this.x - 30,
             this.y + (Math.random() - 0.5) * 40,
             null);
       } else {
         spawnEnemy = new BasicEnemy(
             this.x - 30,
             this.y + (Math.random() - 0.5) * 40,
             null
         );
       }
       spawnEnemy.isSpawned = true;
       spawnEnemy.spawnBy = this.id;
       console.log(`SwarmLeader spawned ${spawnEnemy.name} - isSpawned: ${spawnEnemy.isSpawned}`);
       this.gameEngine.enemies.push(spawnEnemy);
       this.currentSpawnCooldown = this.spawnCooldown;
     }
     //buff nearby enemy
    this.buffNearbyEnemies();
  }

  buffNearbyEnemies() {
    if (!this.gameEngine) return;

    for (const enemy of this.gameEngine.enemies) {
      if (enemy.id === this.id || !enemy.isAlive) continue;

      const distance = Math.hypot(
          this.x + this.width / 2 - (enemy.x + enemy.width / 2),
          this.y + this.height / 2 - (enemy.y + enemy.height / 2)
      )
      if (distance <= this.buffRange) {
        if (!enemy.buffed) {
          enemy.speed *= this.speedBuff;
          enemy.attackDamage *= this.damageBuff;
          enemy.buffed = true;
          enemy.buffedBy = this.id;
        }
      }
    }
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
      width: 30,
      height: 35,
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

  takeDamage(amount) {
    const died = super.takeDamage(amount);
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
      width: 30,
      height: 35,
      color: 'darkred',
      image: image,
      bounty: 30,
      isAttacker: true,
      attackDamage: 15,
      attackRate: 50,
      attackRange: 100
    });
    this.lifeStealPercent = 1.0; //100% heal from attack damage
    this.isMoving = true;
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
      this.isMoving = false;
    } else {
      this.isMoving = true;
    }
    if (this.isMoving) {
      this.x += this.speed;
    }
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    const damageDealt = Math.min(target.health, this.attackDamage);
    target.takeDamage(this.attackDamage);

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

