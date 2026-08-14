# Spell Unit Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop defender rules from applying to one-shot spells, fixing a Healer resurrection exploit, spell destructibility, and a casualty miscount that makes an achievement unobtainable.

**Architecture:** One exported predicate, `isConsumableSpell(unit)`, guards the four places a defender rule must not reach a spell: the base `takeDamage`, the Healer's resurrection filter, enemy target selection, and the casualty counter. No entity restructuring — the spells stay `DefenderUnit` subclasses.

**Tech Stack:** React 19, Vite 7, Vitest 4, plain ES modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-13-spell-unit-semantics-design.md`

**Branch:** `feature/spell-semantics`, branched from `feature/game-feel-audio`. That parent branch is required — the `defender:died` event guarded in Task 4 exists only there.

## Global Constraints

- **Only two units are spells**: `FireBlast` and `IceBomb`, the only classes setting `this.isSpell = true` (`DefenderUnits.js:2317` and `2553`).
- **Every guard calls `isConsumableSpell(unit)`** — never test `unit.isSpell` inline. One rule, one name, one definition.
- **Ordinary defenders must be unaffected in every respect.** Each task pairs an exclusion test with a "still works" test; a guard that suppressed behaviour for everyone would pass the exclusion test alone.
- **Run every new test and observe it FAIL before writing the fix.** Four tests on the parent branch were found to assert nothing precisely because they were written after the code they covered.
- Existing test convention: tests in a `__tests__/` directory beside the source, named `<Module>.test.js`, with explicit `vitest` imports (the project runs `globals: false`).
- Path note: `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `DefenderUnits.js` | Modify | Exports `isConsumableSpell`; base `takeDamage` and the Healer resurrection filter both consult it |
| `CombatManager.js` | Modify | Enemy target selection skips spells |
| `GameEngine.js` | Modify | Casualty counting extracted to `markDefenderDead()`, which skips spells |
| `GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js` | Create | Predicate, damage immunity, resurrection exclusion |
| `InGameManagerHandlers/__tests__/CombatManager.test.js` | Modify | Adds targeting tests to the existing file |
| `GameLogic (MVC)/__tests__/GameEngine.casualties.test.js` | Create | Casualty counting and death-event suppression |

---

## Task 1: The predicate and damage immunity

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/DefenderUnits.js` (add export near the spell classes; guard `takeDamage` at line ~309)
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `export function isConsumableSpell(unit): boolean` from `DefenderUnits.js`. Tasks 2, 3 and 4 all import it.

**Background:** Neither spell overrides `takeDamage`, so both inherit the base at `DefenderUnits.js:309` with `health: 1000`. Enemy melee is one way to destroy a spell mid-fuse; friendly-fire splash at `GameEngine.js:687` is another, and it bypasses enemy targeting entirely. Guarding the base `takeDamage` closes both paths in one place and covers any future spell.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  isConsumableSpell,
  FireBlast,
  IceBomb,
  BasicDefender,
  HealerDefender,
} from '../DefenderUnits.js';

const CARD = { level: 1, image: null };

describe('isConsumableSpell', () => {
  it('is true for Fire Blast', () => {
    expect(isConsumableSpell(new FireBlast(0, 0, CARD))).toBe(true);
  });

  it('is true for Ice Bomb', () => {
    expect(isConsumableSpell(new IceBomb(0, 0, CARD))).toBe(true);
  });

  it('is false for an ordinary defender', () => {
    expect(isConsumableSpell(new BasicDefender(0, 0, CARD))).toBe(false);
  });

  it('is false for a healer', () => {
    expect(isConsumableSpell(new HealerDefender(0, 0, CARD))).toBe(false);
  });

  it('is false for null or undefined without throwing', () => {
    expect(isConsumableSpell(null)).toBe(false);
    expect(isConsumableSpell(undefined)).toBe(false);
  });
});

describe('spell damage immunity', () => {
  it('Fire Blast ignores damage entirely', () => {
    const spell = new FireBlast(0, 0, CARD);
    const startingHealth = spell.health;

    const died = spell.takeDamage(500);

    expect(spell.health).toBe(startingHealth);
    expect(spell.isAlive).toBe(true);
    expect(died).toBe(false);
  });

  it('Ice Bomb ignores damage entirely', () => {
    const spell = new IceBomb(0, 0, CARD);
    const startingHealth = spell.health;

    spell.takeDamage(99999);

    expect(spell.health).toBe(startingHealth);
    expect(spell.isAlive).toBe(true);
  });

  it('Fire Blast survives repeated friendly-fire splash', () => {
    const spell = new FireBlast(0, 0, CARD);
    for (let i = 0; i < 20; i++) spell.takeDamage(300 * 0.3);
    expect(spell.isAlive).toBe(true);
  });

  it('an ordinary defender still takes damage', () => {
    const defender = new BasicDefender(0, 0, CARD);
    const startingHealth = defender.health;

    defender.takeDamage(10);

    expect(defender.health).toBe(startingHealth - 10);
    expect(defender.isAlive).toBe(true);
  });

  it('an ordinary defender still dies from enough damage', () => {
    const defender = new BasicDefender(0, 0, CARD);

    const died = defender.takeDamage(99999);

    expect(defender.health).toBe(0);
    expect(defender.isAlive).toBe(false);
    expect(died).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"`

