//Data for different types of Defender Units
export class DefenderUnit {
  constructor(x, y, cardData) {
    this.x = x;
    this.y = y;
    this.width = cardData.width || 40;
    this.height = cardData.height || 40;
    this.range = cardData.range || 150;
    this.attackDamage = cardData.damage || 20;
    this.fireRate = cardData.fireRate || 60; // frames per shot
    this.fireCountdown = this.fireRate;
    this.cardData = cardData; // Contains original card info (name, type, cost, etc.)
    this.health = cardData.health || 100; // current health
    this.maxHealth = cardData.health || 100; // Store max health for healing
    this.isAlive = true;
    this.id = Math.random();
    this.color = cardData.color || "cyan"; // Base color, can be overridden by cardData
    this.name = cardData.name || "Basic Police"; // for drawing/debug
    this.image = cardData.image;
    this.cost = cardData.cost || 0; // cost to deploy
  }

  // Default logic for all
  // Handles basic attack
  update(enemies, defenderUnits) {
    // Accepts all defenderUnits for future self-healing/buffing
    if (!this.isAlive) return;
    // Handle basic attack logic if the unit has attack damage and range
    if (this.attackDamage > 0 && this.range > 0) {
      this.fireCountdown--;
      if (this.fireCountdown <= 0) {
        // Corrected parameter name: enermy -> enemies
        const target = enemies.find(
          (z) =>
            z.isAlive && Math.hypot(this.x - z.x, this.y - z.y) <= this.range
        );
        if (target) {
          target.takeDamage(this.attackDamage);
          this.fireCountdown = this.fireRate;

          // Might add projectile logic here if not instant hit
        }
      }
    }
    // Subclasses will add their specific update logic here
  }

  draw(ctx) {
    if (!this.isAlive) return;

    if (this.image) {
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    // Unit name text
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(
      this.name.substring(0, 8),
      this.x + 2,
      this.y + this.height + 15
    );

    // Health bar
    ctx.fillStyle = "red";
    ctx.fillRect(this.x, this.y - 10, this.width, 5); // Background of health bar
    ctx.fillStyle = "lime";
    const healthWidth = (this.health / this.maxHealth) * this.width;
    ctx.fillRect(this.x, this.y - 10, healthWidth, 5); // Current health
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true; // Indicate defender died
    }
    return false; // Indicate defender alive
  }

  // Generic method for special abilities. Subclasses will override this.
  // The GameEngine's update loop will call this on relevant units.
  activateSpecialAbility(allGameEntities) {
    // Pass all entities for flexibility
    // Default: no special ability or ability that requires no specific targets
  }
}

export class BasicDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Basic Cop",
      damage: cardData.damage || 15,
      health: cardData.health || 120,
      range: cardData.range || 150,
      fireRate: cardData.fireRate || 60,
      width: 30,
      height: 40,
      color: "blue",
      image: cardData.image,
    });
  }
  // Inherits update, draw, takeDamage from PoliceUnit
}

export class HealerDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Healer Cop",
      damage: cardData.damage || 5, // Healers can still have a base attack damage
      health: cardData.health || 100,
      range: cardData.range || 100,
      fireRate: cardData.fireRate || 90, // Corrected typo: firerate -> fireRate
      healingAmount: cardData.healingAmount || 10,
      healingRate: cardData.healingRate || 120, // frames per heal
      width: 35,
      height: 45,
      color: "lightgreen",
      image: cardData.image,
    });
    this.healingCountdown = this.healingRate;
    this.healingRange = cardData.healingRange || 80;
  }

  update(enemies, defenderUnits) {
    // Corrected parameter name: enermy -> enemies
    super.update(enemies, defenderUnits); // Call super update for potential base attack

    // Healing Logic
    this.healingCountdown--;
    if (this.healingCountdown <= 0) {
      // Find friendly units in healing range that need healing
      const unitsToHeal = defenderUnits.filter(
        (unit) =>
          unit.id !== this.id && // No self-healing
          unit.isAlive &&
          unit.health < unit.maxHealth &&
          Math.hypot(this.x - unit.x, this.y - unit.y) <= this.healingRange // In range
      );
      // Sort by lowest health percentage to prioritize
      unitsToHeal.sort(
        (a, b) => a.health / a.maxHealth - b.health / b.maxHealth
      );
      if (unitsToHeal.length > 0) {
        const targetUnit = unitsToHeal[0];
        targetUnit.health = Math.min(
          targetUnit.maxHealth,
          targetUnit.health + this.healingAmount
        );
      }
      this.healingCountdown = this.healingRate;
    }
  }

  draw(ctx) {
    super.draw(ctx);
    // Optional: Draw a healing aura when healing
    if (this.healingCountdown <= 20 && this.healingCountdown > 0) {
      // Corrected: healingCountDown -> healingCountdown
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.healingRange,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(0, 255, 0, " + this.healingCountdown / 20 + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

export class GrenadeDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Grenadier",
      damage: cardData.damage || 10,
      health: cardData.health || 110,
      range: cardData.range || 200,
      fireRate: cardData.fireRate || 180, // Slower fire rate for grenades
      grenadeDamage: cardData.grenadeDamage || 40,
      grenadeRadius: cardData.grenadeRadius || 60,
      width: 40,
      height: 50,
      color: "darkorange",
      image: cardData.image,
    });
    this.grenadeCountdown = this.fireRate; // Corrected: grenadeCountDown -> grenadeCountdown
  }

  update(enemies, defenderUnits) {
    // Corrected parameter name: enermy -> enemies
    // Call super.update to maintain any base DefenderUnit attack logic
    super.update(enemies, defenderUnits); // Corrected: enermies -> enemies

    this.grenadeCountdown--;
    if (this.grenadeCountdown <= 0) {
      const target = enemies.find(
        // Corrected: enermy -> enemies
        (z) => z.isAlive && Math.hypot(this.x - z.x, this.y - z.y) <= this.range
      );
      if (target) {
        if (this.gameEngine) {
          // Changed to addExplosion, as per previous discussion for clarity
          this.gameEngine.addExplosion(
            target.x,
            target.y,
            this.grenadeDamage,
            this.grenadeRadius
          );
        } else {
          console.warn("GrenadeDefender: gameEngine reference not set!");
        }
        this.grenadeCountdown = this.fireRate;
      }
    }
  }

  setGameEngine(engine) {
    this.gameEngine = engine;
  }
}

// No damage, high health, static
export class BarricadeDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Barricade",
      damage: 0,
      health: cardData.health || 500,
      range: 0,
      fireRate: 0,
      width: cardData.width || 80, // Wider for a barricade
      height: cardData.height || 30, // Shorter
      color: "gray",
      image: cardData.image,
    });
  }

  update(enemies, defenderUnits) {
    // Corrected parameter name: enermy -> enemies
    // Barricades don't attack or move. Their main interaction is absorbing damage.
    // Collision with zombies would be handled by GameEngine's zombie movement logic
    // (e.g., zombies stop when they hit a barricade).
  }

  draw(ctx) {
    super.draw(ctx);
    // super.draw also handles image
  }
}