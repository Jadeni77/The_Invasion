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

### 15. `attackAnimationLock` is read but never assigned, so defenders' attack animation never resets — FIXED 2026-08-15

Found 2026-08-15 while looking for a frame-lock precedent to copy.

`DefenderUnits.js` contained:

```js
    if (this.isAttacking && this.attackAnimationLock <= 0) {
      this.isAttacking = false;
    }
```

`attackAnimationLock` appeared exactly once in the whole file — that read, inside `Mortar.update()`.
It was never initialised and never assigned, so it was always `undefined`, `undefined <= 0` is
`false`, and the reset never ran. It was a guard that silently never fired, which reads as working
code.

**Resolved by the playtest fix wave (2026-08-15), which superseded it rather than repairing it.**
`ATTACK_ANIMATION_LOCK_FRAMES` — the enemy-side pattern this entry recommended copying — is gone
too. Both sides now derive attack-animation playback from the attack cadence
(`Animation/AttackPlayback.js`): one full pass over the sheet per attack, taking
`min(authored sheet duration, cadence)`, and the pass ending is what clears `isAttacking`. A fixed
frame lock could not serve the owner's requirement that every sheet plays in full — at 20 frames it
showed about a third of the Skeleton Shooter's 10-frame sheet.

The two details the old entry flagged still hold and are preserved:

- the release lives in the **base class**, because `CombatManager` starts the swing from a rule about
  `isRanged`, and anything a base-class rule can start a base-class rule must be able to end;
- it cannot be cleared in the same frame it is set, because `GameEngine` runs `enemy.update()` before
  `updateEnemyCombat()`, so `determineAnimationState` would never see it. Counting the sheet's own
  duration down satisfies that automatically.

`Enemy.runDownAttackAnimation()` remains as a backstop for a unit whose sprites never loaded and so
has no sheet to run out of. Two dead Mortar fields (`isFiring`, `fireAnimationTimer`,
`fireAnimationDuration`) went with the guard; the Mortar now drives its swing from `isAttacking` like
every other defender.

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

### 17. The Titan's two AoE abilities kill most of the board, and the loop fix makes them land more often

Found 2026-08-15 on `feat/titan-feedback`, while giving both abilities sound and a telegraph. Full
arithmetic in `2026-08-15-titan-feedback-report.md`; **nothing was tuned**, because this is a balance
decision and it is the owner's.

- **Ground pound.** Three waves of 45 = **135** inside 116.7px (the waves are 116.7 / 233.3 / 350px,
  centre to centre, not one 350px ring). At level 1 that kills **7 of the 10 defender types** —
  everything except the Barricade and the two consumable spells, and the spells only survive because
  `isConsumableSpell` makes them invulnerable. At level 5 it still kills E-Gen, Sniper and Grenadier.
  A single wave of 45 kills nothing; the lethality is entirely in the stacking.
- **Phase transition.** 40 damage kills nothing on its own, but the 1500px radius is larger than the
  canvas, so it reaches every defender the player owns, and 300 frames of `disabled` is 5 seconds ×
  2 transitions. Both transitions total exactly 80, which is exactly lethal to the level-1 E-Gen and
  Sniper (both 80 health).
- **Phase 3 sets `attackDamage = 300`**, against the highest defender health in the game outside the
  Barricade (192, a level-5 Shooter). It one-shots everything else at every level.

**The `continue` fix on this branch makes the pound stronger in practice.** It previously bailed out
of its own damage loop at the first dead defender in `gameEngine.defenders`, sparing everything
behind it — and defenders die constantly against a Titan. The ability always *meant* to do 135 to
everything in the inner ring; now it does. Judge the balance against the fixed behaviour, not against
what has been played until now.

**Corrected 2026-08-15 after play-testing: the 135 figure above is real but nearly unreachable, and
leading with it misrepresents the fight.** The Titan is 180px wide and a defender 64px, so a defender
that has stopped it sits at **122px** centre to centre — the Titan halts the frame their bounding
boxes touch. Wave 1's radius is 116.7px, which is *smaller than that*. So the first and
heaviest-looking slam can never hit the defender standing in front of it.

