// src/component/GameLogic (MVC)/GameEngine.js
// This file serves as the Model (game state, entities) and Controller (game logic, updates)

import { DefenderUnit, BasicDefender, HealerDefender,
  GrenadeDefender, BarricadeDefender, EnergyGenerator, Sniper } from "./DefenderUnits.js";
import { Enemy, BasicEnemy, FastEnemy, TankEnemy,
  BombEnemy, RangeEnemy, ShieldEnemy, HealerEnemy, EMPEnemy,
  MiniEnemy, SplitterEnemy, VampireEnemy, SwarmLeader} from "./EnemyUnits.js";
import { EnergyDrop } from "./EnergyDrop.js";
import { CardPieceDrop} from "./CardPieceDrop.js";
import { CombatManager } from "./GameEngineBreakDown/CombatManager.js";
import { DropManager } from "./GameEngineBreakDown/DropManager.js";
import { GridManager } from "./GameEngineBreakDown/GridManager.js";
import { WaveManager } from "./GameEngineBreakDown/WaveManager.js";

export class GameEngine {
  constructor(updateEnergyCb, updateScoreCb, onWinCb, onLoseCb, updateBaseHealthCb) {
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
    this.enemyProjectiles = [];

    // In-game state
    this.inGameEnergy = 0; // Will be set by level config
    this.inGameScore = 0;
    this.gameOver = false;
    this.defenseLineX = 0; // Dynamic based on canvas width

    this.updateBaseHealthCb = updateBaseHealthCb;
    this.baseHealth = 100;
    this.isPaused = false;

    this.energyDrops = [];
    this.cardPieceDrops = [];
    this.onCardPieceCollected = null;

    this.waveManager = null;
    this.gridManager = null;
    this.dropManager = new DropManager(this);
    this.combatManager = new CombatManager(this);

    // Mapping of card names to their respective DefenderUnit classes
    this.defenderUnitClasses = {
      "Basic Cop": BasicDefender,
      "Healer Cop": HealerDefender,
      "Grenadier": GrenadeDefender,
      "Barricade": BarricadeDefender,
      "Energy Generator": EnergyGenerator,
      "Sniper": Sniper
    };

    // Mapping of enemy names to their respective Enemy classes
    this.enemyClasses = {
      "Basic Zombie": BasicEnemy,
      "Fast Zombie": FastEnemy,
      "Tank Zombie": TankEnemy,
      "Exploder": BombEnemy,
      "Skeleton Shooter": RangeEnemy,
      "Shielder": ShieldEnemy,
      "Healer": HealerEnemy,
      "Splitter": SplitterEnemy,
      "Mini": MiniEnemy,
      "Swarm Witch": SwarmLeader,
      "EMP": EMPEnemy,
      "Vampire": VampireEnemy
    };

    // Level configurations and loaded assets
    this.levelConfigs = new Map();
    this.currentLevelConfig = null;
    this.loadedImages = {}; // Stores loaded Image objects

    // Initialize level configurations on construction
    this.initLevelConfigs();
  }

  /**
   * Push the energy drop into its map
   * @param x the x position of the current energy drop
   * @param y the y position of the current energy drop
   * @param amount the amount of this energy drop
   */
  dropEnergy(x, y, amount) {
    if (this.gameOver) return;
    this.energyDrops.push(new EnergyDrop(x, y, amount));
  }

  /**
   * Check if energy is collected and add it to the inGameEnergy,
   * else return false
   * @param x the x position of the current mouse
   * @param y the y position of the current mouse
   */
  collectEnergy(x, y) {
    for (let i = this.energyDrops.length - 1; i >= 0; i--) {
      const drop = this.energyDrops[i];
      if (drop.checkCollection(x, y)) {
        drop.startCollectionAnimation(110, 20); //where the bar locate;
        this.inGameEnergy = Math.min(100, this.inGameEnergy + drop.amount);
        this.updateEnergyCb(this.inGameEnergy);
        return true; //energy is collected
      }
    }

    return false;
  }

  /**
   * Push the random card piece drop into its map
   * @param x the x position of the card piece drop
   * @param y the y position of the card piece drop
   */
  dropCardPieces(x, y) {
    if (this.gameOver) return;
    const cardType = ['Basic Cop', 'Healer Cop', 'Grenadier', 'Barricade', 'Energy Generator'];
    const randomCard = cardType[Math.floor(Math.random() * cardType.length)];
    this.cardPieceDrops.push(new CardPieceDrop(x, y, randomCard));
  }