Expected: FAIL. The `isConsumableSpell` tests fail because the export does not exist; the damage-immunity tests fail because spells currently lose health. **The two "ordinary defender" tests should PASS already** — they describe existing behaviour, and their passing confirms the test file itself is sound.

- [ ] **Step 3: Add the predicate**

In `DefenderUnits.js`, add this export immediately above the `FireBlast` class declaration (search for `export class FireBlast`):

```js
/**
 * True for one-shot consumables - Fire Blast and Ice Bomb - which fire once and
 * then remove themselves. Defender rules (resurrection, enemy targeting,
 * casualty counting) must not apply to them, because their "death" is a
 * successful cast rather than a loss.
 */
export function isConsumableSpell(unit) {
  return Boolean(unit?.isSpell);
}
```

- [ ] **Step 4: Guard the base `takeDamage`**

`takeDamage` at `DefenderUnits.js:309` currently reads:

```js
  takeDamage(amount) {
    console.log(`Damage took ${amount}`);
    this.health -= amount;
```

Add the guard as its first statement:

```js
  takeDamage(amount) {
    // Consumable spells are invulnerable for their whole fuse. They end by
    // firing, never by being destroyed - by enemies or by friendly-fire splash.
    if (isConsumableSpell(this)) return false;

    console.log(`Damage took ${amount}`);
    this.health -= amount;
```

The guard sits in the base class rather than being duplicated into both spell subclasses, so it stays a single definition and covers any spell added later.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"`

Expected: all 10 tests PASS.

- [ ] **Step 6: Run the full suite**

Run: `cd Frontend && npm test`

Expected: all pre-existing tests still pass alongside the new ones. If any pre-existing test fails, read it before changing anything — a spell losing its ability to take damage should not affect any existing test, so a failure here means something unexpected and is worth reporting rather than patching.

- [ ] **Step 7: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/DefenderUnits.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"
git commit -m "fix: make consumable spells invulnerable during their fuse

Fire Blast and Ice Bomb inherited the base takeDamage, so enemies and
friendly-fire splash could destroy them before they fired. Adds the
isConsumableSpell predicate and guards takeDamage in the base class."
```

---

## Task 2: Healer stops resurrecting spells

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/DefenderUnits.js` (resurrection filter at line ~558)
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js` (append)

**Interfaces:**
- Consumes: `isConsumableSpell(unit)` from Task 1
- Produces: nothing

**Background:** A Healer at level 5+ gains resurrection (`DefenderUnits.js:439-440`). Its filter selects any unit that is not alive, is not itself, and has zero health. A spent spell satisfies all three, so the Healer revives it at 20% health and it fires again — unlimited free casts for the price of one Healer.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js`:

