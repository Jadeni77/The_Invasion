# Known Issues and Follow-ups

**Recorded:** 2026-08-13, at the close of the `feature/game-feel-audio` branch.

Everything here was found during that work, reviewed, and **deliberately not fixed** — either
because it predates the branch or because fixing it needed a decision or a spec of its own. None of
it blocks that branch. It is written down so it does not have to be rediscovered.

## Pre-existing bugs (predate the branch)

### 1. Splash kills award double score and double kill-count

`GameEngine.addDefenderExplosion` handles a splash kill — awarding `inGameScore`, incrementing
`enemiesKilled`, and calling `dropManager.handleEnemyDeath` — but it never splices the enemy from
`this.enemies` nor sets `enemy.deathHandled`. Since `updateDefenders()` runs before
`updateEnemies()` in the same frame, `updateEnemies`' death sweep then calls `handleEnemyDeath` on
that same enemy and awards everything a second time.

Effect: every Grenadier/Mortar-style splash kill counts twice. That inflates score, `enemiesKilled`,
and therefore the `totalEnemiesKilled` achievement counter added in `4ee5641`.

Only direct projectile kills are unaffected, because they splice the enemy before `updateEnemies`
runs.

The audio layer added on `feature/game-feel-audio` explicitly does NOT have this bug — `enemy:died`
is deduplicated per enemy via `GameEngine.emitEnemyDeathFeedback`. So the death sound is currently
the honest signal and the score is the inaccurate one. **Settle this before tuning achievement
thresholds**, since existing player data is already inflated.

**Fuller detail, from a later trace.** The double-award is not limited to score and `enemiesKilled` —
`addDefenderExplosion` also runs `dropManager.handleEnemyDeath` and, via the second pass, increments
`waveManager.totalEnemiesKilled`. So a splash kill double-counts score, kill count, wave kills, and
rolls for drops twice.

Relatedly, the three death sites' scoring guards **disagree with each other**: `handleEnemyDeath`
excludes both `isSpawned` and `shouldExplode`, while the splash and projectile-hit sites exclude only
`isSpawned`. Any fix should reconcile all three rather than patching one.

### 13. Sprite scaling is now non-integer at most window sizes

Defenders are sized to the grid cell (40–80px) rather than a fixed 64, which is what lets units be
placed in adjacent cells at any window size. But sprite source frames are 64px and the canvas runs
with `imageSmoothingEnabled = false`, so nearest-neighbour scaling now lands on a non-integer ratio at
almost every window size, producing uneven pixel rows.

Purely cosmetic, and invisible in tests. Worth addressing as part of the PvZ-style art direction —
either by authoring sprites at a size that divides cleanly, or by snapping the cell size to a multiple
of the source frame.

### 2. CI pins Node 20 with thin margin

`.github/workflows/frontend-tests.yml` and `pr-checks.yml` both set `node-version: '20'`, while
`jsdom@29` declares `engines: ^20.19.0 || ^22.13.0 || >=24.0.0`.

This resolves today — `setup-node` installs the latest 20.x, which is past 20.19 — and there is no
`.npmrc`, so `engine-strict` is off and a mismatch would only warn. Moving both workflows to `'22'`
would remove the risk entirely.

### 3. Minor pre-existing oddities

- A stray `console.trace()` in `GameEngine.resetGame()`.
- A likely double call of `drawUIs.showWaveAnnouncement` inside `GameEngine.showWaveAnnouncement`.
- Two dead fields, written but never read: `DefenderUnits.js` `lastHitTime`, `WaveManager.js`
  `waveStartTime`.
- `WaveManager.getTimeUntilNextWave` does not exist, so `DrawUIs.drawNextWaveTimer` is dead code.

### 14. Two independent melee damage paths, and BossEnemy runs both (double damage, double sound)

Found 2026-08-15 while adding enemy melee sound on `feature/per-unit-audio`.

A defender in contact with a melee enemy can be damaged by **two independent paths**:

1. `Enemy.updateBehavior` — overlap/AABB based, driven by the frame counter `attackCountdown`,
   applying `targetDefender.takeDamage(this.attackDamage)` when it reaches zero.
