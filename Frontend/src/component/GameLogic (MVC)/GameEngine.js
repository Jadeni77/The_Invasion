// src/component/GameLogic (MVC)/GameEngine.js
// This file serves as the Model (game state, entities) and Controller (game logic, updates)

import {
  BasicDefender,
  HealerDefender,
  GrenadeDefender,
  BarricadeDefender,
  EnergyGenerator,
  Sniper,
  Mortar,
  FrostArcher,
  FireBlast,
  IceBomb,
  DefenderUnit,
} from "./DefenderUnits.js";
import {
  BasicEnemy,
  FastEnemy,
  TankEnemy,
  BombEnemy,
  RangeEnemy,
  ShieldEnemy,
  HealerEnemy,
  EMPEnemy,
  MiniEnemy,
  SplitterEnemy,
  VampireEnemy,
  SwarmLeader,
  GhostEnemy,
  BerserkerEnemy,
  NecromancerEnemy,
  AssassinEnemy,
  MageEnemy,
  TitanEnemy,
} from "./EnemyUnits.js";
import { EnergyDrop } from "./GameEngineBreakDown/Drops/EnergyDrop.js";
import { CardPieceDrop } from "./GameEngineBreakDown/Drops/CardPieceDrop.js";
import { CombatManager } from "./GameEngineBreakDown/InGameManagerHandlers/CombatManager.js";
import { DropManager } from "./GameEngineBreakDown/InGameManagerHandlers/DropManager.js";
import { GridManager } from "./GameEngineBreakDown/InGameManagerHandlers/GridManager.js";
import { WaveManager } from "./GameEngineBreakDown/InGameManagerHandlers/WaveManager.js";
import { DrawExplosionEffect } from "./GameEngineBreakDown/Draws/DrawExplosionEffect.js";
import { DrawEntities } from "./GameEngineBreakDown/Draws/DrawEntities.js";
import { DrawUIs } from "./GameEngineBreakDown/Draws/DrawUIs.js";
import { AnimationManager } from "./Animation/AnimationManager.js";
import { AnimationSources } from "./Animation/AnimationSources.js";
import { AssetManifest } from "../../assets/AssetManifest.js";
import { GameLevelConfigs } from "./GameEngineBreakDown/GameLevelConfigs.js";
import { GameClock } from "./Feedback/GameClock.js";

