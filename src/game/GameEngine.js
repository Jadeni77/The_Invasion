// This file serves as the Model (game state, entities) and Controller (game logic, updates)

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

    this.enermies = []; // Corrected: enermy -> enermies for consistency with usage
    this.defenders = []; // Corrected: defender -> defenders for consistency
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
      // Add more
    };

    this.enemyClasses = {
      // Corrected: eneryClasses -> enemyClasses
      "Basic Zombie": Enermy,
      "Fast Zombie": FastEnermy,
      "Tank Zombie": TankEnermy,
      Exploder: BombEnermy,
      // Add more enemy types here
    };

    this.explosions = []; // To manage visual/damage explosions

    this.currentLevelConfig = null;
    this.levelConfigs = new Map(); // A map to store all levels

    // Example Level Data (should ideally come from backend)
    this.levelConfigs.set(1, {
      levelNumber: 1, // Added levelNumber
      enemySpawnInterval: 2500, // Corrected: enermySpawnInterval -> enemySpawnInterval
      maxActiveEnemies: 5, // Corrected: maxActiveEnermy -> maxActiveEnemies
      totalEnemiesToSpawn: 15, // Corrected: totalEnermyToSpawn -> totalEnemiesToSpawn
      availableEnemyTypes: ["Basic Zombie", "Fast Zombie"], // Corrected: availableEnermyType -> availableEnemyTypes
      initialEnergy: 100,
      enemyAssets: {
        // Corrected: enermyAssets -> enemyAssets
        "Basic Zombie": "/assets/images/enemies/basic_zombie.png", // Example path
        "Fast Zombie": "/assets/images/enemies/fast_zombie.png", // Example path
      },
      defenderAssets: {
        "Basic Cop": "/assets/images/defenders/basic_cop.png", // Example path
        "Healer Cop": "/assets/images/defenders/healer_cop.png",
        Grenadier: "/assets/images/defenders/grenadier.png",
        Barricade: "/assets/images/defenders/barricade.png",
      },
    });
    this.levelConfigs.set(2, {
      levelNumber: 2,
      enemySpawnInterval: 2000,
      maxActiveEnemies: 7,
      totalEnemiesToSpawn: 20,
      availableEnemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie"],
      initialEnergy: 120,
      enemyAssets: {
        "Basic Zombie": "/assets/images/enemies/basic_zombie.png",
        "Fast Zombie": "/assets/images/enemies/fast_zombie.png",
        "Tank Zombie": "/assets/images/enemies/tank_zombie.png",
      },
      defenderAssets: {
        "Basic Cop": "/assets/images/defenders/basic_cop.png",
        "Healer Cop": "/assets/images/defenders/healer_cop.png",
        Grenadier: "/assets/images/defenders/grenadier.png",
        Barricade: "/assets/images/defenders/barricade.png",
      },
    });
    // Add more levels here, ensuring each has a 'levelNumber' property

    this.loadedImages = {};
    this.imagesToLoadCount = 0;
    this.imagesLoadedCount = 0;
  }

  // Placeholder for backend: Image URLs for units/enemies should come from the backend
  // as part of card data or level data.
  preloadedImage(imagePaths) {
    this.imagesToLoadCount = Object.keys(imagePaths).length;
    this.imagesLoadedCount = 0;
    const promises = [];

    for (const name in imagePaths) {
      const path = imagePaths[name];
      const img = new Image();
      img.src = path;
      this.loadedImages[name] = img; // Store image object for later use

      const promise = new Promise((resolve, reject) => {
        img.onload = () => {
          this.imagesLoadedCount++;
          resolve();
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${path}`);
          reject(new Error(`Failed to load image: ${path}`));
        };
      });
      promises.push(promise);
    }
    return Promise.all(promises); // Return a promise that resolves when all images are loaded
  }

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

    // Attach click listener only once
    if (!this.handleClickBound) {
      this.handleClickBound = this.handleClick.bind(this);
      this.ctx.canvas.addEventListener("click", this.handleClickBound);
    }

    // Load the configuration for the selected level
    this.currentLevelConfig = this.levelConfigs.get(levelNumber);
    if (!this.currentLevelConfig) {
      console.error(
        `Level configuration for level ${levelNumber} not found. Defaulting to level 1.`
      );
      this.currentLevelConfig = this.levelConfigs.get(1);
      // Ensure levelNumber is correctly set even if defaulting
      if (this.currentLevelConfig) {
        this.currentLevelConfig.levelNumber = 1; // Corrected from + 1
      }
    }
    // IMPORTANT: Ensure the levelNumber property is explicitly set on currentLevelConfig
    // if it wasn't already loaded from the config map (it should be now with above changes)
    if (!this.currentLevelConfig.levelNumber) {
      this.currentLevelConfig.levelNumber = levelNumber;
    }

    // Preload all necessary images for the current level
    const allImagesToLoad = {
      ...this.currentLevelConfig.enemyAssets, // Corrected property name
      ...this.currentLevelConfig.defenderAssets,
    };

    // Before starting the game, ensure images are loaded.
    this.preloadedImage(allImagesToLoad)
      .then(() => {
        console.log("All game assets loaded.");
        this.resetGame(); // Reset and prepare game state
        this.startLoop(); // Start the game loop only after all assets are ready
      })
      .catch((error) => {
        console.error("Error preloading game assets:", error);
        this.gameOver = true; // Prevent game from starting if assets fail to load
      });
  }

  resetGame() {
    this.stopLoop(); // Stop any active loop
    this.enermies = []; // Reset enemy array
    this.defenders = []; // Reset defender array
    this.explosions = []; // Clear explosions
    this.inGameEnergy = this.currentLevelConfig.initialEnergy; // Use level-specific initial energy
    this.inGameScore = 0;
    this.gameOver = false;
    this.lastEnermySpawnTime = 0;
    this.enemiesSpawnedThisLevel = 0; // Reset count for the new level

    this.updateEnergyCb(this.inGameEnergy); // Update UI
    this.updateScoreCb(this.inGameScore); // Update UI
  }

  handleClick(event) {
    // TODO: handle later because require card usage
  }

  // Method to be called by React UI when a card is deployed
  deployDefenderUnit(cardData, x, y) {
    if (this.gameOver) return;

    // Backend Placeholder: Card deployment validation
    // - Whether you have this card
    // - Whether you have enough resources to deploy this card

    // Now only handles energy amount calculations
    const UnitClass = this.defenderUnitClasses[cardData.name];
    if (!UnitClass) {
      console.error(`Unknown defender unit type: ${cardData.name}`);
      return;
    }

    if (this.inGameEnergy >= cardData.cost) {
      const newUnit = new UnitClass(
        x - cardData.width / 2,
        y - cardData.height / 2,
        {
          ...cardData,
          image: this.getImage(cardData.name),
        }
      );

      // Pass GameEngine reference for units like Grenadier that need to trigger global effects
      if (newUnit.setGameEngine) {
        newUnit.setGameEngine(this);
      }
      this.defenders.push(newUnit); // Corrected: defender -> defenders
      this.inGameEnergy -= cardData.cost;
      this.updateEnergyCb(this.inGameEnergy);
      console.log(
        `Deployed ${cardData.name}. Current energy: ${this.inGameEnergy}`
      );
    } else {
      console.log(
        `Insufficient energy (${this.inGameEnergy}) to deploy ${cardData.name} (cost: ${cardData.cost}).`
      );
    }
  }

  // Update the game state
  update() {
    if (this.gameOver || !this.isImageLoaded()) return; // Corrected: isImageLoaded is a function

    const currentTime = Date.now();

    // Spawn new enemies
    if (
      this.enemiesSpawnedThisLevel <
        this.currentLevelConfig.totalEnemiesToSpawn && // Corrected property name
      currentTime - this.lastEnermySpawnTime >
        this.currentLevelConfig.enemySpawnInterval && // Corrected property name
      this.enermies.length < this.currentLevelConfig.maxActiveEnemies // Corrected property name
    ) {
      const availableTypes = this.currentLevelConfig.availableEnemyTypes; // Corrected property name
      const randomTypeName =
        availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const EnemyClass = this.enemyClasses[randomTypeName]; // Corrected: eneryClasses -> enemyClasses

      if (EnemyClass) {
        const image = this.getImage(randomTypeName);
        this.enermies.push(new EnemyClass(0, this.canvasHeight / 2, image)); // Corrected: enermies
        this.lastEnermySpawnTime = currentTime;
        this.enemiesSpawnedThisLevel++;
      } else {
        console.warn(
          `Attempted to spawn unknown enemy type: ${randomTypeName}`
        );
      }
    }

    // Update enemies
    this.enermies.forEach((enemy) => {
      // Corrected: enermy -> enemy
      enemy.update(this.defenders); // Pass defenders to enemy for potential collision/attack logic

      // Activate special ability (e.g., BombEnermy's self-destruct)
      if (enemy instanceof BombEnermy) {
        enemy.activateSpecialAbility(this.defenders); // Corrected: defender -> defenders
      }
    });

    // Filter out dead enemies and handle game over condition
    this.enermies = this.enermies.filter((enemy) => {
      // Corrected: enermy -> enemy
      if (!enemy.isAlive) {
        if (enemy.shouldExplode) {
          // Changed to addExplosion, as per previous discussion
          this.addExplosion(
            enemy.x,
            enemy.y,
            enemy.explosionDamage,
            enemy.explosionRadius
          );
          enemy.shouldExplode = false; // Reset flag after explosion handled
        }
        this.inGameScore += enemy.bounty;
        this.updateScoreCb(this.inGameScore);
        return false; // Remove dead enemy
      }
      // Check if enemy crossed defense line
      if (enemy.x > this.defenseLineX) {
        console.log("Enemy crossed defense line! Game Over.");
        this.gameOver = true;
        // Pass details about the game, including the correct level number
        this.onLoseCb({
          score: this.inGameScore,
          // Ensure currentLevelConfig has levelNumber set, providing a fallback
          level: this.currentLevelConfig
            ? this.currentLevelConfig.levelNumber
            : 0,
          reason: "defenseBreached",
        });
        this.stopLoop();
        return false;
      }
      return true;
    });

    // Update defenders
    this.defenders.forEach(
      (
        defender // Corrected: defender -> defenders
      ) => defender.update(this.enermies, this.defenders) // Pass enemies and all defenders for their update logic
    );
    // Filter out dead defenders (this was missing before)
    this.defenders = this.defenders.filter((defender) => defender.isAlive);

    // Remove expired visual effects (explosions)
    this.explosions = this.explosions.filter((exp) => {
      exp.timer--;
      return exp.timer > 0;
    });

    // Check win conditions: all enemies spawned and all active enemies are dead
    const allEnemiesSpawned = // Corrected: allEnermySpawn -> allEnemiesSpawned
      this.enemiesSpawnedThisLevel >=
      this.currentLevelConfig.totalEnemiesToSpawn; // Corrected property name
    const noActiveEnemies = this.enermies.length === 0; // Corrected: enermy -> enermies

    if (!this.gameOver && allEnemiesSpawned && noActiveEnemies) {
      console.log("All enemies cleared! Game Won.");
      this.gameOver = true;
      this.onWinCb();
      this.stopLoop();
    }
  }

  // Central method for creating and applying explosion effects
  addExplosion(x, y, damage, radius) {
    // Renamed from handleExplosion
    this.explosions.push({
      x,
      y,
      damage,
      radius,
      timer: 30,
    }); // timer for visual effect

    // Apply damage to enemies
    this.enermies.forEach((enemy) => {
      // Corrected: enermy -> enermies, enemy
      if (enemy.isAlive && Math.hypot(x - enemy.x, y - enemy.y) <= radius) {
        enemy.takeDamage(damage);
      }
    });

    // Apply damage to defenders (friendly fire)
    this.defenders.forEach((defender) => {
      // Corrected: defender -> defenders
      if (
        defender.isAlive &&
        Math.hypot(x - defender.x, y - defender.y) <= radius
      ) {
        defender.takeDamage(damage * 0.3); // friendly damage reduction
      }
    });
  }

  // Temporary drawing logic
  draw(ctx) {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw Background
    this.ctx.fillStyle = "#4CAF50"; // Green grass
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw Road/Path for enemies
    this.ctx.fillStyle = "#8B4513"; // Brown road
    this.ctx.fillRect(0, this.canvasHeight / 2 - 25, this.canvasWidth, 50);

    // Draw Defense Line
    this.ctx.fillStyle = "blue";
    this.ctx.fillRect(this.defenseLineX - 5, 0, 10, this.canvasHeight); // Thinner line

    // Draw Game Objects
    this.defenders.forEach((defender) => defender.draw(ctx)); // Corrected: defender -> defenders
    this.enermies.forEach((enemy) => enemy.draw(ctx)); // Corrected: enermy -> enermies, enemy

    // Draw Explosion Effect
    this.explosions.forEach((exp) => {
      this.ctx.beginPath();
      this.ctx.arc(
        exp.x,
        exp.y,
        exp.radius * (1 - exp.timer / 30),
        0,
        Math.PI * 2
      );
      this.ctx.fillStyle = `rgba(255, 165, 0, ${exp.timer / 30})`; // Fading orange
      this.ctx.fill();
    });

    // Display game over/win message
    if (this.gameOver) {
      this.ctx.fillStyle = "rgba(0,0,0,0.7)";
      this.ctx.fillRect(0, this.canvasHeight / 2 - 50, this.canvasWidth, 100);
      this.ctx.fillStyle = "white";
      this.ctx.font = "40px Arial";
      this.ctx.textAlign = "center";
      // Simplified: Just show "GAME OVER" here. The GameContext will interpret win/lose.
      this.ctx.fillText(
        this.gameWon ? "YOU WON!" : "GAME OVER", // Requires 'this.gameWon' state, which isn't directly in GameEngine.
        // Better to let UI handle win/lose messages from GameContext.
        this.canvasWidth / 2,
        this.canvasHeight / 2 + 15
      );
    }
  }

  gameLoop = () => {
    this.update();
    this.draw(this.ctx); // Pass context to draw
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  startLoop() {
    if (!this.animationFrameId) {
      this.gameLoop();
    }
  }

  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
