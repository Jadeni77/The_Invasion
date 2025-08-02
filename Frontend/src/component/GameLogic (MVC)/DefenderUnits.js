// src/component/GameLogic (MVC)/DefenderUnits.js
// Data for different types of Defender Units

export class DefenderUnit {
  constructor(x, y, cardData) {
    this.x = x;
    this.y = y;
    this.level = cardData.level || 1;

    //set base stat (these are the level 1 stats)
    this.baseWidth = cardData.width || 40;
    this.baseHeight = cardData.height || 40;
    this.baseRange = cardData.range || 150;
    this.baseAttackDamage = cardData.damage || 0;
    this.baseFireRate = cardData.fireRate || 60;
    this.baseHealth = cardData.health || 100;
    this.baseCost = cardData.cost || 0;

    //Apply base level grade
    this.applyLevelUpgrades();

    //The final stat after being upgrade or stay as what it is
    this.width = this.baseWidth;
    this.height = this.baseHeight;
    this.range = this.baseRange;
    this.attackDamage = this.baseAttackDamage;
    this.fireRate = this.baseFireRate;
    this.health = this.baseHealth;
    this.maxHealth = this.baseHealth;
    this.cost = this.baseCost; //cost to deploy

    this.fireCountdown = this.fireRate;
    this.lastAttackTime = 0; // New: To track last attack for canAttack
    this.isRanged = cardData.isRanged || false; // New: Flag for ranged units
    this.cardData = cardData; // Contains original card info (name, type, cost, etc.)
    this.isAlive = true;
    this.id = Math.random();
    this.color = cardData.color || "cyan"; // Base color, can be overridden by cardData
    this.name = cardData.name || "Basic Police"; // for drawing/debug
    this.image = cardData.image;

    this.gameEngine = null;
    this.disabled = false;
    this.disabledDuration = 0;
  }

  applyLevelUpgrades() {
    const level = this.level;

    const statMultiplier = 1 + (level - 1) * 0.15; //15% increase

    this.baseAttackDamage = Math.floor(this.baseAttackDamage * statMultiplier);
    this.baseHealth = Math.floor(this.baseHealth * statMultiplier);
    this.baseRange = Math.floor(this.baseRange * statMultiplier);
    //Apply special ability base on level
    this.applySpecialAbilities();
  }

  //this is the special ability being unlock at a certain level
  applySpecialAbilities() {
    ////base class does not have any special ability
    //subclasses can have
  }

  getUpgradeInfo() {
    return {
      damageIncrease: "+15%",
      healthIncrease: "+15%",
      rangeIncrease: "+15%",
      newAbilities: [],
    };
  }

  // Default logic for all
  update(enemies, defenderUnits) {
    // This update method will primarily handle non-attack logic (like movement if any)
    // Attack logic is now separated into canAttack and attack methods, called by GameEngine
    if (!this.isAlive) return;
    // Subclasses can add their specific update logic here
  }

  // Checks if the defender can attack based on fireRate
  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= (this.fireRate * 1000) / 60; // Convert frames to milliseconds
  }

  // Performs an attack on a target
  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    target.takeDamage(this.attackDamage);
    this.lastAttackTime = currentTime; // Update last attack time
  }

  draw(ctx) {
    if (!this.isAlive) return;
    //console.log(`Drawing ${this.name} at (${this.x}, ${this.y})`); // Add debug log

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

  setGameEngine(engine) {
    this.gameEngine = engine;
  }
}

export class BasicDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Basic Cop",

      //Basic stat
      damage: 15, // Base Level 1 damage
      health: 120, // Base Level 1 health
      range: 200, // Base Level 1 range
      fireRate: 60, // Base Level 1 fire rate
      cost: 20, // Base Level 1 cost

      width: 30,
      height: 40,
      color: "blue",
      isRanged: true, // Basic Cop is ranged
      image: cardData.image,
    });
    this.hasRapidFire = false;
    this.armorPiercing = false;
    this.hasArmorPiercing = false;
    this.useProjectile = true;
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    let finalDamage = this.attackDamage;

    //check for armor piecing again tank
    if (this.hasArmorPiercing && this.armorPiercing) {
      //ignore damage reduction
      target.health -= finalDamage;
      if (target.health <= 0) {
        target.health = 0;
        target.isAlive = false;
      }
    } else {
        target.takeDamage(finalDamage);
      }
    this.lastAttackTime = currentTime;
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasRapidFire = true;
        this.baseFireRate = Math.floor(this.baseFireRate * 0.7); // 30% faster
        break;
      case 5:
        this.hasArmorPiercing = true;
        this.armorPiercing = true;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Rapid Fire (Level 3)");
    if (this.level === 4) newAbilities.push("Armor Piercing (Level 5)");

    return {
      ...base,
      newAbilities,
    };
  }
}