| Band | Waves landing | Damage | Deaths at level 1 |
|---|---|---|---|
| < 116.7px | 1, 2, 3 | 135 | 7 of 10 — only defenders in adjacent rows the Titan walks past |
| 116.7-233.3px | 2, 3 | **90** | 3 of 10 — E-Gen (80), Sniper (80), Frost Archer (90, exact) |
| 233.3-350px | 3 | **45** | none |
| > 350px | — | 0 | none |

The unit blocking the Titan takes 90 and usually survives on 10-30 health; its neighbours in
neighbouring rows take the full 135 and mostly die. So the ability punishes the formation's flanks
rather than the defender deliberately placed in its path — a strange shape for a boss attack, and
most likely a consequence of tuning the radii without accounting for the Titan being 180px wide.

**The owner has seen this and chosen to leave it** (2026-08-15). Do not "fix" the radii as a tidy-up.
If it is ever revisited, the two candidate changes are growing `earthquakeRadius / 3` past the 122px
contact distance, or measuring the waves from the Titan's edge rather than its centre.

### 18. The Titan never takes full damage, and the phase-3 comment says otherwise

`TitanEnemy.takeDamage` reduces every incoming hit:

```js
const actualDamage = (this.hasArmor && !ignoreArmor)
  ? amount * this.armorDamageReduction   // 0.2 - 80% reduction
  : amount * 0.5;                        // still 50% reduction
```

Phase 3 sets `hasArmor = false` under the comment `//lose armor reduction`, but the `else` branch
still halves the damage — so the armour never actually comes off, and the Titan takes at most 50% at
any point in the fight. A defender hitting for 5 deals 1, which is what the owner observed in play.

The two comments disagree: `//either take 20% or 50% damage` reads as though the 50% floor is
deliberate, while `//lose armor reduction` reads as though phase 3 should remove it. Whichever is
intended, the other comment is wrong.

**The owner has chosen to leave this** (2026-08-15). Belongs with the balance pass; if phase 3 is
meant to be the reward for surviving that far, the `else` branch should be plain `amount`, which
makes the Titan roughly twice as killable in its final phase.

Belongs with issues 14 and 16 in the balance pass (issue 10).

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
- **`BossEnemy` is never imported by `GameEngine`.** It is tree-shaken out of the bundle, so its
  voice is unreachable. **Do not delete it** — the owner confirmed on 2026-08-15 that the Boss is
  simply not designed yet, and the class is a work in progress rather than an abandoned one. Boss
  waves currently spawn an ordinary enemy type (`bossType` is only ever `Vampire`, `Titan`, `Mage` or
  `Necromancer`) flagged `isBoss: true`, which is why a boss plays like a renamed regular unit.
  **When it is designed and wired up, read issue 14 first** — the Boss is the one enemy that runs
  both melee damage paths, so connecting it also switches on double damage and a double melee thump,
  neither of which is reachable today.
- **`EMPEnemy.triggerEMP` and `TitanEnemy.performGroundPound` apply visible effects to defenders with
  no feedback event.** The EMP disables defenders outright and the ground pound damages everything in
  a 350px radius, both in silence. Neither is a criterion 6 gap — they are not ranged fire, melee,
  spells or summons, and the audio spec assigned them no sound — so they were deliberately skipped
  during the enemy-audio pass rather than missed. They are the obvious candidates for the next audio
  pass, and adding them is a design choice (which sound, which tier) rather than a bug fix.
  **HALF DONE 2026-08-15:** the Titan's ground pound (`quake-charge` + `quake-impact`) and its phase
  transition (`phase-change`) now emit and sound, on `feat/titan-feedback`; see
  `2026-08-15-titan-feedback-report.md`. `EMPEnemy.triggerEMP` is still silent, and now has three
  layered recipes to borrow a shape from.
- **A suspended `AudioContext` freezes `ctx.currentTime`**, so `AudioManager`'s active-voice list never
  prunes and the concurrency cap would steal on every call past 12. Edge case, low priority.

## Not a defect: known verification limits

- **jsdom has no layout engine** (`offsetWidth` is always `0`), so no automated test can prove the
  top-bar text-shift fix works. It is verified by CSS assertion plus manual visual confirmation, by
  deliberate decision recorded in the design spec.
- The music is deliberately simple synthesized ambience so the Music Volume slider controls something
  real. It is not a composed soundtrack.

