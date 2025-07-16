// src/component/GameLogic (MVC)/GameEngine.js
// This file serves as the Model (game state, entities) and Controller (game logic, updates)

import {
  DefenderUnit,
  BasicDefender,
  HealerDefender,
  GrenadeDefender,
  BarricadeDefender,
} from "./DefenderUnits.js";
import {
  Enemy, // Base Enemy class
  BasicEnemy, // Specific Enemy types
  FastEnemy,
  TankEnemy,
  BombEnemy,
} from "./EnemyUnits.js"; 

export class GameEngine {
  constructor(
    updateEnergyCb,
    updateScoreCb,
    onWinCb,
    onLoseCb,
    updateBaseHealthCb
  ) {
    this.ctx = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.animationFrameId = null;

    // Callbacks from GameContext to update UI
    this.updateEnergyCb = updateEnergyCb;
    this.updateScoreCb = updateScoreCb;
    this.onWinCb = onWinCb;
    this.onLoseCb = onLoseCb;

    // Game entities
    this.defenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];

    // In-game state
    this.inGameEnergy = 0; // Will be set by level config
    this.inGameScore = 0;
    this.lastEnemySpawnTime = 0;
    this.enemiesSpawnedThisLevel = 0;
    this.gameOver = false;
    this.gameWon = false; // Track win/loss state
    this.defenseLineX = 0; // Dynamic based on canvas width
    this.currentWave = 1; // Current wave number

    this.updateBaseHealthCb = updateBaseHealthCb;
    this.baseHealth = 100;

    // Mapping of card names to their respective DefenderUnit classes
    this.defenderUnitClasses = {
      "Basic Cop": BasicDefender,
      "Healer Cop": HealerDefender,
      "Grenadier": GrenadeDefender,
      "Barricade": BarricadeDefender,
    };

    // Mapping of enemy names to their respective Enemy classes
    this.enemyClasses = {
      "Basic Zombie": BasicEnemy,
      "Fast Zombie": FastEnemy,
      "Tank Zombie": TankEnemy,
      "Exploder": BombEnemy,
    };

    // Level configurations and loaded assets
    this.levelConfigs = new Map();
    this.currentLevelConfig = null;
    this.loadedImages = {}; // Stores loaded Image objects

