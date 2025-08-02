// src/component/GameLogic (MVC)/DefenderUnits.js
// Data for different types of Defender Units

import card from "../common/Card.jsx";

export class DefenderUnit {
  constructor(x, y, cardData = {}) {
    this.x = x;
    this.y = y;
    this.level = cardData.level || 1;

    //base data
    this.width = cardData.width || 40;
    this.height = cardData.height || 40;
    this.range = cardData.range || 150;
    this.attackDamage = cardData.damage || 0;
    this.fireRate =cardData.fireRate || 60;
    this.health = cardData.health || 100;
    this.maxHealth = cardData.health || 100;
    this.cost = cardData.cost || 0;
    this.color = cardData.color || "cyan";
    this.name = cardData.name || "Basic Police";
    this.image = cardData.image;

    //combat properties
    this.fireCountdown = this.fireRate;
    this.lastAttackTime = 0; // New: To track last attack for canAttack
    this.isRanged = cardData.isRanged || false; // New: Flag for ranged units
    this.isAlive = true;
    this.id = Math.random();

    //status effect
    this.disabled = false;
    this.disabledDuration = 0;

    //game engine reference
    this.gameEngine = null;

    this.applyLevelUpgrades();
  }

  applyLevelUpgrades() {
    const level = this.level;

    const statMultiplier = 1 + (level - 1) * 0.15; //15% increase

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = Math.floor(this.maxHealth * statMultiplier);
    this.range = Math.floor(this.range * statMultiplier);
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
    const typeData = {
      name: "Basic Cop",
      damage: 15,
      health: 120,
      range: 200,
      fireRate: 60,
      cost: 20,
      width: 30,
      height: 40,
      color: "blue",
      isRanged: true,
      level: cardData.level || 1,
      image: cardData.image,
    };
    super(x, y, typeData);

    this.useProjectile = true;
    //special abilities
    this.hasRapidFire = false;
    this.hasArmorPiercing = false;
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    let finalDamage = this.attackDamage;

    //shoot faster
    if (this.hasRapidFire) {
      this.baseFireRate = Math.floor(this.baseFireRate * 0.5); // 50% faster
    }

    //check for armor piecing again tank
    if (this.hasArmorPiercing) {
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
        break;
      case 5:
        this.hasArmorPiercing = true;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Rapid Fire (Level 3)");
    if (this.level === 4) newAbilities.push("Armor Piercing (Level 5)");

    return { ...base, newAbilities };
  }
}

export class HealerDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeData = {
      name: "Healer Cop",
      damage: 5,
      health: 100,
      range: 100,
      fireRate: 90,
      cost: 30,
      width: 35,
      height: 45,
      color: "lightgreen",
      isRanged: false,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeData);

    //healer stats
    this.healingAmount = 10;
    this.healingRate = 120;
    this.healingRange = 80;
    this.healingCountdown = this.healingRate;

    //special ability fields
    this.hasGroupHeal = false;
    this.hasResurrection = false;
    this.canResurrect = false;
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.2; // Healers get 20% increase per level

    this.healingAmount = Math.floor(this.healingAmount * statMultiplier);
    this.healingRange = Math.floor(this.healingRange * statMultiplier);
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasGroupHeal = true;
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

    return {...base, healingIncrease: "+20%", newAbilities};
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
        this.healingRange = Math.floor(this.healingRange * 1.5);
        //heal up to three units
        const toHeal = unitsToHeal.slice(0, 3);
        toHeal.forEach(unit => { unit.health = Math.min(unit.maxHealth,
                                                        unit.health + this.healingAmount);});
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
    const typeData = {
      name: "Grenadier",
      damage: 40,
      health: 110,
      range: 250,
      fireRate: 180,
      cost: 60,
      width: 40,
      height: 45,
      color: "darkorange",
      isRanged: true,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeData);

    this.grenadeRadius = 60;
    this.grenadeCountdown = this.fireRate;
    this.useProjectile = false;

    //Special Ability Fields
    this.hasClusterBomb = false;
    this.hasNapalm = false;
    //TODO: Need to tackle the special ability logic for this class

  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.25; // Grenadiers get 25% increase per level

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.grenadeRadius = Math.floor(this.grenadeRadius * (1 + (level - 1) * 0.1)); // 10% radius increase
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasClusterBomb = true;
        break;
      case 5:
        this.hasNapalm = true;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Cluster Bomb (Level 3)");
    if (this.level === 4) newAbilities.push("Napalm Strike (Level 5)");