  /**
   * Check if card piece drop is collected and call the animation methods
   * @param x the x position of the current mouse
   * @param y the y position of the current mouse
   */
  collectCardPieces(x, y) {
    for (let i = this.cardPieceDrops.length - 1; i >= 0; i--) {
      const drop = this.cardPieceDrops[i];
      if (drop.checkCollection(x, y)) {
        drop.startCollectionAnimation(this.canvasWidth - 100, 50); // top right
        if (this.onCardPieceCollected) {
          this.onCardPieceCollected(drop.cardName);
        }
        this.cardPieceDrops.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Defines the information for every level.
   */
  initLevelConfigs() {
    // Level 1
    this.levelConfigs.set(1, {
      levelNumber: 1,
      enemySpawnInterval: 3000, // 3 seconds
      maxActiveEnemies: 8,
      totalEnemiesToSpawn: 50,
      waves: 3,
      availableEnemyTypes:
          ["Basic Zombie", "Fast Zombie", "Tank Zombie",
           "Exploder", "Skeleton Shooter", "Shielder",
          "Healer", "Splitter", "Mini", "Swarm Witch",
          "EMP", "Vampire"],
      initialEnergy: 100,
      enemyAssets: {
        "Basic Zombie": null,
        "Fast Zombie": null,
        "Skeleton Shooter": null
      },
      defenderAssets: {
        "Basic Cop": null,
        "Healer Cop": null,
        "Grenadier": null,
        "Barricade": null,
        "Energy Generator": null
      },
    });

    /*
        "Basic Zombie": BasicEnemy,
      "Fast Zombie": FastEnemy,
      "Tank Zombie": TankEnemy,
      "Exploder": BombEnemy,
      "Skeleton Shooter": RangeEnemy,
      "Shielder": ShieldEnemy,
      "Healer": HealerEnemy,
      "Splitter": SplitterEnemy,
      "Mini": MiniEnemy,
      "Swarm Witch": SwarmLeader,
      "EMP": EMPEnemy,
      "Vampire": VampireEnemy
     */

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
        "Grenadier": null,
        "Barricade": null,
        "Energy Generator": null
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
        "Exploder": null,
      },
      defenderAssets: {
        "Basic Cop": null,
        "Healer Cop": null,
        "Grenadier": null,
        "Barricade": null,
        "Energy Generator": null
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
    // CRITICAL: Stop any existing game loop FIRST
    this.stopLoop();

    // Clear any existing game state
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

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

    //initialize grid for game
    this.gridManager = new GridManager(width, height);
    this.gridManager.initializeGrid();
    //initialize wave manager
    this.waveManager = new WaveManager(this.currentLevelConfig,
                                       (enemyType) => this.spawnEnemyOfType(enemyType),
                                       this);

    // Preload all necessary images for the current level
    const allImages = {
      ...this.currentLevelConfig.enemyAssets,
      ...this.currentLevelConfig.defenderAssets,
    };

    this.preloadImages(allImages)
        .then(() => {
          // Double-check we're still supposed to be running
          if (this.gameOver) {
            return;
          }

          this.resetGame(); // Reset game state after assets are loaded
          this.startLoop(); // Start the game loop
        })
        .catch((error) => {
          console.error("Error loading game assets:", error);
          this.setGameOver(true, "Prevent game from starting if loading fails");
          this.onLoseCb({
                          score: 0,
                          level: levelNumber,
                          reason: "Asset loading failed",
                        });
        });
  }

  spawnEnemyOfType(enemyType) {
    const EnemyClass = this.enemyClasses[enemyType];
    if (!EnemyClass) {
      console.warn(`Unknown enemy type: ${enemyType}`);
      return;
    }
    const spawnX = -100;
    const spawnY = this.gridManager.getRandomSpawnY();
    const enemy = new EnemyClass(spawnX, spawnY, this.getImage(enemyType));

    if (enemy.setGameEngine()) {
      enemy.setGameEngine(this);
    }
    this.enemies.push(enemy);
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

    if (this.waveManager) {
      this.waveManager.reset();
    }

    this.baseHealth = 100;

    this.energyDrops = [];
    this.cardPieceDrops = [];

    if (this.gridManager) {
      this.gridManager.resetGrid();
    }

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
    if (this.gameOver) return false;

    //get grid cell
    const gridCell = this.gridManager.getGridCell(x, y);
    console.log("Grid cell:", gridCell); // Add this debug line

    if (!gridCell || gridCell.occupied) {
      console.log("Invalid grid cell or cell is occupied/road");
      return false;
    }

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
    let deployX = gridCell.x + (this.gridManager.gridSize - tempUnit.width) / 2;
    let deployY = gridCell.y + (this.gridManager.gridSize - tempUnit.height) / 2;

    // Ensure the unit stays within the deployment area
    if (deployX < this.gridManager.gridOffsetX) {
      deployX = this.gridManager.gridOffsetX;
    }

    // Check if position is valid (not on path, not overlapping other defenders)
    if (!this.isValidDeploymentPosition(deployX, deployY, tempUnit.width, tempUnit.height)) {
      console.log("Invalid deployment position");
      return false;
    }

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

    //mark cell occupy
    gridCell.occupied = true;

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
    if (x < this.gridManager.gridOffsetX - 1 || x + width > this.canvasWidth) {
      return false; // Must be in the right half
    }
    // 2. Check if overlapping existing defenders
    for (const defender of this.defenders) {
      if (this.checkCollision(x, y, width, height, defender.x,
                              defender.y, defender.width, defender.height)) {
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
    if (this.gameOver) return;

    this.explosions.push({x, y, damage, radius, timer: 30,});

    // Apply damage to enemies within radius
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(
        enemy.x + enemy.width / 2 - x,
        enemy.y + enemy.height / 2 - y
      ); // Distance from enemy center to explosion center
      if (distance <= radius) {
        const died = enemy.takeDamage(damage);
        if (died && !this.gameOver) {
          //only change game score when game still playing
          this.inGameScore += enemy.bounty;
          this.updateScoreCb(this.inGameScore);
        }
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
        const actualDamage = damage * 0.3;
        console.log(`Defender ${defender.name} in explosion range, 
        taking ${actualDamage} damage`); // Fix: Added debug logging

        defender.takeDamage(actualDamage); // 30% damage to allies
      }
    }
  }

  /** Main update loop for the game state. */
  update() {
    if (this.gameOver || this.isPaused) return;
    const now = Date.now();

    this.waveManager.update(now, this.enemies.length, this.gameOver);

    // UPDATE PROJECTILES FIRST (before enemies move)
    this.updateProjectiles();
    this.updateEnemyProjectiles();

    this.updateDefenders(now);
    this.updateEnemies(now);

    this.updateEnergyDrops();
    this.updateCardPieceDrops();

    this.updateExplosions();
    this.checkGameConditions();
  }


  updateEnergyDrops() {
    for (let i = this.energyDrops.length - 1; i >= 0; i--) {
      if (!this.energyDrops[i].update()) {
        this.energyDrops.splice(i, 1);
      }
    }
  }

  updateCardPieceDrops() {
    for (let i = this.cardPieceDrops.length - 1; i >= 0; i--) {
      if (!this.cardPieceDrops[i].update()) {
        this.cardPieceDrops.splice(i, 1);
      }
    }
  }

  updateDefenders(now) {
    if (this.gameOver) return;

    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];

      if (!defender.isAlive) {
        //find and free the grid cell
        const gridCell = this.gridManager.getGridCell(
          defender.x + defender.width / 2,
          defender.y + defender.height / 2
        );
        if (gridCell) {
          gridCell.occupied = false;
        }
        this.defenders.splice(i, 1); // Remove dead defender
        continue;
      }
      defender.update(this.enemies, this.defenders); // Pass all enemies and defenders for their specific logic

      this.combatManager.updateDefenderCombat(this.defenders, this.enemies, now);
    }

    //handle disabled
    for (const defender of this.defenders) {
      if (defender.disabled && defender.disabledDuration) {
        defender.disabledDuration--;
        if (defender.disabledDuration <= 0) {
          defender.disabled = false;
        }
      }
    }
  }

  /** Updates all enemy units. */
  updateEnemies(now) {
    if (this.gameOver) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // REMOVE DEAD ENEMIES FIRST
      if (!enemy || !enemy.isAlive) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (!enemy.gameEngine) {
        console.warn(`Enemy ${enemy.name} lost gameEngine reference, restoring...`);
        enemy.gameEngine = this;
      }
      // Update enemy (movement and attacks)
      enemy.update(this.defenders);
      // Check if enemy died during update
      if (!enemy.isAlive) {
        this.handleEnemyDeath(enemy);
        this.enemies.splice(i, 1);
        continue;
      }
      // Handle special abilities (only for alive enemies)
      if (enemy.activateSpecialAbility) {
        enemy.activateSpecialAbility(this.defenders);
      }

      // Check if still alive after special ability
      if (!enemy.isAlive) {
        if (!this.gameOver) {
          this.inGameScore += enemy.bounty;
          this.updateScoreCb(this.inGameScore);
        }

        if (enemy.shouldExplode) {
          this.addExplosion(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              enemy.explosionDamage,
              enemy.explosionRadius
          );
        }
        this.enemies.splice(i, 1);
        continue; // SKIP THE REST
      }

      // Double-check that enemy is actually alive (health > 0)
      if (enemy.health <= 0) {
        enemy.isAlive = false;
        this.enemies.splice(i, 1);
        continue;
      }

      // Only check defense line for ALIVE enemies
      if (enemy.x + enemy.width >= this.defenseLineX) {
        if (!this.gameOver) {
          const damage = 10;
          this.baseHealth = Math.max(0, this.baseHealth - damage);

          if (this.updateBaseHealthCb) {
            this.updateBaseHealthCb(this.baseHealth);
          }

          if (this.baseHealth <= 0) {
            this.handleDefenseBreached();
          }
        }
        this.enemies.splice(i, 1);
      }
    }
    this.combatManager.updateEnemyCombat(this.defenders, this.enemies, now);

    //handle slow/freeze duration

  }

  handleEnemyDeath(enemy) {
    if (!this.gameOver) {
      this.inGameScore += enemy.bounty;
      this.updateScoreCb(this.inGameScore);
      this.dropManager.handleEnemyDeath(enemy);
    }

    if (enemy.shouldExplode) {
      this.addExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          enemy.explosionDamage,
          enemy.explosionRadius
      );
    }
  }