export class HealerDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Healer Cop",
      //base stat
      damage: 5,
      health: 100,
      range: 100,
      fireRate: 90,
      cost: 40,
      healingAmount: 10,
      healingRate: 120,
      healingRange: 80,

      width: 35,
      height: 45,
      color: "lightgreen",
      isRanged: false,
      image: cardData.image,
    });

    //healer bases stats
    this.baseHealingAmount = 10;
    this.baseHealingRate = 120;
    this.baseHealingRange = 80;

    //Apply healer-specific upgrade
    this.applyHealerUpgrades();

    this.healingAmount = this.baseHealingAmount;
    this.healingRate = this.baseHealingRate;
    this.healingRange = this.baseHealingRange;
    this.healingCountdown = this.healingRate;

    //special ability fields
    this.hasGroupHeal = false;
    this.hasResurrection = false;
    this.canResurrect = false;
  }

  applyHealerUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.2; // Healers get 20% increase per level

    this.baseHealingAmount = Math.floor(
      this.baseHealingAmount * statMultiplier
    );
    this.baseHealingRange = Math.floor(this.baseHealingRange * statMultiplier);
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasGroupHeal = true;
        this.baseHealingRange = Math.floor(this.baseHealingRange * 1.5);
        break;
      case 5:
        this.hasResurrection = true;
        this.canResurrect = true;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Group Heal (Level 3)");
    if (this.level === 4) newAbilities.push("Resurrection (Level 5)");

    return {
      ...base,
      healingIncrease: "+20%",
      newAbilities,
    };
  }

  update(enemies, defenderUnits) {
    if (!this.isAlive) return;

    // Healing Logic
    this.healingCountdown--;
    if (this.healingCountdown <= 0) {
      // Find friendly units in healing range that need healing
      const unitsToHeal = defenderUnits.filter(
        (unit) =>
          unit.id !== this.id && // No self-healing
          unit.isAlive &&
          unit.health < unit.maxHealth &&
          Math.hypot(
            this.x + this.width / 2 - (unit.x + unit.width / 2),
            this.y + this.height / 2 - (unit.y + unit.height / 2)
          ) <= this.healingRange // In range
      );

      //group healing special ability
      if (this.hasGroupHeal && unitsToHeal.length > 0) {
        //heal up to three units
        const toHeal = unitsToHeal.slice(0, 3);
        toHeal.forEach(unit => {
          unit.health = Math.min(
              unit.maxHealth,
              unit.health + this.healingAmount
          );
        });
      } else if (unitsToHeal.length > 0) {
        // Sort by lowest health percentage to prioritize
        unitsToHeal.sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth);
        const targetUnit = unitsToHeal[0];
        targetUnit.health = Math.min(targetUnit.maxHealth, targetUnit.health + this.healingAmount);
      }

      //check for resurreltion ability
      if (this.hasResurrection && this.canResurrect) {
        const deadUnit = defenderUnits.find(unit => {
          !unit.isAlive && unit.id !== this.id});
        if (deadUnit && Math.random() < 0.1) { //1% chance for healing cycle
          deadUnit.isAlive = true;
          deadUnit.health = deadUnit.maxHealth * 0.2; //revive with 20% health
          this.canResurrect = false; //only resurrect once per battle
        }
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
      //base stat
      damage: 10,
      health: 110,
      range: 250,
      fireRate: 180,
      cost: 60,
      grenadeDamage: 40,
      grenadeRadius: 60,

      width: 40,
      height: 50,
      color: "darkorange",
      isRanged: true,
      image: cardData.image,
    });

    this.baseGrenadeDamage = 40;
    this.baseGrenadeRadius = 60;

    //apply upgrade
    this.applyGrenadeUpgrades();

    this.grenadeDamage = this.baseGrenadeDamage;
    this.grenadeRadius = this.baseGrenadeRadius;
    this.grenadeCountdown = this.fireRate;

    this.useProjectile = false;

    //Special Ability Fields
    this.hasClusterBomb = false;
    this.clusterBomb = false;
    this.hasNapalm = false;
    this.napalm = false;
    //TODO: Need to tackle the special ability logic for this class
  }

  applyGrenadeUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.25; // Grenadiers get 25% increase per level

    this.baseGrenadeDamage = Math.floor(
      this.baseGrenadeDamage * statMultiplier
    );
    this.baseGrenadeRadius = Math.floor(
      this.baseGrenadeRadius * (1 + (level - 1) * 0.1)
    ); // 10% radius increase
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasClusterBomb = true;
        this.clusterBomb = true;
        break;
      case 5:
        this.hasNapalm = true;
        this.napalm = true;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Cluster Bomb (Level 3)");
    if (this.level === 4) newAbilities.push("Napalm Strike (Level 5)");

    return {
      ...base,
      explosionDamage: "+25%",
      newAbilities,
    };
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
}

