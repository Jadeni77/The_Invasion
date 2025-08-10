// src/component/GameLogic (MVC)/DefenderUnits.js
// Data for different types of Defender Units

import {DrawNegativeEffect} from "./GameEngineBreakDown/Draws/DrawNegativeEffect.js";

export class DefenderUnit {
  constructor(x, y, cardData = {}) {
    this.x = x;
    this.y = y;
    this.level = cardData.level || 1;

    //base data
    this.width = cardData.width || 40;
    this.height = cardData.height || 40;
    this.range = cardData.range || 0;
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

    this.burning = false;
    this.burningDamage = 0;
    this.burningDuration = 0;

    //game engine reference
    this.gameEngine = null;
    this.drawNegativeEffect = new DrawNegativeEffect(this);

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
    ctx.fillText(this.health.toFixed(0), this.x, this.y - 15); // Show health value

    this.drawNegativeEffect.drawAllEffect(ctx);
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
    console.log(`Damge took ${amount}`);
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
  }

  applySpecialAbilities() {
    this.hasRapidFire = false;
    this.hasArmorPiercing = false;
    if (this.level >= 3) {
      this.hasRapidFire = true;
      this.fireRate = Math.floor(this.fireRate * 0.5); // 50% faster
    }
    if (this.level >= 5) {
      this.hasArmorPiercing = true;
    }
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) {
      return;
    }
    const died = target.takeDamage(this.attackDamage, this.hasArmorPiercing);