## Deferred from the visual-direction branch (2026-08-17)

Recorded at the close of `feat/visual-direction`. The branch shipped a token layer over both CSS and
canvas, a real display font, integer sprite scaling, lane bands, a base with a body, cards as objects,
and a reachable settings screen. These are the things deliberately left.

### 19. Settings had never been reachable before this branch

Worth recording because it explains a lot. `GameBoard.jsx`'s element with `className="settings-button"`
is a **quit-to-lobby button** (`onClick={handleQuitClick}`, `title="Return to Lobby"`), and
`openSettings`/`closeSettings` had **zero call sites anywhere** in the codebase. So every audio control
built during the audio work — volume, mute — was unreachable in play for the life of the project.

The lobby now has a real settings button and the full open/close loop is tested. The misleading class
name on the quit button was left alone; renaming it is cosmetic and touches a screen this branch
otherwise did not.

### 20. Fourteen buttons put white text on accent colours below 4.5:1

The contrast guard added on this branch found them and they are pinned as explicit opt-outs, each with a
measured ratio and a reason, so a new one cannot be added silently. They are a systemic convention
rather than a slip: "Play", "Upgrade", "Claim" and similar.

White on gold at 3-4:1 is ordinary in game UI and reads fine for most people; 4.5:1 is an accessibility
standard, not an aesthetic one. **The owner's call.** The mechanical fix is `edge-outline` text on
accent backgrounds, which clears all fourteen at 12.85:1 but changes the look of most primary buttons.

### 21. Mortar and Frost Archer draw at 0.75x on narrow viewports

Both are 64px native after the crop audit; every other defender is 48px, which is the grid floor. So
below a ~716px container the two of them scale fractionally while the other eight stay crisp.

This bites hardest on iPhone: `screen.orientation.lock()` is unsupported in iOS Safari and the failure
is silently caught in `UseMobileOrientation.js`, so the game runs at portrait width (375-430px).

Raising the floor to 64 fixes it and costs a quarter of the columns at every size — declined. The
recommended fix is **on the art side**: re-export those two sheets inside a 48x48-compatible frame.

### 22. Three defenders were being clipped, and one crop typo was hiding it

Found by measuring sprite content boxes with PIL, which no test can do. `Shooter` lost 6px off its
attack swing and `Healer` 2px off its staff-raise — both for the life of the project, because the
shared 48x48 crop template happened to fit `Sniper`, the only unit anyone had checked.

`Mortar`'s `cropConfig` was also misspelled **`ropConfig`** at three lines, so it never cropped at all.
Fixing the typo activated a crop that did not fit it, which is how the clipping was found. `Mortar` and
`Frost Archer` now draw uncropped; `Shooter` and `Healer` have corrected offsets.

### 23. Guard tests fail on scope, not on matching logic

Eight guards were found during this work that did not guard, and **every one failed the same way**: it
scanned too narrow a set of files. Not one failed because its pattern was wrong.

- a font family declared with no file behind it, in a stylesheet the font guard did not read
- a contrast test measuring a rule the browser discards, because it took the first selector match
  rather than the cascade winner
- a colour guard seeing one of six syntactic forms
- a suite green over completely silent audio, because a fake context lacked one property and the bus
  swallowed the error
- `.jsx` owned by no guard at all, in the seam between the CSS and canvas scanners
- a stylesheet colocated with a component, invisible to a non-recursive directory read
- any directory named `test`, which disabled scanning for everything beneath it

The durable form is the one that never failed: **derive scope from what a file is** — does it call a
canvas API, declare a colour property, import the token module — **not from where it sits.**
`Frontend/src/test/sourceFiles.js` does this now. Its own first version fixed a hand-written list of
directories to include and reintroduced the same seam with a hand-written list of directories to
exclude, which is the trap in miniature.

### 24. Smaller items left open

- **No canvas contrast guard.** The WCAG check covers CSS pairs only; canvas text has no equivalent.
- **`accentDanger` carries two meanings** on the lobby map — boss indicator and "late" zone. Pre-existing,
  not introduced; a palette decision.
- **`LoginPage.jsx`'s 13 colour literals** are pinned by an exact ordered list, so a 14th fails the guard.
  Whether that screen belongs to the visual direction is an owner decision, not an oversight.
