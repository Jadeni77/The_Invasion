// This file serves as the Model (game state, entities) and Controller (game logic, updates)

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
        "Basic Zombie": "link",
        "Fast Zombie": "link", // Example path
      },
      defenderAssets: {
        "Basic Cop": "link", // Example path
        "Healer Cop": "link",
        "Grenadier": "link",
        "Barricade": "link",
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
        "Basic Zombie": "link",
        "Fast Zombie": "link",
        "Tank Zombie": "link",
      },
      defenderAssets: {
        "Basic Cop": "link",
        "Healer Cop":"link",
        "Grenadier": "link",
        "Barricade": "link",
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
