

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

    this.defenders = [];
    this.enemies = [];
    this.explosions = [];
    this.projectiles = [];

    this.inGameEnergy = 100;
    this.inGameScore = 0;
    this.lastEnemySpawnTime = 0;
    this.enemiesSpawnedThisLevel = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.defenseLineX = 0;
    this.currentWave = 1;

    // Defender classes mapping
    this.defenderUnitClasses = {
      "Basic Cop": BasicDefender,
      "Healer Cop": HealerDefender,
      "Grenadier": GrenadeDefender,
      "Barricade": BarricadeDefender,
    };

    // Enemy classes mapping
    this.enemyClasses = {
      "Basic Zombie": BasicEnemy,
      "Fast Zombie": FastEnemy,
      "Tank Zombie": TankEnemy,
      "Exploder": BombEnemy,
    };

    // Level configurations
    this.levelConfigs = new Map();
    this.currentLevelConfig = null;
    this.loadedImages = {};

    // Initialize level configurations
    this.initLevelConfigs();
  }

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
        "Basic Zombie": "/assets/enemies/basic_zombie.png",
        "Fast Zombie": "/assets/enemies/fast_zombie.png",
      },
      defenderAssets: {
        "Basic Cop": "/assets/defenders/basic_cop.png",
        "Healer Cop": "/assets/defenders/healer_cop.png",
        Grenadier: "/assets/defenders/grenadier.png",
        Barricade: "/assets/defenders/barricade.png",
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
        "Basic Zombie": "/assets/enemies/basic_zombie.png",
        "Fast Zombie": "/assets/enemies/fast_zombie.png",
        "Tank Zombie": "/assets/enemies/tank_zombie.png",
      },
      defenderAssets: {
        "Basic Cop": "/assets/defenders/basic_cop.png",
        "Healer Cop": "/assets/defenders/healer_cop.png",
        Grenadier: "/assets/defenders/grenadier.png",
        Barricade: "/assets/defenders/barricade.png",
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
        "Basic Zombie": "/assets/enemies/basic_zombie.png",
        "Fast Zombie": "/assets/enemies/fast_zombie.png",
        "Tank Zombie": "/assets/enemies/tank_zombie.png",
        Exploder: "/assets/enemies/exploder.png",
      },
      defenderAssets: {
        "Basic Cop": "/assets/defenders/basic_cop.png",
        "Healer Cop": "/assets/defenders/healer_cop.png",
        Grenadier: "/assets/defenders/grenadier.png",
        Barricade: "/assets/defenders/barricade.png",
      },
    });
  }

  preloadImages(imagePaths) {
    const promises = [];

    for (const [name, path] of Object.entries(imagePaths)) {
      const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
          this.loadedImages[name] = img;
          resolve();
        };
        img.onerror = reject;
      });
      promises.push(promise);
    }

    return Promise.all(promises);
  }

  getImage(name) {
    return this.loadedImages[name];
  }

  initialize(ctx, width, height, levelNumber) {
    this.ctx = ctx;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.defenseLineX = width - 150; // Defense line 150px from right edge

    this.currentLevelConfig = this.levelConfigs.get(levelNumber);
    if (!this.currentLevelConfig) {
      console.error(`Level ${levelNumber} config not found. Using level 1.`);
      this.currentLevelConfig = this.levelConfigs.get(1);
    }

    // Preload all images for this level
    const allImages = {
      ...this.currentLevelConfig.enemyAssets,
      ...this.currentLevelConfig.defenderAssets,
    };

    this.preloadImages(allImages)
      .then(() => {
        this.resetGame();
        this.startLoop();
      })
      .catch((error) => {
        console.error("Error loading game assets:", error);
      });
  }

  resetGame() {
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

    this.updateEnergyCb(this.inGameEnergy);
    this.updateScoreCb(this.inGameScore);
  }

  deployDefenderUnit(cardData, x, y) {
    if (this.gameOver) return false;

    const UnitClass = this.defenderUnitClasses[cardData.name];
    if (!UnitClass) {
      console.error(`Unknown defender type: ${cardData.name}`);
      return false;
    }

    if (this.inGameEnergy < cardData.cost) {
      console.log(`Not enough energy: ${this.inGameEnergy}/${cardData.cost}`);
      return false;
    }

    // Adjust position to center of card
    const deployX = x - cardData.width / 2;
    const deployY = y - cardData.height / 2;

    // Check if position is valid (not on path, not overlapping other defenders)
    if (
      !this.isValidDeploymentPosition(
        deployX,
        deployY,
        cardData.width,
        cardData.height
      )
    ) {
      console.log("Invalid deployment position");
      return false;
    }

    const newUnit = new UnitClass(deployX, deployY, {
      ...cardData,
      image: this.getImage(cardData.name),
    });

    // Pass GameEngine reference for special abilities
    if (newUnit.setGameEngine) {
      newUnit.setGameEngine(this);
    }

    this.defenders.push(newUnit);
    this.inGameEnergy -= cardData.cost;
    this.updateEnergyCb(this.inGameEnergy);

    return true;
  }

  isValidDeploymentPosition(x, y, width, height) {
    // 1. Check if within deployable area (right half of screen)
    if (x < this.canvasWidth / 2 || x + width > this.canvasWidth) {
      return false;
    }

    // 2. Check if overlapping path (bottom 40% of screen)
    const pathTop = this.canvasHeight * 0.6;
    if (y + height > pathTop) {
      return false;
    }

    // 3. Check if overlapping existing defenders
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
        return false;
      }
    }

    return true;
  }

  checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  addExplosion(x, y, damage, radius) {
    this.explosions.push({
      x,
      y,
      damage,
      radius,
      timer: 30, // frames to display
    });

    // Apply damage to enemies
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance <= radius) {
        enemy.takeDamage(damage);
      }
    }

    // Apply reduced damage to defenders
    for (const defender of this.defenders) {
      if (!defender.isAlive) continue;

      const distance = Math.hypot(defender.x - x, defender.y - y);
      if (distance <= radius) {
        defender.takeDamage(damage * 0.3); // 30% damage to allies
      }
    }
  }

  spawnEnemy() {
    const now = Date.now();
    const config = this.currentLevelConfig;

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

      // Spawn at top with random horizontal offset
      const spawnX = -50; // Start off-screen left
      const spawnY = Math.random() * (this.canvasHeight - 100) + 50;

      const enemy = new EnemyClass(spawnX, spawnY, {
        image: this.getImage(enemyType),
      });

      this.enemies.push(enemy);
      this.lastEnemySpawnTime = now;
      this.enemiesSpawnedThisLevel++;
    }
  }

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

  updateDefenders(now) {
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const defender = this.defenders[i];

      if (!defender.isAlive) {
        this.defenders.splice(i, 1);
        continue;
      }

      defender.update(this.enemies, this.defenders);

      // Handle defender attacks
      if (defender.canAttack(now)) {
        const target = this.findTargetForDefender(defender);
        if (target) {
          defender.attack(target, now);

          // Create projectile for ranged attackers
          if (defender.isRanged) {
            this.projectiles.push({
              startX: defender.x + defender.width / 2,
              startY: defender.y + defender.height / 2,
              targetX: target.x + target.width / 2,
              targetY: target.y + target.height / 2,
              speed: 10,
              damage: defender.attackDamage,
              progress: 0,
              maxProgress: 100,
            });
          }
        }
      }
    }
  }

  findTargetForDefender(defender) {
    // Find closest enemy in range
    let closestEnemy = null;
    let closestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      const distance = Math.hypot(defender.x - enemy.x, defender.y - enemy.y);

      if (distance <= defender.range && distance < closestDistance) {
        closestEnemy = enemy;
        closestDistance = distance;
      }
    }

    return closestEnemy;
  }

  updateEnemies(now) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (!enemy.isAlive) {
        // Handle enemy death
        this.inGameScore += enemy.bounty;
        this.updateScoreCb(this.inGameScore);

        // Handle special death effects
        if (enemy.shouldExplode) {
          this.addExplosion(
            enemy.x,
            enemy.y,
            enemy.explosionDamage,
            enemy.explosionRadius
          );
        }

        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(this.defenders);

      // Move enemy toward defense line
      if (!enemy.isAttacking) {
        enemy.x += enemy.speed;

        // Check if reached defense line
        if (enemy.x >= this.defenseLineX) {
          this.handleDefenseBreached();
          return;
        }
      }

      // Handle enemy special abilities
      if (enemy.activateSpecialAbility) {
        enemy.activateSpecialAbility(this.defenders);
      }
    }
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.progress += projectile.speed;

      if (projectile.progress >= projectile.maxProgress) {
        // Apply damage when projectile reaches target
        for (const enemy of this.enemies) {
          if (!enemy.isAlive) continue;

          const distance = Math.hypot(
            enemy.x - projectile.targetX,
            enemy.y - projectile.targetY
          );

          if (distance < enemy.width / 2) {
            enemy.takeDamage(projectile.damage);
            break;
          }
        }

        this.projectiles.splice(i, 1);
      }
    }
  }

  updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer--;

      if (this.explosions[i].timer <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  checkGameConditions() {
    // Check lose condition: defense breached
    for (const enemy of this.enemies) {
      if (enemy.x >= this.defenseLineX) {
        this.handleDefenseBreached();
        return;
      }
    }

    // Check win condition: all enemies defeated and spawned
    const config = this.currentLevelConfig;
    if (
      this.enemiesSpawnedThisLevel >= config.totalEnemiesToSpawn &&
      this.enemies.length === 0
    ) {
      this.handleLevelComplete();
    }
  }

  handleDefenseBreached() {
    this.gameOver = true;
    this.gameWon = false;
    this.stopLoop();

    if (this.onLoseCb) {
      this.onLoseCb({
        score: this.inGameScore,
        level: this.currentLevelConfig.levelNumber,
        reason: "Defense breached",
      });
    }
  }

  handleLevelComplete() {
    this.gameOver = true;
    this.gameWon = true;
    this.stopLoop();

    if (this.onWinCb) {
      this.onWinCb({
        score: this.inGameScore,
        level: this.currentLevelConfig.levelNumber,
      });
    }
  }

  draw(ctx) {
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw background
    this.drawBackground(ctx);

    // Draw game objects
    this.drawDefenders(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawExplosions(ctx);
    this.drawUI(ctx);

    // Draw game over/win message
    if (this.gameOver) {
      this.drawGameOverScreen(ctx);
    }
  }

  drawBackground(ctx) {
    // Draw sky
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight * 0.6);

    // Draw ground
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(
      0,
      this.canvasHeight * 0.6,
      this.canvasWidth,
      this.canvasHeight * 0.4
    );

    // Draw garden (defense area)
    ctx.fillStyle = "#2E8B57";
    ctx.fillRect(this.defenseLineX, 0, 10, this.canvasHeight);

    // Draw garden details
    ctx.fillStyle = "#228B22";
    for (let i = 0; i < 5; i++) {
      const y = this.canvasHeight * 0.7 + i * 30;
      ctx.beginPath();
      ctx.arc(this.defenseLineX + 30, y, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDefenders(ctx) {
    for (const defender of this.defenders) {
      if (defender.isAlive) {
        defender.draw(ctx);
      }
    }
  }

  drawEnemies(ctx) {
    for (const enemy of this.enemies) {
      if (enemy.isAlive) {
        enemy.draw(ctx);
      }
    }
  }

  drawProjectiles(ctx) {
    ctx.fillStyle = "#FF0000";

    for (const projectile of this.projectiles) {
      const progress = projectile.progress / projectile.maxProgress;
      const x =
        projectile.startX + (projectile.targetX - projectile.startX) * progress;
      const y =
        projectile.startY + (projectile.targetY - projectile.startY) * progress;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawExplosions(ctx) {
    for (const explosion of this.explosions) {
      const radius = explosion.radius * (explosion.timer / 30);
      const alpha = explosion.timer / 30;

      ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawUI(ctx) {
    // Draw energy bar
    const energyPercent =
      this.inGameEnergy / this.currentLevelConfig.initialEnergy;
    ctx.fillStyle = "#333";
    ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = energyPercent > 0.3 ? "#4CAF50" : "#FF5722";
    ctx.fillRect(10, 10, 200 * energyPercent, 20);
    ctx.fillStyle = "#FFF";
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
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.defenseLineX, 0);
    ctx.lineTo(this.defenseLineX, this.canvasHeight);
    ctx.stroke();
  }

  drawGameOverScreen(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = "#FFF";
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

  gameLoop = () => {
    this.update();
    this.draw(this.ctx);

    if (!this.gameOver) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  };

  startLoop() {
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