2. `CombatManager.updateEnemyCombat` → `Enemy.attack()` — distance based against `attackRange`,
   gated by `canAttack(now)` / `lastAttackTime`.

`GameEngine` runs `enemy.update(this.defenders)` and then `combatManager.updateEnemyCombat(...)` in
the same frame, so both are *reached* every frame. The two cooldowns are nominally the same rate
(`attackRate` frames versus `attackRate * 1000 / 60` ms) but are tracked separately, so they also
drift against each other.

**Corrected 2026-08-15, measured rather than reasoned.** An earlier version of this entry (and of the
task-4 report it was copied from) said the net effect is that melee enemies deal about twice their
configured DPS. That is not what happens for most of them. Both paths only run when an enemy is a
`CombatManager` target *while in contact*, which needs

```
attackRange >= (enemy.width + defender.width) / 2      // the centre distance it stops at
```

because `Enemy.updateBehavior` halts the enemy the frame its bounding box first overlaps. Every
non-spell defender is 64 wide, so this is a stable per-enemy property. Driving each enemy into a
Shooter on a real `GameEngine` tick and counting damage applications:

| Enemy | `attackRange` | contact distance | paths that fire |
|---|---|---|---|
| BasicEnemy, FastEnemy, TankEnemy, BombEnemy, ShieldEnemy, GhostEnemy, HealerEnemy, SplitterEnemy, MiniEnemy, EMPEnemy, **TitanEnemy** | 0-50 | 48-122 | base tick only (they use, or `super`-call, `Enemy.updateBehavior`) — **1× damage** |
| VampireEnemy, BerserkerEnemy, NecromancerEnemy, SwarmLeader | 100-250 | 64-82 | `CombatManager` only (they override `updateBehavior` with no damage tick) — **1× damage** |
| **AssassinEnemy** | 30 | 57 | its own `updateBehavior` override for the one-shot strike, then the base tick — **1× damage** |
| **BossEnemy** | **1000** | **82** | **both — 2× damage** |

*(Table corrected 2026-08-15 after review: `TitanEnemy` was missing entirely — it calls
`super.updateBehavior()` and belongs in row 1 — and `AssassinEnemy` was filed in row 1 although its
critical strike comes from its own override. Both re-derived from the constructors. The conclusion is
unchanged: `BossEnemy` is the only enemy where both paths run.)*

So the doubling is real but currently affects **`BossEnemy` alone**.

> **The bug exists in the code but is unreachable in play.** `GameEngine` never imports or constructs
> `BossEnemy` — it is absent from both the import list and the `enemyClasses` map, and no level config
> spawns it (see issue 12, "`BossEnemy` is never imported by `GameEngine`"). No enemy a player can
> currently meet takes double damage or plays the double melee sound.
>
> **Whoever wires the Boss up makes this live and player-visible in the same commit.** At that moment
> the Boss deals roughly twice its configured `attackDamage` and thumps twice per swing, and the
> characterisation test `plays TWO melee sounds per attack cycle for a Boss - a known defect`
> (`EnemyUnits.audioEvents.test.js`) documents the behaviour being inherited. Fix this entry's
> underlying bug first, or ship a boss that hits twice as hard as its stats say.

The architecture is still the bug: an enemy silently flips into double damage the moment someone raises its `attackRange` past its
contact distance, or widens a unit, with nothing to catch it. That is what makes it a balance-pass
blocker (issue 10) — not a blanket 2× on every melee enemy.

**Audio consequence, also corrected.** The melee sound emits sit on the damage sites, so the same
measurement decides how many sounds the player hears. The earlier claim that both emits always land
in one frame and collapse inside `AudioManager`'s 0.04s dedupe window is **false**: the two are gated
by different conditions on different clocks, so their phase offset is arbitrary. Measured on a real
tick, `BossEnemy` emits twice per attack cycle **750-917ms apart** and the player hears **two melee
thumps per swing**. Where the collapse does hold — `VampireEnemy` and `BerserkerEnemy`, which emit
twice for a single strike — it holds because both emits are in one call stack, zero milliseconds
apart, regardless of frame ordering.