    // Initialize level configurations on construction
    this.initLevelConfigs();
  }

  // Defines all game level configurations
  initLevelConfigs() {
    // Level 1
    this.levelConfigs.set(1, {
      levelNumber: 1,
      enemySpawnInterval: 3000, // 3 seconds
      maxActiveEnemies: 8,
      totalEnemiesToSpawn: 20,
      waves: 3,
      availableEnemyTypes: ["Basic Zombie", "Fast Zombie"],
      initialEnergy: 100,
      enemyAssets: {
        "Basic Zombie": null,
        "Fast Zombie": null,
      },
      defenderAssets: {
        "Basic Cop": null,
        "Healer Cop": null,
        Grenadier: null,
        Barricade: null,
      },
    });

    // Level 2
    this.levelConfigs.set(2, {
      levelNumber: 2,
      enemySpawnInterval: 2500, // 2.5 seconds
      maxActiveEnemies: 12,
      totalEnemiesToSpawn: 30,
      waves: 4,
      availableEnemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie"],
      initialEnergy: 120,
      enemyAssets: {
        "Basic Zombie": null,
        "Fast Zombie": null,
        "Tank Zombie": null,
      },
      defenderAssets: {
        "Basic Cop": null,
        "Healer Cop": null,
        Grenadier: null,
        Barricade: null,
      },
    });

    // Level 3
    this.levelConfigs.set(3, {
      levelNumber: 3,
      enemySpawnInterval: 2000, // 2 seconds
      maxActiveEnemies: 15,
      totalEnemiesToSpawn: 40,
      waves: 5,
      availableEnemyTypes: [
        "Basic Zombie",
        "Fast Zombie",
        "Tank Zombie",
        "Exploder",
      ],
      initialEnergy: 150,
      enemyAssets: {
        "Basic Zombie": null,
        "Fast Zombie": null,
        "Tank Zombie": null,
        Exploder: null,
      },
      defenderAssets: {
        "Basic Cop": null,
        "Healer Cop": null,
        Grenadier: null,
        Barricade: null,
      },
    });
  }

  // Preloads all images required for the current level
  preloadImages(imagePaths) {
    const promises = [];
    for (const [name, path] of Object.entries(imagePaths)) {
      const promise = new Promise((resolve) => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
          this.loadedImages[name] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${path}. Using fallback.`);
          this.loadedImages[name] = null; // Mark as failed
          resolve();
        };
      });
      promises.push(promise);
    }
    return Promise.all(promises);
  }

  // Retrieves a loaded image by its name
  getImage(name) {
    return this.loadedImages[name] || null;
  }

  /**
   * Initializes the game engine for a specific level.
   * @param {HTMLCanvasElement} canvas - The canvas DOM element.
   * @param {number} width - The width of the canvas.
   * @param {number} height - The height of the canvas.
   * @param {number} levelNumber - The number of the level to initialize.
   */
  initialize(canvas, width, height, levelNumber) {
    this.ctx = canvas.getContext("2d"); // Get 2D rendering context
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.defenseLineX = width * 0.9; // Defense line 150px from right edge

    // Get the configuration for the selected level
    this.currentLevelConfig = this.levelConfigs.get(levelNumber);
    if (!this.currentLevelConfig) {
      console.error(
        `Level ${levelNumber} config not found. Defaulting to level 1.`
      );
      this.currentLevelConfig = this.levelConfigs.get(1);
      // Ensure levelNumber is correctly set even if defaulting
      if (this.currentLevelConfig) {
        this.currentLevelConfig.levelNumber = 1; // Default to level 1
      }
    }

    // Preload all necessary images for the current level
    const allImages = {
      ...this.currentLevelConfig.enemyAssets,
      ...this.currentLevelConfig.defenderAssets,
    };

    this.preloadImages(allImages)
      .then(() => {
        this.resetGame(); // Reset game state after assets are loaded
        this.startLoop(); // Start the game loop
      })
      .catch((error) => {
        console.error("Error loading game assets:", error);
        this.gameOver = true; // Prevent game from starting if assets fail to load
        this.onLoseCb({
          // Notify GameContext about the failure
          score: 0,
          level: levelNumber,
          reason: "Asset loading failed",
        });
      });
  }

  // Resets the game state to its initial values for the current level
  resetGame() {
    this.stopLoop(); // Stop any active animation loop
    this.defenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];

    this.inGameEnergy = this.currentLevelConfig.initialEnergy;
    this.inGameScore = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.lastEnemySpawnTime = 0;
    this.enemiesSpawnedThisLevel = 0;
    this.currentWave = 1;
    this.baseHealth = 100;

    // Update UI via callbacks
    this.updateEnergyCb(this.inGameEnergy);
    this.updateScoreCb(this.inGameScore);

    if (this.updateBaseHealthCb) {
      this.updateBaseHealthCb(100);
    }
    console.log("Game reset complete");
  }

  /**
   * Deploys a defender unit onto the game board.
   * @param {object} cardData - The data of the card being deployed.
   * @param {number} x - X coordinate for deployment.
   * @param {number} y - Y coordinate for deployment.
   * @returns {boolean} True if deployment was successful, false otherwise.
   */
  deployDefenderUnit(cardData, x, y) {
    //debug
    console.log("Deploying defender:", cardData.name, "at", x, y);

    if (this.gameOver) return false;

    const UnitClass = this.defenderUnitClasses[cardData.name];
    if (!UnitClass) {
      console.error(`Unknown defender type: ${cardData.name}`);
      return false;
    }

    //create tempperaroy units - it will calculate its stat base on levels
    const tempUnit = new UnitClass(0, 0, {
      ...cardData,
      image: this.getImage(cardData.name),
    });

    if (this.inGameEnergy < cardData.cost) {
      console.log(`Not enough energy: ${this.inGameEnergy}/${cardData.cost}`);
      return false;
    }

    // Adjust position to center of card
    const deployX = x - tempUnit.width / 2;
    const deployY = y - tempUnit.height / 2;

    console.log(
      `Deployment coordinates: (${deployX}, ${deployY}), dimensions: ${tempUnit.width}x${tempUnit.height}`
    );

    // Check if position is valid (not on path, not overlapping other defenders)
    if (
      !this.isValidDeploymentPosition(
        deployX,
        deployY,
        tempUnit.width,
        tempUnit.height
      )
    ) {
      console.log("Invalid deployment position");
      return false;
    }

    console.log("Deployment valid. Creating unit.");

    //the actual unit
    const newUnit = new UnitClass(deployX, deployY, {
      ...cardData,
      image: this.getImage(cardData.name),
    });

    // Pass GameEngine reference for special abilities (e.g., Grenadier's explosion)
    if (newUnit.setGameEngine) {
      newUnit.setGameEngine(this);
    }

    this.defenders.push(newUnit);
    this.inGameEnergy -= newUnit.cost;
    this.updateEnergyCb(this.inGameEnergy); // Update UI

    console.log(`Defender deployed with level ${newUnit.level} stats:`, {
      damage: newUnit.attackDamage,
      health: newUnit.health,
      cost: newUnit.cost,
      specialAbilities: newUnit.getUpgradeInfo().newAbilities,
    });
    return true;
  }

  /**
   * Checks if a given position is valid for deploying a defender.
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {number} width - Width of the unit.
   * @param {number} height - Height of the unit.
   * @returns {boolean} True if valid, false otherwise.
   */
  isValidDeploymentPosition(x, y, width, height) {
    // 1. Check if within deployable area (right half of screen, excluding road)
    // Assuming road is in the middle, and deployable area is top-right quadrant
    const roadTop = this.canvasHeight * 0.4; // Example: road starts at 40% down
    const roadBottom = this.canvasHeight * 0.6; // Example: road ends at 60% down

    if (x < this.canvasWidth / 2 || x + width > this.canvasWidth) {
      return false; // Must be in the right half
    }

    // 2. Check if overlapping existing defenders
    for (const defender of this.defenders) {
      if (
        this.checkCollision(
          x,
          y,
          width,
          height,
          defender.x,
          defender.y,
          defender.width,
          defender.height
        )
      ) {
        return false; // Overlapping another defender
      }
    }

    return true;
  }

  /**
   * Performs AABB collision detection.
   * @returns {boolean} True if collision, false otherwise.
   */
  checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  /**
   * Adds an explosion effect and applies damage in an area.
   * @param {number} x - Center X of explosion.
   * @param {number} y - Center Y of explosion.
   * @param {number} damage - Damage dealt by explosion.
   * @param {number} radius - Radius of explosion effect.
   */
  addExplosion(x, y, damage, radius) {
    this.explosions.push({
      x,
      y,
      damage,
      radius,
      timer: 30, // frames to display visual effect
    });

    // Apply damage to enemies within radius
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(
        enemy.x + enemy.width / 2 - x,
        enemy.y + enemy.height / 2 - y
      ); // Distance from enemy center to explosion center
      if (distance <= radius) {
        enemy.takeDamage(damage);
      }
    }

    // Apply reduced damage to defenders within radius (friendly fire)
    for (const defender of this.defenders) {
      if (!defender.isAlive) continue;

      const distance = Math.hypot(
        defender.x + defender.width / 2 - x,
        defender.y + defender.height / 2 - y
      ); // Distance from defender center to explosion center
      if (distance <= radius) {
        defender.takeDamage(damage * 0.3); // 30% damage to allies
      }
    }
  }

  /** Spawns a new enemy based on current level configuration. */
  spawnEnemy() {
    const now = Date.now();
    const config = this.currentLevelConfig;

    // Check if total enemies for level are spawned, if interval passed, and if max active enemies limit is not reached
    if (
      this.enemiesSpawnedThisLevel < config.totalEnemiesToSpawn &&
      now - this.lastEnemySpawnTime > config.enemySpawnInterval &&
      this.enemies.length < config.maxActiveEnemies
    ) {
      const enemyType =
        config.availableEnemyTypes[
          Math.floor(Math.random() * config.availableEnemyTypes.length)
        ];

      const EnemyClass = this.enemyClasses[enemyType];
      if (!EnemyClass) {
        console.warn(`Unknown enemy type: ${enemyType}`);
        return;
      }

      // Spawn at a random Y position on the left edge
      const spawnX = -100; // Start off-screen left
      const spawnY = this.canvasHeight * 0.5;

      const enemy = new EnemyClass(spawnX, spawnY, {
        image: this.getImage(enemyType),
      });

      this.enemies.push(enemy);
      this.lastEnemySpawnTime = now;
      this.enemiesSpawnedThisLevel++;
    }
  }

  /** Main update loop for the game state. */
  update() {
    if (this.gameOver) return;

    const now = Date.now();

    // Spawn enemies
    this.spawnEnemy();

    // Update all entities
    this.updateDefenders(now);
    this.updateEnemies(now);
    this.updateProjectiles();
    this.updateExplosions();

    // Check win/lose conditions
    this.checkGameConditions();
  }

  /** Updates all defender units. */
  updateDefenders(now) {
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];

      if (!defender.isAlive) {
        this.defenders.splice(i, 1); // Remove dead defender
        continue;
      }

      defender.update(this.enemies, this.defenders); // Pass all enemies and defenders for their specific logic

      // Handle defender attacks (if they can attack)
      if (
        defender.attackDamage > 0 &&
        defender.range > 0 &&
        defender.canAttack(now)
      ) {
        const target = this.findTargetForDefender(defender);
        if (target) {
          // If the defender is ranged, create a projectile
          if (defender.isRanged) {
            this.projectiles.push({
              startX: defender.x + defender.width / 2,
              startY: defender.y + defender.height / 2,
              target: target, // Store reference to the target enemy
              speed: 10,
              damage: defender.attackDamage,
              // Projectile progress will be calculated based on distance to target
            });
          }
          defender.attack(target, now); // Defender performs its attack
        }
      }
    }
  }

  /**
   * Finds the closest valid target for a given defender.
   * @param {DefenderUnit} defender - The defender unit looking for a target.
   * @returns {Enemy|null} The closest enemy in range, or null if none found.
   */
  findTargetForDefender(defender) {
    let closestEnemy = null;
    let closestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      // Calculate distance from defender's center to enemy's center
      const distance = Math.hypot(
        defender.x + defender.width / 2 - (enemy.x + enemy.width / 2),
        defender.y + defender.height / 2 - (enemy.y + enemy.height / 2)
      );

      if (distance <= defender.range && distance < closestDistance) {
        closestEnemy = enemy;
        closestDistance = distance;
      }
    }
    return closestEnemy;
  }

  /** Updates all enemy units. */
  updateEnemies(now) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      enemy.update(this.defenders); // Enemy updates its state (movement, attack if attacker)

      // Handle enemy special abilities (e.g., BombEnemy self-destruct if near defender)
      if (enemy.activateSpecialAbility) {
        enemy.activateSpecialAbility(this.defenders);
      }

      if (!enemy.isAlive) {
        // Handle enemy death
        this.inGameScore += enemy.bounty;
        this.updateScoreCb(this.inGameScore); // Update UI score

        // Handle special death effects (e.g., BombEnemy explosion)
        if (enemy.shouldExplode) {
          // BombEnemy sets this flag
          this.addExplosion(
            enemy.x + enemy.width / 2, // Center explosion on enemy
            enemy.y + enemy.height / 2,
            enemy.explosionDamage,
            enemy.explosionRadius
          );
        }

        this.enemies.splice(i, 1); // Remove dead enemy
        continue;
      }

      // Check if enemy reached defense line
      if (enemy.isAlive && enemy.x + enemy.width >= this.defenseLineX) {
        // Damage the base
        const damage = 10;
        const newHealth = Math.max(0, this.baseHealth - damage);
        this.baseHealth = newHealth;

        if (this.updateBaseHealthCb) {
          this.updateBaseHealthCb(newHealth);
        }

        // Remove enemy bc it reach the line 
        enemy.isAlive = false;
        this.enemies.splice(i, 1);

        // Check for game over
        if (this.baseHealth <= 0) {
          this.baseHealth = 0;
          this.gameOver = true;
          if (this.onLoseCb) {
            this.onLoseCb({
              score: this.inGameScore,
              level: this.currentLevelConfig.levelNumber,
              reason: "Base destroyed",
            });
          }
        }
        continue; //skip to next enemy
      }
    }
  }

  /** Updates all projectiles. */
  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      if (!projectile.target.isAlive) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx =
        projectile.target.x + projectile.target.width / 2 - projectile.startX;
      const dy =
        projectile.target.y + projectile.target.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        // Hit target
        projectile.target.takeDamage(projectile.damage);
        this.projectiles.splice(i, 1);
      } else {
        // Move projectile
        const angle = Math.atan2(dy, dx);
        projectile.startX += Math.cos(angle) * projectile.speed;
        projectile.startY += Math.sin(angle) * projectile.speed;
      }
    }
  }

  /** Updates and removes expired explosion effects. */
  updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer--; // Decrement timer

      if (this.explosions[i].timer <= 0) {
        this.explosions.splice(i, 1); // Remove expired explosion
      }
    }
  }

  /** Checks for win or lose conditions. */
  checkGameConditions() {
    // Lose condition: defense breached (handled in updateEnemies loop)

    // Win condition: all enemies spawned AND all active enemies are dead
    const config = this.currentLevelConfig;
    const allEnemiesSpawned =
      this.enemiesSpawnedThisLevel >= config.totalEnemiesToSpawn;
    const noActiveEnemies = this.enemies.length === 0;

    if (!this.gameOver && allEnemiesSpawned && noActiveEnemies) {
      this.handleLevelComplete(); // Trigger win condition
    }

    if (this.gameOver) {
      this.handleDefenseBreached
    }
  }

  // /** Handles the game over state when defense is breached. */
  handleDefenseBreached() {
    this.gameOver = true;
    this.gameWon = false;
    this.stopLoop(); // Stop the game loop

    if (this.onLoseCb) {
      this.onLoseCb({
        score: this.inGameScore,
        level: this.currentLevelConfig.levelNumber,
        reason: "Defense breached",
      });
    }
  }

  /** Handles the game win state when all enemies are defeated. */
  handleLevelComplete() {
    this.gameOver = true;
    this.gameWon = true;
    this.stopLoop(); // Stop the game loop

    if (this.onWinCb) {
      this.onWinCb({
        score: this.inGameScore,
        level: this.currentLevelConfig.levelNumber,
      });
    }
  }

  /** Main drawing function for the canvas. */
  draw(ctx) {
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight); // Clear canvas

    this.drawBackground(ctx);
    this.drawDefenders(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawExplosions(ctx);
    this.drawUI(ctx);

    // Draw game over/win message overlay
    if (this.gameOver) {
      this.drawGameOverScreen(ctx);
    }
  }

  drawBackground(ctx) {
    // Draw sky
    ctx.fillStyle = "#1a3a5a";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw grass (top and bottom)
    ctx.fillStyle = "#2a5a3a";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight * 0.4); // Top grass
    ctx.fillRect(
      0,
      this.canvasHeight * 0.6,
      this.canvasWidth,
      this.canvasHeight * 0.4
    ); // Bottom grass

    // Draw road
    ctx.fillStyle = "#5a5a5a";
    ctx.fillRect(
      0,
      this.canvasHeight * 0.4,
      this.canvasWidth,
      this.canvasHeight * 0.2
    );

    // Draw road markings
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let i = 20; i < this.canvasWidth; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, this.canvasHeight * 0.5 - 5);
      ctx.lineTo(i + 20, this.canvasHeight * 0.5 - 5);
      ctx.stroke();
    }

    // Draw defense line (right edge)
    ctx.strokeStyle = "#ff3300";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.defenseLineX - 1, 0);
    ctx.lineTo(this.defenseLineX - 1, this.canvasHeight);
    ctx.stroke();

    // Draw base building
    ctx.fillStyle = "#8b6f4b";
    ctx.fillRect(
      this.defenseLineX - 30,
      this.canvasHeight * 0.3,
      30,
      this.canvasHeight * 0.4
    );

    // Draw windows
    ctx.fillStyle = "#ffcc00";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(
        this.defenseLineX - 25,
        this.canvasHeight * 0.35 + i * 40,
        10,
        20
      );
    }
  }

  /** Draws all active defender units. */
  drawDefenders(ctx) {
    console.log(`Drawing ${this.defenders.length} defenders`); // Add debug log
    for (const defender of this.defenders) {
      if (defender.isAlive) {
        console.log(`Drawing defender at (${defender.x}, ${defender.y})`); // Add debug log

        defender.draw(ctx);
      }
    }
  }

  /** Draws all active enemy units. */
  drawEnemies(ctx) {
    for (const enemy of this.enemies) {
      if (enemy.isAlive) {
        enemy.draw(ctx);
      }
    }
  }

  /** Draws all active projectiles. */
  drawProjectiles(ctx) {
    ctx.fillStyle = "#FF0000"; // Red projectiles

    for (const projectile of this.projectiles) {
      // Projectile is drawn at its current startX/startY
      ctx.beginPath();
      ctx.arc(projectile.startX, projectile.startY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draws all active explosion effects. */
  drawExplosions(ctx) {
    for (const explosion of this.explosions) {
      const radius = explosion.radius * (explosion.timer / 30); // Radius shrinks over time
      const alpha = explosion.timer / 30; // Alpha fades over time

      ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`; // Fading orange
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draws the in-game UI (energy, score, wave). */
  drawUI(ctx) {
    // Draw energy bar
    const energyPercent =
      this.inGameEnergy / this.currentLevelConfig.initialEnergy;
    ctx.fillStyle = "#333"; // Background
    ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = energyPercent > 0.3 ? "#4CAF50" : "#FF5722"; // Green or orange based on energy level
    ctx.fillRect(10, 10, 200 * energyPercent, 20);
    ctx.fillStyle = "#FFF"; // Text color
    ctx.font = "16px Arial";
    ctx.fillText(`Energy: ${Math.floor(this.inGameEnergy)}`, 15, 26);

    // Draw score
    ctx.fillStyle = "#FFF";
    ctx.font = "16px Arial";
    ctx.fillText(`Score: ${this.inGameScore}`, this.canvasWidth - 150, 26);

    // Draw wave info
    ctx.fillText(
      `Wave: ${this.currentWave}/${this.currentLevelConfig.waves}`,
      this.canvasWidth / 2 - 50,
      26
    );

    // Draw defense line indicator
    ctx.strokeStyle = "#FF0000"; // Red line
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.defenseLineX, 0);
    ctx.lineTo(this.defenseLineX, this.canvasHeight);
    ctx.stroke();
  }

  /** Draws the game over/win screen overlay. */
  drawGameOverScreen(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // Semi-transparent black overlay
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = "#FFF"; // White text
    ctx.font = "48px Arial";
    ctx.textAlign = "center";

    if (this.gameWon) {
      ctx.fillText(
        "VICTORY!",
        this.canvasWidth / 2,
        this.canvasHeight / 2 - 50
      );
      ctx.font = "24px Arial";
      ctx.fillText(
        `You defended your garden and earned ${this.inGameScore} points!`,
        this.canvasWidth / 2,
        this.canvasHeight / 2
      );
    } else {
      ctx.fillText(
        "GAME OVER",
        this.canvasWidth / 2,
        this.canvasHeight / 2 - 50
      );
      ctx.font = "24px Arial";
      ctx.fillText(
        "The evil creatures reached your garden!",
        this.canvasWidth / 2,
        this.canvasHeight / 2
      );
    }

    ctx.font = "20px Arial";
    ctx.fillText(
      "Click anywhere to continue",
      this.canvasWidth / 2,
      this.canvasHeight / 2 + 50
    );
  }

  /** The main game animation loop. */
  gameLoop = () => {
    this.update();
    this.draw(this.ctx); // Pass context to draw

    if (!this.gameOver) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  };

  /** Starts the game animation loop. */
  startLoop() {
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  /** Stops the game animation loop. */
  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Cleans up GameEngine resources when no longer needed. */
  cleanup() {
    this.stopLoop();
    this.ctx = null;
    this.canvas = null;
    this.defenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];
    console.log("GameEngine cleanup completed.");
  }
}
