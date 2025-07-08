// This file serves as the Model (game state, entities) and Controller (game logic, updates)

class Enermy {
  constructor(x, y, typeData = {}) {
    this.x = x;
    this.y = y;
    this.width = typeData.width || 30;
    this.height = typeData.height || 30;
    this.speed = typeData.speed || 0.8;
    this.health = typeData.health || 100;
    this.maxHealth = typeData.health || 100;
    this.color = typeData.color || "darkgreen";
    this.name = typeData.name || "Basic Zombie";
    this.isAlive = true;
    this.id = Math.random();
    this.image = typeData.image; //placeholder, but pixel style should also be an image
    this.bounty = typeData.bounty || 10; //how much reward when killing an enermy
  }

  /**
   * Movement Path
   */
  update(defenderUnits) {
    //enermy need to know abt defender for collosion/attack
    if (this.isAlive) {
      this.x += this.speed;
    }
    // TODO: Collision detection with defenders (if zombies stop/attack defenders)
    // For now, they just pass through if no collision logic is implemented
  }

  draw(ctx) {
    if (!this.isAlive) return;

    if (this.image) {
      //draw the image if available
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
    }
    return false; //inidicating that enermy did not die
  }

  activateSpecialAbility(gameEntities) {
    //default does not have any but can be overriden
  }
}

class FastEnermy extends Enermy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Fast Zombie",
      speed: 1.5, //faster
      health: 80, //less health
      color: "darkorange",
      width: 25,
      height: 25,
      image: image,
      bounty: 15,
    });
  }
}

class TankEnermy extends Enermy {
  constructor(x, y, image) {
    super(x, y, {
      name: "Tank Zombie",
      speed: 0.5, //slower
      health: 400,
      width: 40,
      height: 40,
      color: "darkred",
      image: image,
      bounty: 30,
    });
    this.raged = false;
    this.rageThreshold = 0.5; // Rage when health drops below 50%
    this.rageSpeedMultiplier = 2.0; // Double speed when raged
    this.rageDamageMultiplier = 1.5; // 50% more attack damage when raged (if zombies attack defenders)
  }