`EnemyUnits.audioEvents.test.js` characterises all three shapes on a real `GameEngine` tick
(`how many melee sounds a real engine tick actually produces`), including the Boss double-thump as a
known defect. **Whoever fixes this bug should expect the Boss test to fail** — with one damage path
there should be one emit and one sound, and that test should then be rewritten to assert exactly
that.

### 15. `attackAnimationLock` is read but never assigned, so defenders' attack animation never resets

Found 2026-08-15 while looking for a frame-lock precedent to copy.

`DefenderUnits.js` contains:

```js
    if (this.isAttacking && this.attackAnimationLock <= 0) {
      this.isAttacking = false;
    }
```

`attackAnimationLock` appears exactly once in the whole file — that read. It is never initialised
and never assigned, so it is always `undefined`, `undefined <= 0` is `false`, and the reset never
runs. Whatever clears a defender's `isAttacking` today, it is not this.

Add it to the dead-field list in issue 3, but it is worth its own entry because it is not merely
unused — it is a guard that silently never fires, which reads as working code.

This branch implements the pattern this was evidently meant to be, and it can serve as the reference
if someone repairs the defender side: `CombatManager` sets `isAttacking` and
`attackAnimationLock = ATTACK_ANIMATION_LOCK_FRAMES` at the moment of the shot, and **`Enemy.update()`
runs the lock down via `runDownAttackAnimationLock()`**, clearing `isAttacking` when it expires. Note
the two details that matter: the countdown lives in the **base class**, because `CombatManager` sets
the lock from a rule about `isRanged` and anything set by a base-class rule must be released by one;
and it cannot be cleared in the same frame it is set, because `GameEngine` runs `enemy.update()`
before `updateEnemyCombat()`, so `determineAnimationState` would never see it and the attack
animation would never render at all.

### 16. Stun does not prevent ranged enemy attacks

Found 2026-08-15 during the audio-direction review, while checking whether a stunned enemy should
make a firing sound.

`CombatManager.updateEnemyCombat` skips an enemy that is `frozen` but not one that is `stunned`:

```js
if (!enemy.isAttacker || !enemy.isAlive || enemy.frozen) continue;
```

`Enemy.attack()` *does* bail out on `stunned`, so a stunned **melee** enemy deals no damage — the
melee emit added on this branch is guarded on `stunned` for exactly that reason. But the **ranged**
branch never calls `attack()` to deliver the shot: it pushes a projectile whose `onHit` calls
`attack(target, now)` later, by which time the stun has usually expired. So a stunned ranged enemy
keeps firing, and the projectiles keep landing.

The audio behaviour is therefore *honest* — the shot really happens, so it should really make a sound
— and `determineAnimationState` forces the `idle` animation while stunned, so nothing looks wrong
either. **This is a combat bug, not an audio one.**

Deliberately not fixed on the audio branch: adding `|| enemy.stunned` to that guard makes stun
meaningfully stronger against every ranged enemy, which is a **balance change**, and an audio-only
branch must not make one. It belongs with issue 14 as a blocker for the balance pass (issue 10). Note
the asymmetry to resolve at the same time: the melee branch's `stunned` check is deliberate, so
whoever fixes this should decide whether the guard belongs at the top of the loop instead.

## Deferred from the branch

### 4. `SettingsStore.merge()` returns a shallow copy

Its early-return path is `{ ...DEFAULT_SETTINGS }`, so on a cold start
`getSettings().audio === DEFAULT_SETTINGS.audio`. Not currently exploitable — every writer uses
immutable spreads — but a future in-place mutation would corrupt the fallback for all later merges.

The fix is to deep-copy per category inside `merge()`. Note that `Object.freeze(DEFAULT_SETTINGS)`
would NOT close this, since a shallow freeze leaves the category objects mutable.

### 5. Test coverage gaps

- **No test constructs a `GameEngine`; `GameEngine.test.js` (and `GameEngine.casualties.test.js`)
  only borrow prototype methods onto stubs.** Consequently, reverting the clock-domain fix at
  `GameEngine.resetGame()` (`lastSpawnTime = this.gameClock.now + 5000`) would not be caught by any
  test, and neither would a regression in auto-collect. Both are currently covered only at the unit
  level or by manual play. Building a minimal engine harness would close several gaps at once.
