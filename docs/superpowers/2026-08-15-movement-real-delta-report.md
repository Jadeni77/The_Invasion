# Movement and countdowns on real elapsed time, not rendered frames

Branch `fix/movement-real-delta`, from `develop` at `44fe448`.

## The bug

A playtester on a 120Hz ProMotion Mac reported "the attacks are not consistent...
idk if I am lagging or what". They were not lagging. The game was running fast.

`GameEngine.gameLoop` is uncapped `requestAnimationFrame`. Combat cooldowns run on
`GameClock`, which measures `performance.now()`, and since `0b7bc21` sprite
animation does too. Movement and every other countdown were still counted once per
*rendered* frame. On a 120Hz display that is two steps of movement per one step of
cadence: enemies walked and projectiles flew at double their intended speed while
the firing rate stayed correct, and a drop to 30fps inverted it. What the player
felt as inconsistent attacks was the two clocks drifting apart.

This is the same defect `0b7bc21` fixed for animation, in the systems that commit
did not reach. A half-converted game is worse than an unconverted one, because the
converted and unconverted halves disagree with each other by an amount that depends
on the player's hardware.

## The constraint, and why this is a fix and not a rebalance

Every speed and countdown constant in this codebase was authored against a 60fps
frame. `speed: 0.8` means 0.8 pixels per sixtieth of a second; `attackRate: 90`
means ninety sixtieths. The conversion is only a bug fix if it reproduces today's
60fps behaviour *exactly*. No authored constant was changed.

The shape is a scale factor that is exactly 1 at 60fps:

```js
frameScale() === frameDeltaMs() / AUTHORED_FRAME_MS
this.x += this.speed * frameScale();
```

At a frame that measures exactly `1000/60` ms this is `x / x`, which is exactly
`1.0` in IEEE 754, so `speed * frameScale()` is bit-for-bit `speed` and the
additions proceed in the same order on the same floats. At 60fps the change is a
no-op. Only other refresh rates move.

### The nominal-frame constant

`0b7bc21` deleted `GAME_FRAME_MS` deliberately, on the grounds that "a caller that
has not been told how much time passed should freeze, not guess". A clearly-named
constant is reintroduced rather than derived, because the two constants mean
different things and only one of them was a bug:

- `GAME_FRAME_MS` claimed to be **how long a frame is**. That is a measurement, it
  was wrong by 2x on the reporter's machine, and guessing it was the bug.
- `AUTHORED_FRAME_MS` is **the frame length the game's constants were tuned
  against**. That is a unit of authorship. It is a fact about the source, not about
  the hardware, and it is exactly as true on a 120Hz display as on a 60Hz one.

Deriving it (writing `1000 / 60` at the one division site) would have worked, but a
named constant is where the "why 60?" explanation can live, and the reasoning above
is precisely what a future reader will need.

### The clamp

`frameScale()` is derived from `frameDeltaMs()` rather than measuring a delta of its
own, so it inherits `GameClock`'s exported `MAX_DELTA_MS` for free. No second clamp
was declared. Without it, a tab left backgrounded for a minute returns with a single
frame worth thousands of authored frames and teleports every enemy across the field.

### Publication rather than threading

`frameScale()` is read from the `Animation/FrameTime.js` module singleton that
`0b7bc21` introduced, and which `GameEngine.update()` already publishes to once per
frame. Threading a delta parameter through instead would mean widening the
signatures of `handleMovement`, `updateBehavior` and `update` across two unit
hierarchies and some fifty call sites — a far larger change than the bug warrants,
and the same trade-off `0b7bc21` made for the same reason.

## Sites converted: 49

### `EnemyUnits.js` — 18

Movement (8): `Enemy`, `RangeEnemy`, `SwarmLeader`, `VampireEnemy`,
`BerserkerEnemy` (inline in `updateBehavior`, not a `handleMovement` override),
`NecromancerEnemy`, `AssassinEnemy` (whose step is `dashSpeed` while stealthed),
`MageEnemy`.

Countdowns (10): melee `attackCountdown`; `HealerEnemy.currentHealCooldown`;
`SwarmLeader.currentSpawnCooldown`; `GhostEnemy.currentPhaseShiftCooldown` and
`currentPhaseDuration`; `NecromancerEnemy.currentReviveCooldown`;
`AssassinEnemy.currentStealthDuration`; `MageEnemy.attackCooldown` and
`castingTimer`; `TitanEnemy.currentGroundPoundCooldown`.

### `DefenderUnits.js` — 12

`HealerDefender.healAnimationTimer` and `healingCountdown`;
`BarricadeDefender.hitAnimationTimer` and `electricFieldCooldown`;
`EnergyGenerator.generateAnimationTimer`, `energyBurstCooldown` and
`energyDropCountDown`; `Sniper.barrelRecoil` and `targetLockTime`;
`Mortar`'s per-shell `timeRemaining`; `FireBlast.currentActivationTimer` and
`IceBomb.currentActivationTimer`.