// No damage, high health, static
export class BarricadeDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Barricade",
      //base stat
      damage: 0,
      health: 500,
      range: 0,
      fireRate: 0,
      cost: 30,

      width: 50,
      height: 30,
      color: "gray",
      isRanged: false,
      image: cardData.image,
    });
    //special ability
    this.hasSpikes = false;
    this.spikeCounter = false;
    this.hasElectricField = false;
    this.electricField = false;
    //TODO: Need to tackle the special ability logic for this class
  }

  applyLevelUpgrades() {
    const level = this.level;
    // Barricades only get health increases and special abilities
    const healthMultiplier = 1 + (level - 1) * 0.3; // 30% health increase per level

    this.baseHealth = Math.floor(this.baseHealth * healthMultiplier);
    //this.baseCost = Math.floor(this.baseCost * (1 + (level - 1) * 0.1));

    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasSpikes = true;
        this.spikeCounter = true;
        break;
      case 5:
        this.hasElectricField = true;
        this.electricField = true;
        break;
    }
  }

  getUpgradeInfo() {
    const newAbilities = [];
    if (this.level === 2) newAbilities.push("Spike Counter (Level 3)");
    if (this.level === 4) newAbilities.push("Electric Field (Level 5)");

    return {
      healthIncrease: "+30%",
      newAbilities,
    };
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

export class EnergyGenerator extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Energy Generator",
      //basic
      damage: 0,
      health: 80,
      range: 0,
      fireRate: 0,
      cost: 25,
      energyDropAmount: 5,
      energyDropRate: 600, //10 seconds

      width: 35,
      height: 35,
      color: "yellow",
      isRanged: false,
      image: cardData.image,
    });
    this.baseEnergyDropAmount = 5;
    this.baseEnergyDropRate = 300;

    this.applyEnergyUpgrades();

    this.energyDropAmount = this.baseEnergyDropAmount;
    this.energyDropRate = this.baseEnergyDropRate;
    this.energyDropCountDown = this.energyDropRate;

    //special ability
    this.hasEnergyBurst = false;
    this.hasEnergyField = false;
    this.autoCollect = false;
    //TODO: Need to tackle the special ability logic for this class
  }

  applyEnergyUpgrades() {
    const level = this.level;
    this.baseEnergyDropAmount = this.baseEnergyDropAmount + (level - 1);
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasEnergyBurst = true;
        this.baseEnergyDropAmount += 2; // +2 extra energy
        break;
      case 5:
        this.hasEnergyField = true;
        this.autoCollect = true;
        break;
    }
  }

  getUpgradeInfo() {
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Energy Burst (Level 3)");
    if (this.level === 4) newAbilities.push("Auto-Collect Field (Level 5)");

    return {
      energyIncrease: `+${this.level - 1} per drop`,
      newAbilities
    }
  }

  update(enemies, defenderUnits) {
    if (!this.isAlive) return;

    //energy drop logic
    this.energyDropCountDown--;
    if (this.energyDropCountDown <= 0) {
      if (this.gameEngine) {
        //drop energy at random position near this defender
        const offsetX = (Math.random() - 0.5 ) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        this.gameEngine.dropEnergy(
            this.x + this.width / 2 + offsetX,
            this.y + this.height / 2 + offsetY,
            this.energyDropAmount
        );
      }
      this.energyDropCountDown = this.energyDropRate;
    }
  }

  draw(ctx) {
    super.draw(ctx);

    //energy generator indicator
    const progress = 1 - (this.energyDropCountDown / this.energyDropRate);
    ctx.beginPath();
    ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2 + 5,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * progress)
    );
    ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