        if (died && !target.isSpawned && this.gameEngine && !this.gameEngine.gameOver) {
          this.gameEngine.inGameScore += target.bounty;
          this.gameEngine.updateScoreCb(this.gameEngine.inGameScore);
          this.gameEngine.dropManager.handleEnemyDeath(target);
          //remove from enemy array
          const enemyIndex = this.gameEngine.enemies.findIndex(e => e.id === target.id);
          if (enemyIndex !== -1) {
            this.gameEngine.enemies.splice(enemyIndex, 1);
          }
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
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.2; // Healers get 20% increase per level

    this.healingAmount = Math.floor(this.healingAmount * statMultiplier);
    this.healingRange = Math.floor(this.healingRange * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    this.hasGroupHeal = false;
    this.hasResurrection = false;
    this.canResurrect = false;

    if (this.level >= 3) {
      this.hasGroupHeal = true;
      this.healingRange = Math.floor(this.healingRange * 1.5);
    }
    if (this.level >= 5) {
      this.hasResurrection = true;
      this.canResurrect = true;
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
        console.log(`Healer checking for dead units...`);

        //check all defenders including recent died
        let allDefender = [...defenderUnits];
        if (this.gameEngine && this.gameEngine.recentlyDiedDefenders) {
          allDefender = [...defenderUnits, ...this.gameEngine.recentlyDiedDefenders];
        }
        const deadUnits = allDefender.filter(unit => !unit.isAlive
                                                     && unit.id !== this.id
                                                     && unit.health <= 0);
        console.log(`Found ${deadUnits.length} dead units`);
        if (deadUnits.length > 0) {
          const deadUnit = deadUnits[0];
            console.log(`Resurrecting ${deadUnit.name}`);
            if (!deadUnit.occupied) {
              deadUnit.health = Math.floor(deadUnit.maxHealth * 0.2);
              this.canResurrect = false;
              deadUnit.hasBeenResurrected = true;
              console.log("Resurrection successful!");
            }
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
    // Visual indicator for resurrection ability
    if (this.hasResurrection && this.canResurrect) {
      ctx.fillStyle = "rgba(255, 215, 0, 0.3)"; // Golden glow
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 10,
          0,
          Math.PI * 2
      );
      ctx.fill();
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

    //Special Ability Fields

  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.25; // Grenadiers get 25% increase per level

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.grenadeRadius = Math.floor(this.grenadeRadius * (1 + (level - 1) * 0.1)); // 10% radius increase

    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    this.hasClusterBomb = false;
    this.hasNapalm = false;

    if (this.level >= 3) {
      this.hasClusterBomb = true;
    }
    if (this.level >= 5) {
      this.hasNapalm = true;
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
    console.log(`Grenadier has ClusterBomb : ${this.hasClusterBomb} `);
    console.log(`Grenadier has Napalm : ${this.hasNapalm} `);

    if (this.gameEngine) {
      this.gameEngine.addDefenderExplosion(
          target.x + target.width / 2, // Center explosion on target
          target.y + target.height / 2,
          this.attackDamage,
          this.grenadeRadius,
          "grenadier");

    if (this.hasClusterBomb) {
      for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3;
        const offsetX = Math.cos(angle) * 40;
        const offsetY = Math.sin(angle) * 40;

        setTimeout(() => {
          this.gameEngine.addDefenderExplosion(
              target.x + target.width / 2 + offsetX,
              target.y + target.height / 2 + offsetY,
              this.attackDamage * 0.75, //75% damage
              this.grenadeRadius * 0.8, //smaller radius,
              "grenadier"
          );
        }, 200 + i * 100);
      }
    }
    if (this.hasNapalm && this.gameEngine) {
      const napalmX = target.x + target.width / 2;
      const napalmY = target.y + target.height / 2;
      const napalmRadius = this.grenadeRadius * 0.8;
      //5 ticks of fire damage over 2.5 second
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (this.gameEngine && this.gameEngine.enemies) {
            this.gameEngine.explosions.push({
                                              x: napalmX,
                                              y: napalmY,
                                              damage: 0,
                                              radius: napalmRadius,
                                              timer: 15,
                                              color: "orange",
                                              innerColor: "red",
                                              particleColor: "rgba(255, 100, 0, 0.9)",
                                              style: "burst",
                                              type: "defender",
                                              source: "grenadier",
                                              explodeBy: "grenadier"
                                            });

            //apply burining damage
            for (const enemy of this.gameEngine.enemies) {
              if (!enemy.isAlive) continue;
              const distance = Math.hypot(
                  enemy.x + enemy.width / 2 - napalmX,
                  enemy.y + enemy.height / 2 - napalmY
              );
              if (distance <= napalmRadius) {
                enemy.takeDamage(this.attackDamage * 0.1, false);
              }
            }
          }
        }, i * 500);
      }
    }
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
    this.hasSpikes = false;
    this.hasElectricField = false;

    if (this.level >= 3) {
      this.hasSpikes = true;
    }
    if (this.level >= 5) {
      this.hasElectricField = true;
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
    //TODO: Need to tackle the special ability logic for this class
  }

  applyLevelUpgrades() {
    const level = this.level;
    this.energyDropAmount = this.energyDropAmount + (level - 1);
  }

  applySpecialAbilities() {
    this.hasEnergyBurst = false;
    this.hasEnergyField = false;
    this.autoCollect = false;

    if (this.level >= 3) {
      this.hasEnergyBurst = true;
    }
    if (this.level >= 5) {
      this.hasEnergyField = true;
      this.autoCollect = true;
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
      range: 600,
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

    this.critChance = 0.2;
    this.critMultiplier = 2.0;
    this.lastTargetId = null;
    this.laserDuration = 300; //show laser for 300ms
    this.lastShotTime = 0;

    //for piercing shot tracking
    this.piercingTargets = new Set();
    //Note: it is mark as unused but this is used
    this.lastPiercingTargets = new Set(); // Store for drawing

    //special ability
  }

  applyLevelUpgrades() {
    const statMultiplier = 1 + (this.level - 1) * 0.15; //15% increase

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = Math.floor(this.maxHealth * statMultiplier);

    this.critChance = 0.2 + (this.level - 1) * 0.08; //+8% every level
    this.critChance = Math.min(1.0, this.critChance); //max 100%


    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    this.hasPiercingShot = false;
    this.hasHeadshot = false;

    if (this.level >= 3) {
      this.hasPiercingShot = true;
      this.critChance = 0.4;
    }
    if (this.level >= 5) {
      this.hasHeadshot = true;
      this.critMultiplier = 3.0;
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Piercing Shot (Level 3)");
    if (this.level === 4) newAbilities.push("Headshot (Level 5)");

    return {...base, criticalIncrease: "+8% per level", newAbilities,};
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive || !this.gameEngine) return;

    console.log(`Sniper attack - Level: ${this.level}, Piercing: ${this.hasPiercingShot}, Headshot: ${this.hasHeadshot}`);

    // Store shot info for laser drawing
    this.lastShotTime = Date.now();
    this.lastTargetId = target.id;
    this.lastTargetPosition = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2
    };

    let damage = this.attackDamage;
    const isCrit = Math.random() < this.critChance;

    if (isCrit) {
      damage *= this.critMultiplier;
      console.log("Critical hit!");
    }
    // Clear previous piercing targets and track new ones
    this.lastPiercingTargets = new Set(this.piercingTargets);
    this.piercingTargets.clear();
    this.piercingTargets.add(target.id);

    const targetDied = target.takeDamage(damage, true); //always have armor piercing
    if (targetDied && !target.isSpawned && this.gameEngine && !this.gameEngine.gameOver) {
      this.handleEnemyDeath(target);
    }
    // Piercing Shot - hits all enemies in a line
    if (this.hasPiercingShot) {
      const startX = this.x + this.width / 2;
      const startY = this.y + this.height / 2;
      const targetX = target.x + target.width / 2;
      const targetY = target.y + target.height / 2;

      const dx = targetX - startX;
      const dy = targetY - startY;
      //length between the target and sniper
      const length = Math.sqrt(dx * dx + dy * dy);
      //direction vector
      const dirX = dx / length;
      const dirY = dy / length;

      for (const enemy of this.gameEngine.enemies) {
        //enemy cannot be pierce twice
        if (!enemy.isAlive || this.piercingTargets.has(enemy.id)) continue;

        const enemyX = enemy.x + enemy.width / 2;
        const enemyY = enemy.y + enemy.height / 2;

        //calculate if enemy is on line
        const toEnemyX = enemyX - startX;
        const toEnemyY = enemyY - startY;
        // Dot product to find projection length
        const projLength = toEnemyX * dirX + toEnemyY * dirY;

        //check if enemy is in front of the sniper and within range
        if (projLength > 0 && projLength <= this.range) {
          // Calculate perpendicular distance from line
          const perpX = toEnemyX - projLength * dirX;
          const perpY = toEnemyY - projLength * dirY;
          const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

          // If enemy is close enough to the line (within 20 pixels)
          if (perpDist <= 20) {
            const pierceDamage = damage * 0.7; //only apply 70%
            const pierceDied = enemy.takeDamage(pierceDamage, true);
            this.piercingTargets.add(enemy.id);
            if (pierceDied && !enemy.isSpawned && this.gameEngine && !this.gameEngine.gameOver) {
              this.handleEnemyDeath(enemy)
            }
          }
        }

      }
    }
    //crit kills will create explosion area
    if (this.hasHeadshot && isCrit && targetDied) {
      console.log("Explosive headshot!");

      this.gameEngine.addDefenderExplosion(
        target.x + target.width / 2,
        target.y + target.height / 2,
        damage * 0.5, //50%
        200,
        "sniper");

      //visual affect
      this.gameEngine.explosions.push({
                                        x: target.x + target.width / 2,
                                        y: target.y + target.height / 2,
                                        damage: 0,
                                        radius: 200,
                                        timer: 20,
                                        color: "crimson",
                                        innerColor: "white",
                                        particleColor: "rgba(220, 20, 60, 0.9)",
                                        style: "piercing",
                                        type: "defender",
                                        source: "sniper",
                                        explodeBy: "Sniper"});}
    this.lastAttackTime = currentTime;
    this.lastTargetId = target.id;
  }

  handleEnemyDeath(enemy) {
    this.gameEngine.inGameScore += enemy.bounty;
    this.gameEngine.updateScoreCb(this.gameEngine.inGameScore);
    this.gameEngine.dropManager.handleEnemyDeath(enemy);

    const enemyIndex = this.gameEngine.enemies.findIndex(e => e.id === enemy.id);
    if (enemyIndex !== -1) {
      this.gameEngine.enemies.splice(enemyIndex, 1);
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Draw laser sight only for a short duration after shooting
    const timeSinceShot = Date.now() - this.lastShotTime;
    if (timeSinceShot < this.laserDuration && this.lastTargetPosition) {
      ctx.save();

      // Calculate fade effect
      const fadeAlpha = 1 - (timeSinceShot / this.laserDuration);

      // Draw piercing line if has ability
      if (this.hasPiercingShot) {
        // Main laser beam
        const gradient = ctx.createLinearGradient(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.lastTargetPosition.x,
            this.lastTargetPosition.y
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${fadeAlpha})`);
        gradient.addColorStop(1, `rgba(255, 100, 0, ${fadeAlpha * 0.5})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 - (timeSinceShot / this.laserDuration) * 2; // Shrinking line
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);

        // Extend line to show piercing
        const dx = this.lastTargetPosition.x - (this.x + this.width / 2);
        const dy = this.lastTargetPosition.y - (this.y + this.height / 2);
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
          const extendX = (dx / length) * this.range;
          const extendY = (dy / length) * this.range;

          ctx.lineTo(
              this.x + this.width / 2 + extendX,
              this.y + this.height / 2 + extendY
          );
          ctx.stroke();
        }

        // Draw hit markers on pierced enemies
        ctx.fillStyle = `rgba(255, 0, 0, ${fadeAlpha * 0.7})`;
        for (const enemyId of this.piercingTargets) {
          const enemy = this.gameEngine.enemies.find(e => e.id === enemyId);
          if (enemy) {
            // Expanding circle effect
            const expandRadius = 10 + (timeSinceShot / this.laserDuration) * 20;
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, expandRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // Regular laser sight (non-piercing)
        ctx.strokeStyle = `rgba(255, 0, 0, ${fadeAlpha * 0.8})`;
        ctx.lineWidth = 2 - (timeSinceShot / this.laserDuration);
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.lastTargetPosition.x, this.lastTargetPosition.y);
        ctx.stroke();

        // Impact point
        ctx.fillStyle = `rgba(255, 100, 0, ${fadeAlpha})`;
        ctx.beginPath();
        ctx.arc(this.lastTargetPosition.x, this.lastTargetPosition.y, 5 + timeSinceShot / 50, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Scope indicator
    if (this.hasHeadshot) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Crosshair
      ctx.moveTo(this.x + this.width / 2 - 10, this.y + this.height / 2);
      ctx.lineTo(this.x + this.width / 2 + 10, this.y + this.height / 2);
      ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2 - 10);
      ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2 + 10);
      ctx.stroke();
    }
  }
}