`hitAnimationTimer` was decremented by a hardcoded `16`, this file's own
hand-rounded 60fps frame. It is scaled (`16 * frameScale()`) rather than replaced by
the true delta on purpose: 16 against a 500ms `hitAnimationDuration` is 31.25
frames, so the hit flash has always lasted ~521ms rather than 500ms. Substituting
the real delta would quietly shorten it by 4%, which is a rebalance. Noted as a
separate, pre-existing inaccuracy; not fixed here.

### `GameEngine.js` — 11

Projectile movement in `updateProjectiles`, `updateEnemyProjectiles` and
`updateSpellProjectiles`; the spell trail's `point.timer`; explosion timers; the
defender status effects `disabledDuration` and `burningDuration`; the enemy status
effects `slowDuration`, `frozenDuration`, `stunnedDuration` and `burningDuration`.

Two of these needed more than a multiplication:

**The projectile arrival test.** `if (distance <= projectile.speed)` compared the
remaining distance against the *authored* speed. At 30fps a frame's step is two
authored speeds, so a projectile that only counted as arrived within one would step
straight past its target and then orbit it forever. Both the test and the move now
use the same `step = speed * frameScale()`.

**The burn damage tick.** `if (defender.burningDuration % 30 === 0)` fired every 30
authored frames by landing exactly on a multiple. A countdown that steps by a
fraction lands on an exact multiple essentially never, so the burn would silently
stop dealing damage. Replaced with `crossedPeriod(before, after, 30)`, which asks
whether the step *crossed* a multiple. It reproduces the integer behaviour exactly
(31→30 fires, 30→29 does not, 1→0 fires) and fires once, not repeatedly, for a step
large enough to skip several periods — the tick is an event, not an accumulation.
This was the only `% N === 0` against a frame counter in the codebase; the sweep for
others found only wave-number arithmetic, which is not time.

### `GameEngineBreakDown/Draws/DrawUIs.js` — 6

`announcementTimer` (both the copy in `update()` and the copy in
`drawWaveAnnouncement`), `milestoneAnimation.timer` (likewise both), and the
announcement's linear fade in and fade out.

Note for a future reader: `announcementTimer` is decremented in *both* `update()`
and `drawWaveAnnouncement()`, so a wave announcement has always counted down at
twice its nominal rate. That is a pre-existing bug. Both sites are scaled
identically, so 60fps behaviour is preserved exactly and the double decrement is
left as it was rather than silently corrected inside a timing change.

### `Drops/EnergyDrop.js`, `Drops/CardPieceDrop.js` — 2

The `lifetime` countdowns, so a "10 second" orb lasts ten seconds at any refresh
rate.

## Sites deliberately NOT converted

**The two drops' collect animations** (`x += dx * 0.1`, `opacity *= 0.95`, and the
`0.15` / `0.92` variants). These are the only per-frame accumulations left in the
gameplay path, and the omission is commented at both sites so it does not read as an
oversight.

They are geometric decays rather than linear steps. The rate-correct conversion is
`1 - Math.pow(1 - 0.1, frameScale())`, and that evaluates to `0.09999999999999998`
at 60fps, not `0.1` — verified, along with `0.15 → 0.15000000000000002`. It would
therefore break the exact-identity property the whole change is built on. Nothing
turns on the difference: a drop's energy is credited to the player at the moment the
collect animation *starts*, so this is the flight of an already-collected pickup
toward the HUD. It runs about twice as fast on a 120Hz display and always has.

(`opacity *= 0.95` alone could be converted exactly, since `Math.pow(0.95, 1)` is
exactly `0.95`. Converting the fade without the flight it accompanies would produce
precisely the half-converted, mutually-disagreeing state this change exists to
remove, so both are left together.)

**Everything else the sweep turned up is not per-frame and needs no conversion:**

- Event counters incremented on an occurrence, not a tick: `enemiesKilled`,
  `defendersLost`, `defendersDeployed`, `energyCollected`, `inGameScore`,
  `baseDamageTaken`, `waveEnemiesSpawned`, `currentWave`, `killCount`,
  `reviveCount`, and `BerserkerEnemy`'s per-kill `damageBonus` / `speedBonus` /
  `healthBonus`.
- Damage and cost arithmetic: `health -= amount`, `shieldHealth -= amount`,
  `inGameEnergy -= cost`, crit and rage multipliers.
- Already real-time: `GameClock`, `JuiceManager` (takes `deltaMs`), `MusicPlayer`
  (audio-context time), `WaveManager` and `CombatManager` (both read
  `gameClock.now`), and sprite animation (`0b7bc21`).
- `TitanEnemy.performGroundPound`'s charge and earthquake timings, which are
  `setTimeout` on the wall clock and were never frame-counted.
- Drawing geometry that happens to use `+=`: the segment walks in
  `DrawExplosionEffect` and `DrawNegativeEffect`, and loop counters. The explosion
  and negative-effect draws animate off `explosion.timer` (now real-time) or
  `Date.now()`, so both follow automatically.
- `WaveManager`'s `random -= weights[i]` weighted pick, which is not time at all.

## The first frame

