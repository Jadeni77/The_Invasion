# Sprite animation advanced by a nominal frame, not by real time

Branch `fix/animation-real-delta`, off `develop` at `5b94a6c`.

Reported symptom: "the attacks are not consistent... idk if i am lagging or what",
from a macOS user, very likely on a 120Hz ProMotion display.

## 1. Verifying the diagnosis

Confirmed, in all four parts.

- **The loop is uncapped.** `GameEngine.gameLoop` (GameEngine.js:1420) calls
  `requestAnimationFrame(this.gameLoop)` with no frame limiting, so it runs at
  whatever the display refreshes at.
- **A real delta is available and already used for gameplay.**
  `GameEngine.update()` (GameEngine.js:763-768) computes
  `performance.now() - this.lastFrameTime` and feeds it to `gameClock.advance()`
  and `juiceManager.update()`. Combat reads `gameClock.now`, so every cooldown is
  real-time.
- **Animation was not.** `Animation/AttackPlayback.js` exported
  `GAME_FRAME_MS = 1000 / 60`, and `EnemyUnits.update()` passed that constant to
  `updateAnimation()` and `runDownAttackAnimation()` (EnemyUnits.js:242, 246,
  256) regardless of elapsed time. `DefenderUnits.updateAnimation()` did the same
  inline: `this.animationTimer += GAME_FRAME_MS` (DefenderUnits.js:127).
- **The consequence is refresh-rate scaled.** At 120Hz each real second produced
  ~2000ms of animation; at 30fps, ~500ms. Cooldowns stayed correct either way, so
  the swing drifted from the shot by an amount that depends on the player's
  hardware - which is exactly why it read as "am I lagging?".

This also undercut `01801f4`, which timed attack sheets to the firing cadence:
it computed correct millisecond durations and then consumed them with a nominal
clock, so a 120Hz machine finished each sheet in about half its intended
wall-time.

**One part of the brief was already out of date.** It said `DefenderUnits.js`
"counts frames with `Math.floor(60 / config.fps)`, whose integer truncation also
quantises fps". That path is already gone - `01801f4` replaced it with the same
millisecond accumulation the enemy path uses, and only a historical comment at
DefenderUnits.js:54 still mentions it. So the two paths were already unified in
mechanism; the sole remaining divergence was where the delta came from, which is
what this change removes. See section 5.

## 2. RED

New file: `Frontend/src/component/GameLogic (MVC)/__tests__/AnimationFrameDelta.test.js`.

It drives the real `GameEngine.prototype.update` against a mocked
`performance.now()` at 120Hz / 60Hz / 30fps, and measures animation in wall-clock
milliseconds. Two harness bugs were fixed before the meaningful red (target
fixtures with no `update()`; and a clamp probe that aliased, because every walk
sheet in the manifest happens to loop in exactly 1000ms, the same as the clock's
clamp, so a clamped hitch was indistinguishable from no advance at all - hence
the synthetic 3-second probe sheet).

`npx vitest run "src/component/GameLogic (MVC)/__tests__/AnimationFrameDelta.test.js"`
-> **8 failed | 3 passed (11)**. The three that passed are the 60Hz controls,
which is the rate the old nominal constant happened to be right for.

```
AssertionError: expected 416.6666666666664 to be greater than 816.6666666666667
AssertionError: expected 1666.6666666666656 to be less than 900
AssertionError: expected 250.00000000000009 to be greater than 483.3333333333333
AssertionError: expected 1000.0000000000003 to be less than 566.6666666666666
AssertionError: expected 16.666666666666668 to be close to 8.333333333333334, received difference is 8.333333333333334, but expected 5e-7
AssertionError: expected 16.666666666666668 to be close to 33.333333333333336, received difference is 16.666666666666668, but expected 5e-7
AssertionError: expected 16.666666666666668 to be close to 1000, received difference is 983.3333333333334, but expected 5e-7
AssertionError: expected { …(4), …(1) } to not have property "GAME_FRAME_MS"
```

Read in order, that is the bug stated numerically:

- Skeleton Shooter attack sheet, timed to its 833ms cadence: **417ms** of wall
  clock at 120Hz (half), **1667ms** at 30fps (double).
- Shooter (defender) attack sheet, authored 500ms: **250ms** at 120Hz, **1000ms**
  at 30fps. A separate code path, the same factor.
- The walk probe consumed **16.67ms** of animation on a frame that really covered
  8.33ms, 33.33ms, and 1000ms respectively - the nominal constant, ignoring
  reality.

## 3. GREEN

New module `Frontend/src/component/GameLogic (MVC)/Animation/FrameTime.js`:
`setFrameDeltaMs()` / `frameDeltaMs()`. `GameEngine.update()` publishes the
frame's real delta once, next to `gameClock.advance(deltaMs)`. Both
`updateAnimation()` implementations, and `Enemy.runDownAttackAnimation()`, now
take `deltaMs = frameDeltaMs()` as a defaulted parameter.