```js
describe('healer resurrection targeting', () => {
  /**
   * A level-5 healer with resurrection unlocked, primed to act on the very next
   * update().
   *
   * The healing and resurrection logic sits behind `this.healingCountdown--;
   * if (this.healingCountdown <= 0)`, and a healer starts at healingCountdown =
   * 120. Without priming it to 1, a single update() call decrements to 119 and
   * never reaches the resurrection block at all - so every "does not resurrect"
   * assertion would pass vacuously, proving nothing.
   */
  function createResurrectingHealer() {
    const healer = new HealerDefender(0, 0, { level: 5, image: null });
    healer.applySpecialAbilities();
    healer.gameEngine = { recentlyDiedDefenders: [], explosions: [] };
    healer.healingCountdown = 1;
    return healer;
  }

  /** Puts a unit in the state the resurrection filter looks for. */
  function kill(unit) {
    unit.isAlive = false;
    unit.health = 0;
    return unit;
  }

  it('has resurrection unlocked at level 5', () => {
    const healer = createResurrectingHealer();
    expect(healer.hasResurrection).toBe(true);
    expect(healer.canResurrect).toBe(true);
  });

  it('does not resurrect a spent Fire Blast', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new FireBlast(50, 50, CARD));

    healer.update([], [healer, spell]);

    expect(spell.health).toBe(0);
    expect(spell.isAlive).toBe(false);
    expect(spell.hasBeenResurrected).toBeFalsy();
    expect(healer.canResurrect).toBe(true); // charge not spent on a spell
  });

  it('does not resurrect a spent Ice Bomb', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new IceBomb(50, 50, CARD));

    healer.update([], [healer, spell]);

    expect(spell.health).toBe(0);
    expect(spell.hasBeenResurrected).toBeFalsy();
  });

  it('still resurrects an ordinary dead defender', () => {
    const healer = createResurrectingHealer();
    const defender = kill(new BasicDefender(50, 50, CARD));

    healer.update([], [healer, defender]);

    expect(defender.health).toBeGreaterThan(0);
    expect(defender.hasBeenResurrected).toBe(true);
  });

  it('picks the ordinary defender when a spell is also dead', () => {
    const healer = createResurrectingHealer();
    const spell = kill(new FireBlast(50, 50, CARD));
    const defender = kill(new BasicDefender(60, 60, CARD));

    healer.update([], [healer, spell, defender]);

    expect(defender.health).toBeGreaterThan(0);
    expect(spell.health).toBe(0);
  });
});
```

The last test is the important one: it proves the filter *skips* spells rather than merely stopping at the first entry.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js" -t "resurrection targeting"`

Expected: the two "does not resurrect" tests and the "picks the ordinary defender" test FAIL — the spell gets revived to 20% health. The "still resurrects an ordinary dead defender" test should PASS already, confirming resurrection works and the test drives it correctly.

If the "still resurrects" test fails at this stage, stop and report it — that would mean the test is not reaching the resurrection code, and no amount of guarding will make the other assertions meaningful.

- [ ] **Step 3: Guard the resurrection filter**

At `DefenderUnits.js:558-560` the filter currently reads:

```js
        const deadUnits = allDefender.filter(
          (unit) => !unit.isAlive && unit.id !== this.id && unit.health <= 0,
        );
```

Change it to:

```js
        const deadUnits = allDefender.filter(
          (unit) =>
            !unit.isAlive &&
            unit.id !== this.id &&
            unit.health <= 0 &&
            // A spent spell is not a casualty - it fired. Reviving one would
            // hand out unlimited free casts.
            !isConsumableSpell(unit),
        );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"`

Expected: all tests PASS, including Task 1's.

- [ ] **Step 5: Run the full suite**