- **12 declared tokens have no uses** — mostly `--space-*`, `--radii-sm`, `--type-size-*`. Adopting them
  is a geometry change wanting its own look and its own guard; `--type-weight-regular` can just go.
- **`RAINBOW_STOPS` has no live consumer**, kept deliberately so a hardcoded rainbow does not grow back.
- **`.ts`/`.tsx` are outside the guards' extensions.** Parked: the repo has no TypeScript.
- **`drawBackground` has no top-level save/restore.** Confirmed leaking, no live bug.

### 25. Nothing visual on this branch has been seen

jsdom has no layout engine and no rasteriser, so 1228 passing tests confirm that colours come from
tokens and that scale arithmetic is whole — never that a screen looks right. Ranked by likelihood of
looking wrong, from the final review: the lobby map's five moved zone hues and new backdrop washes; the
base wall against the terrain; lane bands at 1.146:1 possibly reading as "nothing shipped"; two
typefaces per frame if the canvas font fails to load; recharging cards; `Mortar` at portrait width.

## Found 2026-08-17 while diagnosing owner play-test feedback

### 26. Spawn intervals reach 25 enemies per second, and maxActiveEnemies is never enforced

The owner reported: "The game spawning logic also need improvements, it spawn so often, and that some
of the zombie movements are way faster that it is hard to defend."

Measured. **40 hand-written wave configs sit below 300ms**, escalating by level:

| Level | Fastest interval | Spawns/second |
|---|---|---|
| 12-13 | 200-250ms | 4-5 |
| 14-16 | 140-180ms | 5.6-7.1 |
| 17 | 100ms | 10 |
| 18 | 60ms | 16.7 |
| 20 | **40ms** | **25** |

Two things make this worse than a steep curve:

- **`maxActiveEnemies` is not checked at the spawn gate.** `WaveManager.spawnWaveEnemies` returns early
  only on `waveEnemiesSpawned >= waveConfig.enemyCount` and on the interval. Nothing caps how many
  enemies are alive at once, so the interval alone governs the field.
- **Hand-written configs bypass the floors the generated ones have.** `WaveManager` clamps its own
  generated intervals with `Math.max(500, …)` and `Math.max(300, …)`, but a `waveConfigurations` entry
  is used verbatim. The two paths disagree about what a safe minimum is.

On speed: enemy movement runs 0.1-1.6, with FastEnemy at 1.5 and SwarmLeader at 1.6 against a basic
zombie's 0.8 — close to 2x. That is defensible on its own and punishing alongside a sub-200ms interval.

**Note for whoever tunes this:** `speed: 12` appears twice in `EnemyUnits.js` and is *not* enemy
movement — it is fireball and icebolt projectile speed in `MageEnemy`. An earlier diagnosis of mine
mistook it for a movement outlier. Do not "fix" it.

Belongs with the balance pass (issue 10), alongside 14, 16, 17 and 18.

### 27. The settings screen is the only blue-accented screen in the game

The owner reported it "seems unrelated to the game… like an isolated area."

Counted across every stylesheet:

| Stylesheet | `accent-info` (blue) | `accent-energy` (gold) |
|---|---|---|
| AchievementPage | 0 | 18 |
| GameBoard | 0 | 16 |
| Lobby | 8 | 32 |
| UpgradeModal | 7 | 11 |
| CollectionPage | 5 | 6 |
| **SettingModal** | **14** | **0** |

Every other screen is gold-dominant. `SettingModal.css` uses blue fourteen times and gold not once —
headings, sliders, the selected quality button, and Apply.

The cause is a role error in the token conversion, not a bad token. Blue is the **informational** accent
(frost, information); gold is the primary accent (energy, currency, stars, primary action). The settings
screen's original colours were blue-ish, so the conversion preserved the hue where it should have mapped
the role.

Fix is small: primary actions and headings take `accent-energy`, and blue is kept for anything genuinely
informational. Worth checking `CollectionPage` and `UpgradeModal` for the same error while there.

---

## 28. The repo-wide colour guard's named-colour list covers 27 of 147 names

**Found:** 2026-08-17, during the lobby campaign-map work.
**Severity:** low today, latent.
**Scope: repo-wide, not one file.**