A frame's length is measured against the previous frame, so the very first frame has
nothing to measure against and covers zero time. Movement and countdowns therefore
do not advance on it, where previously they advanced by a whole frame. This is one
frame at game start and one on resume from pause, it is unobservable in play, and it
is the rule `GameClock` and sprite animation have already followed since `0b7bc21` —
the alternative is to guess, and guessing is the bug. It is called out explicitly in
the test fixture so a future reader does not mistake it for drift.

## Tests

`__tests__/MovementRealDelta.test.js`, 12 tests in two groups.

**60fps identity (7).** Positions and countdowns after N frames of exactly
`1000/60` ms are compared with `toBe` against a reference computed by the very
repeated addition the frame-counted code performed — `expected += 0.8` sixty times,
not `60 * 0.8`, which is a different float. Covers enemy walking, the melee attack
countdown, melee damage-tick cadence, frozen expiry, the burn damage tick, projectile
flight in both axes, and explosion expiry.

These pass *before and after* the change. That is what they are for: they are the
evidence that this is not a rebalance.

**Refresh-rate independence (5).** One real second of simulated 120Hz, 60Hz and
30fps frames, driven through the real `GameEngine.prototype.update()` against a
mocked `performance.now()`, must advance an enemy the same distance, land a
projectile at the same wall-clock time, land the same number of melee swings, thaw a
frozen enemy at the same time, and expire an explosion at the same time.

### RED

Command: `npx vitest run "src/component/GameLogic (MVC)/__tests__/MovementRealDelta.test.js"`
against `44fe448` source with the new test file in place (verified by stashing only
the source changes).

```
Tests  5 failed | 7 passed (12)

120Hz (ProMotion) travelled 95.99999999999979px in one second:
  expected 95.99999999999979 to be close to 48
120Hz (ProMotion) landed the shot after 1708.333333333329ms,
  60Hz after 3416.666666666658ms: expected 1708.333333333329 to be less than 34.333333333333336
120Hz (ProMotion) landed 4 swings in one second, 60Hz landed 2:
  expected 4 to be 2
120Hz (ProMotion) thawed after 1499.9999999999975ms, not the authored 3000ms:
  expected 1500.0000000000025 to be less than 34.333333333333336
120Hz (ProMotion) expired the explosion after 166.66666666666669ms:
  expected 166.66666666666663 to be less than 34.333333333333336
```

96px against 48px, 1708ms against 3417ms, 4 swings against 2: exactly the factor of
two the report describes. All 7 identity tests passed in this run, against the
unmodified source — the point of the exercise.

### GREEN

```
Test Files  28 passed (28)
     Tests  601 passed (601)
```

589 at the `44fe448` baseline, plus the 12 new tests. `npm run lint` clean.

### An honest note on how the identity tests are driven

The identity group publishes an exact `1000/60` delta and calls the frame's real
update methods in `GameEngine.update()`'s own order, rather than driving `update()`
end to end. This is not a convenience: a mocked clock advanced by repeated
`+= 1000/60` accumulates rounding, so the *measured* delta comes out an ulp short
and `frameScale()` lands at `0.9999999999999998` instead of `1`. The first draft of
these tests failed for exactly that reason, which is how the distinction was found.
The property being asserted is about a frame that measures exactly one sixtieth of a
second; the independence group drives the real `update()` end to end, where that ulp
is irrelevant.

The two wall-clock independence assertions use a tolerance of one frame at the
coarsest rate under test. A countdown can only expire on a frame boundary, so that
is the finest granularity the claim can honestly be made at.

## Existing tests touched

`EnemyUnits.test.js`, `DefenderUnits.spells.test.js` and
`DefenderUnits.audioEvents.test.js` drive `update()` by hand as a stand-in for the
game loop and count ticks. With movement on real time and no delta published, they
saw zero elapsed time and nothing moved. Each now pins the loop to 60Hz in a
`beforeEach`, exactly as `0b7bc21` did for `AttackAnimation.test.js` and
`EnemyUnits.audioEvents.test.js`, with a comment saying so. No assertion was
changed — the tick counts always meant 60Hz ticks; that assumption is now written
down.

## Concerns

1. **`DrawUIs` timers are decremented twice per frame** (once in `update()`, once in
   `drawWaveAnnouncement`/`drawMilestoneIndicator`). Pre-existing; preserved exactly
   rather than fixed inside a timing change. Worth a follow-up.
2. **`hitAnimationTimer`'s hardcoded `16`** makes the hit flash ~521ms rather than
   the 500ms its `hitAnimationDuration` declares. Pre-existing; preserved. A
   one-character fix, but a rebalance, so out of scope here.
3. **The module-singleton frame delta is global state.** It is the pattern
   `0b7bc21` established and the alternative is a fifty-site signature change, but it
   does mean a caller outside `GameEngine.update()` sees whatever the last frame
   published. In practice everything that reads it runs inside `update()` or the
   `draw()` immediately following it.
4. **Fractional countdowns can take one extra frame to expire** when accumulated
   float leaves a residue of ~1e-13. Observed in testing at 60Hz. It is one frame,
   it is inherent to fractional accumulation, and it is invisible in play.