Run: `cd Frontend && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/DefenderUnits.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"
git commit -m "fix: healer no longer resurrects spent spells

A level-5 healer's resurrection filter matched any dead unit with zero
health, including a Fire Blast or Ice Bomb that had already fired - which
revived it at 20% health and let it fire again, indefinitely."
```

---

## Task 3: Enemies ignore spells

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/CombatManager.js` (`findTargetForEnemy`, line ~124)
- Test: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js` (append to the existing file)

**Interfaces:**
- Consumes: `isConsumableSpell(unit)` from Task 1
- Produces: nothing

**Background:** `findTargetForEnemy` picks the closest living defender within range. It has no spell exclusion, so an enemy will stop and attack a Fire Blast. With Task 1's damage guard the spell now survives, but the enemy still halts in front of it, which reads as broken. Enemies should walk past as if the cell were empty.

`CombatManager.js` currently has no imports at all — you are adding the first one. From `GameEngineBreakDown/InGameManagerHandlers/`, the path to `DefenderUnits.js` is `../../DefenderUnits.js`.

- [ ] **Step 1: Write the failing test**

Append to the existing `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js`.

Add these imports at the top of the file, beside its existing imports:

```js
import { FireBlast, BasicDefender } from '../../../DefenderUnits.js';
```

Then append this block:

```js
describe('findTargetForEnemy spell exclusion', () => {
    const CARD = { level: 1, image: null };

    /** A minimal enemy positioned at the origin with generous reach. */
    function createEnemy() {
        return { x: 0, y: 0, width: 40, height: 40, attackRange: 500 };
    }

    it('ignores a spell even when it is the only unit in range', () => {
        const combat = new CombatManager({});
        const spell = new FireBlast(50, 0, CARD);

        expect(combat.findTargetForEnemy(createEnemy(), [spell])).toBeNull();
    });

    it('still targets an ordinary defender in range', () => {
        const combat = new CombatManager({});
        const defender = new BasicDefender(50, 0, CARD);

        expect(combat.findTargetForEnemy(createEnemy(), [defender])).toBe(defender);
    });

    it('targets the defender behind a nearer spell', () => {
        const combat = new CombatManager({});
        const spell = new FireBlast(20, 0, CARD);
        const defender = new BasicDefender(120, 0, CARD);

        expect(combat.findTargetForEnemy(createEnemy(), [spell, defender])).toBe(defender);
    });

    it('still ignores dead defenders', () => {
        const combat = new CombatManager({});
        const defender = new BasicDefender(50, 0, CARD);
        defender.isAlive = false;

        expect(combat.findTargetForEnemy(createEnemy(), [defender])).toBeNull();
    });
});
```

The third test is the one that matters: a naive guard that stopped the loop at a spell would fail it, while a guard that skips would pass.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js" -t "spell exclusion"`

Expected: the first and third tests FAIL — the spell is returned as a target. The second and fourth should PASS already.

- [ ] **Step 3: Add the import and the guard**

At the very top of `CombatManager.js`, above its `export class CombatManager` declaration and its leading comment block, add:

```js
import { isConsumableSpell } from '../../DefenderUnits.js';
```

Then in `findTargetForEnemy`, extend the existing skip condition. It currently reads:

```js
        for (const defender of defenders) {
            if (!defender.isAlive) continue;
```

Change it to:

```js
        for (const defender of defenders) {
            if (!defender.isAlive) continue;
            // Enemies walk past consumable spells as though the cell were empty.
            // Stopping to attack something invulnerable reads as a stuck enemy.
            if (isConsumableSpell(defender)) continue;
```

Use `continue`, not `break` — an enemy must still reach a defender standing behind a spell.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js"`

Expected: all tests in the file PASS, including its pre-existing ones.

- [ ] **Step 5: Run the full suite**