export class GameEngine {
  constructor(
    updateEnergyCb,
    updateScoreCb,
    onWinCb,
    onLoseCb,
    updateBaseHealthCb,
    updateEndlessWaveCb,
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
    this.updateEndlessWaveCb = updateEndlessWaveCb || null;

    this.playerSelectedCards = [];

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

    // Achievement stat tracking
    this.enemiesKilled = 0;
    this.defendersDeployed = 0;
    this.energyCollected = 0;
    this.defendersLost = 0;
    this.baseDamageTaken = 0;
    this.levelStartTime = Date.now();
    this.defenseLineX = 0; // Dynamic based on canvas width

    this.updateBaseHealthCb = updateBaseHealthCb;
    this.baseHealth = 100;
    this.isPaused = false;

    this.energyDrops = [];
    this.cardPieceDrops = [];
    this.onCardPieceCollected = null;

    this.waveManager = null;
    this.gridManager = null;
    this.gameClock = new GameClock();
    this.lastFrameTime = null;
    this.dropManager = new DropManager(this);
    this.combatManager = new CombatManager(this);
    this.drawExplosionEffect = new DrawExplosionEffect(this);
    this.drawEntities = new DrawEntities(this);
    this.drawUIs = new DrawUIs(this);
    this.animationManager = null;
    this.animationSources = new AnimationSources();
    this.gameLevelConfigs = new GameLevelConfigs(this);

    // Mapping of card names to their respective DefenderUnit classes
    this.defenderUnitClasses = {
      Shooter: BasicDefender,
      Healer: HealerDefender,
      Grenadier: GrenadeDefender,
      Barricade: BarricadeDefender,
      "E-Gen": EnergyGenerator,
      Sniper: Sniper,
      Mortar: Mortar,
      "Frost Archer": FrostArcher,
      "Fire Blast": FireBlast,
      "Ice Bomb": IceBomb,
    };

    // Mapping of enemy names to their respective Enemy classes
    this.enemyClasses = {
      "Basic Zombie": BasicEnemy,
      "Fast Zombie": FastEnemy,
      "Tank Zombie": TankEnemy,
      Exploder: BombEnemy,
      "Skeleton Shooter": RangeEnemy,
      Shielder: ShieldEnemy,
      Healer: HealerEnemy,
      Splitter: SplitterEnemy,
      Mini: MiniEnemy,
      "Swarm Witch": SwarmLeader,
      EMP: EMPEnemy,
      Vampire: VampireEnemy,
      Ghost: GhostEnemy,
      Berserker: BerserkerEnemy,
      Necromancer: NecromancerEnemy,
      Assassin: AssassinEnemy,
      Mage: MageEnemy,
      Titan: TitanEnemy,
    };

    // Level configurations and loaded assets
    this.levelConfigs = new Map();
    this.currentLevelConfig = null;

    // Initialize level configurations on construction
    this.gameLevelConfigs.initLevelConfigs();
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
        this.inGameEnergy = Math.min(9999, this.inGameEnergy + drop.amount);
        this.energyCollected++;
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

    const availableDefenderType = this.playerSelectedCards
      .map((card) => card.name)
      .filter((name) => name); //remove undefine/null

    const randomCard =
      availableDefenderType[
        Math.floor(Math.random() * availableDefenderType.length)
      ];
    this.cardPieceDrops.push(new CardPieceDrop(x, y, randomCard));
  }

