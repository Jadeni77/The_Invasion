// src/component/GameLogic (MVC)/DefenderUnits.js
// Data for different types of Defender Units

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
    this.lastAttackTime = 0; // New: To track last attack for canAttack
    this.isRanged = cardData.isRanged || false; // New: Flag for ranged units
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
  update(enemies, defenderUnits) {
    // This update method will primarily handle non-attack logic (like movement if any)
    // Attack logic is now separated into canAttack and attack methods, called by GameEngine
    if (!this.isAlive) return;
    // Subclasses can add their specific update logic here
  }

  // New: Checks if the defender can attack based on fireRate
  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= (this.fireRate / 60) * 1000; // Convert frames to milliseconds
  }

  // New: Performs an attack on a target
  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    target.takeDamage(this.attackDamage);
    this.lastAttackTime = currentTime; // Update last attack time
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

  drawFallback(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw unit type initial
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.charAt(0), this.x + 5, this.y + 15);
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
      isRanged: true, // Basic Cop is ranged
      image: cardData.image,
    });
  }
}

export class HealerDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Healer Cop",
      damage: cardData.damage || 5, // Healers can still have a base attack damage
      health: cardData.health || 100,
      range: cardData.range || 100,
      fireRate: cardData.fireRate || 90,
      healingAmount: cardData.healingAmount || 10,
      healingRate: cardData.healingRate || 120, // frames per heal
      width: 35,
      height: 45,
      color: "lightgreen",
      isRanged: false, // Healer is not ranged (doesn't shoot projectiles)
      image: cardData.image,
    });
    this.healingCountdown = this.healingRate;
    this.healingRange = cardData.healingRange || 80;
  }

  update(enemies, defenderUnits) {
    // Healers don't attack enemies directly in their update, but can still heal
    // super.update(enemies, defenderUnits); // Removed as it handles attack logic, which Healer doesn't need here

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
      damage: cardData.damage || 10, // Base damage for direct hit (if any)
      health: cardData.health || 110,
      range: cardData.range || 200,
      fireRate: cardData.fireRate || 180, // Slower fire rate for grenades
      grenadeDamage: cardData.grenadeDamage || 40,
      grenadeRadius: cardData.grenadeRadius || 60,
      width: 40,
      height: 50,
      color: "darkorange",
      isRanged: true, // Grenadier is ranged (throws projectiles)
      image: cardData.image,
    });
    this.grenadeCountdown = this.fireRate;
    this.gameEngine = null; // Reference to game engine for adding explosions
  }

  // Override attack to trigger explosion via GameEngine
  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    if (this.gameEngine) {
      this.gameEngine.addExplosion(
        target.x + target.width / 2, // Center explosion on target
        target.y + target.height / 2,
        this.grenadeDamage,
        this.grenadeRadius
      );
      this.lastAttackTime = currentTime; // Update last attack time
    } else {
      console.warn("GrenadeDefender: gameEngine reference not set for attack!");
    }
  }

  // Grenadier's update primarily for its own state, not attacking
  update(enemies, defenderUnits) {
    // No specific movement or other continuous logic for Grenadier beyond base DefenderUnit
    // The attack logic is handled by GameEngine calling canAttack/attack
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
      damage: 0, // Barricades don't attack
      health: cardData.health || 500,
      range: 0, // No attack range
      fireRate: 0, // No fire rate
      width: cardData.width || 80, // Wider for a barricade
      height: cardData.height || 30, // Shorter
      color: "gray",
      isRanged: false, // Not ranged
      image: cardData.image,
    });
  }

  update(enemies, defenderUnits) {
    // Barricades don't attack or move. Their main interaction is absorbing damage.
    // Collision with zombies would be handled by GameEngine's zombie movement logic
    // (e.g., zombies stop when they hit a barricade).
  }

  draw(ctx) {
    super.draw(ctx);
  }
}