Run: `cd Frontend && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/CombatManager.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js"
git commit -m "fix: enemies ignore consumable spells when choosing a target

Enemies stopped to attack Fire Blast and Ice Bomb. Now they walk past as
though the cell were empty, and still reach any defender behind the spell."
```

---

## Task 4: A cast is not a casualty

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (import; `updateDefenders` casualty block at line ~806-814; new `markDefenderDead` method)
- Modify: `docs/superpowers/2026-08-12-known-issues-and-followups.md`
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js` (create)

**Interfaces:**
- Consumes: `isConsumableSpell(unit)` from Task 1
- Produces: `GameEngine.prototype.markDefenderDead(defender)` — records a death once; increments `this.defendersLost` and emits `defender:died` only for non-spells

**Background:** `FireBlast.activate()` and `IceBomb.activate()` both end with `this.isAlive = false; this.health = 0;` — the intended self-removal after firing. But `updateDefenders` treats any non-alive defender as a casualty, so a successful cast increments `defendersLost` and emits `defender:died`.

Two user-visible consequences: the `perfect_defense` achievement (zero defenders lost) is unobtainable for anyone who casts a spell, and a successful cast plays a crumble death sound with screen shake.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { FireBlast, IceBomb, BasicDefender } from '../DefenderUnits.js';

const CARD = { level: 1, image: null };

/**
 * markDefenderDead only touches defendersLost and emitFeedback, so it can be
 * exercised against a minimal stand-in rather than a constructed GameEngine.
 */
function createEngineStub() {
  return { defendersLost: 0, emitFeedback: vi.fn() };
}

function callMarkDefenderDead(engine, defender) {
  return GameEngine.prototype.markDefenderDead.call(engine, defender);
}

describe('markDefenderDead', () => {
  it('counts an ordinary defender as a casualty', () => {
    const engine = createEngineStub();
    const defender = new BasicDefender(0, 0, CARD);

    callMarkDefenderDead(engine, defender);

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'defender:died',
      expect.objectContaining({ x: defender.x, y: defender.y }),
    );
  });

  it('does not count a spent Fire Blast', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new FireBlast(0, 0, CARD));

    expect(engine.defendersLost).toBe(0);
    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('does not count a spent Ice Bomb', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new IceBomb(0, 0, CARD));

    expect(engine.defendersLost).toBe(0);
    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('still marks a spell as handled so it is not reprocessed each frame', () => {
    const engine = createEngineStub();
    const spell = new FireBlast(0, 0, CARD);

    callMarkDefenderDead(engine, spell);

    expect(spell.deathHandled).toBe(true);
  });

  it('counts an ordinary defender only once', () => {
    const engine = createEngineStub();
    const defender = new BasicDefender(0, 0, CARD);

    callMarkDefenderDead(engine, defender);
    callMarkDefenderDead(engine, defender);
    callMarkDefenderDead(engine, defender);

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledTimes(1);
  });

  it('counts each of several defenders separately', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new BasicDefender(0, 0, CARD));
    callMarkDefenderDead(engine, new BasicDefender(10, 10, CARD));

    expect(engine.defendersLost).toBe(2);
  });

  it('a mixed wave counts only the ordinary defenders', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new FireBlast(0, 0, CARD));
    callMarkDefenderDead(engine, new BasicDefender(10, 10, CARD));
    callMarkDefenderDead(engine, new IceBomb(20, 20, CARD));

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledTimes(1);
  });
});
```

The last test is the one that proves `perfect_defense` becomes obtainable: casting two spells alongside one genuine loss must report exactly one casualty.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js"`

Expected: FAIL with `markDefenderDead is not a function` — the method does not exist yet.

**If instead the run fails while importing `GameEngine.js`**, that is a different problem: `GameEngine.js` pulls in `AssetManifest.js`, which imports roughly 60 PNG files, and no existing test has ever imported it. Vite normally resolves static assets to URL strings under Vitest, so this should work. If it does not, report the exact error rather than working around it — do not add a mocking layer without checking first.