- `canvasState.test.js` guards only the two drop classes. `DrawUIs.drawNormalWaveInfo` and the other
  17 `textAlign` assignment sites have no regression guard, which is narrower than the design spec's
  "after every `draw*`" intent.

### 6. Controls intentionally left disabled

Three settings controls are shown disabled with "(Coming Soon)" rather than wired, because no
behaviour exists behind them:

- **Show Tutorial Hints** — no tutorial system exists.
- **Confirm Deployment** — a two-click confirm flow is real gameplay design and needs its own spec.
- **Auto-deploy Defenders** — was already disabled before this work.

Their keys remain in `DEFAULT_SETTINGS`, so any of them can be wired later without a storage
migration.

### 7. Audio and effects gaps

- **Enemy attacks are silent.** `enemyProjectiles.push` and `spellProjectiles.push` emit nothing;
  the design spec's event catalog has no enemy-attack sound. Adding one would improve game feel.
- **`MusicPlayer` is never stopped.** It starts on the first user gesture and keeps playing through
  logout back to the login page. It also will not restart if the browser suspends the audio context,
  because its `pointerdown` listener has already been removed.

### 8. Minor CSS coupling

The shared numeric-readout rule in `GameBoard.css` uses an unscoped `.score-value` selector, which
also matches an unrelated span on the post-game results screen. Inert today, because that span is
`display: inline` and therefore ignores `width`, `text-align`, and `flex`.

Scoping it to `.game-top-bar .score-value` is the obvious fix, but note that a later rule
(`.score-value, .gold-value`) already overrides font-size and colour — so naive scoping would change
how the top bar looks. Wants a design eye rather than a mechanical edit.

### 9. Spells are modelled as defenders

`FireBlast` and `IceBomb` are `DefenderUnit` subclasses distinguished only by an `isSpell` flag, so
every rule written for defenders applies to them unless individually guarded. Eight such guards exist
today, all consulting `isConsumableSpell(unit)`:

- `DefenderUnit.takeDamage` (base) — spells are invulnerable.
- `HealerDefender`'s resurrection filter — spells are never revived.
- `CombatManager.findTargetForEnemy` — the combat-manager targeting path.
- `GameEngine.markDefenderDead` — a spent spell is not a casualty.
- `Enemy.updateBehavior` (base melee bounding-box search) — melee enemies do not halt on a spell.
- `Enemy.findClosestDefender` (shared by every ranged/special-target enemy) — ranged enemies skip
  spells (not an early exit) to keep looking for a real defender standing behind one.
- `BombEnemy.updateBehavior` (self-destruct proximity check) — a bomber does not detonate on a spell.
- `AssassinEnemy.updateBehavior` (critical-strike search) — the one-shot `hasStruck` crit is not
  burned on a spell.

Three bugs came from this before the first four guards were added — a resurrection exploit,
destructible spells, and casts counting as casualties. A fourth class of bug (enemies treating spells
as targetable/collidable obstacles, addressed by the last four guards above) came from enemy
targeting living in three independent code paths that the first pass of guards missed. If a third
spell type is ever added, move spells into their own entity collection instead of adding a ninth
guard.

**Two further proximity searches remain deliberately unguarded**, because neither causes an enemy to
halt and both are balance quirks rather than defects: `GhostEnemy`'s phase-trigger (around
`EnemyUnits.js:1232`) and `TitanEnemy`'s ground-pound trigger (around `EnemyUnits.js:2097`). Each can
still react to a spell.

They are worth knowing about mainly as evidence for the structural fix: `EnemyUnits.js` contains
copy-pasted proximity searches throughout, so the guard count keeps growing with each one discovered.
Eight guards were needed to cover what was originally believed to be one targeting path. That is the
argument for moving spells out of `this.defenders` rather than continuing to guard individually.

### 10. Level 1 is in a debug state, and the level 1 → 2 curve is a cliff

Found while scoping balance work; not yet fixed, and not a matter of taste — these are broken values.

In `GameLevelConfigs.js`, level 1 ("The Outbreak", the tutorial level):

- **`initialEnergy: 10000`** while every other level gets 120–200. A leftover debug value.
- **Its first wave spawns a `Necromancer`** — one of the most advanced enemy types, listed 15th of 18.
  It is the first enemy a new player ever meets.
