// src/component/GameLogic (MVC)/GameEngine.js
// This file serves as the Model (game state, entities) and Controller (game logic, updates)

import {
  BasicDefender, HealerDefender, GrenadeDefender,
  BarricadeDefender, EnergyGenerator, Sniper, Mortar
} from "./DefenderUnits.js";
import {
  BasicEnemy, FastEnemy, TankEnemy, BombEnemy, RangeEnemy, ShieldEnemy,
  HealerEnemy, EMPEnemy, MiniEnemy, SplitterEnemy, VampireEnemy,
  SwarmLeader, GhostEnemy, BerserkerEnemy, NecromancerEnemy, AssassinEnemy,
  MageEnemy, TitanEnemy
} from "./EnemyUnits.js";
import { EnergyDrop } from "./GameEngineBreakDown/Drops/EnergyDrop.js";
import { CardPieceDrop} from "./GameEngineBreakDown/Drops/CardPieceDrop.js";
import { CombatManager } from "./GameEngineBreakDown/InGameManagerHandlers/CombatManager.js";
import { DropManager } from "./GameEngineBreakDown/InGameManagerHandlers/DropManager.js";
import { GridManager } from "./GameEngineBreakDown/InGameManagerHandlers/GridManager.js";
import { WaveManager } from "./GameEngineBreakDown/InGameManagerHandlers/WaveManager.js";
import { DrawExplosionEffect } from "./GameEngineBreakDown/Draws/DrawExplosionEffect.js";
import { DrawEntities } from "./GameEngineBreakDown/Draws/DrawEntities.js";
import { DrawUIs } from "./GameEngineBreakDown/Draws/DrawUIs.js";
import {AnimationManager} from "./Animation/AnimationManager.js";
import {AnimatedEnemyWrapper} from "./Animation/AnimatedEnemyWrapper.js";
import {AnimationSources} from "./Animation/AnimationSources.js";
import {AnimatedDefenderWrapper} from "./Animation/AnimatedDefenderWrapper.js";

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
    this.recentlyDiedDefenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.spellProjectiles = [];

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
    this.drawExplosionEffect = new DrawExplosionEffect(this);
    this.drawEntities = new DrawEntities(this);
    this.drawUIs = new DrawUIs(this);
    this.animationManager = null;
    this.animationSources = new AnimationSources();

    // Mapping of card names to their respective DefenderUnit classes
    this.defenderUnitClasses = {
      "Basic Cop": BasicDefender,
      "Healer Cop": HealerDefender,
      "Grenadier": GrenadeDefender,
      "Barricade": BarricadeDefender,
      "Energy Generator": EnergyGenerator,
      "Sniper": Sniper,
      "Mortar": Mortar
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
      "Vampire": VampireEnemy,
      "Ghost": GhostEnemy,
      "Berserker": BerserkerEnemy,
      "Necromancer": NecromancerEnemy,
      "Assassin": AssassinEnemy,
      "Mage": MageEnemy,
      "Titan": TitanEnemy
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
    const cardType = ['Basic Cop', 'Healer Cop', 'Grenadier',
                      'Barricade', 'Energy Generator', "Sniper", "Mortar"];
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
      totalEnemiesToSpawn: 20,
      waves: 3,
      availableEnemyTypes:  ["Vampire"],
          // ["Basic Zombie", "Fast Zombie", "Tank Zombie",
          //  "Exploder", "Skeleton Shooter", "Shielder",
          // "Healer", "Splitter", "Mini", "Swarm Witch",
          // "EMP", "Vampire", "Ghost", "Berserker", "Necromancer",
          //  "Assassin", "Mage", "Titan"],
      initialEnergy: 100000,
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
      BasicEnemy, FastEnemy, TankEnemy, BombEnemy, RangeEnemy, ShieldEnemy,
  HealerEnemy, EMPEnemy, MiniEnemy, SplitterEnemy, VampireEnemy,
  SwarmLeader, GhostEnemy, BerserkerEnemy, NecromancerEnemy, AssassinEnemy,
  MageEnemy, TitanEnemy
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
  async initialize(canvas, width, height, levelNumber) {
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

    await this.loadAllAnimations();

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

  async loadAllAnimations() {
    this.animationManager = new AnimationManager();

    //TODO: Define sprite sheet for each enemy type
     const enemyAnimations = this.animationSources.enemyAnimation();

    //load only animation for enemy in current level
    for (const enemyType of this.currentLevelConfig.availableEnemyTypes) {
      if (enemyAnimations[enemyType]) {
        await this.animationManager.loadUnitAnimation(enemyType, enemyAnimations[enemyType]);
      }
    }

    //TODO: Define sprite sheet for each defender type
    const defenderAnimations = this.animationSources.defenderAnimation();

    for (const [defenderType, animation] of Object.entries(defenderAnimations)) {
      await this.animationManager.loadUnitAnimation(defenderType, animation);
    }
  }


  spawnEnemyOfType(enemyType) {
    const EnemyClass = this.enemyClasses[enemyType];
    if (!EnemyClass) {
      console.warn(`Unknown enemy type: ${enemyType}`);
      return;
    }
    const spawnX = -100;
    const spawnY = this.gridManager.getRandomSpawnY();

    let enemy;
    if (this.animationManager?.hasAnimation(enemyType)) {
      enemy = new AnimatedEnemyWrapper(EnemyClass, spawnX, spawnY, this.animationManager);
    } else {
      enemy = new EnemyClass(spawnX, spawnY, this.getImage(enemyType));
    }
    if (enemy.setGameEngine) {
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

    //create temporary units - it will calculate its stat base on levels
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

    let newUnit;
    if (this.animationManager?.hasAnimation(cardData.name)) {
      newUnit = new AnimatedDefenderWrapper(UnitClass, deployX, deployY,
                                            cardData, this.animationManager);
    } else {
      newUnit = new UnitClass(deployX, deployY, cardData);
    }

    // Pass GameEngine reference for special abilities (e.g., Grenadier's explosion)
    if (newUnit.setGameEngine) {
      newUnit.setGameEngine(this);
    }

    this.defenders.push(newUnit);
    this.inGameEnergy -= newUnit.cost;
    this.updateEnergyCb(this.inGameEnergy); // Update UI

    //mark cell occupy
    gridCell.occupied = true;
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
  addDefenderExplosion(x, y, damage, radius, ) {
    if (this.gameOver) return;

    // Apply damage to enemies within radius
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(
        enemy.x + enemy.width / 2 - x,
        enemy.y + enemy.height / 2 - y
      ); // Distance from enemy center to explosion center
      if (distance <= radius) {
        const died = enemy.takeDamage(damage, false); //explosion does not ignore armor
        if (died && !this.gameOver) {
          if (!enemy.isSpawned) {
            //only change game score when game still playing
            this.inGameScore += enemy.bounty;
            this.updateScoreCb(this.inGameScore);
          }
          this.dropManager.handleEnemyDeath(enemy);
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
        const friendlyFire = damage * 0.3;
        console.log(`Defender ${defender.name} in explosion range, 
        taking ${friendlyFire} damage`); // Fix: Added debug logging

        defender.takeDamage(friendlyFire); // 30% damage to allies
      }
    }
  }

  addEnemyExplosion(x, y, damage, radius, ) {
    if (this.gameOver) return;

    for (const defender of this.defenders) {
      const distance = Math.hypot(
          defender.x + defender.width / 2 - x,
          defender.y + defender.height / 2 - y
      );
      if (distance <= radius) {
        defender.takeDamage(damage);
        console.log(`Enemy explosion: ${defender.name} taking ${damage} damage`);
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
    this.updateSpellProjectiles();

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

    //add recent dead enemies back to main defender for resurrection check
    if (this.recentlyDiedDefenders.length > 0) {
      this.defenders.push(...this.recentlyDiedDefenders);
      this.recentlyDiedDefenders = [];
    }
    //update all alive defenders
    for (const defender of this.defenders) {
      const actualDefender = defender instanceof AnimatedDefenderWrapper ?
                             defender.defender : defender;
      // Skip update for dead defenders, but keep them in array
        defender.update(this.enemies, this.defenders); // Pass all defenders including dead ones
    }
    //check for resurrect units
    for (const defender of this.defenders) {
      const actualDefender = defender instanceof AnimatedDefenderWrapper ?
                             defender.defender : defender;
      if (!actualDefender.isAlive && actualDefender.health > 0) {
        actualDefender.isAlive = true;
        console.log(`${actualDefender.name} resurrected!`);

        const gridCell = this.gridManager.getGridCell(
            actualDefender.x + actualDefender.width / 2,
            actualDefender.y + actualDefender.height / 2
        );
        if (gridCell && !gridCell.occupied) {
          gridCell.occupied = true;
        }
      }
    }

    this.combatManager.updateDefenderCombat(this.defenders, this.enemies, now);

    //handle disabled and other nagative effects
    for (const defender of this.defenders) {
      const actualDefender = defender instanceof AnimatedDefenderWrapper ?
                             defender.defender : defender;
      if (actualDefender.disabled && actualDefender.disabledDuration) {
        actualDefender.disabledDuration--;
        if (actualDefender.disabledDuration <= 0) {
          actualDefender.disabled = false;
        }
      }
      if (actualDefender.burning && actualDefender.burningDuration) {
        actualDefender.burningDuration--;
        if (actualDefender.burningDuration % 30 === 0) {
          actualDefender.takeDamage(actualDefender.burningDamage);
        }
        if (actualDefender.burningDuration <= 0) {
          actualDefender.burning = false;
        }
      }
    }
    //remove dead defenders and clear grid logic but keep them for one frame
    const newRecentlyDied = [];
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];
      let shouldRemove = false;
      let actualDefender;
      //handle wrapper
      if (defender instanceof AnimatedDefenderWrapper) {
        actualDefender = defender.defender;
        shouldRemove = defender.deathComplete;
        if (shouldRemove) {
          console.log(`Removing ${actualDefender.name} - death animation complete`);
        }
      } else {
        //for non-animated defenders
        actualDefender = defender;
        shouldRemove = !actualDefender.isAlive && actualDefender.health <= 0;
        if (shouldRemove) {
        //  console.log(`Removing non-animated defender ${actualDefender.name}`);
          newRecentlyDied.push(defender);
        }
      }
      //free the grid cell
      if (shouldRemove) {
      //  console.log('free cell');
        const gridCell = this.gridManager.getGridCell(
            actualDefender.x + actualDefender.width / 2,
            actualDefender.y + actualDefender.height / 2
        );
        if (gridCell) {
          gridCell.occupied = false;
        }
        this.defenders.splice(i, 1);
      }
    }
    this.recentlyDiedDefenders = newRecentlyDied;
  }

  /** Updates all enemy units. */
  updateEnemies(now) {
    if (this.gameOver) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      //handle animated enemies with death animation
      if (enemy instanceof AnimatedEnemyWrapper) {
        //remove enemy only when the death animation is completed
        if (enemy.deathComplete) {
          console.log(`🗑️ Removing ${enemy.enemy.name} - death animation complete`);
          this.enemies.splice(i, 1);
          continue;
        }
        //always call update
        enemy.update(this.defenders);

        // If enemy just died, handle game effects but DON'T remove
        const actualEnemy = enemy.enemy;
        if (!actualEnemy.isAlive && actualEnemy.health <= 0 && !enemy.isAnimationDeath) {
          // This case shouldn't happen as death is handled in takeDamage
          console.log(`⚠️ Enemy died without animation starting`);
          this.handleEnemyDeath(enemy);
        }

        // Skip further processing if death animation is playing
        // if (enemy.isAnimationDeath) {
        //   continue;
        // }
      } else {
        //regular enemy without animation
        if (!enemy || !enemy.isAlive) {
          this.enemies.splice(i, 1);
          continue;
        }
        enemy.update(this.defenders);
      }

      if (!enemy.gameEngine) {
        console.warn(`Enemy ${enemy.name} lost gameEngine reference, restoring...`);
        enemy.gameEngine = this;
      }

      const actualEnemy = enemy instanceof AnimatedEnemyWrapper ? enemy.enemy : enemy;

      // Check if enemy died during update
      if (!actualEnemy.isAlive && actualEnemy.health <= 0) {
        // For animated enemies, DON'T remove yet - let death animation play in next cycle
        if (enemy instanceof AnimatedEnemyWrapper) {
          if (!enemy.isAnimationDeath) {
            console.log(`🎬 Enemy ${actualEnemy.name} just died, death animation will start next frame`);
            // Animation will be handled in next update cycle
          }
          continue;
        } else {
          // Regular enemies get removed immediately
          this.handleEnemyDeath(enemy);
          this.enemies.splice(i, 1);
          continue;
        }
      }

      // Only check defense line for ALIVE enemies
      if (actualEnemy.isAlive && actualEnemy.x + actualEnemy.width >= this.defenseLineX) {
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
    // Get the actual enemy (unwrap if it's an AnimatedEnemyWrapper)
    const actualEnemy = enemy instanceof AnimatedEnemyWrapper ? enemy.enemy : enemy;

    if (!this.gameOver) {
      if (!actualEnemy.isSpawned && !actualEnemy.shouldExplode) {
        this.inGameScore += actualEnemy.bounty;
        this.updateScoreCb(this.inGameScore);
        this.dropManager.handleEnemyDeath(actualEnemy);
      } else {
        console.log(`Spawned enemy ${actualEnemy.name} killed - no score awarded`);
      }
    }
    if (actualEnemy.shouldExplode) {
      this.addEnemyExplosion(
          actualEnemy.x + actualEnemy.width / 2,
          actualEnemy.y + actualEnemy.height / 2,
          actualEnemy.attackDamage,
          actualEnemy.explosionRadius,
          );
    }
  }

  /** Updates all projectiles. */
  updateProjectiles() {
    if (this.gameOver) {
      return;
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      //get the actualTarget (handle the wrapper class as well)
      const actualTarget = projectile.target.enemy || projectile.target;

      // Check if target still exists and is alive
      if (!actualTarget || !actualTarget.isAlive) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx = actualTarget.x + actualTarget.width / 2 - projectile.startX;
      const dy = actualTarget.y + actualTarget.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        if (projectile.onHit) {
          projectile.onHit();
        } else {
          const died = actualTarget.takeDamage(projectile.damage, projectile.ignoreArmor);
          if (died && !this.gameOver) {
            if (!actualTarget.isSpawned) {
              this.inGameScore += actualTarget.bounty;
              this.updateScoreCb(this.inGameScore);
            }
            this.dropManager.handleEnemyDeath(actualTarget);
            const enemyIndex = this.enemies.findIndex(e => e.id === actualTarget.id);
            if (enemyIndex !== -1) {
              this.enemies.splice(enemyIndex, 1);
            }
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

      const actualTarget = projectile.target.defender || projectile.target;

      //check if target exist and alive
      if (!actualTarget || !actualTarget.isAlive) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx = actualTarget.x + actualTarget.width / 2 - projectile.startX;
      const dy = actualTarget.y + actualTarget.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        if (projectile.onHit) {
          projectile.onHit();
        } else {
          //hit target
          actualTarget.takeDamage(projectile.damage);
        }
        this.enemyProjectiles.splice(i, 1);
      } else {
        //move projectile
        const angle = Math.atan2(dy, dx);
        projectile.startX += Math.cos(angle) * projectile.speed;
        projectile.startY += Math.sin(angle) * projectile.speed;
      }
    }
  }

  updateSpellProjectiles() {
    if (this.gameOver) return;

    for (let i = this.spellProjectiles.length - 1; i >= 0; i--) {
      const spell = this.spellProjectiles[i];

      //add to trail for visual effect
      spell.trail.push({ x: spell.currentX, y: spell.currentY, timer: 20});

      //clean up old trial points
      spell.trail = spell.trail.filter(point => {
        point.timer--;
        return point.timer > 0; //timer reach zero, the effect be gone in its draw method
      });

      //move projectile
      const dx = spell.targetX - spell.currentX;
      const dy = spell.targetY - spell.currentY;
      const distance = Math.hypot(dx, dy);

      if (distance <= spell.speed) {
        //spell has reach target
        this.handleSpellImpact(spell);
        this.spellProjectiles.splice(i, 1);
      } else {
        //move toward target
        const angle = Math.atan2(dy, dx);
        spell.currentX += Math.cos(angle) * spell.speed;
        spell.currentY += Math.sin(angle) * spell.speed;
      }

    }
  }

  handleSpellImpact(spell) {
    if (!spell.target || !spell.target.isAlive) return;

    switch (spell.type) {
      case "fireball":
        //create fire explosion
        this.explosions.push({
                               x: spell.targetX,
                               y: spell.targetY,
                               damage: 0,
                               radius: 180,
                               timer: 30,
                               color: "orange",
                               innerColor: "yellow",
                               particleColor: "rgba(255, 165, 0, 0.9)",
                               style: "fireball",
                               type: "effect",
                               source: "mage"
                             });
        for (const defender of this.defenders) {
          if (!defender.isAlive || defender.id === spell.target.id) continue;
          const distance = Math.hypot(
              defender.x - spell.targetX,
              defender.y - spell.targetY
          );
          if (distance <= 180) {
            defender.takeDamage(spell.damage);
            defender.burning = true;
            defender.burningDamage = 10;
            defender.burningDuration = 180;
          }
        }
        spell.target.takeDamage(spell.damage);
        spell.target.burning = true;
        spell.target.burningDamage = 10;
        spell.target.burningDuration = 180;
            break;
      case "icebolt":
        // Create ice explosion
        this.explosions.push({
                               x: spell.targetX,
                               y: spell.targetY,
                               damage: 0,
                               radius: 150,
                               timer: 30,
                               color: "lightblue",
                               innerColor: "white",
                               particleColor: "rgba(173, 216, 230, 0.9)",
                               style: "ice",
                               type: "effect",
                               source: "mage"
                             });
        for (const defender of this.defenders) {
          if (!defender.isAlive || defender.id === spell.target.id) continue;
          const distance = Math.hypot(
              defender.x - spell.targetX,
              defender.y - spell.targetY
          );
          if (distance <= 150) {
            defender.takeDamage(spell.damage);
            defender.disabled = true;
            defender.disabledDuration = 200;
          }
        }
        // Apply damage and freeze
        spell.target.takeDamage(spell.damage);
        spell.target.disabled = true;
        spell.target.disabledDuration = 200;
        break;
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

    this.drawUIs.drawBackground(ctx);
    this.drawUIs.drawUI(ctx);
    this.gridManager.drawGrid(ctx);
    this.drawEntities.drawDefenders(ctx);
    this.drawEntities.drawEnemies(ctx);
    this.drawEntities.drawProjectiles(ctx);
    this.drawEntities.drawSpellProjectiles(ctx);
    this.drawEntities.drawEnergyDrops(ctx);
    this.drawEntities.drawCardPieceDrops(ctx);
    this.drawExplosionEffect.drawExplosions(ctx);
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
    this.defenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];
    console.log("GameEngine cleanup completed.");
  }
}
