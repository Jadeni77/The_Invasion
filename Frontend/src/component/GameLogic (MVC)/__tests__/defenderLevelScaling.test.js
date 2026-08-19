/*
 * Upgrading a defender buys something.
 *
 * Two ways it stopped doing so, both found in the Frost Archer and neither
 * caught by anything:
 *
 * - `applyLevelUpgrades` runs inside `super()`, so a subclass constructor that
 *   assigns the same property AFTERWARDS overwrites what the level derived.
 *   Frost Archer set `freezeChance = 0.1` on the line after `super()`, pinning
 *   every archer in the game at the level-1 chance. The "up to 50% freeze"
 *   upgrade never once fired.
 * - A stat small enough that the 15%-a-level multiplier floors back onto
 *   itself. Two damage stayed two damage through level four.
 *
 * So the guard reads the source for the stats a class derives from its level,
 * then builds the defender at level 1 and level 5 and requires those stats to
 * have actually moved. Naming the properties here instead would only ever
 * catch the two that already broke.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT } from '../../../test/sourceFiles.js';
import { defenderUnitClasses } from '../DefenderClassUtils.js';

const SOURCE = readFileSync(
  join(SRC_ROOT, 'component', 'GameLogic (MVC)', 'DefenderUnits.js'),
  'utf8',
);

/** The body of `class <name>`, up to the next top-level class. */
function classBody(name) {
  const start = SOURCE.indexOf(`export class ${name} `);
  if (start === -1) return '';
  const next = SOURCE.indexOf('\nexport class ', start + 1);
  return SOURCE.slice(start, next === -1 ? SOURCE.length : next);
}

const CLASS_NAMES = Object.fromEntries(
  Object.entries(defenderUnitClasses).map(([label, Klass]) => [label, Klass.name]),
);

/**
 * The properties a class assigns from its level.
 *
 * An assignment counts when its right-hand side mentions `level` or the
 * `statMultiplier` derived from it - that is what makes the stat a function of
 * the level rather than a constant that happens to live in the same method.
 */
function levelDerivedProps(className) {
  const body = classBody(className);
  // A class with no applyLevelUpgrades of its own inherits the base one.
  const source = body.includes('applyLevelUpgrades()')
    ? body
    : body + classBody('DefenderUnit');

  const props = new Set();
  // To the semicolon, not to the newline: these assignments wrap across lines,
  // and stopping at the newline hides the `level` on the line below.
  for (const match of source.matchAll(/this\.(\w+)\s*=\s*([^;]+);/g)) {
    const [, prop, expression] = match;
    if (prop === 'level') continue; // The input, not a stat derived from it.
    // `statMultiplier` is the common name, not the only one - Ice Bomb calls
    // its own `damageMultiplier`.
    if (/\blevel\b|\w*[Mm]ultiplier\b/.test(expression)) props.add(prop);
  }
  return [...props];
}

/** One defender of `label`, built at `level`. */
function build(label, level) {
  const Klass = defenderUnitClasses[label];
  return new Klass(0, 0, { name: label, level });
}

const LABELS = Object.keys(defenderUnitClasses);

describe('the defender roster', () => {
  it('is really there, and its source was really read', () => {
    expect(LABELS.length).toBeGreaterThan(8);
    expect(SOURCE.length).toBeGreaterThan(10_000);
    expect(classBody('FrostArcher')).toContain('applyLevelUpgrades');
  });
});

/*
 * Stats that predate this guard: written to scale with the level, pinned to
 * their level-1 value by an assignment in the constructor that runs after
 * `super()`. Every one of these upgrades is bought by players and does nothing.
 *
 * The stat names are stored, not just the defender's, so a SECOND pinned stat
 * on a defender already listed here still fails - which is the hole a list of
 * bare names would leave open.
 *
 * These are recorded rather than fixed because fixing one changes what that
 * defender does at every level above 1, and that is the owner's call to make
 * per unit. An entry here is a to-do, not an exemption.
 */
