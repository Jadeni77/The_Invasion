/*
 * Level 1 can be beaten by someone who has never played.
 *
 * It shipped opening with a Titan - 5000 base health - against 100 starting
 * energy and a single Shooter doing 15 damage a shot. Unwinnable, and live,
 * because a stray local test value was swept into a commit by a broad
 * `git add` and released.
 *
 * Nothing failed. Level 1 is not something the suite plays, and a wave naming a
 * real enemy class passes every other check there is.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../GameEngine.js';
import { GameLevelConfigs } from '../GameLevelConfigs.js';
import { defenderUnitClasses } from '../../DefenderClassUtils.js';

function levelConfigs() {
  const engine = { levelConfigs: new Map() };
  new GameLevelConfigs(engine).initLevelConfigs();
  return engine.levelConfigs;
}

const LEVELS = levelConfigs();
const LEVEL_ONE = LEVELS.get(1);

/** Health of `name` at level 1, from the class the engine would build. */
function enemyHealth(name) {
  const EnemyClass = new GameEngine().enemyClasses[name];
  return EnemyClass ? new EnemyClass(0, 0, null).maxHealth : 0;
}

/** What a starting player can field: one Shooter, and what it does a second. */
function starterDamagePerSecond() {
  const shooter = new defenderUnitClasses.Shooter(0, 0, { level: 1 });
  return (shooter.attackDamage * 60) / shooter.fireRate;
}

describe('the level the player meets first', () => {
  it('is really there', () => {
    expect(LEVEL_ONE?.waveConfigurations?.length).toBeGreaterThan(0);
  });

  /*
   * The concrete failure: a Titan in wave 1. Rather than name it, this asks
   * whether the enemy could be killed at all with what a new player owns -
   * which catches the next late-game type dropped in here by accident.
   */
  it('opens with something a single starting Shooter could actually kill', () => {
    const firstWave = LEVEL_ONE.waveConfigurations[0];
    const dps = starterDamagePerSecond();

    for (const name of firstWave.enemyTypes) {
      const secondsToKill = enemyHealth(name) / dps;
      expect(
        secondsToKill,
        `${name} has ${enemyHealth(name)} health - one Shooter needs `
        + `${Math.round(secondsToKill)}s to kill it`,
      ).toBeLessThan(30);
    }
  });

  it('can afford to place a defender at all', () => {
    const shooter = new defenderUnitClasses.Shooter(0, 0, { level: 1 });
    expect(LEVEL_ONE.initialEnergy).toBeGreaterThanOrEqual(shooter.cost);
  });

  /* The whole level, not only its opening: no boss-tier enemy belongs here. */
  it('sends nothing from the late game at any point', () => {
    const dps = starterDamagePerSecond();
    const tooTough = [];

    for (const wave of LEVEL_ONE.waveConfigurations) {
      for (const name of wave.enemyTypes ?? []) {
        if (enemyHealth(name) / dps >= 30) tooTough.push(name);
      }
    }

    expect([...new Set(tooTough)], 'level 1 is where someone learns the game').toEqual([]);
  });
});