`noRawColours.test.js` blocks raw colour literals by matching hex, the functional notations, and a list
of CSS named colours. The hex and functional matching is sound — `#[0-9a-fA-F]{3,8}\b` spans all four
valid hex lengths, alpha included. The named-colour list is the gap: it holds about 27 names against
CSS's 147.

These pass the guard today:

`coral`, `crimson`, `indigo`, `khaki`, `salmon`, `turquoise`, `violet`, `tan`, `beige`, `chocolate`,
`plum`, `orchid`, `hotpink`, `skyblue`, `steelblue`, `seagreen`, `royalblue`, `goldenrod` (only
`darkgoldenrod` is listed), `tomato`.

Nothing exploits this now. It matters because the list is copied into per-file guards as they are
written — `TerrainProps.test.jsx` took it verbatim — so the gap propagates rather than staying in one
place.

**This is the fourteenth guard-scope finding in this project, and the fourteenth to fail on scope rather
than on matching logic.** The pattern is exact enough to be a rule now: when a guard enumerates the
things it forbids, it is wrong by default — the durable form asserts what is *allowed* and rejects
everything else.

Fix: either use the full 147-name list, or invert it — assert every colour-valued declaration is
`var(--…)` and fail anything that is not, which needs no list at all.

---

## 29. Two guards ship with an enumerated escape hatch

**Found:** 2026-08-18, adjudicated at the close of the lobby campaign-map branch.
**Severity:** latent. Nothing exploits either today.

Both guards added on that branch work, were proved by mutation, and each keeps one hole of the same
shape.

**The duplicate-selector guard flags a selector only as it crosses from one occurrence to more than
one.** Eight pre-existing collisions sit in a dated `KNOWN_DUPLICATE_SELECTORS` allowlist. A *third*
`.chest-glow` rule added tomorrow stays inside that allowlist and is never reported — the guard cannot
distinguish "the two we accepted" from "the two we accepted plus a new one".
Fix: store the accepted **count** per selector, not just the name, so any increase fails.

**`lobbyZOrder.test.js` pins the eight documented layers by exact value and strict order.** A new layer
inserted between two of them, carrying a z-index value not in `DOCUMENTED_STACK`, passes untouched — and
an unclaimed value between two claimed ones is exactly how the route came to paint underneath the
foreground band in the first place.
Fix: assert the set of z-index values in the file **equals** the documented stack, rather than that each
documented layer holds its value.

The contrast guard's orphan-to-family pairing is a third instance, disclosed in its own report:
`.player-name`, `.portal-label` and `.highest-wave` match no family and are silently skipped.

**This is the sixteenth guard-scope finding in this project. Every one of the sixteen failed on scope;
not one failed on matching logic.** The rule earned by now, stated once:

> A guard that enumerates what it forbids — or what it forgives — is wrong by default. Assert what is
> allowed and reject the complement, so the thing nobody thought of fails closed instead of open.

Both fixes above are that inversion applied.

---

## 30. Lobby map follow-ups left after the legibility fix

**Found:** 2026-08-18, closing `fix/lobby-map-legibility`. None blocks the branch.

**a. Each region stretches the same ridgeline SVG across its own width.** The ridge is authored
`viewBox="0 0 600 200"` and each zone spans 675–950px, so the silhouette scales up to 1.4× by a different
factor per region and **the seams between regions do not line up.** Visible on screen. The fix is to the
terrain SVG — author the ridge at the widest span and let narrower regions crop, or tile a fixed-width
motif — not a one-liner, which is why it was deferred.

**b. Props are 70px, the same order as a 54–66px node.** Nothing in the code makes that wrong; whether it
reads as scenery or clutter needs eyes. Shrink the far row before the near row.

**c. The `chestGlow` deferral is pinned only halfway.** `@keyframes chestGlow` animates `scale()` on
`.chest-glow`, whose transform is a centring translate — the same defect fixed on nodes and chests. It was
left alone because `.chest-glow`'s two rules disagree about how it is positioned at all, so restoring the
translate would preserve an unresolved placement. An assertion pins that the animation still exists, so
deleting it forces re-review. **It does not pin the precondition:** if `.chest-glow`'s duplicate rules are
resolved independently, the assertion keeps passing while the bug goes live unnoticed. Pin the duplicate
too, or fix both together.

