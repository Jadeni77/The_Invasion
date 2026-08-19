/* A level's starting budget grows with what it asks of the player. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const configs = readFileSync(join(HERE, '..', 'GameLevelConfigs.js'), 'utf8');
const drops = readFileSync(
  join(HERE, '..', 'InGameManagerHandlers', 'DropManager.js'),
  'utf8',
);

/** initialEnergy per level, read from the config in source order. */
function energyByLevel() {
  const out = new Map();
  let level = null;
  for (const line of configs.split('\n')) {
    const l = /levelNumber:\s*(\d+)/.exec(line);
    if (l) level = Number(l[1]);
    const e = /initialEnergy:\s*(\d+)/.exec(line);
    if (e && level !== null) out.set(level, Number(e[1]));
  }
  return out;
}

const SHOOTER_COST = 20;

describe('the starting energy curve', () => {
  const energy = energyByLevel();

  it('reads a real set of levels (guards against a vacuous run)', () => {
    expect(energy.size).toBeGreaterThanOrEqual(20);
  });

  it('never gives a later campaign level less than an earlier one', () => {
    // Level 1 is excluded: it is a sandbox at 10000 and deliberately not on the
    // curve.
    const campaign = [...energy.entries()]
      .filter(([lvl]) => lvl >= 2 && lvl <= 20)
      .sort((a, b) => a[0] - b[0]);

    for (let i = 1; i < campaign.length; i++) {
      const [lvl, value] = campaign[i];
      const [prevLvl, prevValue] = campaign[i - 1];
      expect(value, `level ${lvl} gives less than level ${prevLvl}`).toBeGreaterThanOrEqual(prevValue);
    }
  });

  it('actually grows across the campaign rather than sitting flat', () => {
    // The defect: 2 through 7 were all 120.
    expect(energy.get(20)).toBeGreaterThan(energy.get(2) * 2);
  });

  it('gives level 3 enough to absorb the Exploder it introduces', () => {
    // An Exploder one-shots a Shooter, so the budget has to cover losses, not just
    // an opening line. Six was not enough; this asks for at least eight.
    expect(Math.floor(energy.get(3) / SHOOTER_COST)).toBeGreaterThanOrEqual(8);
  });

  it('gives level 4 more again, where the 1200 HP Tank Zombie arrives', () => {
    expect(energy.get(4)).toBeGreaterThan(energy.get(3));
  });
});

describe('energy earned during a level', () => {
  it('pays a defender back inside a reasonable number of kills', () => {
    const amount = Number(/dropEnergy\([\s\S]*?(\d+)\s*\)/.exec(drops)?.[1]);
    const chance = Number(/energyDropChance\s*=\s*([0-9.]+)/.exec(drops)?.[1]);
    expect(amount, 'drop amount not found').toBeGreaterThan(0);
    expect(chance, 'drop chance not found').toBeGreaterThan(0);

    const killsToPayBack = SHOOTER_COST / (amount * chance);
    // Was 11.4 at 5 energy and a 35% chance.
    expect(killsToPayBack).toBeLessThanOrEqual(8);
  });
});
