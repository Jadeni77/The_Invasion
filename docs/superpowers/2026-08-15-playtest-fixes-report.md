# Playtest fixes: death sound, Mortar sound, truncated attack animation

Date: 2026-08-15
Branch: `develop` (from 765e6f6, the merge of PR #5)

Three symptoms were reported from a playtest: no enemy death sound, no Mortar sound, and the
skeleton's attack sprite sheet only playing partway. Each supplied diagnosis was re-derived here
before anything was changed. **One of the three diagnoses was wrong**, and the symptom it named turns
out to have a different cause. That is written up first because it changes what the fix wave is.

---

## Bug 1 — "four defenders never emit a firing sound": NOT CONFIRMED

### The diagnosis as supplied

> `CombatManager`'s defender loop emits `projectile:fired` inside **only** the
> `defender.isRanged && defender.useProjectile` branch. `useProjectile` is set only in
> `BasicDefender`, so `Mortar`, `Sniper`, `GrenadeDefender` and `FrostArcher` fall to the branch that
> only calls `defender.attack(target, now)` and emits nothing.

### What is actually true

Everything in that description is true **except the last clause**. Confirmed by reading:

- `useProjectile = true` really is assigned in exactly two places in the whole codebase —
  `BasicDefender` (`DefenderUnits.js:347`) and `RangeEnemy` (`EnemyUnits.js:656`). It is `undefined`
  for `Mortar`, `Sniper`, `GrenadeDefender` and `FrostArcher`, all of which are `isRanged: true`.
- The `else` branch really does only call `defender.attack(target, now)`.

But that call reaches an emit, because **each of those four units emits from inside its own
`attack()` override**:

| Unit              | Emit site                                        |
| ----------------- | ------------------------------------------------ |
| `BasicDefender`   | `CombatManager`, in the `useProjectile` branch    |
| `GrenadeDefender` | `DefenderUnits.js`, in `attack()`                 |
| `Sniper`          | `DefenderUnits.js`, in `attack()`                 |
| `Mortar`          | `DefenderUnits.js`, in `attack()`                 |
| `FrostArcher`     | `DefenderUnits.js`, in `attack()`                 |

The diagnosis describes the state of the code **before PR #5**. The per-unit-audio branch fixed it by
moving each emit to the site where the unit actually acts, and left a comment saying so at the top of
`DefenderUnits.audioEvents.test.js`. Nothing was broken here to fix.

There is no double-emit for `BasicDefender`: its `attack()` never emitted.

### Verification

A test was written that derives the class list from `DefenderUnits.js`'s own exports (filtering to
`isRanged`), drives the **real `CombatManager`** rather than calling `attack()` directly, and asserts
exactly one `projectile:fired` carrying the unit's own name. It went **green on its first run** —
that is the observation that disconfirms the diagnosis.

To show the test is not vacuous, every `'projectile:fired'` line was then deleted from
`DefenderUnits.js`, reproducing the state the diagnosis describes, and the test was re-run:

```
× GrenadeDefender emits exactly one projectile:fired for one attack
× Sniper emits exactly one projectile:fired for one attack
× Mortar emits exactly one projectile:fired for one attack
× FrostArcher emits exactly one projectile:fired for one attack
AssertionError: expected [] to have a length of 1 but got +0
      Tests  4 failed | 1 passed | 13 skipped (18)
```

Exactly the four the diagnosis names; `BasicDefender` still passes, because `CombatManager` emits for
it. The file was then restored.

The test was kept. The existing suite names those five units **by hand**, and a hand-written list is
how a silent unit survives — add an eleventh defender and forget to add it here, and the gap is
invisible. Deriving from the exports removes that failure mode.

### Why the owner heard no Mortar

Because of bug 2. `soundKeyFor('Mortar', 'fire')` resolves to the `mortar` sound key, whose recipe was
a bandpassed noise burst sweeping **120Hz -> 60Hz**. The event fired; the sound was inaudible.

### The non-ranged units, decided per unit

