/*
 * Every enemy a level asks for is one the engine can actually build.
 *
 * spawnEnemyOfType warns and returns when it does not recognise a name, so a
 * typo in a wave does not crash anything - it just spawns nothing, and the wave
 * clears itself the moment it starts. Level 19 shipped ten of its fifteen waves
 * asking for "Basic Enemies" and "Mid Tier Enemies", neither of which is a
 * class, so the Final Stand quietly sent 98 enemies instead of 270.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../GameEngine.js';
import { GameLevelConfigs } from '../GameLevelConfigs.js';

const KNOWN = Object.keys(new GameEngine().enemyClasses);

/** Every level config, by number. */
function allLevels() {
  const engine = { levelConfigs: new Map() };
  new GameLevelConfigs(engine).initLevelConfigs();
  return engine.levelConfigs;
}

const LEVELS = allLevels();

describe('the level configs', () => {
  it('are really there, so the walk below is not vacuous', () => {
    expect(LEVELS.size).toBeGreaterThan(19);
    expect(KNOWN.length).toBeGreaterThan(10);
  });
});

describe('every enemy named by a level', () => {
  it('is a type the engine can spawn', () => {
    const unknown = [];

    for (const [levelId, config] of LEVELS) {
      const waves = config.waveConfigurations ?? [];

      waves.forEach((wave, index) => {
        for (const type of wave.enemyTypes ?? []) {
          if (!KNOWN.includes(type)) {
            unknown.push(`level ${levelId} wave ${index + 1}: "${type}"`);
          }
        }
        if (wave.bossType && !KNOWN.includes(wave.bossType)) {
          unknown.push(`level ${levelId} wave ${index + 1} boss: "${wave.bossType}"`);
        }
      });

      for (const type of config.availableEnemyTypes ?? []) {
        if (!KNOWN.includes(type)) {
          unknown.push(`level ${levelId} availableEnemyTypes: "${type}"`);
        }
      }
    }

    expect(
      unknown.sort(),
      `spawnEnemyOfType only knows: ${KNOWN.join(', ')}`,
    ).toEqual([]);
  });

  it('leaves no wave with nothing to spawn', () => {
    const empty = [];

    for (const [levelId, config] of LEVELS) {
      (config.waveConfigurations ?? []).forEach((wave, index) => {
        const spawnable = (wave.enemyTypes ?? []).filter((t) => KNOWN.includes(t));
        if (wave.enemyCount > 0 && spawnable.length === 0) {
          empty.push(`level ${levelId} wave ${index + 1} asks for ${wave.enemyCount}`);
        }
      });
    }

    expect(empty.sort(), 'a wave that spawns nothing clears itself').toEqual([]);
  });
});
