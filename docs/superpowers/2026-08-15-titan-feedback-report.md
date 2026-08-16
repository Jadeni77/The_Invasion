# Titan feedback: audio, telegraph, and a loop bug — implementation report

Branch: `feat/titan-feedback` (from `develop` at `0232835`)
Date: 2026-08-15

## Status

DONE_WITH_CONCERNS — the work is complete and green, but two of the three
`return`-in-a-loop sites named in the brief were **not** bugs, and the damage
arithmetic the owner asked for says the Titan's abilities are lethal to 7 of
the 10 defender types before this branch and will reach *more* defenders after
it. Both are written up below.

## The owner's report

> For titan, there is no audio for the earthquake attack, no audio for the
> phase change. Another issue I found is that when I place a defender close to
> titan, it instantly dies without seeing the titan attack at all.

All three symptoms are feedback, not balance. The abilities work exactly as
written; they were simply silent and invisible. **No damage number, radius,
cooldown or duration was changed on this branch.**

## Summary

1. Three feedback events added — `enemy:groundPoundCharge`,
   `enemy:groundPoundImpact`, `enemy:phaseChange` — routed through the existing
   `emitFeedback` → `FeedbackManager.attach` → `soundKeyFor` → `UNIT_VOICES`
   path, with three new layered voices in the LOUD mix tier.
2. The ground pound now plays the Titan's attack sheet through the 500 ms
   wind-up, and stands still while it does. The sheet already existed.
3. The `return`-instead-of-`continue` bug in the earthquake damage loop is
   fixed. It was one site, not three.
4. The damage arithmetic is reported for the owner to make a balance call.

## Test results

| | Tests | Files |
|---|---|---|
| Baseline at `0232835` | 714 passed | 28 |
| **After this branch** | **782 passed** | **29** |

`cd Frontend && npm test` — 782 passed (782), 29 files.
`cd Frontend && npm run lint` — clean, no output.

68 tests added, none deleted. Two existing assertions were **updated, not
weakened**: `UnitVoices.test.js`'s layer census (`extraLayers` 5 → 11) and its
layered-sound inventory, both of which pin *how many* layered recipes exist so
that a `layers` array quietly dropped is visible. Adding three layered voices
necessarily moves both. The 200 Hz floor assertions they guard were not
touched, and every new layer passes them unmodified.

## TDD evidence

### RED

Tests written first, before any implementation.
`npx vitest run "src/component/GameLogic (MVC)/__tests__/TitanFeedback.test.js"`:

```
 ❯ src/component/GameLogic (MVC)/__tests__/TitanFeedback.test.js (23 tests | 16 failed)
     × damages a live defender that sits behind a dead one in the array 4ms
     × deals the same damage however the corpses are ordered 2ms
     × emits a charge event the moment the wind-up starts 0ms
     × emits the impact when the first wave actually lands 0ms
     × emits ONE impact for all three waves, not three 1ms
     × emits one charge per pound, not one per defender in range 1ms
     × stays silent about an impact the Titan died before delivering 1ms
     × emits a phase-change event when the Titan crosses 66% health 0ms
     × emits again, carrying the new phase, at 33% 1ms
     × emits once per transition, not once per defender it disables 0ms
     × plays the attack animation during the wind-up, before any damage lands 1ms
     × starts the sheet from its first frame rather than mid-swing 0ms
     × holds the swing for the whole pound, not for a single frame 0ms
     × stands still while it winds up instead of walking through its own quake 0ms
     × plays a charge sound, then a different impact sound 0ms
     × plays the phase-change sound when the Titan escalates 0ms

 Test Files  1 failed (1)
      Tests  16 failed | 7 passed (23)
```

The loop bug specifically, which is the failure the brief asked for:

```
 FAIL  src/component/GameLogic (MVC)/__tests__/TitanFeedback.test.js > the earthquake
       damages every live defender, whatever the array order > damages a live defender
       that sits behind a dead one in the array
AssertionError: expected "vi.fn()" to be called with arguments: [ 45 ]

Number of calls: 0

 ❯ src/component/GameLogic (MVC)/__tests__/TitanFeedback.test.js:132:29
    130|     vi.advanceTimersByTime(FIRST_WAVE_MS);
    131|
    132|     expect(live.takeDamage).toHaveBeenCalledWith(WAVE_DAMAGE);
```