| Unit                | Emits?                                    | Reasoning                                                                                             |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `HealerDefender`    | yes, on a successful heal (`didHeal`)     | Spec maps it to `heal`. Already correct, and guarded on `didHeal` so an idle healer is silent. Not doubled — nothing else emits for it. |
| `FireBlast`         | yes, in `activate()`                      | Spec maps it to `fire`. A spell's "attack" is its detonation; `attack()` is never called on it (range 0). |
| `IceBomb`           | yes, in `activate()`                      | Same shape; resolves to `magic`.                                                                       |
| `BarricadeDefender` | no                                        | Correct. `attackDamage` 0 and `range` 0, so `CombatManager` never reaches it. It has no action to announce. |
| `EnergyGenerator`   | no                                        | Same.                                                                                                  |

No change was needed to any of them.

---

## Bug 2 — every death sound, and the Mortar, pitched below audibility: CONFIRMED and FIXED

### Confirmed

`VARIANTS.death` applied `freqScale: 0.5` on top of death recipes already authored at 100-300Hz.
`mortar` was 120 -> 60Hz with no variant involved at all.

`MIN_FREQ` was checked as instructed: it is **20**. It was masking nothing — the lowest value the old
table could derive was 25Hz, well clear of the clamp.

The reason this matters more than a weak fundamental would: every one of these recipes is
`noise: true`, and `AudioManager.createNoiseSource` renders those as white noise through a **bandpass
filter** whose centre sweeps `freqStart -> freqEnd`. For a noise recipe that sweep is not the
fundamental, it is the entire spectrum of the sound — there are no harmonics above the passband to
carry it. A 130Hz triangle still speaks on a laptop; a noise burst centred at 30Hz does not.

### Red run observed

```
× death-medium played as a death sweeps entirely above the floor
× death-small played as a death sweeps entirely above the floor
× titan played as a death sweeps entirely above the floor
× boss played as a death sweeps entirely above the floor
× death-defender played as a death sweeps entirely above the floor
× artillery played as a fire sweeps entirely above the floor
× mortar played as a fire sweeps entirely above the floor
× fire played as a fire sweeps entirely above the floor
× the Mortar the owner could not hear is audible
× a death sounds heavy because it is long and loud, not because it is subsonic

AssertionError: death-small/death freqStart: expected 150 to be greater than or equal to 200
AssertionError: death-medium/death freqStart: expected 100 to be greater than or equal to 200
AssertionError: death-defender/death freqStart: expected 90 to be greater than or equal to 200
AssertionError: titan/death freqStart: expected 50 to be greater than or equal to 200
AssertionError: boss/death freqStart: expected 65 to be greater than or equal to 200
AssertionError: mortar/fire freqStart: expected 120 to be greater than or equal to 200
AssertionError: expected 60 to be greater than or equal to 200
AssertionError: artillery/fire freqEnd: expected 110 to be greater than or equal to 200
AssertionError: fire/fire freqEnd: expected 80 to be greater than or equal to 200
      Tests  10 failed | 54 passed (64)
```

Every number the diagnosis predicted, reproduced exactly. The run also surfaced **two the diagnosis
missed**: `artillery` (a 110Hz tail, the Grenadier) and `fire` (an 80Hz tail, FireBlast).

### Fixed

`VARIANTS.death.freqScale` 0.5 -> **0.8**, and the noise recipes lifted so the clamp is never the
mechanism. Weight now comes from waveform, length and level.

Effective **post-variant** sweeps, printed from `resolveVoice` on the committed table:

| Sound key             | Variant | Effective sweep    | Duration | Gain   |
| --------------------- | ------- | ------------------ | -------- | ------ |
| `death-small`         | death   | 520 -> 320 Hz      | 0.300 s  | 0.2875 |
| `death-medium`        | death   | 440 -> 272 Hz      | 0.500 s  | 0.4025 |
| `death-defender`      | death   | 384 -> 232 Hz      | 0.875 s  | 0.4600 |
| `titan`               | death   | 320 -> 216 Hz      | 1.000 s  | 0.6325 |
| `boss`                | death   | 336 -> 224 Hz      | 1.250 s  | 0.6900 |
| `mortar`              | fire    | 380 -> 220 Hz      | 0.300 s  | 0.5000 |
| `artillery` (adjacent)| fire    | 520 -> 300 Hz      | 0.140 s  | 0.4000 |
| `fire` (adjacent)     | fire    | 520 -> 240 Hz      | 0.400 s  | 0.5000 |
| `melee` (adjacent)    | melee   | 340 -> 220 Hz      | 0.035 s  | 0.1650 |