  setPlayerSelectedCards(cards) {
    this.playerSelectedCards = cards;
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

  showWaveAnnouncement(waveNumber, isBoss) {
    if (this.drawUIs && this.drawUIs.showWaveAnnouncement(waveNumber, isBoss)) {
      this.drawUIs.showWaveAnnouncement(waveNumber, isBoss);
    }
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
    this.defenseLineX = width - 60; // Defense line 150px from right edge

    // Get the configuration for the selected level
    this.currentLevelConfig = this.levelConfigs.get(levelNumber);
    if (!this.currentLevelConfig) {
      console.error(
        `Level ${levelNumber} config not found. Defaulting to level 1.`,
      );
      this.currentLevelConfig = this.levelConfigs.get(1);
      // Ensure levelNumber is correctly set even if defaulting
      if (this.currentLevelConfig) {
        this.currentLevelConfig.levelNumber = 1; // Default to level 1
      }
    }

    //initialize grid for game
    this.gridManager = new GridManager(width, height, levelNumber);
    this.gridManager.initializeGrid();
    //initialize wave manager
    this.waveManager = new WaveManager(
      this.currentLevelConfig,
      (enemyType, options) => this.spawnEnemyOfType(enemyType, options),
      this,
    );

    await this.loadAllAnimations();
    this.resetGame();
    this.startLoop();
  }

  async loadAllAnimations() {
    this.animationManager = new AnimationManager();
    this.animationSources = new AnimationSources();

    // Load only animations for enemies/defenders in current level
    const enemyAnimations = await this.animationSources.getEnemyAnimations(
      this.currentLevelConfig.availableEnemyTypes,
    );

    // Get defender types from available cards
    const defenderTypes = Object.keys(this.defenderUnitClasses);
    const defenderAnimations =
      await this.animationSources.getDefenderAnimations(defenderTypes);

    // Load into AnimationManager
    for (const [enemyType, animations] of Object.entries(enemyAnimations)) {
      if (animations) {
        await this.animationManager.loadUnitAnimation(enemyType, animations);
      }
    }

    for (const [defenderType, animations] of Object.entries(
      defenderAnimations,
    )) {
      if (animations) {
        await this.animationManager.loadUnitAnimation(defenderType, animations);
      }
    }
  }

  spawnEnemyOfType(enemyType, options = {}) {
    const EnemyClass = this.enemyClasses[enemyType];
    if (!EnemyClass) {
      console.warn(`Unknown enemy type: ${enemyType}`);
      return;
    }

    const spawnX = this.gridManager.getEnemySpawnX();
    const row = this.gridManager.getRandomSpawnRow();
    const rowCenterY = this.gridManager.getRowCenterY(row);
    const enemy = new EnemyClass(spawnX, rowCenterY, null);

    if (options.isBoss) {
      enemy.isBoss = true;
      enemy.health    = Math.floor(enemy.health    * 2.5);
      enemy.maxHealth = Math.floor(enemy.maxHealth * 2.5);
      enemy.attackDamage = Math.floor(enemy.attackDamage * 2);
      enemy.bounty    = Math.floor(enemy.bounty    * 2);
    }

    // Center the sprite vertically on the row so tall zombies (e.g. Titan)
    // don't visually overflow into a non-existent 7th lane.
    enemy.y = rowCenterY - enemy.height / 2;

    if (
      this.animationManager &&
      this.animationManager.hasAnimation(enemyType)
    ) {
      const frames = {
        idle: this.animationManager.getFrames(enemyType, "idle"),
        move: this.animationManager.getFrames(enemyType, "move"),
        attack: this.animationManager.getFrames(enemyType, "attack"),
        death: this.animationManager.getFrames(enemyType, "death"),
      };

      enemy.animationFrames = frames;
      enemy.animationConfig = AssetManifest.enemies[enemyType]?.config;
    }

    if (enemy.setGameEngine) {
      enemy.setGameEngine(this);
    }

    this.enemies.push(enemy);
  }

  attachAnimationsToEnemy(enemy, enemyType) {
    if (
      this.animationManager &&
      this.animationManager.hasAnimation(enemyType)
    ) {
      const frames = {
        idle: this.animationManager.getFrames(enemyType, "idle"),
        move: this.animationManager.getFrames(enemyType, "move"),
        attack: this.animationManager.getFrames(enemyType, "attack"),
        death: this.animationManager.getFrames(enemyType, "death"),
      };

      enemy.animationFrames = frames;
      enemy.animationConfig = AssetManifest.enemies[enemyType]?.config;
      console.log(`Attached animations to ${enemyType}`);
    }
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
    this.enemiesKilled = 0;
    this.defendersDeployed = 0;
    this.energyCollected = 0;
    this.defendersLost = 0;
    this.baseDamageTaken = 0;
    this.levelStartTime = Date.now();
    this.gameClock.reset();
    this.lastFrameTime = null;

    if (this.waveManager) {
      this.waveManager.reset();
      this.waveManager.lastSpawnTime = this.gameClock.now + 5000; // 5 second delay
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
    console.trace();
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

    const gridCell = this.gridManager.getGridCell(x, y);

    if (!gridCell || gridCell.occupied) {
      console.log("Invalid grid cell or cell is occupied/road");
      return false;
    }

    const UnitClass = this.defenderUnitClasses[cardData.name];
    if (!UnitClass) {
      console.error(`Unknown defender type: ${cardData.name}`);
      return false;
    }

    const tempUnit = new UnitClass(0, 0, cardData);

    if (this.inGameEnergy < cardData.cost) {
      console.log(`Not enough energy: ${this.inGameEnergy}/${cardData.cost}`);
      return false;
    }

    let deployX = gridCell.x + (this.gridManager.gridSize - tempUnit.width) / 2;
    let deployY =
      gridCell.y + (this.gridManager.gridSize - tempUnit.height) / 2;

    if (deployX < this.gridManager.gridOffsetX) {
      deployX = this.gridManager.gridOffsetX;
    }

    if (
      !this.isValidDeploymentPosition(
        deployX,
        deployY,
        tempUnit.width,
        tempUnit.height,
      )
    ) {
      console.log("Invalid deployment position");
      return false;
    }

    const newUnit = new UnitClass(deployX, deployY, cardData);

    // ADD THIS: Attach animation frames if available
    if (
      this.animationManager &&
      this.animationManager.hasAnimation(cardData.name)
    ) {
      const frames = {
        idle: this.animationManager.getFrames(cardData.name, "idle"),
        attack: this.animationManager.getFrames(cardData.name, "attack"),
        death: this.animationManager.getFrames(cardData.name, "death"),
      };

      newUnit.animationFrames = frames;
      newUnit.animationConfig = AssetManifest.defenders[cardData.name]?.config;
    }

    if (newUnit.setGameEngine) {
      newUnit.setGameEngine(this);
    }

    this.defenders.push(newUnit);
    this.defendersDeployed++;
    this.inGameEnergy -= newUnit.cost;
    this.updateEnergyCb(this.inGameEnergy);

    gridCell.occupied = true;

    return true;
  }

  /**
   * Removes a defender at the specified coordinates
   * @param {number} x - X coordinate where the click happened
   * @param {number} y - Y coordinate where the click happened
   * @returns {boolean} True if a defender was removed, false otherwise
   */
  removeDefenderAt(x, y) {
    if (this.gameOver) return;

    //find defender at this position
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];
      console.log("Remove method call");

      //check if click is within defender bound
      if (
        x >= defender.x &&
        x <= defender.x + defender.width &&
        y >= defender.y &&
        y <= defender.y + defender.height
      ) {
        //only remove if alive
        if (!defender.isAlive) {
          console.log("Cannot remove dead defender");
          return;
        }
        //free cell
        const gridCell = this.gridManager.getGridCell(
          defender.x + defender.width / 2,
          defender.y + defender.height / 2,
        );
        if (gridCell) {
          gridCell.occupied = false;
        }
        //remove defender
        this.defenders.splice(i, 1);

        console.log(`Removed defender: ${defender.name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Set the hovered defender based on mouse position. Used to gate range
   * indicators so they only appear for the unit the player is inspecting,
   * avoiding visual clutter when many defenders are on the field.
   */
  setHoveredDefender(x, y) {
    let hovered = null;
    for (const defender of this.defenders) {
      if (!defender.isAlive) continue;
      if (
        x >= defender.x &&
        x <= defender.x + defender.width &&
        y >= defender.y &&
        y <= defender.y + defender.height
      ) {
        hovered = defender;
        break;
      }
    }
    for (const defender of this.defenders) {
      defender.showRangeIndicators = defender === hovered;
    }
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
    // Check if within canvas bounds
    if (
      x < 0 ||
      x + width > this.canvasWidth ||
      y < 0 ||
      y + height > this.canvasHeight
    ) {
      return false;
    }
    // Check if overlapping existing defenders
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
          defender.height,
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
  addDefenderExplosion(x, y, damage, radius) {
    if (this.gameOver) return;

    // Apply damage to enemies within radius
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(
        enemy.x + enemy.width / 2 - x,
        enemy.y + enemy.height / 2 - y,
      ); // Distance from enemy center to explosion center
      if (distance <= radius) {
        const died = enemy.takeDamage(damage, false); //explosion does not ignore armor
        if (died && !this.gameOver) {
          if (!enemy.isSpawned) {
            //only change game score when game still playing
            this.inGameScore += enemy.bounty;
            this.enemiesKilled++;
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
        defender.y + defender.height / 2 - y,
      ); // Distance from defender center to explosion center
      if (distance <= radius) {
        const friendlyFire = damage * 0.3;
        console.log(`Defender ${defender.name} in explosion range, 
        taking ${friendlyFire} damage`); // Fix: Added debug logging

        defender.takeDamage(friendlyFire); // 30% damage to allies
      }
    }
  }

  addEnemyExplosion(x, y, damage, radius) {
    if (this.gameOver) return;

    for (const defender of this.defenders) {
      const distance = Math.hypot(
        defender.x + defender.width / 2 - x,
        defender.y + defender.height / 2 - y,
      );
      if (distance <= radius) {
        defender.takeDamage(damage);
        console.log(
          `Enemy explosion: ${defender.name} taking ${damage} damage`,
        );
      }
    }
  }

  /** Main update loop for the game state. */
  update() {
    if (this.gameOver || this.isPaused) {
      // Drop the frame reference so the pause does not count as one huge frame.
      this.lastFrameTime = null;
      return;
    }

    const realNow = performance.now();
    const deltaMs = this.lastFrameTime === null ? 0 : realNow - this.lastFrameTime;
    this.lastFrameTime = realNow;

    this.gameClock.advance(deltaMs);
    const now = this.gameClock.now;

    this.waveManager.update(now, this.enemies.length, this.gameOver);

    // Track endless wave progression
    if (this.currentLevelConfig?.isEndless && this.updateEndlessWaveCb) {
      this.updateEndlessWaveCb(this.waveManager.currentWave);
    }

    if (this.drawUIs) {
      this.drawUIs.update();
    }

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

    // Re-add recently died defenders ONLY for resurrection check
    if (this.recentlyDiedDefenders.length > 0) {
      this.defenders.push(...this.recentlyDiedDefenders);
      this.recentlyDiedDefenders = [];
    }

    // Update all defenders (alive and dead playing animations)
    for (const defender of this.defenders) {
      if (defender.isAlive) {
        defender.update(this.enemies, this.defenders);
      } else {
        // Dead defenders only update their animation
        if (!defender.deathHandled) {
          defender.deathHandled = true;
          this.defendersLost++;
        }
        // Still update animation for dead units
        if (defender.currentAnimation !== "death") {
          defender.setAnimation("death");
        }
        defender.updateAnimation();
      }
    }

    // Check for resurrection
    for (const defender of this.defenders) {
      if (!defender.isAlive && defender.health > 0) {
        defender.isAlive = true;
        defender.isPlayingDeathAnimation = false;
        defender.deathAnimationComplete = false;
        defender.deathHandled = false;
        console.log(`${defender.name} resurrected!`);

        const gridCell = this.gridManager.getGridCell(
          defender.x + defender.width / 2,
          defender.y + defender.height / 2,
        );
        if (gridCell && !gridCell.occupied) {
          gridCell.occupied = true;
        }
      }
    }

    // Combat updates for alive defenders only
    this.combatManager.updateDefenderCombat(
      this.defenders.filter((d) => d.isAlive),
      this.enemies,
      now,
    );

    // Handle status effects for alive defenders
    for (const defender of this.defenders) {
      if (!defender.isAlive) continue;

      if (defender.disabled && defender.disabledDuration) {
        defender.disabledDuration--;
        if (defender.disabledDuration <= 0) {
          defender.disabled = false;
        }
      }
      if (defender.burning && defender.burningDuration) {
        defender.burningDuration--;
        if (defender.burningDuration % 30 === 0) {
          defender.takeDamage(defender.burningDamage);
        }
        if (defender.burningDuration <= 0) {
          defender.burning = false;
        }
      }
    }

    // Remove dead defenders - FIXED LOGIC
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];

      // Only check dead defenders
      if (!defender.isAlive && defender.health <= 0) {
        if (defender.deathAnimationComplete) {
          // Animation complete, remove the defender
          const gridCell = this.gridManager.getGridCell(
            defender.x + defender.width / 2,
            defender.y + defender.height / 2,
          );
          if (gridCell) {
            gridCell.occupied = false;
          }
          this.defenders.splice(i, 1);
          console.log(`${defender.name} removed after death animation`);
        }
        // If death animation not complete, keep the defender in array
      }
    }

    // Clear the recently died array - don't keep them
    this.recentlyDiedDefenders = [];
  }

  /** Updates all enemy units. */
  updateEnemies(now) {
    if (this.gameOver) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      //Handle Enemy negative effects
      if (enemy.slowed && enemy.slowDuration) {
        enemy.slowDuration--;
        if (enemy.slowDuration <= 0) {
          enemy.slowed = false;
          if (enemy.initialSpeed) {
            enemy.speed = enemy.initialSpeed;
          }
        }
      }
      if (enemy.frozen && enemy.frozenDuration) {
        enemy.frozenDuration--;
        if (enemy.frozenDuration <= 0) {
          enemy.frozen = false;
          if (enemy.initialSpeed) {
            enemy.speed = enemy.initialSpeed;
          }
        }
      }
      if (enemy.stunned && enemy.stunnedDuration) {
        enemy.stunnedDuration--;
        if (enemy.stunnedDuration <= 0) {
          enemy.stunned = false;
        }
      }
      if (enemy.burning && enemy.burningDuration) {
        enemy.burningDuration--;
        if (enemy.burningDuration <= 0) {
          enemy.burning = false;
        }
      }

      // Remove enemy only if death animation is complete
      if (enemy.deathAnimationComplete) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (!enemy.gameEngine) {
        console.warn(
          `Enemy ${enemy.name} lost gameEngine reference, restoring...`,
        );
        enemy.gameEngine = this;
      }

      // Update enemy (movement, attacks, and animations)
      enemy.update(this.defenders);

      // Check if enemy just died and hasn't been handled yet
      if (!enemy.isAlive && !enemy.deathHandled) {
        this.handleEnemyDeath(enemy);
        enemy.deathHandled = true; // Mark as handled
        continue;
      }

      // Skip further checks if enemy is playing death animation
      if (enemy.isPlayingDeathAnimation) {
        continue;
      }

      // Only check defense line for ALIVE enemies
      if (enemy.isAlive && enemy.x + enemy.width >= this.defenseLineX) {
        if (!this.gameOver) {
          const damage = 10;
          this.baseDamageTaken += damage;
          this.baseHealth = Math.max(0, this.baseHealth - damage);

          if (this.updateBaseHealthCb) {
            this.updateBaseHealthCb(this.baseHealth);
          }

          if (this.baseHealth <= 0) {
            this.handleDefenseBreached();
          }
        }
        // Remove enemy that reached defense line immediately
        this.enemies.splice(i, 1);
      }
    }

    this.combatManager.updateEnemyCombat(this.defenders, this.enemies, now);
  }

  handleEnemyDeath(enemy) {
    if (!this.gameOver) {
      if (!enemy.isSpawned && !enemy.shouldExplode) {
        this.inGameScore += enemy.bounty;
        this.enemiesKilled++;
        this.updateScoreCb(this.inGameScore);
        this.dropManager.handleEnemyDeath(enemy);
        this.waveManager.totalEnemiesKilled++;
      } else {
        console.log(`Spawned enemy ${enemy.name} killed - no score awarded`);
      }
    }

    if (enemy.shouldExplode && enemy.exploderBySelf) {
      this.addEnemyExplosion(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.attackDamage,
        enemy.explosionRadius,
      );
    } else if (enemy.shouldExplode && !enemy.exploderBySelf) {
      this.addEnemyExplosion(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.attackDamage / 2,
        enemy.explosionRadius / 2,
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

      // Check if target still exists and is alive
      if (!projectile.target || !projectile.target.isAlive) {
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
        if (projectile.onHit) {
          projectile.onHit();
        } else {
          const died = projectile.target.takeDamage(
            projectile.damage,
            projectile.ignoreArmor,
          );
          if (died && !this.gameOver) {
            if (!projectile.target.isSpawned) {
              this.inGameScore += projectile.target.bounty;
              this.enemiesKilled++;
              this.updateScoreCb(this.inGameScore);
            }
            this.dropManager.handleEnemyDeath(projectile.target);
            const enemyIndex = this.enemies.findIndex(
              (e) => e.id === projectile.target.id,
            );
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

      //check if target exist and alive
      if (!projectile.target || !projectile.target.isAlive) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Calculate direction and move projectile
      const dx =
        projectile.target.x + projectile.target.width / 2 - projectile.startX;
      const dy =
        projectile.target.y + projectile.target.height / 2 - projectile.startY;
      const distance = Math.hypot(dx, dy);

      if (distance <= projectile.speed) {
        if (projectile.onHit) {
          projectile.onHit();
        } else {
          //hit target
          projectile.target.takeDamage(projectile.damage);
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
      spell.trail.push({ x: spell.currentX, y: spell.currentY, timer: 20 });

      //clean up old trial points
      spell.trail = spell.trail.filter((point) => {
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
          source: "mage",
        });
        for (const defender of this.defenders) {
          if (!defender.isAlive || defender.id === spell.target.id) continue;
          const distance = Math.hypot(
            defender.x - spell.targetX,
            defender.y - spell.targetY,
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
          source: "mage",
        });
        for (const defender of this.defenders) {
          if (!defender.isAlive || defender.id === spell.target.id) continue;
          const distance = Math.hypot(
            defender.x - spell.targetX,
            defender.y - spell.targetY,
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

    // Endless mode has different win conditions (none - it's endless!)
    if (this.currentLevelConfig.isEndless) {
      // Endless mode continues until player loses
      return;
    }

    // Win condition: all enemies spawned AND all active enemies are dead
    const config = this.currentLevelConfig;
    const allEnemiesSpawned =
      this.waveManager.allWavesComplete ||
      this.waveManager.enemiesSpawnedThisLevel >= config.totalEnemiesToSpawn;
    const allEnemiesDead = this.enemies.every((enemy) => !enemy.isAlive);

    const allAnimationsComplete = this.areAllDeathAnimationsComplete();

    if (
      !this.gameOver &&
      allEnemiesSpawned &&
      allEnemiesDead &&
      allAnimationsComplete &&
      this.cardPieceDrops.length === 0
    ) {
      this.handleLevelComplete(); // Trigger win condition
    }
  }

  areAllDeathAnimationsComplete() {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive && !enemy.deathAnimationComplete) {
        return false;
      }
    }
    for (const defender of this.defenders) {
      if (!defender.isAlive && !defender.deathAnimationComplete) {
        return false;
      }
    }
    return true;
  }

  // /** Handles the game over state when defense is breached. */
  handleDefenseBreached() {
    if (!this.gameOver) {
      // this.gameOver = true;
      this.setGameOver(true, "Defense Breached");
      this.stopLoop(); // Stop the game loop

      if (this.currentLevelConfig.levelNumber === 999) {
        if (this.onLoseCb) {
          this.onLoseCb({
            score: this.inGameScore,
            level: 999,
            reason: "Defense breached",
            endlessWave: this.waveManager ? this.waveManager.currentWave : 0,
            enemiesKilled: this.enemiesKilled,
            defendersDeployed: this.defendersDeployed,
            energyCollected: this.energyCollected,
          });
        }
      } else {
        if (this.onLoseCb) {
          console.log("Calling onLoseCb now");

          this.onLoseCb({
            score: this.inGameScore,
            level: this.currentLevelConfig.levelNumber,
            reason: "Defense breached",
            enemiesKilled: this.enemiesKilled,
            defendersDeployed: this.defendersDeployed,
            energyCollected: this.energyCollected,
          });
        }
      }
    }
  }

  /** Handles the game win state when all enemies are defeated. */
  handleLevelComplete() {
    if (this.currentLevelConfig.isEndless) {
      return;
    }
    this.setGameOver(true, "Level Complete");
    this.stopLoop(); // Stop the game loop

    if (this.onWinCb) {
      this.onWinCb({
        score: this.inGameScore,
        level: this.currentLevelConfig.levelNumber,
        enemiesKilled: this.enemiesKilled,
        defendersDeployed: this.defendersDeployed,
        energyCollected: this.energyCollected,
        defendersLost: this.defendersLost,
        baseDamageTaken: this.baseDamageTaken,
        timeElapsed: Date.now() - this.levelStartTime,
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
