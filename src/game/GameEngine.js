//This file serves as the Model and Controller

class Enermy {
  constructor(x, y, typeData = {}) {
    this.x = x;
    this.y = y;
    this.width = typeData.width || 30;
    this.height = typeData.height || 30;
    this.speed = typeData.speed || 0.8;
    this.health = typeData.health || 100;
    this.color = typeData.color || "darkgreen";
    this.name = typeData.name || "Basic Zombie";
    this.isAlive = true;
    this.id = Math.random();
    // Add any base special abilities/timers here if all zombies might have them
  }

  /**
   * Movement Path
   */
  update() {
    if (this.isAlive) {
      this.x += this.speed;
    } else {
      return;
    }
  }

  draw(ctx) {
    if (!this.isAlive) return;
    ctx.fillStyle = "darkgreen";
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.fillText(this.health, this.x, this.y - 5);
    ctx.fillText(this.name, this.x, this.y + this.height + 10);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
      this.isAlive = false;
    }
    //could add effects here, e.g., if health drops below 50%, rage effect
  }

  activateSpecialAbility(gameEntities) {
    //default does not have any but can be overriden
  }
}

class FastEnermy extends Enermy {
  constructor(x, y) {
    super(x, y, {
      name: "Fast Zombie",
      speed: 1.5, //faster
      health: 80, //less health
      color: "darkorange",
      width: 25,
      height: 25,
    });
  }
}

class TankEnermy extends Enermy {
  constructor(x, y) {
    super(x, y, {
      name: "Tank Zombie",
      speed: 0.5, //slower
      health: 400,
      width: 40,
      height: 40,
      color: "darkred",
    });
  }

  takeDamage(amount) {
    super.takeDamage(amount);
    if (this.health <= 300) {
      const newDamage = amount * 0.5; //50% reduction
      super.takeDamage(newDamage);
    }
    //can add visual armor
  }
}

class BombEnermy extends Enermy {
  constructor(x, y) {
    super(x, y, {
      name: "Exploder",
      speed: 1.2,
      health: 120,
      width: 35,
      height: 35,
      color: "purple",
    });
    this.explosionRadius = 100;
    this.explosionDamage = 200;
  }

  //explode on death
  takeDamage(amount) {
    super.takeDamage(amount);
    if (!this.isAlive && this.health <= 0) {
      //Trigger Explosion Logic
      //TODO: After Handle Defender
    }
    this.shouldExplode = true;
  }

  activateSpecialAbility(defender) {
    //If close then explode
    const nearestDefender = defender.find(
      (defender) =>
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
    if (this.isAlive && this.health < 50) {
      ctx.beginPath();
      ctx.arc(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2 + Math.sin(Date.now() / 100) * 5,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "yellow";
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
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillText();
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.substring(0, 5), this.x + 2, this.y + 25);
    //health bar
    ctx.fillStyle = "red";
    ctx.fillRect(this.x, this.y - 10, this.width, 5); // Background of health bar
    ctx.fillStyle = "lime";
    const healthWidth = (this.health / this.maxHealth) * this.width;
    ctx.fillRect(this.x, this.y - 10, healthWidth, 5); //current health
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
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
    });
    this.healingCountDown = this.healingRate;
    this.healingRange = cardData.healingRange || 80;
  }

  update(enermy, defenderUnits) {
    super.update(enermy, defenderUnits);

    //Healing Logic
    this.healingCountDown--;
    if (this.healingCountDown <= 0) {
      // Find friendly units in healing range that need healing
      const unitsToHeal = defenderUnits.filter(
        (unit) =>
          unit.id != this.id && //no self
          unit.isAlive &&
          unit.health < unit.maxHealth &&
          Math.hypot(this.x - unit.x, this.y - unit.y) <= this.healingRange //in range
      );
      unitsToHeal.array.forEach((unit) => {
        unit.health = Math.min(
          unit.maxHealth,
          unit.health + this.healingAmount
        );
      });
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
    });
    this.grenadeCountDown = this.fireRate;
  }

  update(enermy, defenderUnits) {
    // No super.update(zombies) for direct attack, as they primarily throw grenades.

    this.grenadeCountDown--;
    if (this.grenadeCountDown <= 0) {
      const target = enermy.find(
        (z) => z.isAlive && Math.hypot(this.x - z.x, this.y - z.y) <= this.range
      );
      if (target) {
        this.gameEngine.addExplosion(
          target.x,
          target.y,
          this.grenadeDamage,
          this.grenadeRadius
        );
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
    });
  }

  update(enermy, defenderUnits) {
    // Barricades don't attack or move. Their main interaction is absorbing damage.
    // Collision with zombies would be handled by GameEngine's zombie movement logic
    // (e.g., zombies stop when they hit a barricade).
  }

  draw(ctx) {
    // Custom draw for barricade (e.g., specific image or shape)
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    // Draw health bar like other units
    ctx.fillStyle = "red";
    ctx.fillRect(this.x, this.y - 10, this.width, 5);
    ctx.fillStyle = "lime";
    const healthWidth = (this.health / this.maxHealth) * this.width;
    ctx.fillRect(this.x, this.y - 10, healthWidth, 5);
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(this.name.substring(0, 5), this.x + 2, this.y + 25);
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
    this.ENERMY_SPAWN_INTERVAL = 2000;

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

    this.explosions = []; // To manage visual/damage explosions

    this.currentLevelConfig = null;
    this.levelConfigs = new Map(); //a map to store all levels

    //Examples
    //must be load from backend JSON file
    this.levelConfigs.set(1, {
      zombieSpawnInterval: 2500,
      maxActiveEnermy: 5,
      totalEnermyToSpawn: 15,
      availableEnermyType: [Enermy, FastEnermy],
      initialEnergy: 100,
    });
    //add more levels
  }

  initialize(ctx, width, height, levelNumber) {
    this.ctx = ctx;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.defenseLineX = this.canvasWidth - 30;

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

  handleClick(event) {

  }

  //Method to be called by React UI when a card is deployed
  deployDefenderUnit(cardData) {

  }

  update() {

  }

  draw() {

  }

  addExplosion() {

  }

  gameLoop = () => {

  }

  startLoop() {

  }

  stopLoop() {

  }
}