**d. Three test files still carry the `ruleBody` parenthesis bug.** `MapPanning.test.jsx:19-22`,
`TopBand.test.jsx:16-18` and `RouteAndNodes.test.jsx:10-13` escape only `.` and `:` when building a
selector regex, so a selector containing `:not(...)` would turn its parentheses into a capture group and
the helper would **silently return an empty rule body for a rule that exists** — a passing test that
checked nothing. Fixed in `NodeStates.test.jsx`; latent in the other three because none currently passes a
paren-containing selector. Fix before one does.

**e. The hover-centring guard's reach.** It catches elements centred by a bare single-class selector whose
`:hover`/`:active`/`:focus` rule is a direct compound extension. It misses grouped/comma selectors,
multi-class and descendant base selectors, centring done with margins or insets instead of `transform`,
and hover states applied by a JS-toggled class rather than a real pseudo-class.

---

## 31. Sixteen bare class selectors are declared in more than one stylesheet

**Found:** 2026-08-18, while fixing the Settings screen.
**Severity:** low individually, but this is the mechanism behind two shipped bugs.

Every stylesheet in this app is bundled globally, so a bare `.thing` declared in
two files is **one global class with two definitions**, and bundle order decides
which wins. That is invisible in review: each file looks right on its own, and the
damage lands on a different screen.

It has already caused two visible bugs. `.close-button` was declared in four
stylesheets; `UpgradeModal.css` set `position: absolute; top: 15px; right: 15px`,
which won everywhere, so the **Settings dialog's X rendered in the viewport's
top-right corner** instead of its own header. The same mechanism previously
pinned UpgradeModal's per-card buttons to a corner via `.upgrade-button`.

`.close-button` is now scoped to each screen's root. Sixteen remain:

| Selector | Stylesheets |
|---|---|
| `.energy-icon` | Card, CardSelectionModal, EnergyBar, GameBoard |
| `.resource-icon` | AllImage, GameBoard, Lobby |
| `.progress-bar`, `.progress-fill`, `.progress-text` | AchievementPage, UpgradeModal |
| `.resource-symbol`, `.resource-info`, `.resource-value`, `.resource-label` | AllImage, Lobby |
| `.card-name`, `.card-cost` | Card, Lobby |
| `.back-button` | AchievementPage, CollectionPage |
| `.cancel-button` | CardSelectionModal, SettingModal |
| `.deployment-indicator`, `.indicator-icon` | GameBoard, Lobby |
| `.pieces-icon` | GameBoard, UpgradeModal |
| `.action-buttons` | GameBoard, SettingModal |

Some are genuinely shared components (`ResourceIcon` is one component used by
several screens) and want **one** owning stylesheet rather than scoping. Others
are coincidental name collisions and want scoping.

`selectorOwnership.test.js` guards this. It stores the accepted **count** per
selector, not just the name, so a third `.resource-icon` fails even though the
selector is already listed — and it fails if a listed collision is fixed without
updating the table.

**Related, worth fixing at the same time:** `UpgradeModal.jsx:6` imports
`Lobby.css` outright ("Assuming some styles are shared"), which is how the lobby
resource bar's chip padding reaches the upgrade cost rows.

---

## Fixed since this document was written

- **27 (Settings used the informational accent as its primary):** fixed
  2026-08-18. `accent-info` 14 uses → 0; the heading, section titles, sliders,
  percentages, selected quality button and Apply are `accent-energy`. Apply and
  the active quality button take dark text on gold, which **retired two
  `contrast-ok` opt-outs** that existed only because white-on-blue measured
  2.61:1.
- **30a (each region stretched the same ridge SVG):** fixed 2026-08-18. The
  silhouettes are generated from **absolute map x** on a fixed peak pitch, with
  each region's `viewBox` width equal to its rendered width, so the scale is 1:1
  everywhere and a region's last hill and its neighbour's first are consecutive
  points on one continuous range. Regions span 380–760px and were being stretched
  0.63×–1.27×.
- **The login 403 was a false alarm.** Recorded briefly as a blocker on
  2026-08-18; `POST /api/auth/login` returns a token and the player when the
  backend is built from current source. The 403 came from a stale running
  instance.