  /** Updates all projectiles. */
  updateProjectiles() {
    if (this.gameOver) return;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Check if target still exists and is alive
      if (!projectile.target || !projectile.target.isAlive) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx = projectile.target.x + projectile.target.width / 2 - projectile.startX;
      const dy = projectile.target.y + projectile.target.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        const died = projectile.target.takeDamage(projectile.damage);
        if (died) {
          if (!this.gameOver) {
            this.inGameScore += projectile.target.bounty;
            this.updateScoreCb(this.inGameScore);
            this.dropManager.handleEnemyDeath(projectile.target);
          }
          const enemyIndex = this.enemies.findIndex(e => e.id === projectile.target.id);
          if (enemyIndex !== -1) {
            this.enemies.splice(enemyIndex, 1);
          }
        }
        this.projectiles.splice(i, 1);
      } else {
        // Move projectile
        const angle = Math.atan2(dy, dx);
        projectile.startX += Math.cos(angle) * projectile.speed;
        projectile.startY += Math.sin(angle) * projectile.speed;
      }
    }
  }

  updateEnemyProjectiles() {
    if (this.gameOver) return;

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.enemyProjectiles[i];

      //check if target exist and alive
      if (!projectile.target || !projectile.target.isAlive) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx = projectile.target.x + projectile.target.width / 2 - projectile.startX;
      const dy = projectile.target.y + projectile.target.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        //hit target
        projectile.target.takeDamage(projectile.damage);
        this.enemyProjectiles.splice(i, 1);
      } else {
        //move projectile
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
    if (this.gameOver) return;

    // Win condition: all enemies spawned AND all active enemies are dead
    const config = this.currentLevelConfig;
    const allEnemiesSpawned = this.waveManager.enemiesSpawnedThisLevel >= config.totalEnemiesToSpawn;
    const noActiveEnemies = this.enemies.length === 0;

    if (!this.gameOver && allEnemiesSpawned && noActiveEnemies) {
      this.handleLevelComplete(); // Trigger win condition
    }
  }

  // /** Handles the game over state when defense is breached. */
  handleDefenseBreached() {
    if (!this.gameOver) {
      // this.gameOver = true;
      this.setGameOver(true, "Defense Breached");
      this.gameWon = false;
      this.stopLoop(); // Stop the game loop

      if (this.onLoseCb) {
        console.log("Calling onLoseCb now");

        this.onLoseCb({
          score: this.inGameScore,
          level: this.currentLevelConfig.levelNumber,
          reason: "Defense breached",
        });
      }
    }
  }

  /** Handles the game win state when all enemies are defeated. */
  handleLevelComplete() {
    // this.gameOver = true;
    this.setGameOver(true, "Level Complete");
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
    this.gridManager.drawGrid(ctx);
    this.drawDefenders(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawEnergyDrops(ctx);
    this.drawCardPieceDrops(ctx);
    this.drawExplosions(ctx);
    this.drawUI(ctx);
  }

  drawEnergyDrops(ctx) {
    for (const drop of this.energyDrops) {
      drop.draw(ctx);
    }
  }

  drawCardPieceDrops(ctx) {
    for (const drop of this.cardPieceDrops) {
      drop.draw(ctx);
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
    for (const defender of this.defenders) {
      if (defender.isAlive) {
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
    //draw defender projectiles
    for (const projectile of this.projectiles) {
      // Projectile is drawn at its current startX/startY
      ctx.beginPath();
      ctx.arc(projectile.startX, projectile.startY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw enemy projectiles
    for (const projectile of this.enemyProjectiles) {
      ctx.fillStyle = projectile.color || "#FF0000"; // Red for enemies
      ctx.beginPath();
      ctx.arc(projectile.startX, projectile.startY, 4, 0, Math.PI * 2);
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
    // Fix: Save the current context state
    ctx.save();

    // Draw energy bar
    const energyPercent =
      this.inGameEnergy / this.currentLevelConfig.initialEnergy;
    ctx.fillStyle = "#333"; // Background
    ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = energyPercent > 0.3 ? "#4CAF50" : "#FF5722"; // Green or orange based on energy level
    ctx.fillRect(10, 10, 200 * energyPercent, 20);
    ctx.fillStyle = "#FFF"; // Text color
    ctx.font = "16px Arial";
    ctx.textAlign = "left"; // Set text alignment
    ctx.textBaseline = "middle"; // Fix text baseline
    ctx.fillText(`Energy: ${Math.floor(this.inGameEnergy)}`, 15, 26);

    // Draw score
    ctx.fillStyle = "#FFF";
    ctx.font = "16px Arial";
    ctx.textAlign = "right"; // Fix: Set text alignment
    ctx.textBaseline = "middle"; // Fix text baseline
    ctx.fillText(`Score: ${this.inGameScore}`, this.canvasWidth - 150, 26);

    // Draw wave info
    ctx.textAlign = "center"; // Fix: Set text alignment
    ctx.textBaseline = "middle"; // Fix text baseline
    ctx.fillText(
      `Wave: ${this.waveManager.currentWave}/${this.currentLevelConfig.waves}`,
      this.canvasWidth / 2 - 50,
      20
    );

    // Draw defense line indicator
    ctx.strokeStyle = "#FF0000"; // Red line
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.defenseLineX, 0);
    ctx.lineTo(this.defenseLineX, this.canvasHeight);
    ctx.stroke();

    //Restore the context state
    ctx.restore();
  }

  /** The main game animation loop. */
  gameLoop = () => {
    if (!this.gameOver) {
      if (!this.isPaused) {
        this.update();
        this.draw(this.ctx); // Pass context to draw
      }
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  };

  pauseGame() {
    this.isPaused = true;
  }

  resumeGame() {
    this.isPaused = false;
  }

  //setter for setting the game over with console debugging
  setGameOver(value, reason) {
    console.log(`Setting gameOver to ${value}, reason: ${reason}`);
    console.trace(); // Show call stack
    this.gameOver = value;
  }

  /** Starts the game animation loop. */
  startLoop() {
    // ADD THIS CHECK
    if (this.animationFrameId) {
      console.warn("Game loop already running! Stopping old loop.");
      this.stopLoop();
    }
    if (!this.animationFrameId && !this.gameOver) {
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