    return {...base, explosionDamage: "+25%", newAbilities,};
  }

  // Override attack to trigger explosion via GameEngine
  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    if (this.hasClusterBomb) {
      //TODO:
    }
    if (this.hasNapalm) {
      //TODO:
    }

    if (this.gameEngine) {
      this.gameEngine.addExplosion(
        target.x + target.width / 2, // Center explosion on target
        target.y + target.height / 2,
        this.attackDamage,
        this.grenadeRadius
      );
      this.lastAttackTime = currentTime; // Update last attack time
    } else {
      console.warn("GrenadeDefender: gameEngine reference not set for attack!");
    }
  }
}

// No damage, high health, static
export class BarricadeDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeData = {
      name: "Barricade",
      damage: 0,
      health: 500,
      range: 0,
      fireRate: 0,
      cost: 30,
      width: 50,
      height: 40,
      color: "gray",
      isRanged: false,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeData);

    //special ability
    this.hasSpikes = false;
    this.hasElectricField = false;
    //TODO: Need to tackle the special ability logic for this class
  }

  applyLevelUpgrades() {
    const level = this.level;
    const healthMultiplier = 1 + (level - 1) * 0.3; // 30% health increase per level

    this.health = Math.floor(this.health * healthMultiplier);
    //this.baseCost = Math.floor(this.baseCost * (1 + (level - 1) * 0.1));

    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasSpikes = true;
        break;
      case 5:
        this.hasElectricField = true;
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
    if (this.hasSpikes) {
      //TODO:
    }
    if (this.hasElectricField) {
      //TODO:
    }
  }
}

export class EnergyGenerator extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeData = {
      name: "Energy Generator",
      damage: 0,
      health: 80,
      range: 0,
      fireRate: 0,
      cost: 25,
      width: 35,
      height: 35,
      color: "yellow",
      isRanged: false,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeData);

    this.energyDropAmount = 5;
    this.energyDropRate = 300;
    this.energyDropCountDown = this.energyDropRate;

    //special ability
    this.hasEnergyBurst = false;
    this.hasEnergyField = false;
    this.autoCollect = false;
    //TODO: Need to tackle the special ability logic for this class
  }

  applyLevelUpgrades() {
    const level = this.level;
    this.energyDropAmount = this.energyDropAmount + (level - 1);
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasEnergyBurst = true;
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

    return {energyIncrease: `+${this.level - 1} per drop`, newAbilities
    }
  }

  update(enemies, defenderUnits) {
    if (!this.isAlive) return;

    if (this.hasEnergyBurst) {
      this.energyDropAmount *= 1.5; //50% increase
    }
    if (this.hasEnergyField) {
      //TODO:
    }
    if (this.autoCollect) {
      //TODO:
    }
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

export class Sniper extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeDate = {
      name: "Sniper",
      damage: 50,
      health: 80,
      range: 800,
      fireRate: 120,
      cost: 80,
      width: 30,
      height: 40,
      color: "darkgreen",
      isRanged: true,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeDate);

    this.critChance = 0,2;
    this.critMultiplier = 2.0;

    //special ability
    this.hasPiercingShot = false;
    this.hasHeadshot = false;
  }

  applySpecialAbilities() {
    switch (this.level) {
      case 3:
        this.hasPiercingShot = true;
        this.critChance = 0.4;
        break;
      case 5:
        this.hasHeadshot = true;
        this.critMultiplier = 3.0;
        break;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Piercing Shot (Level 3)");
    if (this.level === 4) newAbilities.push("Headshot (Level 5)");

    return {...base, criticalIncrease: "+10%", newAbilities,};
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    let damage = this.attackDamage;

    if (Math.random() < this.critChance) {
      damage *= this.critMultiplier;
    }
    if (this.hasPiercingShot) {
      //TODO:
    }
    if (this.hasHeadshot) {
      //TODO:
    }
    target.takeDamage(damage);
    this.lastAttackTime = currentTime;
  }
}


