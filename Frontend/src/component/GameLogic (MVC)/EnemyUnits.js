//Data for different types of Enermy types

export class Enermy {
  constructor(x, y, typeData = {}) {
    this.x = x;
    this.y = y;
    this.initialSpeed = typeData.initialSpeed || 0.8;
    this.speed = this.initialSpeed; //current speed and can be modify by rage or ability
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

    //attak properties
    this.isAttacker = typeData.isAttacker || false;
    this.attackDamage = typeData.attackDamage || 0;
    this.attackRate = typeData.attackRate || 60;
    this.attackCountdown = this.attackRate;
    this.isAttacking = false; //if entity is engage in attack
  }

  /**
   * Movement Path
   */
  update(defenderUnits) {
    if (!this.isAlive) return;

    let targetDefender = null;

    if (this.isAttacker) {
      // Find the first defender in its path/collision range
      targetDefender = defenderUnits.find((defender) => {
        //find closest
        defender.isAlive &&
          this.x + this.width >= defender.x && // Enemy's right edge past defender's left edge
          this.x <= defender.x + defender.width && // Enemy's left edge before defender's right edge
          this.y + this.height >= defender.y && // Enemy's bottom edge past defender's top edge
          this.y <= defender.y + defender.height; // Enemy's top edge before defender's bottom edge
      });

      if (targetDefender) {
        this.speed = 0; //attack will not move
        this.isAttacking = true;

        this.attackCountdown--;

        if (this.attackCountdown <= 0) {
          defenderUnits.takeDamage(this.attackDamage);
          this.attackCountdown = this.attackRate;
        }
      } else {
        this.speed = this.initialSpeed;
        this.isAttacking = false;
        this.attackCountdown = this.attackRate; // Reset cooldown when not attacking
      }
    }
    if (!this.isAttacking) {
      this.x += this.speed;
    }
  }

  draw(ctx) {
    if (!this.isAlive) return;

    if (this.image) {
      // Draw the image if available
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    } else {
      // Fallback to color fill if no image
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
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

  takeDamage(amount) {
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

class FastEnermy extends Enermy {
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
      isAttacker: false,
      attackDamage: 0,
    });
  }
}

class TankEnermy extends Enermy {
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
      isAttacker: true,
      attackDamage: 30, //high base damage
      attackRate: 90, // Slower attack speed (1.5 seconds)
    });
    this.raged = false;
    this.rageThreshold = 0.5; // Rage when health drops below 50%
    this.rageSpeedMultiplier = 2.0; // Double speed when raged
    this.rageDamageMultiplier = 1.5; // 50% more attack damage when raged (if zombies attack defenders)
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
      // This line was causing an error as 'attackDamage' is not a property of Enermy or TankEnermy by default.
      // If you intend for enemies to attack, you'll need to add an `attackDamage` property to Enermy class.
      // For now, I'm commenting it out to prevent errors.
      this.attackDamage *= this.rageDamageMultiplier;
      this.raged = true;
      console.log(`${this.name} is enraged! Speed: ${this.speed.toFixed(1)}`);
      // TODO: Add visual effect (e.g., change color to brighter red, pulsating) or sound effect
      this.color = "orange"; // Simple visual change
    }
    return died;
  }
}

class BombEnermy extends Enermy {
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
      isAttacker: false,
      attackDamage: 0
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

  // This method should be called by GameEngine's update loop if BombEnermy needs to explode when near a defender
  // even if it hasn't died yet.
  activateSpecialAbility(defenders) {
    // Check if alive AND not already marked for explosion
    if (!this.isAlive || this.shouldExplode) return;

    // If close then explode
    const nearestDefender = defenders.find(
      (defender) =>
        defender.isAlive &&
        Math.hypot(this.x - defender.x, this.y - defender.y) <
          this.explosionRadius
    );
    if (nearestDefender) {
      console.log(`${this.name} self-destructs near a defender!`);
      this.shouldExplode = true; // Mark for explosion
      this.isAlive = false; // Enemy is consumed by the explosion
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