**Why a published per-frame value rather than a threaded parameter.**
`updateAnimation()` is called from about thirty places across a dozen `update()`
overrides in two files of 70-80KB each, all with no argument. Widening every one
of those signatures would be a far larger and riskier change than the bug
warrants. A defaulted parameter keeps the dependency visible at each signature
and leaves the seam injectable for tests. This follows the module-singleton shape
the codebase already uses for `Feedback/SettingsStore.js`.

**The clamp: `MAX_DELTA_MS = 1000`, imported from `GameClock`, not redeclared.**
`GameClock.advance` ignores non-finite and non-positive deltas and clamps to
1000ms; `setFrameDeltaMs` now applies exactly that, by importing the constant,
which is newly exported for the purpose. Matching by import rather than by value
is deliberate: two independently-written clamps would silently diverge the next
time one is tuned, and the situation they cover - a tab restored after a minute
away - is precisely where a divergence would be most visible. A test asserts the
identity behaviourally (animation time consumed == gameplay time consumed) rather
than by hardcoding 1000.

**The default of zero is deliberate.** A caller that has not been told how much
time passed freezes rather than guessing. Guessing is the bug.

## 4. Test suite

- `cd Frontend && npm test` -> **589 passed (589)**, 27 files. Baseline at
  `5b94a6c` was 578; the 11 new ones are this file.
- `cd Frontend && npm run lint` -> clean, no output.

Two existing test files needed updating, because they drive `unit.update()` by
hand as a stand-in for the game loop and were implicitly relying on the nominal
constant. They now say what they always meant: `setFrameDeltaMs(FRAME_MS_60HZ)`
in a `beforeEach`, with a comment that their tick counts are 60Hz ticks and that
other refresh rates are covered by the new file. No assertion was weakened.

- `__tests__/AttackAnimation.test.js` (21 tests)
- `__tests__/EnemyUnits.audioEvents.test.js` (2 tests)

## 5. Unifying the two paths, and removing `GAME_FRAME_MS`

Not unified further, because there is no longer a difference worth the churn.
`01801f4` had already converted the defender path from frame counting to the same
millisecond accumulation against `frameDurationMs()` that the enemy path uses, so
the only divergence left was the delta source, and both now default to
`frameDeltaMs()` with identical signatures. What remains is duplication of the
~40-line stepping loop between two classes that share no base class; extracting it
is a genuine refactor across two very large files, with no behavioural change to
show for it, and belongs in its own commit rather than riding along with a bugfix.

`GAME_FRAME_MS` is removed from `AttackPlayback.js`. Nothing legitimately needs a
nominal frame: the only consumers were the two animation paths (now fixed) and
two tests (now naming their own 60Hz constant). A test asserts the export is gone,
so nothing quietly reintroduces it.

## Files changed

- `Frontend/src/component/GameLogic (MVC)/Animation/FrameTime.js` (new)
- `Frontend/src/component/GameLogic (MVC)/Animation/AttackPlayback.js`
- `Frontend/src/component/GameLogic (MVC)/Feedback/GameClock.js`
- `Frontend/src/component/GameLogic (MVC)/GameEngine.js`
- `Frontend/src/component/GameLogic (MVC)/EnemyUnits.js`
- `Frontend/src/component/GameLogic (MVC)/DefenderUnits.js`
- `Frontend/src/component/GameLogic (MVC)/__tests__/AnimationFrameDelta.test.js` (new)
- `Frontend/src/component/GameLogic (MVC)/__tests__/AttackAnimation.test.js`
- `Frontend/src/component/GameLogic (MVC)/__tests__/EnemyUnits.audioEvents.test.js`

## Concerns

**1. Everything else in the game is still frame-counted, and movement is the one
the player will see.** `Enemy.handleMovement` does `this.x += this.speed` once per
update, so at 120Hz enemies cross the screen at double speed while their firing
cadence stays correct. The same applies to `attackCountdown--` (melee damage
ticks - a melee enemy deals double DPS at 120Hz), `healingCountdown--`,
`slowDuration--` / `frozenDuration--` / `stunnedDuration--` / `burningDuration--`,
boss phase and stealth timers, and explosion/UI timers.

There is a trade-off in this fix that a reviewer should see clearly: before it,
the walk animation and the movement it depicts were both frame-coupled and so
agreed with each other; now the animation is real-time and the movement is not,
so at 120Hz a walking enemy's feet will slide. The right resolution is to make
movement real-time too, not to hold animation back - animation has to agree with
the real-time cadences it depicts, which is the reported bug. I did not do it
here: `speed` is authored in pixels-per-frame throughout, converting it changes
wave pacing, contact detection and difficulty, and that is a balance decision for
the owner rather than a bugfix. It wants its own PR.

**2. The frame delta is module-level state.** Two `GameEngine` instances alive at
once would write to it, last writer winning. In practice there is one engine and
it publishes before any unit updates, and the value self-corrects on the first
frame after any restart (`lastFrameTime` is null, so the delta is 0). Worth
knowing rather than worth fixing now.

**3. `juiceManager.update(deltaMs)` still receives the unclamped delta.** It was
already like that, it is outside this fix, and hit-stop is measured in ms so it is
not frame-coupled - but it does not share the clamp.