- [ ] **Step 3: Add the import**

`GameEngine.js` already imports from `./DefenderUnits.js` in a multi-line block ending at line 16. Add `isConsumableSpell` to that existing import list, after `DefenderUnit`:

```js
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
  isConsumableSpell,
} from "./DefenderUnits.js";
```

- [ ] **Step 4: Extract and guard the casualty block**

The block in `updateDefenders` at `GameEngine.js:806-814` currently reads:

```js
    for (const defender of this.defenders) {
      if (defender.isAlive) {
        defender.update(this.enemies, this.defenders);
      } else {
        // Dead defenders only update their animation
        if (!defender.deathHandled) {
          defender.deathHandled = true;
          this.defendersLost++;
          this.emitFeedback('defender:died', { x: defender.x, y: defender.y });
        }
```

Replace the inner `if (!defender.deathHandled) { ... }` block with a single call:

```js
      } else {
        // Dead defenders only update their animation
        this.markDefenderDead(defender);
```

Leave everything after it — the death-animation handling — exactly as it is.

Then add the new method immediately above `updateDefenders`:

```js
  /**
   * Records a defender's death exactly once.
   *
   * Consumable spells end by firing, not by being destroyed, so they are not
   * casualties: counting them made the perfect_defense achievement (zero
   * defenders lost) unobtainable for anyone who cast one, and played a crumble
   * death sound on a successful cast. They are still marked handled so the
   * death sweep does not reprocess them every frame.
   */
  markDefenderDead(defender) {
    if (defender.deathHandled) return;
    defender.deathHandled = true;

    if (isConsumableSpell(defender)) return;

    this.defendersLost++;
    this.emitFeedback('defender:died', { x: defender.x, y: defender.y });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js"`

Expected: all 7 tests PASS.

- [ ] **Step 6: Run the full suite**

Run: `cd Frontend && npm test`

Expected: all tests pass.

- [ ] **Step 7: Record the follow-up**

In `docs/superpowers/2026-08-12-known-issues-and-followups.md`, add this entry under the "Deferred from the branch" section:

```markdown
### 9. Spells are modelled as defenders

`FireBlast` and `IceBomb` are `DefenderUnit` subclasses distinguished only by an `isSpell` flag, so
every rule written for defenders applies to them unless individually guarded. Four such guards exist
today, all consulting `isConsumableSpell(unit)`: the base `takeDamage`, the Healer's resurrection
filter, `CombatManager.findTargetForEnemy`, and `GameEngine.markDefenderDead`.

Three bugs came from this before the guards were added — a resurrection exploit, destructible spells,
and casts counting as casualties. If a third spell type is ever added, move spells into their own
entity collection instead of adding a fifth guard.
```

- [ ] **Step 8: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js" \
        docs/superpowers/2026-08-12-known-issues-and-followups.md
git commit -m "fix: a successful spell cast is not a defender lost

Spells self-terminate after firing, and updateDefenders counted any
non-alive defender as a casualty. That made perfect_defense unobtainable
for anyone who cast a spell, and played a death sound on a successful cast."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

Expected: no new errors.

- [ ] **Confirm each success criterion from the spec**

1. A level-5 Healer never resurrects a Fire Blast or Ice Bomb, and still resurrects ordinary defenders.
2. Neither enemy attacks nor friendly-fire splash can destroy a spell during its fuse.
3. Enemies walk past spells without stopping.
4. Using a spell does not increment `defendersLost`, so `perfect_defense` is obtainable while using spells.
5. Using a spell plays no death sound and causes no screen shake.
6. Ordinary defenders are unaffected in every one of these respects.
7. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 3 and 5 are visible and audible rather than testable. Place a Fire Blast with enemies approaching and confirm: enemies walk past instead of stopping to hit it, the spell always fires regardless of what reaches it, and the cast produces its own sound with no crumble or shake. Then finish a level using a spell and confirm the loss counter did not increase.
