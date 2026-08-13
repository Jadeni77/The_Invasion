# Spell Unit Semantics — Design

**Date:** 2026-08-13
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

Fire Blast and Ice Bomb are one-shot consumables: placed on the board, they wait through a short
fuse, fire once, and remove themselves. They are implemented as `DefenderUnit` subclasses
distinguished only by an `isSpell = true` flag (`DefenderUnits.js:2317` and `2553` — the only two
units that set it).

Because they are defenders as far as the rest of the engine is concerned, every rule written for
defenders applies to them. Three of those rules should not.

### Bug 1 — the Healer resurrects spells

A Healer at level 5 or above gains resurrection (`DefenderUnits.js:439-440`). Its target filter
(`DefenderUnits.js:558-560`) is:

```js
const deadUnits = allDefender.filter(
  (unit) => !unit.isAlive && unit.id !== this.id && unit.health <= 0,
);
```

A spell that has fired satisfies every clause, so the Healer revives it at 20% health and it fires
again. The result is unlimited free Fire Blasts for the cost of one Healer.

### Bug 2 — spells can be destroyed before they fire

Neither spell overrides `takeDamage`, so both inherit the base implementation
(`DefenderUnits.js:311`) with `health: 1000`. During the fuse they are damageable.

Enemy melee is the obvious path, but not the only one: `GameEngine.js:687` applies 30% friendly-fire
splash damage to defenders inside an explosion radius, so a Grenadier can destroy a Fire Blast that
has not yet fired.

### Bug 3 — a successful spell counts as a defender lost

`FireBlast.activate()` ends with `this.isAlive = false; this.health = 0;` — the intended
self-termination. But `GameEngine.js:806-814` treats any defender that is not alive as a casualty:

```js
        if (!defender.deathHandled) {
          defender.deathHandled = true;
          this.defendersLost++;
          this.emitFeedback('defender:died', { x: defender.x, y: defender.y });
        }
```

Two consequences:

- **The `perfect_defense` achievement is unobtainable for anyone who uses a spell.** It requires zero
  defenders lost (`GameContext.jsx`, added in commit `4ee5641`), and every successful cast
  increments the counter.
- **Casting a spell plays a death sound.** The `defender:died` event was added by the
  `feature/game-feel-audio` branch, so a successful cast now produces a crumble sound and screen
  shake — feedback that says something went wrong when nothing did.

### Root cause

All three follow from modelling spells as defenders. Each bug is a defender rule leaking onto a unit
type that is not a defender.

## Approach

Guard the four sites where a defender rule must not apply to a spell, using one shared, named
predicate. The structural fix — moving spells out of `this.defenders` into their own entity type — is
recorded as a follow-up rather than built.

**Why not the structural fix now.** It is more correct, and it would prevent this bug class
permanently. But deployment, grid occupancy, card selection, cooldowns, rendering, and achievement
stats all assume `this.defenders`, so the blast radius covers the two largest files in the project
(`GameEngine.js` at ~1400 lines, `DefenderUnits.js` at ~2700) to fix three bugs that four guards
close. Spells also genuinely share most defender behaviour — placement, energy cost, grid cell, card
slot, cooldown — so the split is less clean than it first appears. Revisit if a third spell type is
added.

## Design

### The predicate

`isConsumableSpell(unit)` is exported from `DefenderUnits.js`, beside the two spell classes it
describes:

```js
/** True for one-shot consumables (Fire Blast, Ice Bomb) that fire once and remove
 *  themselves. Defender rules — resurrection, enemy targeting, casualty counting —
 *  must not apply to them. */
export function isConsumableSpell(unit) {
  return Boolean(unit?.isSpell);
}
```

Every guard calls this function rather than testing `unit.isSpell` inline, so the rule has one name
and one definition.

### The four guard sites

| # | Site | File | Change | Fixes |
|---|---|---|---|---|
| 1 | Resurrection target filter | `DefenderUnits.js:558-560` | Exclude spells from `deadUnits` | Bug 1 |
| 2 | Enemy target selection | `CombatManager.js:124` (`findTargetForEnemy`) | Skip spells when choosing a target | Bug 2 |
| 3 | Casualty counter and death event | `GameEngine.js:811-814` | Skip both `defendersLost++` and the `defender:died` emit; still mark `deathHandled` and run the death animation | Bug 3 |
| 4 | `takeDamage` | Spell classes | No-op while alive | Bug 2 |

Site 3 needs a single guard because the counter and the emit are adjacent lines inside the same
`if (!defender.deathHandled)` block. The guard must not skip setting `deathHandled` or advancing the
death animation, or the spell would be re-processed every frame.

Site 4 is not redundant with site 2. Enemies no longer target spells, but friendly-fire splash
(`GameEngine.js:687`) reaches defenders directly without going through target selection.

### Enemy behaviour

Enemies ignore spells entirely and walk past as though the cell were empty. Invincibility is a
consequence of never being targeted rather than a second rule to maintain.

This was chosen over making spells a brief roadblock. An enemy that stops to attack something it
cannot damage reads as broken, and giving spells a secondary blocking role would change balance in a
bug-fix change.

### What is deliberately unchanged

- The Healer's ordinary healing needs no guard. With `takeDamage` a no-op, a spell is always at full
  health, so it can never be selected as a heal target.
- Scoring, `enemiesKilled`, and drop handling are untouched.
- The pre-existing splash-kill double-award (recorded in
  `docs/superpowers/2026-08-12-known-issues-and-followups.md`) is out of scope. It is a scoring
  change affecting already-inflated player data and needs its own decision.

## Testing

Every behaviour here is unit-testable with harnesses that already exist in the repo (the fake canvas
context in `canvasState.test.js`, and the fake `FeedbackBus`).

| Test | Asserts |
|---|---|
| Resurrection excludes spells | A Healer given one dead spell and one dead ordinary defender revives only the defender |
| Resurrection still works | The same Healer with only a dead ordinary defender still revives it |
| Enemy targeting skips spells | An enemy whose only in-range unit is a spell selects no target |
| Enemy targeting unaffected otherwise | An enemy with an ordinary defender in range still targets it |
| Spell death is not a casualty | A spell that self-terminates leaves `defendersLost` unchanged and emits nothing on the bus |
| Defender death still counts | An ordinary defender death still increments `defendersLost` and still emits `defender:died` |
| Spells ignore damage | `spell.takeDamage(500)` leaves `health` and `isAlive` unchanged |
| Ordinary defenders still take damage | An ordinary defender's health drops normally |

Each test is run and observed to FAIL before its fix is written. Four tests on the
`feature/game-feel-audio` branch were found to assert nothing precisely because they were written
after the code they covered; the red run is what distinguishes a real guard from a restatement.

The paired "still works" tests matter as much as the exclusions: a guard that suppressed resurrection
or targeting entirely would pass every exclusion test while breaking the game.

## Success criteria

1. A level-5 Healer never resurrects a Fire Blast or Ice Bomb, and still resurrects ordinary
   defenders.
2. Neither enemy attacks nor friendly-fire splash can destroy a spell during its fuse.
3. Enemies walk past spells without stopping.
4. Using a spell does not increment `defendersLost`, so `perfect_defense` is obtainable while using
   spells.
5. Using a spell plays no death sound and causes no screen shake.
6. Ordinary defenders are unaffected in every one of these respects.
7. The full test suite passes.

## Follow-up

Add to `docs/superpowers/2026-08-12-known-issues-and-followups.md`: spells are modelled as
`DefenderUnit` subclasses, so every defender rule must be guarded individually. Four guards exist
today. If a third spell type is added, move spells into their own entity collection instead of adding
a fifth.