A live defender standing at the Titan's own centre took **zero** damage from an
earthquake, purely because a corpse sat in front of it in `gameEngine.defenders`.

The 7 tests that passed in the red run passed for reasons worth recording:
`does not throw when the Titan has no engine reference`, `says nothing on a hit
that crosses no threshold`, `skips the corpse itself rather than damaging it`,
`has an attack sheet to play at all`, `goes back to walking once the pound is
over`, `none of the three fall back to the generic projectile sound` (nothing
was emitted at all, so nothing wrong was emitted either), and the
characterisation test described under "the loop bug" below.

Two red failures were **test-harness** faults rather than implementation
faults, and are recorded here rather than quietly fixed: `vi.advanceTimersByTime(500)`
does not run the wave timers, because those timers are created *by* the 500 ms
charge timer's own callback and so do not exist when the fake clock lands
exactly on 500. The tests advance to `CHARGE_MS + 1`.

### GREEN

```
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

Full suite, after all four pieces:

```
 Test Files  29 passed (29)
      Tests  782 passed (782)
```

## 1. The loop bug — one site, not three

The brief named three sites, "around lines 1375, 2253 and 2298". Verified
individually:

| Line | Context | Verdict |
|---|---|---|
| 1375 | `GhostEnemy.updateBehavior`, inside `defenderUnits.find(defender => {...})` | **Not a bug.** A `find` *predicate*. |
| 2253 | `TitanEnemy.updateBehavior`, inside `defenderUnits.find(defender => {...})` | **Not a bug.** A `find` *predicate*. |
| 2298 | `performGroundPound`, inside `for (const defender of this.gameEngine.defenders)` | **The bug.** Fixed. |

In a `find` predicate, a bare `return` yields `undefined`, which is falsy, which
means "this element does not match — keep looking". That is precisely the wanted
behaviour for a corpse, and `continue` would not even be legal there (a
`SyntaxError`: `continue` outside a loop). Changing those two would have broken
a working search. They have been rewritten as `return false` — behaviourally
identical, but it no longer *looks* like the third one — and each carries a
comment saying why it differs from the loop that was broken.

Line 2298 is a real `for...of` body, and `return` there left the entire timer
callback the moment it met a dead defender. Every defender **behind** that
corpse in the array escaped a wave it was standing inside, so who survived
depended on array order — the shape of "sometimes it hits me and sometimes it
doesn't". Now `continue`, which is what the identical loop in
`EMPEnemy.triggerEMP` (line 1235) already used.

Test coverage: a live defender behind a dead one takes the damage; a full pound
deals the same three hits whichever order the corpses sit in; the corpse itself
is still skipped; and — the characterisation test — a dead defender first in the
array still does not stop the Titan *noticing* a live one in range, which is the
`find` predicate at 2253 doing its job. That last one passed before the change
as well as after, and is labelled in the file as characterisation so a future
sweep that "fixes" all three sites identically has something to fail against.

## 2. Audio

### Events

| Event | When | Variant | Sound key | Tier |
|---|---|---|---|---|
| `enemy:groundPoundCharge` | start of `performGroundPound`, 500 ms before damage | `charge` | `quake-charge` | LOUD |
| `enemy:groundPoundImpact` | inside the charge timeout, as the first wave lands | `impact` | `quake-impact` | LOUD |
| `enemy:phaseChange` | in `createPhaseTransition`, carrying `phase` | `phase` | `phase-change` | LOUD |

Resolution is by **variant**, the way `hit` and `melee` already are, and the keys
are named for the archetype rather than for the Titan, following this file's
stated rule that sound identity is by archetype. Only the Titan reaches them
today.

**Charge and impact are two events, not one.** The brief called the charge-up
`setTimeout` a gift and it is: the 500 ms gap is the only window in which a
player can still act. A single sound at the moment of damage explains a death;
a sound at the wind-up can prevent it.

**The three waves emit once, not three times.** They land 200 ms apart —
5× `AudioManager`'s 40 ms dedupe window — so three emits would *not* collapse;
they would be three identical full-volume copies of a LOUD sound inside 400 ms.
Suppressing two of the three instead would throw away the rhythm, which is the
most legible thing about the attack. Instead the rhythm is authored into the
recipe as layers at the offsets the waves actually land on (0.20 s, 0.40 s), so
the player hears three receding hits for the cost of **one voice and one dedupe
slot**. This follows the precedent already in the codebase: `MageEnemy`'s
lightning emits once however many defenders it chains to, and `SplitterEnemy`
emits one summon for its whole split.

### Mix tier — LOUD, and I agree with the brief

All three sit at 1.0 with `baseDamaged`, boss death and the win/lose stings. The
tier is about how much the moment matters, and nothing else in the game costs
the player their whole board: 135 damage inside 350 px, or a five-second
disable inside 1500 px.

The charge is LOUD for a second reason: it is not decoration on the impact, it
is the warning, and a warning that loses to projectile chatter is not a warning.
Its lower level *relative to the impact* is authored into the recipe's gains
(peak 0.30 against 0.58), which is the right lever — the tier says how important
the category is, the gain says how loud this sound is within it.

### Layer table

Every layer, as authored. `gain` means the same level on the tone and the noise
path (`AudioManager.noiseMakeupGain`), so these numbers are directly comparable
and are **not** hand-compensated. Noise layers are white noise through a
bandpass whose centre sweeps start → end; that sweep is the entire sound.

**`quake-charge`** — the 500 ms wind-up. Span 0.46 s, so it finishes just as the
first wave lands. Everything rises: tension.

| # | Offset | Render | Wave | Sweep | Duration | Gain |
|---|---|---|---|---|---|---|
| 0 | 0 | tone | sawtooth | 260 → 400 Hz | 0.42 s | 0.30 |
| 1 | +0.060 s | noise | bandpass | 380 → 1500 Hz | 0.40 s | 0.20 |

Layer 0 is pitched so its harmonic stack still speaks after the laptop rolloff
eats 260 Hz. Layer 1 is grit rising with it and ending bright, which is what
points at the impact still to come.

**`quake-impact`** — one sound, four layers, three waves. Span 0.62 s.

| # | Offset | Render | Wave | Sweep | Duration | Gain | Role |
|---|---|---|---|---|---|---|---|
| 0 | 0 | noise | bandpass | 1400 → 420 Hz | 0.08 s | 0.45 | crack — the transient, highest and shortest |
| 1 | +0.010 s | tone | sawtooth | 400 → 260 Hz | 0.36 s | 0.58 | body — the weight, pitched |
| 2 | +0.200 s | noise | bandpass | 900 → 330 Hz | 0.26 s | 0.32 | wave 2 |
| 3 | +0.400 s | noise | bandpass | 700 → 280 Hz | 0.22 s | 0.20 | wave 3 |

The body is pitched deliberately: a noise-only slam is a hiss, which is the
lesson the Mortar cost. Gains fall 0.58 → 0.32 → 0.20 because the rings are
expanding *away* — receding level is what that looks like, and it keeps the tail
of a LOUD sound from fighting whatever plays next.

**`phase-change`** — the 66 % and 33 % transitions. Span 0.78 s. Deliberately the
mirror of the pound: the pound **falls**, this **rises**, because it is an
escalation and because the player must be able to tell two loud Titan noises
apart without looking. Same vocabulary as the wave alerts in `SfxLibrary`.

| # | Offset | Render | Wave | Sweep | Duration | Gain | Role |
|---|---|---|---|---|---|---|---|
| 0 | 0 | noise | bandpass | 320 → 2400 Hz | 0.28 s | 0.32 | swell — the shockwave leaving, matching the 1500 px ring |
| 1 | +0.050 s | tone | sawtooth | 330 → 660 Hz | 0.60 s | 0.52 | roar — the Titan itself, up an octave |
| 2 | +0.280 s | noise | bandpass | 800 → 300 Hz | 0.50 s | 0.22 | settle — debris, under both |

**Nothing is below 200 Hz**, and nothing needed to be: the lowest frequency
authored anywhere above is 260 Hz. That is not slack, it is forced —
`UnitVoices.test.js` checks every layered *unit voice* through the death
variant's 0.8 pitch scale, so a layered voice must clear **250 Hz** as authored
even when, as here, nothing ever plays it as a death. The floor test was not
weakened; these recipes were written to pass it.

### Juice

The impact adds 0.35 trauma and the phase change 0.45 (against `base:damaged`'s
0.5). The charge deliberately adds **none** — shaking the board while the player
is trying to drag a defender out of it is the wrong kind of help. All of it is
gated by the existing screen-shake setting.

### Samples

`charge`/`impact`/`phase` are deliberately absent from `VARIANTS` and
`SAMPLE_VARIANTS`. Both tables fall back to their `fire` entry, and both `fire`
entries are identity, so the synthesized and sampled paths agree: these sounds
play at their authored level. A test pins that.

## 3. The visible telegraph

**A Titan attack animation already existed.** `AssetManifest.enemies.Titan`
declares `attack: () => TitanAttack` (`Golem_01_attack.png`) with
`{ frameCount: 11, frameWidth: 90, frameHeight: 64, fps: 5.5 }` — 2000 ms, which
the manifest's own comment notes matches the Titan's `attackRate: 120`. Nothing
outside melee contact ever played it. No asset needed inventing.

`performGroundPound` now calls `beginAttackAnimation()` — the cadence-derived
playback from `01801f4`, so there is one attack-animation clock in this codebase
and not two — and sets `isAttacking`.

`isAttacking` does two jobs. `determineAnimationState` reads it to select the
sheet, and `handleMovement` reads it to stop. The second one matters more than
it looks: `this.speed = 0` at the top of `performGroundPound` **has never
worked**, because `updateMovementSpeed` recomputes `speed` from `initialSpeed`
on every frame and overwrites it before `handleMovement` is reached. So the
Titan has been strolling through its own earthquake, and `originalSpeed` has
been restoring a value that was never lost. Left in place (it is harmless, and
removing it is a behaviour change to code this branch was not asked to touch),
but it is why the telegraph is hung on `isAttacking` and not on the speed.

`TitanEnemy.updateBehavior` re-asserts the flag while `isGroundPounding`,
because `super.updateBehavior` clears `isAttacking` on every frame with nothing
in melee contact — and a ground pound is not melee contact. Without the
re-assert the telegraph survives exactly one frame.

What the player sees: the Titan plants itself and swings for 500 ms, then the
three waves land under it, then it walks again. The pound runs 1300 ms against a
2000 ms sheet, so roughly the first seven of eleven frames are shown before the
walk resumes. Sizing the sheet to the pound instead would need a second notion
of cadence, which is the parallel mechanism the brief asked me not to build.

## 4. Damage arithmetic — for the owner, unchanged

**Nothing here was modified.** All numbers below were measured by instantiating
every class in `defenderUnitClasses` and reading `health` after
`applyLevelUpgrades()`, not read off the source.

### Defender health

| Card | Class | Level 1 | Level 5 |
|---|---|---|---|
| Shooter | `BasicDefender` | 120 | 192 |
| Healer | `HealerDefender` | 100 | 180 |
| Grenadier | `GrenadeDefender` | 110 | 110 † |
| Barricade | `BarricadeDefender` | 1000 | 2200 |
| E-Gen | `EnergyGenerator` | 80 | 128 |
| Sniper | `Sniper` | 80 | 128 |
| Mortar | `Mortar` | 100 | 180 |
| Frost Archer | `FrostArcher` | 90 | 144 |
| Fire Blast | `FireBlast` | 1000 ‡ | 1000 ‡ |
| Ice Bomb | `IceBomb` | 1000 ‡ | 1000 ‡ |

† The Grenadier does not scale its health with level, unlike every other
non-spell defender. Noted in passing; not touched.
‡ Fire Blast and Ice Bomb are consumable spells. `DefenderUnit.takeDamage`
returns early for `isConsumableSpell`, so they are **invulnerable for their
whole fuse** — their 1000 health is decorative and they cannot be hit by either
ability at any level.

### Ground pound: 45 × 3 = 135

The 135 figure applies only at close range. `radius = earthquakeRadius * (i+1)/3`
gives the three waves **116.7 px, 233.3 px and 350 px**, measured centre to
centre, so:

- within 116.7 px — all three waves — **135 damage**
- 116.7 to 233.3 px — waves 2 and 3 — 90 damage
- 233.3 to 350 px — wave 3 only — 45 damage

The Titan is 180 px wide, so a defender placed adjacent to it is well inside the
first ring. That is exactly the owner's "place a defender close to titan, it
instantly dies".

**Survivors of a full 135, at level 1: 3 of 10** — Barricade, Fire Blast, Ice
Bomb. Two of those three survive only by being invulnerable, so of the eight
defenders that can actually be damaged, **only the Barricade lives**. The other
seven (Shooter, Healer, Grenadier, E-Gen, Sniper, Mortar, Frost Archer) all die
to one pound.

At level 5 the count is 6 of 10: Shooter (192), Healer (180), Mortar (180) and
Frost Archer (144) survive; E-Gen (128), Sniper (128) and Grenadier (110) still
do not.

**A single wave of 45 kills nothing** at any level — every defender survives 45.
The lethality is entirely in the stacking of three.

### Phase transition: 40 damage + 5 s disable at 1500 px

- 40 damage alone kills **nothing**: all 10 survive a single transition at
  level 1.
- The radius is 1500 px against a canvas around 1000 px wide, so "nearby" means
  every defender the player owns, wherever it stands. The disable is 300 frames
  = 5 seconds.
- Both transitions total 80. At level 1 that is **exactly lethal** to E-Gen (80)
  and Sniper (80) — `health <= 0` counts as death — so a Titan taken from full
  to 33 % kills those two outright without ever touching them. The other eight
  survive at level 1; all ten survive both transitions at level 5.
- Both transitions plus one full pound is 215, which at level 1 leaves only the
  Barricade and the two spells standing.

The disable is arguably the bigger cost: 5 seconds × 2 transitions is 10 seconds
in which the entire board does nothing, while a Titan whose speed has just gone
from 0.1 to 0.2 walks.

### Phase 3: `attackDamage = 300`

Phase 2 sets 150 and phase 3 sets 300, against `attackRange` 50 — melee. 150
already one-shots every level-1 defender except the Barricade. **300 one-shots
every non-Barricade defender at every level**, the highest of which is the
level-5 Shooter at 192. The Barricade takes 4 hits at level 1 and 8 at level 5.

### The fix makes the abilities stronger

Worth stating plainly: **fixing the `return` bug means the ground pound now hits
more defenders than it did yesterday.** Before the fix, one dead defender early
in `gameEngine.defenders` could spare an arbitrary number of live ones behind
it — and defenders die constantly against a Titan, so this was not a rare state.
The ability as designed always did 135 to everything inside 116.7 px; it just
did not always land. Any balance judgement should be made against the fixed
behaviour, not against what the owner has been playing.

**This is a balance decision and it is the owner's.** Nothing was tuned.
Recorded as issue 17 in the known-issues document.

## Files changed

| File | Change |
|---|---|
| `Frontend/src/component/GameLogic (MVC)/EnemyUnits.js` | three emits; `continue` fix; telegraph; two `return false` clarifications; removed a per-frame `console.log` |
| `Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js` | three sound keys, three `soundKeyFor` branches, three LOUD tiers |
| `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js` | three layered recipes |
| `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js` | three subscriptions |
| `Frontend/src/component/GameLogic (MVC)/__tests__/TitanFeedback.test.js` | new — 23 tests |
| `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js` | +11 tests; layer census updated 5 → 11 |
| `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js` | +9 tests |
| `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js` | +7 tests |
| `docs/superpowers/2026-08-12-known-issues-and-followups.md` | issue 17 |
| `docs/superpowers/2026-08-15-titan-feedback-report.md` | this report |

## Concerns

1. **The balance question above is unresolved and is deliberately left open.**
   Seven of ten defender types die to a single ground pound at level 1, the fix
   makes it land more often, and phase 3's 300 melee damage one-shots
   everything but the Barricade. None of it was changed.
2. **`this.speed = 0` in `performGroundPound` is dead**, as is the
   `originalSpeed` that restores it, because `updateMovementSpeed` overwrites
   `speed` every frame. The telegraph does not depend on it, so it was left
   alone rather than removed on a feedback branch — but it is misleading code
   and the next person to read it will believe the Titan stops because of it.
3. **Sounds authored, not heard.** There is no audio hardware in this
   environment. Every frequency, duration and gain above is reasoned from the
   project's stated constraints and checked by tests; none of it has been
   listened to. The layer tables are printed above precisely so the owner can
   sanity-check the numbers before playing.
4. **The pound shows about 7 of the attack sheet's 11 frames**, because the
   ability is 1300 ms and the sheet is 2000 ms. The wind-up — the part that
   matters — is fully visible.
5. **An unrelated uncommitted edit was stashed, not committed.**
   `GameLevelConfigs.js` had a working-tree change (level 1 wave 1 spawning
   `Titan` instead of `Necromancer`) that predates this branch's work — a
   playtest hack, most likely for testing this very Titan. It is not part of
   this change, so it was left out of the commit and stashed to give a clean
   tree. Recover it with `git stash pop`.