const PINNED_BY_CONSTRUCTOR = {
  // Empty, and it should stay that way. All seven defenders that used to sit
  // here now scale from a base constant declared beside their class, because
  // applyLevelUpgrades runs inside super() and cannot read a value the subclass
  // constructor has not assigned yet.
  //
  // A new entry here is a regression, not a to-do.
};

/** The level-derived stats of `label` that do not move between level 1 and 5. */
function pinnedStats(label) {
  const props = levelDerivedProps(CLASS_NAMES[label]);
  const low = build(label, 1);
  const high = build(label, 5);

  return props
    .filter((prop) => typeof low[prop] === 'number' && low[prop] === high[prop])
    .sort();
}

describe('every stat a defender derives from its level', () => {
  it.each(LABELS)('derives at least one stat from its level: %s', (label) => {
    expect(levelDerivedProps(CLASS_NAMES[label]).length).toBeGreaterThan(0);
  });

  it.each(LABELS)('has no NEWLY pinned stat: %s', (label) => {
    const allowed = PINNED_BY_CONSTRUCTOR[label] ?? [];
    const unexpected = pinnedStats(label).filter((prop) => !allowed.includes(prop));

    expect(
      unexpected,
      `${label}: derived from level, identical at level 1 and 5. Either the `
      + 'constructor overwrites it after super(), or the multiplier rounds back '
      + 'onto the same value.',
    ).toEqual([]);
  });

  it('keeps the table honest - a stat that now scales must leave it', () => {
    const stale = [];
    for (const [label, listed] of Object.entries(PINNED_BY_CONSTRUCTOR)) {
      const stuck = pinnedStats(label);
      for (const prop of listed) {
        if (!stuck.includes(prop)) stale.push(`${label}.${prop} scales now`);
      }
    }

    expect(stale.sort(), 'good news, but the table has to follow').toEqual([]);
  });

  it('has the Frost Archer out of that table, since its freeze was fixed', () => {
    expect(PINNED_BY_CONSTRUCTOR['Frost Archer']).toBeUndefined();
    expect(pinnedStats('Frost Archer')).toEqual([]);
  });
});

describe('every defender that attacks repeatedly', () => {
  /** Damage a second, or 0 for the one-shot and support units. */
  const dps = (unit) => (unit.fireRate > 0 ? (unit.attackDamage * 60) / unit.fireRate : 0);

  const ATTACKERS = LABELS.filter((label) => {
    const unit = build(label, 1);
    return unit.fireRate > 0 && unit.attackDamage > 0;
  });

  it('has some to check', () => {
    expect(ATTACKERS.length).toBeGreaterThan(3);
  });

  it.each(ATTACKERS)('does enough damage to be worth its place: %s', (label) => {
    // A defender that costs energy and shoots must out-damage doing nothing by
    // a margin a player can see. The Frost Archer shipped at 1.6 a second.
    expect(dps(build(label, 1))).toBeGreaterThan(5);
  });

  it.each(ATTACKERS)('hits harder when upgraded: %s', (label) => {
    expect(dps(build(label, 5))).toBeGreaterThan(dps(build(label, 1)));
  });
});

describe('the Frost Archer, which is priced as control rather than damage', () => {
  it('still shoots faster than anything else, since that is where its damage comes from', () => {
    const frost = build('Frost Archer', 1);

    for (const label of LABELS) {
      if (label === 'Frost Archer') continue;
      const other = build(label, 1);
      if (other.fireRate <= 0 || other.attackDamage <= 0) continue;
      expect(frost.fireRate, `${label} fires at least as fast`).toBeLessThan(other.fireRate);
    }
  });

  it('cannot hold an enemy frozen on its own', () => {
    // Freeze is rolled per hit and lasts a second, so a fast enough archer with
    // a high enough chance would simply stop an enemy where it stands.
    const frost = build('Frost Archer', 5);
    const rollsPerSecond = (60 / frost.fireRate) * frost.freezeChance;
    const freezeSeconds = frost.freezeDuration / 60;

    expect(rollsPerSecond * freezeSeconds).toBeLessThan(0.5);
  });
});