Lowest point anywhere in the death family is **216 Hz**, clear of the ~200Hz rolloff.

Ordering the spec promises, preserved: small -> medium -> defender falls in pitch while rising in
length and gain, so a small enemy dies lighter than a medium one. Titan and Boss both outweigh every
ordinary death on all three axes; they are deliberately not ordered against **each other** (the Titan
is the lowest, the Boss the longest and loudest).

`artillery` was lifted alongside `mortar` because leaving it would have inverted the family — the
Grenadier would have sounded deeper, and therefore bigger, than the Mortar. `fire` was lifted because
the derived check found it, and it is the same defect.

`MIN_FREQ` was deliberately **left at 20** and documented as a degenerate-value guard rather than
raised to an audibility floor. Raising it would have masked the problem instead of fixing it: a
clamped noise recipe has its sweep flattened into a single dull band and passes any floor check by
construction. Audibility is a property each recipe carries, enforced by the test.

### The test

Derives its `(sound key, variant)` pairs by running `soundKeyFor` over the class exports of **both**
`EnemyUnits.js` and `DefenderUnits.js`, so a unit added later is covered without being listed, and it
only checks combinations the game can actually reach. The floor is written as a **literal** in the
test — importing it from the module under test would make it pass against whatever value the module
happened to hold, which is how 60Hz shipped.

---

## Bug 3 — the attack animation truncated instead of playing its sheet: CONFIRMED and FIXED

### Confirmed

`ATTACK_ANIMATION_LOCK_FRAMES = 20` (~333ms at 60fps) against a Skeleton Shooter attack sheet of 10
frames at 10fps (1000ms). The red run measured what actually reaches the screen:

```
AssertionError: skeleton: frames shown: expected [ 0, 1, 2, 3 ] to deeply equal [ 0, 1, 2, 3, ..., 9 ]
```

Four frames of ten — the reported "only plays partway", quantified.

The bind is real too, and the test asserts it rather than assuming it: the sheet's authored 1000ms is
longer than the skeleton's 833ms cadence (`attackRate` 50), so "full sheet at authored speed, once per
shot" is impossible without overrunning the next shot.

### The design

`Animation/AttackPlayback.js`. One full pass over the attack sheet per attack, taking
**`min(authored sheet duration, cadence)`**:

- **longer than the cadence** (skeleton: 1000ms sheet, 833ms cadence) — compressed to fit, so every
  frame is seen and it finishes as the next shot is due;
- **shorter than the cadence** (Mortar: 500ms sheet, 6000ms reload) — left at its authored speed and
  handed back to idle. Explicitly **not** stretched: three frames spread over six seconds is slow
  motion, not a firing animation. A test rejects that implementation specifically.

The pass ending is what clears `isAttacking`. `ATTACK_ANIMATION_LOCK_FRAMES` is gone.

Applied to both sides:

- **Enemies** keep their millisecond accumulator, now stepped by a nominal 60fps frame rather than a
  hard-coded `16`, and stepping in a loop so a compressed sheet is not capped at one frame per tick.
- **Defenders** lose the `frameCounter` / `Math.floor(60 / config.fps)` path entirely. That
  truncation quantised every fps that does not divide 60: a Grenadier's 11fps sheet ran ~9% fast, a
  Healer's and Frost Archer's 18fps sheets ~11% fast.

`Enemy.runDownAttackAnimation()` remains as a backstop for a unit whose sprites never loaded and so
has no sheet to run out of — that case is covered by a test using an enemy with no animation data at
all.

### Three things the derived tests found on the way

1. **`BasicDefender` played no attack animation at the shot at all.** `CombatManager`'s
   `useProjectile` branch never calls `attack()`; the projectile's `onHit` does, up to a second later.
   So the Shooter's swing started when its arrow *landed*, and once sheets were allowed to finish it
   would have played twice per shot. The swing now starts where the shot leaves, and
   `BasicDefender.attack` (the impact callback) no longer claims it.
2. **The Mortar replayed its sheet four times per shell.** Its animation was gated on a private
   120-frame `isFiring` timer (2s) against a 500ms sheet. It now drives from `isAttacking` like every
   other defender; `isFiring`, `fireAnimationTimer` and `fireAnimationDuration` are deleted.