- **The config contradicts itself:** `totalEnemiesToSpawn: 1` and `maxActiveEnemies: 1`, while its
  `waveConfigurations` define 11 enemies across three waves.

The result is a difficulty cliff at the worst possible place. Level 1 gives one enemy and effectively
unlimited energy; level 2 gives **25 enemies, 8 active at once, and 120 energy** — precisely when a new
player is still learning the game.

Separately, in `DefenderUnits.js`, **FrostArcher has `damage: 2` with the comment
`// Increased from 80`.** The comment and the value disagree, and 2 damage on a 35-cost unit is close
to useless even allowing for its slow effect. Almost certainly a debugging leftover.

Fixing these is the natural first step of any balance pass, ahead of retuning the curve across all 20
levels.

### 11. `constructor.name` is a load-bearing key — the build must preserve it

The per-unit audio system keys its voice table on `constructor.name`. Vite's esbuild minifier renames
classes by default, so in a production build `Mortar` became `Ef`, every one of the 29 lookups missed,
and the whole feature silently fell back to generic sounds. **All 340 tests passed** while this was
true, because every test supplied the class name as a string literal rather than deriving it from a
real instance.

`Frontend/vite.config.js` now sets `esbuild: { keepNames: true }`. **Do not remove it**, and be wary of
adding any other code that relies on `constructor.name`, `function.name`, or class names surviving the
build.

The audio-direction branch **widened this** from one table in `UnitVoices.js` to `soundKeyFor`, which
every sound in the game now routes through: without the setting, every unit collapses to `projectile`
on fire and `death-medium` on death. Deleting the config block used to leave the whole suite green, so
`Feedback/__tests__/viteConfig.test.js` now asserts the value directly. That is the only mechanical
guard available from inside a test run — a vitest run is never minified, so no runtime test can
observe the real failure.

Two lessons worth keeping:

- A test that supplies an identifier as a literal proves nothing about whether the real caller produces
  that identifier. `UnitVoices.test.js` now constructs a real `Mortar` and reads
  `instance.constructor.name`, which is the only version of that test that can fail.
- A green suite is not evidence a feature works end to end. This one was fully compatible with the
  feature being completely dead in the shipped game.

### 12. Remaining audio gaps

- **`enemy:hit` does not fire for `onHit`-callback attacks.** The emit sits on the `else` branch of
  the projectile-hit path, so any attack using an `onHit` callback — Sniper hitscan, FrostArcher,
  Mortar splash — produces no hit sound. Recorded during the per-unit audio work, not fixed.
- **Mortar's firing sound is not frame-synced with its shell's visual launch.** It queues a
  locally-tracked shell rather than pushing to `gameEngine.projectiles`, so the sound plays when it
  commits to firing rather than when the shell appears.
- **`BossEnemy` is never imported by `GameEngine`.** It is dead code, tree-shaken out of the bundle,
  so its voice is unreachable. Either wire the class up or delete it. **If you wire it up, read
  issue 14 first** — the Boss is the one enemy that runs both melee damage paths, so connecting it
  also switches on double damage and a double melee thump, neither of which is reachable today.
- **`EMPEnemy.triggerEMP` and `TitanEnemy.performGroundPound` apply visible effects to defenders with
  no feedback event.** The EMP disables defenders outright and the ground pound damages everything in
  a 350px radius, both in silence. Neither is a criterion 6 gap — they are not ranged fire, melee,
  spells or summons, and the audio spec assigned them no sound — so they were deliberately skipped
  during the enemy-audio pass rather than missed. They are the obvious candidates for the next audio
  pass, and adding them is a design choice (which sound, which tier) rather than a bug fix.
- **A suspended `AudioContext` freezes `ctx.currentTime`**, so `AudioManager`'s active-voice list never
  prunes and the concurrency cap would steal on every call past 12. Edge case, low priority.

## Not a defect: known verification limits

- **jsdom has no layout engine** (`offsetWidth` is always `0`), so no automated test can prove the
  top-bar text-shift fix works. It is verified by CSS assertion plus manual visual confirmation, by
  deliberate decision recorded in the design spec.
- The music is deliberately simple synthesized ambience so the Music Volume slider controls something
  real. It is not a composed soundtrack.
