// src/component/GameLogic (MVC)/DefenderUnits.js
// Data for different types of Defender Units

/* TODO:
    1.Implement the Animation fields in the main defender class similar to
    the Enemy class.
    2. Fix the bug of long range Enemy attacking not having Attack Animation
    3. Find more asset
*/

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
    this.fireRate = cardData.fireRate || 60;
    this.health = cardData.health || 100;
    this.maxHealth = cardData.health || 100;
    this.cost = cardData.cost || 0;
    this.color = cardData.color || "cyan";
    this.name = cardData.name || "Basic Police";
    this.image = cardData.image;

    //combat properties
    this.fireCountdown = this.fireRate;
    this.lastAttackTime = 0;
    this.isRanged = cardData.isRanged || false;
    this.isAlive = true;
    this.id = Math.random();
    this.isAttacking = false; // ADD THIS: Track attack state for animation

    //status effect
    this.disabled = false;
    this.disabledDuration = 0;

    this.burning = false;
    this.burningDamage = 0;
    this.burningDuration = 0;

    //game engine reference
    this.gameEngine = null;
    this.drawNegativeEffect = new DrawNegativeEffect(this);

    // ADD THESE: Animation properties
    this.currentAnimation = 'idle';
    this.animationFrame = 0;
    this.frameCounter = 0;
    this.animationFrames = null;
    this.animationConfig = null;

    this.isPlayingDeathAnimation = false;
    this.deathAnimationComplete = false;
    this.deathHandled = false;

    this.applyLevelUpgrades();
  }

  // ADD THIS: Animation state management
  setAnimation(animationName) {
    // Add safety check
    if (!this.animationFrames || !animationName) {
      return;
    }

    if (this.currentAnimation !== animationName) {
      console.log(`${this.name} switching animation from ${this.currentAnimation} to ${animationName}`);
      this.currentAnimation = animationName;
      this.animationFrame = 0;
      this.frameCounter = 0;

      if (animationName === 'death') {
        this.isPlayingDeathAnimation = true;
        console.log(`${this.name} started death animation`);

        // Check if we have death animation frames
        if (!this.animationFrames.death || this.animationFrames.death.length === 0) {
          console.warn(`${this.name} has no death animation frames!`);
          this.deathAnimationComplete = true;
        }
      }
    }
  }

  // ADD THIS: Animation frame updates
  updateAnimation() {
    if (!this.animationConfig || !this.animationFrames) {
      // If no animation data, mark death as complete if dead
      if (!this.isAlive && this.currentAnimation === 'death') {
        this.deathAnimationComplete = true;
      }
      return;
    }

    const config = this.animationConfig[this.currentAnimation];
    if (!config) {
      // If no config for current animation, mark death as complete if dead
      if (!this.isAlive && this.currentAnimation === 'death') {
        this.deathAnimationComplete = true;
      }
      return;
    }

    this.frameCounter++;
    const gameFramesPerAnimFrame = Math.floor(60 / config.fps);

    if (this.frameCounter >= gameFramesPerAnimFrame) {
      this.frameCounter = 0;
      this.animationFrame++;

      if (this.animationFrame >= config.frameCount) {
        if (config.loop !== false) {
          this.animationFrame = 0;
          // Reset attack state after attack animation completes
          if (this.currentAnimation === 'attack') {
            this.isAttacking = false;
          }
        } else {
          this.animationFrame = config.frameCount - 1;

          if (this.currentAnimation === 'death') {
            console.log(`${this.name} death animation complete at frame ${this.animationFrame}`);
            this.deathAnimationComplete = true;
          }
        }
      }
    }
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.15;

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = this.health;
    this.range = Math.floor(this.range * statMultiplier);
    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    // Base class has no special abilities
  }

  getUpgradeInfo() {
    return {
      damageIncrease: "+15%",
      healthIncrease: "+15%",
      rangeIncrease: "+15%",
      newAbilities: [],
    };
  }

  // UPDATE THIS METHOD: Add animation state management
  update(enemies, defenderUnits) {
    if (!this.isAlive) {
      if (this.currentAnimation !== 'death') {
        this.setAnimation('death');
      }
      this.updateAnimation();
      return;
    }

    // Determine animation state
    if (this.disabled) {
      this.setAnimation('idle');
    } else if (this.isAttacking) {
      this.setAnimation('attack');
    } else {
      this.setAnimation('idle');
    }

    // Update animation
    this.updateAnimation();
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= (this.fireRate * 1000) / 60;
  }

  // UPDATE THIS METHOD: Set attacking state
  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive) return;

    this.isAttacking = true; // ADD THIS
    target.takeDamage(this.attackDamage);
    this.lastAttackTime = currentTime;
  }

  // REPLACE THE ENTIRE draw METHOD
  draw(ctx) {
    // Draw animation frames if available
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

    // Don't draw UI elements for dead units playing death animation
    if (!this.isAlive && this.isPlayingDeathAnimation && !this.deathAnimationComplete) {
      return;
    }

    // Only draw health bar and name for alive units
    if (this.isAlive) {
      // Unit name text
      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.fillText(
          this.name.substring(0, this.name.length),
          this.x + 2,
          this.y + this.height + 15
      );

      // Health bar
     if (this.health < this.maxHealth) {
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

    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.charAt(0), this.x + 5, this.y + 15);
  }

  takeDamage(amount) {
    console.log(`Damage took ${amount}`);
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true;
    }
    return false;
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

    this.isAttacking = true; // ADD THIS
    const died = target.takeDamage(this.attackDamage, this.hasArmorPiercing);

    if (died && !target.isSpawned && this.gameEngine && !this.gameEngine.gameOver) {
      this.gameEngine.inGameScore += target.bounty;
      this.gameEngine.updateScoreCb(this.gameEngine.inGameScore);
      this.gameEngine.dropManager.handleEnemyDeath(target);
    }

    this.lastAttackTime = currentTime; // ADD THIS
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
    this.healingRange = 100;
    this.healingCountdown = this.healingRate;
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.2; // Healers get 20% increase per level

    this.healingAmount = Math.floor(this.healingAmount * statMultiplier);
    this.healingRange = Math.floor(this.healingRange * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = this.health;
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
    if (!this.isAlive) {
      // Handle death animation
      if (this.animationFrames && this.animationFrames.death) {
        if (this.currentAnimation !== 'death') {
          this.setAnimation('death');
        }
        this.updateAnimation();
      } else {
        this.deathAnimationComplete = true;
      }
      return;
    }

    // Healing Logic
    this.healingCountdown--;
    if (this.healingCountdown <= 0) {
      const unitsToHeal = defenderUnits.filter(
          (unit) =>
              unit.id !== this.id &&
              unit.isAlive &&
              unit.health < unit.maxHealth &&
              Math.hypot(
                  this.x + this.width / 2 - (unit.x + unit.width / 2),
                  this.y + this.height / 2 - (unit.y + unit.height / 2)
              ) <= this.healingRange
      );

      // Group healing special ability
      if (this.hasGroupHeal && unitsToHeal.length > 0) {
        this.isAttacking = true; // Show attack animation when healing
        const toHeal = unitsToHeal.slice(0, 3);
        toHeal.forEach(unit => {
          unit.health = Math.min(unit.maxHealth, unit.health + this.healingAmount);
        });
      } else if (unitsToHeal.length > 0) {
        this.isAttacking = true; // Show attack animation when healing
        unitsToHeal.sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth);
        const targetUnit = unitsToHeal[0];
        targetUnit.health = Math.min(targetUnit.maxHealth, targetUnit.health + this.healingAmount);
      } else {
        this.isAttacking = false; // Not healing anyone
      }

      // Check for resurrection ability
      if (this.hasResurrection && this.canResurrect) {
        console.log(`Healer checking for dead units...`);

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
            this.isAttacking = true; // Show attack animation when resurrecting
            deadUnit.health = Math.floor(deadUnit.maxHealth * 0.2);
            this.canResurrect = false;
            deadUnit.hasBeenResurrected = true;
            console.log("Resurrection successful!");
          }
        }
      }

      this.healingCountdown = this.healingRate;
    }

    // Animation state management
    if (this.animationFrames) {
      if (this.disabled) {
        this.setAnimation('idle');
      } else if (this.isAttacking) {
        this.setAnimation('attack');
      } else {
        this.setAnimation('idle');
      }
      this.updateAnimation();
    }

    // Reset attack state after animation
    if (this.isAttacking && this.healingCountdown < this.healingRate - 10) {
      this.isAttacking = false;
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

    this.isAttacking = true; // ADD THIS

    console.log(`Grenadier has ClusterBomb : ${this.hasClusterBomb} `);
    console.log(`Grenadier has Napalm : ${this.hasNapalm} `);

    if (this.gameEngine) {
      this.gameEngine.addDefenderExplosion(
          target.x + target.width / 2,
          target.y + target.height / 2,
          this.attackDamage,
          this.grenadeRadius,
      );

      // Create visual effect
      this.gameEngine.explosions.push({
                                        x: target.x + target.width / 2,
                                        y: target.y + target.height / 2,
                                        damage: 0,
                                        radius: this.grenadeRadius,
                                        timer: 30,
                                        color: "orange",
                                        innerColor: "yellow",
                                        particleColor: "rgba(255, 200, 0, 0.8)",
                                        style: "burst",
                                        type: "defender",
                                        source: "grenadier",
                                        explodeBy: "grenadier"
                                      });

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
          );
          this.gameEngine.explosions.push({
                                            x: target.x + target.width / 2 + offsetX,
                                            y: target.y + target.height / 2 + offsetY,
                                            damage: 0,
                                            radius: this.grenadeRadius * 0.8,
                                            timer: 25,
                                            color: "orange",
                                            innerColor: "yellow",
                                            particleColor: "rgba(255, 200, 0, 0.8)",
                                            style: "burst",
                                            type: "defender",
                                            source: "grenadier",
                                            explodeBy: "grenadier"
                                          });
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
      health: 1000,
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
  }

  applyLevelUpgrades() {
    const level = this.level;
    const healthMultiplier = 1 + (level - 1) * 0.3; // 30% health increase per level

    this.health = Math.floor(this.health * healthMultiplier);
    this.maxHealth = this.health;
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
    if (!this.isAlive) {
      if (this.currentAnimation !== 'death') {
        this.setAnimation('death');
      }
      this.updateAnimation();
      return;
    }

    // Determine animation state
    if (this.disabled) {
      this.setAnimation('idle');
    } else if (this.isAttacking) {
      this.setAnimation('attack');
    } else {
      this.setAnimation('idle');
    }
    this.updateAnimation();

    if (this.hasSpikes) {
      //deal damage to those who attack on this barricade
      for (const enemy of enemies) {
        const isAttacking = (enemy.isAttacking &&
                             enemy.x + enemy.width >= this.x &&
                             enemy.x <= this.x + this.width &&
                             enemy.y + enemy.height >= this.y &&
                             enemy.y <= this.y + this.height);
        if (isAttacking) {
          //reflect damage back
          const spikeDamage = 0.5; //20% damage reflect
          enemy.takeDamage(spikeDamage, false);

          this.gameEngine.explosions.push({
                                            x: enemy.x + enemy.width / 2,
                                            y: enemy.y + enemy.height / 2,
                                            damage: 0,
                                            radius: 20,
                                            timer: 15,
                                            color: "silver",
                                            innerColor: "gray",
                                            particleColor: "rgba(192, 192, 192, 0.8)",
                                            style: "spike",
                                            type: "effect",
                                            source: "barricade"
                                          });
        }
      }
    }
    if (this.hasElectricField) {
      //stun nearby enemy periodically
      if (!this.electricFieldCooldown) {
        this.electricFieldCooldown = 300;
      }
      this.electricFieldCooldown--;
      if (this.electricFieldCooldown <= 0) {
        const stunRadius = 100;
        for (const enemy of enemies) {
          const distance = Math.hypot(
              enemy.x + enemy.width / 2 - (this.x + this.width / 2),
              enemy.y + enemy.height / 2 - (this.y + this.height / 2));
          if (distance <= stunRadius) {
            enemy.stunned = true;
            enemy.stunnedDuration = 60;
            enemy.takeDamage(5);
          }
        }
        if (this.gameEngine) {
          this.gameEngine.explosions.push({
                                            x: this.x + this.width / 2,
                                            y: this.y + this.height / 2,
                                            damage: 0,
                                            radius: stunRadius,
                                            timer: 20,
                                            color: "yellow",
                                            innerColor: "white",
                                            particleColor: "rgba(255, 255, 0, 0.6)",
                                            style: "electric",
                                            type: "effect",
                                            source: "barricade"
                                          });
        }
        this.electricFieldCooldown = 300;
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    // Spike visual indicator
    if (this.hasSpikes && this.isAlive) {
      ctx.save();
      ctx.strokeStyle = "silver";
      ctx.lineWidth = 2;

      // Draw spikes on the barricade
      const spikeCount = 5;
      for (let i = 0; i < spikeCount; i++) {
        const x = this.x + (this.width / spikeCount) * i + 5;
        ctx.beginPath();
        ctx.moveTo(x, this.y);
        ctx.lineTo(x - 3, this.y - 8);
        ctx.lineTo(x + 3, this.y - 8);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Electric field visual
    if (this.hasElectricField && this.isAlive) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          100,
          0,
          Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }
}

//TODO: Auto collect no working
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
  }

  applyLevelUpgrades() {
    const level = this.level;
    this.energyDropAmount = this.energyDropAmount + (level - 1);
  }

  applySpecialAbilities() {
    this.hasEnergyBurst = false;
    this.autoCollect = false;

    if (this.level >= 3) {
      this.hasEnergyBurst = true;
    }
    if (this.level >= 5) {
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
    if (!this.isAlive) {
      // Handle death animation
      if (this.animationFrames && this.animationFrames.death) {
        if (this.currentAnimation !== 'death') {
          this.setAnimation('death');
        }
        this.updateAnimation();
      } else {
        this.deathAnimationComplete = true;
      }
      return;
    }

    if (this.hasEnergyBurst) {
      if (!this.energyBurstCooldown) {
        this.energyBurstCooldown = 600;
      }
      this.energyBurstCooldown--;
      if (this.energyBurstCooldown <= 0 && this.gameEngine) {
        //generate 3x energy in a burst
        for (let i = 0; i < 3; i++) {
          const offsetX = (Math.random() - 0.5) * 100;
          const offsetY = (Math.random() - 0.5) * 100;
          this.gameEngine.dropEnergy(
              this.x + this.width / 2 + offsetX,
              this.y + this.height / 2 + offsetY,
              this.energyDropAmount
          );
        }
        this.energyBurstCooldown = 600;
      }
    }
    if (this.autoCollect && this.gameEngine) {
      const collectRadius = 150;
      for (let i = this.gameEngine.energyDrops.length - 1; i >= 0; i--) {
        const drop = this.gameEngine.energyDrops[i];
        const distance = Math.hypot(
            drop.x - (this.x + this.width / 2),
            drop.y - (this.y + this.height / 2)
        );
        if (distance <= collectRadius) {
          //auto-collect energy
          drop.startCollectionAnimation(110, 20);
          this.gameEngine.inGameEnergy = Math.min(100, this.gameEngine.inGameEnergy + drop.amount);
          this.gameEngine.updateEnergyCb(this.gameEngine.inGameEnergy);
          // Remove collected drop
          this.gameEngine.energyDrops.splice(i, 1);
        }
      }
    }
    // Energy drop logic
    this.energyDropCountDown--;
    if (this.energyDropCountDown <= 0) {
      if (this.gameEngine) {
        // Play "attack" animation when generating energy
        this.isAttacking = true;

        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        this.gameEngine.dropEnergy(
            this.x + this.width / 2 + offsetX,
            this.y + this.height / 2 + offsetY,
            this.energyDropAmount
        );
      }
      this.energyDropCountDown = this.energyDropRate;
    }

    // Animation state management
    if (this.animationFrames) {
      if (this.isAttacking) {
        this.setAnimation('attack');
      } else {
        this.setAnimation('idle');
      }
      this.updateAnimation();
    }

    // Reset attack animation after a short time
    if (this.isAttacking && this.energyDropCountDown > this.energyDropRate - 30) {
      this.isAttacking = false;
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Energy burst indicator
    if (this.hasEnergyBurst && this.energyBurstCooldown && this.isAlive) {
      const progress = 1 - (this.energyBurstCooldown / 600);
      ctx.strokeStyle = "gold";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.width / 2 + 10,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * progress)
      );
      ctx.stroke();
    }

    // Auto-collect field visual
    if (this.autoCollect && this.isAlive) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.2 + Math.sin(Date.now() / 300) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width / 2,
          this.y + this.height / 2,
          150,
          0,
          Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }

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

    this.isAttacking = true; // ADD THIS

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
        );

      //visual affect
      this.gameEngine.explosions.push({
                                        x: target.x + target.width / 2,
                                        y: target.y + target.height / 2,
                                        damage: 0,
                                        radius: 200,
                                        timer: 30,
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

export class Mortar extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeData = {
      name: "Mortar",
      damage: 120,        // Increased from 80
      health: 100,
      range: 700,
      fireRate: 360,
      cost: 120,
      width: 45,
      height: 50,
      color: "darkgray",
      isRanged: true,
      level: cardData.level || 1,
      image: cardData.image,
    };
    super(x, y, typeData);

    // Mortar-specific properties
    this.minimumRange = 250;     // Increased from 150
    this.explosionRadius = 150;   // Increased from 100
    this.shellTravelTime = 200;  // 1.5 seconds for shell to land
    this.pendingShells = [];      // Track shells in flight

    // Visual properties
    this.showRangeIndicators = false;
    this.lastFireAngle = 0;
    this.barrelRecoil = 0;

    //targeting system
    this.currentTarget = null;
    this.nextTarget = null;
    this.targetLockTime = 0;

    this.attackAnimationLock = 0;
    this.attackAnimationDuration = 60;
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.2; // 20% increase per level

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = Math.floor(this.maxHealth * statMultiplier);
    this.explosionRadius = Math.floor(this.explosionRadius * (1 + (level - 1) * 0.15)); // 15% radius increase

    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    this.hasImprovedFuses = false;
    this.hasClusterShells = false;
    this.hasSiegeMode = false;

    if (this.level >= 3) {
      this.hasImprovedFuses = true;
      this.minimumRange = Math.floor(this.minimumRange * 0.7); // 30% reduction
      this.shellTravelTime = 75; // Faster shells
    }
    if (this.level >= 5) {
      this.hasSiegeMode = true;
      this.hasClusterShells = true;
      this.range = Math.floor(this.range * 1.3); // 30% range increase
      this.explosionRadius = Math.floor(this.explosionRadius * 1.2); // Extra 20% radius at level 5
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Improved Fuses - Reduced minimum range (Level 3)");
    if (this.level === 4) newAbilities.push("Siege Mode - Cluster shells & increased range (Level 5)");

    return {
      ...base,
      damageIncrease: "+20%",
      explosionRadius: "+15%",
      newAbilities
    };
  }

  // Check if an enemy is in valid attack range
  isValidTarget(enemy) {
    if (!enemy || !enemy.isAlive) return false;

    const distance = Math.hypot(
        enemy.x + enemy.width/2 - (this.x + this.width/2),
        enemy.y + enemy.height/2 - (this.y + this.height/2)
    );

    return distance >= this.minimumRange && distance <= this.range;
  }

  // Find the best target (closest valid enemy)
  findBestTarget(enemies) {
    let bestTarget = null;
    let highestPriority = -1;
    for (const enemy of enemies) {
      if (!this.isValidTarget(enemy)) continue;

      const distance = Math.hypot(
          enemy.x + enemy.width / 2 - (this.x + this.width / 2),
          enemy.y + enemy.height / 2 - (this.y + this.height / 2)
      );

      //prioritize base on threat level and distance
      const priority = (enemy.health / enemy.maxHealth) * 100 +
                       (1 - distance / this.range) * 50 +
                       (enemy.attackDamage || 0);
      if (priority > highestPriority) {
        highestPriority = priority;
        bestTarget = enemy;
      }
    }
    return bestTarget;
  }

  canAttack(currentTime) {
    //override to check if the target is valid
    if (!super.canAttack(currentTime)) return false;

    //chekc if there are valid tarhet
    if (this.gameEngine) {
      this.nextTarget = this.findBestTarget(this.gameEngine.enemies);
      return this.nextTarget !== null;
    }
    return false;
  }

  update(enemies, defenderUnits) {
    if (!this.isAlive) {
      // Handle death animation
      if (this.animationFrames && this.animationFrames.death) {
        if (this.currentAnimation !== 'death') {
          this.setAnimation('death');
        }
        this.updateAnimation();
      } else {
        this.deathAnimationComplete = true;
      }
      return;
    }

    // Update barrel recoil animation
    if (this.barrelRecoil > 0) {
      this.barrelRecoil -= 0.5;
    }

    // Update target lock visual
    if (this.targetLockTime > 0) {
      this.targetLockTime--;
    }

    // Process pending shells
    this.pendingShells = this.pendingShells.filter(shell => {
      if (!shell.fired && this.targetLockTime <= 0) {
        shell.fired = true;
        shell.currentY = -100;
      }
      if (shell.fired) {
        shell.timeRemaining--;

        if (shell.target && shell.target.isAlive) {
          shell.targetX = shell.target.x + shell.target.width / 2;
          shell.targetY = shell.target.y + shell.target.height / 2;
        }

        const progress = 1 - (shell.timeRemaining / this.shellTravelTime);
        const arcHeight = 300;

        shell.currentX = shell.startX + (shell.targetX - shell.startX) * progress;
        shell.currentY = shell.startY + (shell.targetY - shell.startY) * progress
                         - arcHeight * 4 * progress * (1 - progress);

        if (shell.timeRemaining <= 0) {
          this.createExplosion(shell.targetX, shell.targetY);
          return false;
        }
      }
      return true;
    });

    // Clear current target if dead or out of range
    if (this.currentTarget && (!this.currentTarget.isAlive || !this.isValidTarget(this.currentTarget))) {
      this.currentTarget = null;
    }

    // Animation state management - FIX: Keep attack animation playing during lock
    if (this.animationFrames) {
      if (this.attackAnimationLock > 0) {
        this.setAnimation('attack');
      } else if (this.disabled) {
        this.setAnimation('idle');
      } else {
        this.setAnimation('idle');
      }
      this.updateAnimation();
    }

    // Reset attack animation after firing
    if (this.isAttacking && this.attackAnimationLock <= 0) {
      this.isAttacking = false;
    }
  }

  attack(target, currentTime) {
    const actualTarget = this.nextTarget || target;

    if (!this.isAlive || !actualTarget || !actualTarget.isAlive) return;

    if (!this.isValidTarget(actualTarget)) {
      console.log("Mortar: Target too close or too far");
      return;
    }

    this.isAttacking = true; // ADD THIS
    // FIX: Set animation lock to keep attack animation playing
    this.attackAnimationLock = this.attackAnimationDuration;

    // Lock onto target
    this.currentTarget = actualTarget;
    this.targetLockTime = 30;

    // Calculate angle for visual effect
    this.lastFireAngle = Math.atan2(
        actualTarget.y + actualTarget.height / 2 - (this.y + this.height / 2),
        actualTarget.x + actualTarget.width / 2 - (this.x + this.width / 2)
    );

    // Add barrel recoil effect
    this.barrelRecoil = 10;

    // Add shell to pending
    this.pendingShells.push({
                              target: actualTarget,
                              targetX: actualTarget.x + actualTarget.width / 2,
                              targetY: actualTarget.y + actualTarget.height / 2,
                              timeRemaining: this.shellTravelTime,
                              startX: this.x + this.width / 2,
                              startY: this.y + this.height / 2,
                              currentX: this.x + this.width/2,
                              currentY: this.y + this.height/2,
                              fired: false
                            });

    this.lastAttackTime = currentTime;
  }

  createExplosion(x, y) {
    if (!this.gameEngine) return;

    // Main explosion with increased damage and radius
    this.gameEngine.addDefenderExplosion(
        x,
        y,
        this.attackDamage,
        this.explosionRadius,
    );
    // Enhanced visual effect
    this.gameEngine.explosions.push({
                                      x: x,
                                      y: y,
                                      damage: 0,
                                      radius: this.explosionRadius,
                                      timer: 30,
                                      color: "orange",
                                      innerColor: "yellow",
                                      particleColor: "rgba(255, 200, 0, 0.9)",
                                      style: "burst",
                                      type: "defender",
                                      source: "mortar",
                                      explodeBy: "mortar"
                                    });
    // Cluster shells at level 5
    if (this.hasClusterShells) {
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * 2 * i) / 4;
        const offsetX = Math.cos(angle) * 60;  // Slightly larger spread
        const offsetY = Math.sin(angle) * 60;

        setTimeout(() => {
          if (this.gameEngine) {
            this.gameEngine.addDefenderExplosion(
                x + offsetX,
                y + offsetY,
                this.attackDamage * 0.5,
                this.explosionRadius * 0.6,
            );
            this.gameEngine.explosions.push({
                                              x: x,
                                              y: y,
                                              damage: 0,
                                              radius: this.explosionRadius,
                                              timer: 30,
                                              color: "orange",
                                              innerColor: "yellow",
                                              particleColor: "rgba(255, 200, 0, 0.9)",
                                              style: "burst",
                                              type: "defender",
                                              source: "mortar",
                                              explodeBy: "mortar"
                                            });
          }
        }, 200 + i * 100);
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);

    // Draw range indicators
    this.drawRangeIndicators(ctx);

    // Draw barrel with recoil
    this.drawBarrel(ctx);

    // Draw targeting system
    this.drawTargetingSystem(ctx);

    // Draw shells in flight
    this.drawShells(ctx);
  }

  drawRangeIndicators(ctx) {
    // Show ranges when hovering or during cooldown
    if (this.showRangeIndicators || this.fireCountdown > this.fireRate - 60) {
      ctx.save();

      // Dead zone (minimum range) - red with pattern
      ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
      ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width/2,
          this.y + this.height/2,
          this.minimumRange,
          0,
          Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Label for dead zone
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("DEAD ZONE", this.x + this.width/2, this.y + this.height/2 - this.minimumRange - 10);

      // Maximum range - green
      ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(
          this.x + this.width/2,
          this.y + this.height/2,
          this.range,
          0,
          Math.PI * 2
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  drawBarrel(ctx) {
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);

    if (this.lastFireAngle !== 0) {
      ctx.rotate(this.lastFireAngle);
    }

    // Barrel with recoil
    const barrelLength = 35 - this.barrelRecoil;
    ctx.fillStyle = "#444";
    ctx.fillRect(5, -6, barrelLength, 12);

    // Barrel end
    ctx.fillStyle = "#222";
    ctx.fillRect(barrelLength + 5, -8, 5, 16);

    ctx.restore();
  }

  drawTargetingSystem(ctx) {
    // Draw targeting on current target
    if (this.currentTarget && this.currentTarget.isAlive && this.targetLockTime > 0) {
      const targetX = this.currentTarget.x + this.currentTarget.width/2;
      const targetY = this.currentTarget.y + this.currentTarget.height/2;

      ctx.save();

      // Pulsing effect
      const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;

      // Target reticle
      ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.lineWidth = 3;

      // Outer circle
      ctx.beginPath();
      ctx.arc(targetX, targetY, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      const crossSize = 50;
      ctx.beginPath();
      ctx.moveTo(targetX - crossSize, targetY);
      ctx.lineTo(targetX - 20, targetY);
      ctx.moveTo(targetX + 20, targetY);
      ctx.lineTo(targetX + crossSize, targetY);
      ctx.moveTo(targetX, targetY - crossSize);
      ctx.lineTo(targetX, targetY - 20);
      ctx.moveTo(targetX, targetY + 20);
      ctx.lineTo(targetX, targetY + crossSize);
      ctx.stroke();

      // Target lock text
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("LOCKED", targetX, targetY - 60);

      ctx.restore();
    }
  }

  drawShells(ctx) {
    for (const shell of this.pendingShells) {
      if (!shell.fired) continue;

      // Update target position for moving enemies
      const targetX = shell.target && shell.target.isAlive ?
                      shell.target.x + shell.target.width / 2 : shell.targetX;
      const targetY = shell.target && shell.target.isAlive ?
                      shell.target.y + shell.target.height / 2 : shell.targetY;

      // Draw target marker that follows enemy
      ctx.save();

      // Target circle on ground
      const progress = 1 - (shell.timeRemaining / this.shellTravelTime);
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + progress * 0.5})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = -Date.now() / 50;

      ctx.beginPath();
      ctx.arc(targetX, targetY, 30, 0, Math.PI * 2);
      ctx.stroke();

      // X mark
      const markSize = 20;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(targetX - markSize, targetY - markSize);
      ctx.lineTo(targetX + markSize, targetY + markSize);
      ctx.moveTo(targetX + markSize, targetY - markSize);
      ctx.lineTo(targetX - markSize, targetY + markSize);
      ctx.stroke();

      // Impact zone preview
      ctx.fillStyle = `rgba(255, 165, 0, ${0.1 + progress * 0.2})`;
      ctx.beginPath();
      ctx.arc(targetX, targetY, this.explosionRadius * progress, 0, Math.PI * 2);
      ctx.fill();

      // Draw shell in air
      if (shell.currentY < shell.targetY - 50) { // Only draw if high enough
        // Shell trail
        const trailLength = 5;
        const gradient = ctx.createLinearGradient(
            shell.currentX, shell.currentY,
            shell.currentX, shell.currentY + trailLength * 10
        );
        gradient.addColorStop(0, "rgba(100, 100, 100, 0.8)");
        gradient.addColorStop(1, "rgba(100, 100, 100, 0)");

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shell.currentX, shell.currentY);
        ctx.lineTo(shell.currentX, shell.currentY + trailLength * 10);
        ctx.stroke();

        // Shell body
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(shell.currentX, shell.currentY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Shell tip
        ctx.fillStyle = "#ff6600";
        ctx.beginPath();
        ctx.arc(shell.currentX, shell.currentY - 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

export class FrostArcher extends DefenderUnit {
  constructor(x, y, cardData) {
    const typeData = {
      name: "Frost Archer",
      damage: 2,        // Increased from 80
      health: 90,
      range: 250,
      fireRate: 75,
      cost: 35,
      width: 30,
      height: 40,
      color: "lightblue",
      isRanged: true,
      level: cardData.level || 1,
      image: cardData.image,
    }
    super(x, y, typeData);

    this.slowAmount = 0.5; //50%
    this.slowDuration = 120; //2 sec
    this.freezeChance = 0.1; //10%
    this.freezeDuration = 60; //1 sec
  }

  applyLevelUpgrades() {
    const level = this.level;
    const statMultiplier = 1 + (level - 1) * 0.15; //15%

    this.attackDamage = Math.floor(this.attackDamage * statMultiplier);
    this.health = Math.floor(this.health * statMultiplier);
    this.maxHealth = this.health;
    this.range = Math.floor(this.range * statMultiplier);

    this.freezeChance = Math.min(0.5, 0.1 + (level - 1) * 0.08); // Up to 50% freeze chance
    this.applySpecialAbilities();
  }

  applySpecialAbilities() {
    this.hasPermaFrost = false;
    this.hasIceShards = false;

    if (this.level >= 3) {
      this.hasPermaFrost = true; //slowed enemy took extra damage
    }
    if (this.level >= 5) {
      this.hasIceShards = true; //explosion upon death froze enemy
    }
  }

  attack(target, currentTime) {
    if (!this.isAlive || !target || !target.isAlive || !this.gameEngine) return;

    this.isAttacking = true;

    //frost projectile
    const projectile = {
      startX: this.x + this.width / 2,
      startY: this.y + this.height / 2,
      target: target,
      damage: this.attackDamage,
      speed: 8,
      color: "lightblue",
      trail: [],
      onHit: () => this.onProjectileHit(target)
    };
    this.gameEngine.projectiles.push(projectile);
    this.lastAttackTime = currentTime;
  }

  onProjectileHit(enemy) {
    if (!enemy || !enemy.isAlive) return;

    //apply damage
    const extraDamage = (this.hasPermaFrost && enemy.slowed) ? this.attackDamage * 0.5 : 0;
    const died = enemy.takeDamage(this.attackDamage + extraDamage, false);

    //apply slow effect
    if (!enemy.frozen) {
      enemy.slowed = true;
      enemy.slowDuration = this.slowDuration;
    }

    //check for freeze
    if (Math.random() < this.freezeChance) {
      enemy.frozen = true;
      enemy.frozenDuration = this.freezeDuration;

      // Visual effect
      if (this.gameEngine) {
        this.gameEngine.explosions.push({
                                          x: enemy.x + enemy.width / 2,
                                          y: enemy.y + enemy.height / 2,
                                          damage: 0,
                                          radius: 40,
                                          timer: 20,
                                          color: "lightblue",
                                          innerColor: "white",
                                          particleColor: "rgba(173, 216, 230, 0.9)",
                                          style: "freeze",
                                          type: "effect",
                                          source: "frost_archer"
                                        });
      }
    }
    //ice shard explosion on enemy death
    if (died && this.hasIceShards && enemy.frozen && this.gameEngine) {
      this.gameEngine.addDefenderExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          this.attackDamage,
          100
      );
      for (const enemy of this.gameEngine.enemies) {
        const distance = Math.hypot(enemy.x + enemy.width / 2,
                                    enemy.y + enemy.height / 2);
        if (distance <= 100) {
          enemy.slowed = true;
          enemy.slowDuration = this.slowDuration
        }
      }
      this.gameEngine.explosions.push({
                                        x: enemy.x + enemy.width / 2,
                                        y: enemy.y + enemy.height / 2,
                                        damage: 0,
                                        radius: 100,
                                        timer: 30,
                                        color: "lightblue",
                                        innerColor: "white",
                                        particleColor: "rgba(135, 206, 235, 0.9)",
                                        style: "ice_shatter",
                                        type: "defender",
                                        source: "frost_archer"
                                      });
    }
  }

  getUpgradeInfo() {
    const base = super.getUpgradeInfo();
    const newAbilities = [];

    if (this.level === 2) newAbilities.push("Permafrost & Pierce (Level 3)");
    if (this.level === 4) newAbilities.push("Ice Shards (Level 5)");

    return { ...base, slowEffect: `${Math.round((1-this.slowAmount)*100)}% slow`, newAbilities };
  }
}