  takeDamage(amount) {
    //50% reduction always
    const actualDamage = amount * 0.5;
    const died = super.takeDamage(actualDamage); // Call parent takeDamage with reduced amount

    if (
      this.isAlive &&
      !this.raged &&
      this.health / this.maxHealth <= this.rageThreshold
    ) {
      this.speed *= this.rageSpeedMultiplier;
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
    });
    this.explosionRadius = 100;
    this.explosionDamage = 200;
    this.shouldExplode = false; // Flag to tell GameEngine to handle explosion
  }

  //explode on death
  takeDamage(amount) {
    const died = super.takeDamage(amount);
    if (died) {
      this.shouldExplode = true; //mark for explosion
    }
    return died;
  }

  activateSpecialAbility(defenders) {
    if (!this.isAlive && !this.shouldExplode) return; //already explode or not active
    //If close then explode
    const nearestDefender = defenders.find(
      (defender) =>
        defender.isAlive &&
        Math.hypot(this.x - defender.x, this.y - defender.y) <
          this.explosionRadius
    );
    if (nearestDefender) {
      console.log(`${this.name} self-destructs near a defender!`);
      this.shouldExplode = true;
      this.isAlive = false;
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

class DefenderUnit {
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
    this.health = cardData.health || 100; //current health
    this.maxHealth = cardData.health || 100; // Store max health for healing
    this.isAlive = true;
    this.id = Math.random();
    this.color = cardData.color || "cyan"; // Base color, can be overridden by cardData
    this.name = cardData.name || "Basic Police"; //for drawing/debug
    this.image = cardData.image;
    this.cost = cardData.cost || 0; //cost to deploy
  }

  //default logic for all
  //handles basic attack
  update(enermy, defenderUnits) {
    //accepts all defenderUnit for future self-healing/buffing
    if (!this.isAlive) return;
    // Handle basic attack logic if the unit has attack damage and range
    if (this.attackDamage > 0 && this.range > 0) {
      this.fireCountdown--;
      if (this.fireCountdown <= 0) {
        const target = enermy.find(
          (z) =>
            z.isAlive && Math.hypot(this.x - z.x, this.y - z.y) <= this.range
        );
        if (target) {
          target.takeDamage(this.attackDamage);
          this.fireCountdown = this.fireRate;

          //might add projectile logic here if not instant hit
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

    //Unit name text
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
      return true; //indicate defender die
    }
    return false; //indicate defender alive
  }

  // Generic method for special abilities. Subclasses will override this.
  // The GameEngine's update loop will call this on relevant units.
  activateSpecialAbility(allGameEntities) {
    // Pass all entities for flexibility
    // Default: no special ability or ability that requires no specific targets
  }
}

class BasicDefender extends DefenderUnit {
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

class HealerDefender extends DefenderUnit {
  constructor(x, y, cardData) {
    super(x, y, {
      ...cardData,
      name: "Healer Cop",
      damage: cardData.damage || 5,
      health: cardData.health || 100,
      range: cardData.range || 100,
      firerate: cardData.fireRate || 90,
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

  update(enermy, defenderUnits) {
    super.update(enermy, defenderUnits);

    //Healing Logic
    this.healingCountdown--;
    if (this.healingCountdown <= 0) {
      // Find friendly units in healing range that need healing
      const unitsToHeal = defenderUnits.filter(
        (unit) =>
          unit.id != this.id && //no self
          unit.isAlive &&
          unit.health < unit.maxHealth &&
          Math.hypot(this.x - unit.x, this.y - unit.y) <= this.healingRange //in range
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
    if (this.healingCountDown <= 20 && this.healingCountdown > 0) {
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

class GrenadeDefender extends DefenderUnit {
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
    this.grenadeCountDown = this.fireRate;
  }

  update(enermy, defenderUnits) {
    // No super.update(zombies) for direct attack, as they primarily throw grenades.
    super.update(enermies, defenderUnits); // Still call to allow for future base class updates

    this.grenadeCountDown--;
    if (this.grenadeCountDown <= 0) {
      const target = enermy.find(
        (z) => z.isAlive && Math.hypot(this.x - z.x, this.y - z.y) <= this.range
      );
      if (target) {
        if (this.gameEngine) {
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

//No damage, high health, static
class BarricadeDefender extends DefenderUnit {
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

  update(enermy, defenderUnits) {
    // Barricades don't attack or move. Their main interaction is absorbing damage.
    // Collision with zombies would be handled by GameEngine's zombie movement logic
    // (e.g., zombies stop when they hit a barricade).
  }

  draw(ctx) {
    super.draw(ctx);
    //super.draw also handles image
  }
}

export class GameEngine {
  constructor(updateEnergyCb, updateScoreCb, onWinCb, onLoseCb) {
    this.ctx = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.animationFrameId = null;

    this.updateEnergyCb = updateEnergyCb;
    this.updateScoreCb = updateScoreCb;
    this.onWinCb = onWinCb;
    this.onLoseCb = onLoseCb;

    this.enermy = [];
    this.defender = [];
    this.inGameEnergy = 100;
    this.inGameScore = 0;
    this.lastEnermySpawnTime = 0;
    this.enemiesSpawnedThisLevel = 0; // Track how many enemies have been spawned
    this.gameOver = false;
    this.defenseLineX = 0;

    // Map of card types/names to their respective DefenderUnit classes
    this.defenderUnitClasses = {
      "Basic Cop": BasicDefender,
      "Healer Cop": HealerDefender,
      Grenadier: GrenadeDefender,
      Barricade: BarricadeDefender,
      //add more
    };

    this.eneryClasses = {
      "Basic Zombie": Enermy,
      "Fast Zombie": FastEnermy,
      "Tank Zombie": TankEnermy,
      Exploder: BombEnermy,
      // Add more enemy types here
    };

    this.explosions = []; // To manage visual/damage explosions

    this.currentLevelConfig = null;
    this.levelConfigs = new Map(); //a map to store all levels

    // Example Level Data (should ideally come from backend)
    // Backend Placeholder: In a full game, these level configurations
    // would be loaded from a backend API when the player selects a level.
    this.levelConfigs.set(1, {
      zombieSpawnInterval: 2500,
      maxActiveEnermy: 5,
      totalEnermyToSpawn: 15,
      availableEnermyType: ["Basic Zombie", "Fast Zombie"],
      initialEnergy: 100,
      // Frontend asset paths for enemies in this level (could also be from backend)
      enermyAssets: {
        enemyAssets: {
          "Basic Zombie": "image link path",
          "Fast Zombie": "image link path",
        },
        // Frontend asset paths for defenders (loaded once, passed to cards)
        defenderAssets: {
          // This would be more global than per-level, but illustrates the point
          "Basic Cop": "image link path",
          "Healer Cop": "image link path",
          Grenadier: "image link path",
          Barricade: "image link path",
        },
      },
    });
    //add more levels

    this.loadedImages = {};
    this.imagesToLoadCount = 0;
    this.imagesLoadedCount = 0;
  }

  //placeholder for backend
  preloadedImage() {}

  isImageLoaded() {
    return this.imagesLoadedCount === this.imagesToLoadCount;
  }

  getImage(name) {
    return this.loadedImages[name];
  }

  initialize(ctx, width, height, levelNumber) {
    this.ctx = ctx;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.defenseLineX = this.canvasWidth - 100;

    this.ctx.canvas.removeEventListener("click", this.handleClickBound); // Remove old listener
    this.handleClickBound = this.handleClick.bind(this);
    this.ctx.canvas.addEventListener("click", this.handleClickBound);

    // Load the configuration for the selected level
    this.currentLevelConfig = this.levelConfigs.get(levelNumber);
    if (!this.currentLevelConfig) {
      console.error();
      this.currentLevelConfig = this.levelConfigs.get(1);
    }
    //reset game? with new state
    this.resetGame();
  }

  resetGame() {
    this.enermy = [];
    this.defender = [];
    this.explosions = [];
    this.inGameEnergy = this.currentLevelConfig.initialEnergy; // Use level-specific initial energy
    this.inGameScore = 0;
    this.gameOver = false;
    this.lastEnermySpawnTime = Date.now();
    this.totalEnermyToSpawn = 0; //reset for new level
    this.updateEnergyCb(this.inGameEnergy);
    this.updateScoreCb(this.inGameScore);
    this.startLoop();
  }

  handleClick(event) {}

  //Method to be called by React UI when a card is deployed
  deployDefenderUnit(cardData) {}

  update() {}

  draw() {}

  addExplosion() {}

  gameLoop = () => {};

  startLoop() {}

  stopLoop() {}
}