3. **The Healer looped its heal sheet.** `healAnimationTimer` held the attack animation for 180
   frames against a 120-frame heal cadence and a 500ms sheet. The timer is kept for the healing aura
   in `draw()` but no longer pins `isAttacking`, and `HealerDefender.attackCadenceMs()` returns its
   `healingRate` rather than the `fireRate` it never uses.

### Known issue 15

Superseded, not repaired, and the entry is updated to say so. The dead
`if (this.isAttacking && this.attackAnimationLock <= 0)` guard in `Mortar.update()` is deleted. The
two properties the old entry flagged are preserved by the new design: the release lives in the base
class (because `CombatManager` starts the swing from a rule about `isRanged`), and it cannot fire on
the frame it was set (because `GameEngine` runs `enemy.update()` before `updateEnemyCombat()`).

### Level-threshold fire rates

`BasicDefender` halves its `fireRate` at level 3. Because playback derives from
`attackCadenceMs()`, which reads the live `fireRate`, it adapts with no special case. Covered by
driving **every** attacking defender at levels 1, 3 and 5 off the real `AssetManifest` sheets and the
real `CombatManager`, with the class list derived from `defenderUnitClasses` rather than written out.

---

## Verification

| Check                                   | Result                                    |
| --------------------------------------- | ----------------------------------------- |
| `cd Frontend && npm test`               | 25 files, **575 passed**, 0 failed        |
| `cd Frontend && npm run lint`           | clean, no output                          |
| `git status --porcelain`                | empty                                     |
| Baseline before any change              | 24 files, 531 passed                      |

Each commit was checked out on its own and the suite run against it:

| Commit    | Tests               |
| --------- | ------------------- |
| `f24e2d2` | 24 files, 537 passed |
| `4b3034f` | 24 files, 550 passed |
| `01801f4` | 25 files, 575 passed |

### Commits

- `f24e2d2` test: derive the ranged-defender firing list from the module exports
- `4b3034f` fix: lift every noise-based voice out of the laptop speaker's rolloff
- `01801f4` fix: play every attack sheet in full by timing it to the attack cadence

---

## Concerns

1. **Bug 2's numbers are reasoned, not heard.** The frequencies are chosen against a stated ~200Hz
   laptop rolloff and verified arithmetically; nobody has listened to them. The owner should re-play
   and confirm, particularly that a Titan still reads as heavier than a small zombie now that the
   pitch spread between them is 320-216Hz rather than 150-25Hz. If the death family now sounds too
   similar, the lever is duration and gain, not pitch.
2. **`artillery` and `fire` were changed although only `mortar` was in the brief.** Both had the same
   defect and the derived check found them. `artillery` in particular could not be left alone without
   the Grenadier sounding bigger than the Mortar.
3. **"Exactly one pass per attack" is not enforced for units that hold `isAttacking` on a timer of
   their own.** Melee enemies hold it for as long as they are in contact and restart the sheet on
   each damage tick, so a sheet shorter than the cadence still loops — that reads as continuous
   swinging and is deliberate. `MageEnemy` does the same across its cast window. If the owner wants
   strictly one pass there too, those two need the `beginAttackAnimation` treatment as well; it was
   left out because clearing `isAttacking` mid-contact would let a melee enemy step forward
   (`handleMovement` gates on that flag, and `updateMovementSpeed` overwrites the `speed = 0` that
   `updateBehavior` sets).
4. **The 833ms compression lands within one game frame of the cooldown.** The animation advances in
   whole 60fps frames while `canAttack` is wall-clock, so the swing can finish a frame either side of
   the shot. When the shot wins, `beginAttackAnimation` restarts the sheet, which is correct; the
   tests allow one frame of slack for this and say why.
5. **The Healer now visibly returns to idle between heals**, where it previously stayed in its heal
   animation almost continuously. This follows from "one pass per heal" but is a visible change the
   owner did not ask for by name.
6. **`GameEngine`'s loop is `requestAnimationFrame`-driven with a real delta for the game clock, but
   animation is still advanced by a nominal 60fps frame.** Below 60fps the animation runs slow
   relative to the cooldown. Cadence-derived playback narrows the gap but does not close it; closing
   it means threading the real `deltaMs` into `update()`, which is out of scope here.
