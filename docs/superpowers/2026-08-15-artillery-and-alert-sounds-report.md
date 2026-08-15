# Artillery and alert sounds — implementation report

Branch: `feat/artillery-and-alert-sounds` (from `develop` at `44fe448`)
Date: 2026-08-15

## Status

DONE_WITH_CONCERNS — all four items complete; the concerns are pre-existing
findings surfaced by the work, listed at the end.

## Summary

1. `AudioManager` learned layered recipes. A recipe may carry `layers`;
   the whole thing is one voice and one dedupe slot.
2. The Mortar is now three-layer artillery: crack, falling body, decaying tail.
3. `waveStarted` is now a two-tone rising alert. `bossWaveStarted` got the same
   treatment inverted (falling), and the reasoning for doing so is below.
4. The enemy death sound is **emitting correctly and being suppressed by
   nothing**. It is inaudible for a level reason, quantified below.

## Test results

| | Tests | Files |
|---|---|---|
| Baseline at `44fe448` | 589 passed | 27 |
| After this change | **642 passed** | 27 |

`cd Frontend && npm test` — 642 passed (642), 27 files, output pristine.
`cd Frontend && npm run lint` — clean, no output.

53 tests added, no test deleted, no existing test modified.

## TDD evidence

### RED

Tests written first, before any implementation. `npm test`:

```
 Test Files  3 failed | 24 passed (27)
      Tests  39 failed | 596 passed (635)
```

The 39 failures, by cause:

- `TypeError: recipeLayers is not a function` / `recipeSpan is not a function`
  — the shared expansion helper did not exist yet (SfxLibrary and UnitVoices
  suites).
- `AudioManager > layered recipes > starts one source per layer, the base
  recipe included` — `expected "createOscillator" to be called 2 times, but got
  1 time`. `playRecipe` rendered the base recipe only and silently dropped
  `layers`, which is exactly the limitation the task describes.
- `AudioManager > layered recipes > stops every layer of the voice the cap
  evicts, not just its first source` — eviction knew about one `source` per
  voice.
- `AudioManager > layered recipes > takes ONE dedupe slot for the whole sound,
  not one per layer` — could not be judged while layers were dropped.
- `noise voices stay above what a laptop speaker reproduces > finds every
  layered sound in both tables, so the floor check is not vacuous`:

```
AssertionError: expected [] to deeply equal [ 'bossWaveStarted', 'mortar', …(1) ]
- Expected                     + Received
- [ "bossWaveStarted", "mortar", "waveStarted" ]
+ []
```

  This is the vacuity guard on the 200 Hz layer check. Without it the audibility
  `it.each` would have been green from the start simply because no layered
  recipe existed, which is the same failure mode that let 25–90 Hz ship.

- `the Mortar sounds like artillery, not one burst > has a transient, a body
  and a tail` — `expected [ { …(7) } ] to have a length of 3 but got 1`.
- `the wave stings read as alerts > waveStarted is a multi-note figure, not one
  drone`, `… steps UP …`, `… neither sting is the slow low sawtooth rise the
  owner rejected` — all failed against the old single sawtooth sweeps.
- `resolveVoice carries layers through > scales each layer by the variant` —
  `resolveVoice` built its result field by field and dropped `layers`.

Four of the new `layered recipes` tests passed in the red run, as expected:
they assert that a **single-source** recipe is unchanged, plus the one-voice
accounting, which is trivially satisfiable while layers are being ignored.
They are regression guards for the implementation, not drivers of it — the
sharp counterpart (`stops every layer of the voice the cap evicts`) failed.

### GREEN

```
 Test Files  27 passed (27)
      Tests  642 passed (642)
```

## Item 1 — layered recipe support

### Shape chosen

```js
{
  wave, freqStart, freqEnd, duration, gain, noise,   // the base layer
  layers: [ { offset, wave, freqStart, freqEnd, duration, gain, noise }, ... ]
}
```

The recipe **is** its own first layer, at offset 0. Additional layers live in
`layers`, each with an `offset` in seconds from the trigger (default 0).

Why this shape rather than a pure `{ layers: [...] }` container:

- **Every existing recipe is already a valid one-layer sound.** No migration,
  no `offset: 0` boilerplate on thirteen SFX entries and fifteen unit voices,
  and no risk of a transcription error while touching sounds that are out of
  scope for this task.
- **The top-level fields stay meaningful to everything that already reads
  them.** `resolveVoice` clamps `duration` against `MAX_DURATION`; the SFX and
  UnitVoices well-formedness suites read `recipe.wave` / `recipe.gain`;
  `MIX_TIERS` math multiplies `recipe.gain`. A container shape would make
  `recipe.duration` and `recipe.gain` undefined on layered recipes and force
  every one of those consumers to special-case them.
- **`noise` stays a per-layer property, which is the whole point.** The reason
  layering is needed is that `noise: true` selects the noise source *instead
  of* the oscillator. Making it per layer is what lets one sound be a
  bandpassed crack and a pitched body simultaneously.

Two pure helpers are exported from `SfxLibrary.js`:

- `recipeLayers(recipe)` — expands to the layer list, base first, offsets
  explicit. Returns `[]` for a missing recipe.
- `recipeSpan(recipe)` — the end of the last layer to *finish* (not the last
  declared, not the base duration).

They live in `SfxLibrary.js`, next to the recipe shape they describe, and are
exported specifically so that **the audibility tests inspect the same layers
the renderer plays**. A test-local expansion would be free to drift from the
renderer, which is precisely how an inaudible Mortar shipped with a green
suite last time.

### One voice, one dedupe slot

- `reserveVoiceSlot(dedupeKey, now)` is called **once**, before any layer is
  built. Unchanged from before; it never knew about layers and still doesn't.
- All of a sound's sources go into a **single** `activeVoices` entry, whose
  shape changed from `{ source, endTime }` to `{ sources, endTime }`.
- Eviction stops **every** source in the evicted entry, so a layered voice
  cannot keep sounding through its own eviction.
- `endTime` is the span, so the slot is held until the last layer's tail rather
  than the base layer's — verified by a test that advances the clock past the
  base layer but not past the tail.
- `playSample` pushes `{ sources: [source], endTime }`; it was already one
  source and is unaffected otherwise.

Tests covering this specifically: layer count; per-layer start offset; per-layer
stop time; per-layer envelope and gain; per-layer bandpass frequencies (rejects
an implementation that renders layers but hands each the base recipe's sweep);
default offset; one-voice accounting against the cap; eviction stopping every
layer; one dedupe slot for the whole sound; layers not deduping *each other*
away; slot held to the last tail; slot released after the last tail; and a
single-source recipe rendering exactly as before (one oscillator, one envelope,
four gain nodes total, start/stop at the old times).

The existing 589 tests all still pass untouched, which is the evidence that
single-source recipes are unaffected.

## Item 2 — the Mortar as artillery

`UNIT_VOICES.mortar`, played at `MIX_TIERS.mortar = MID = 0.7`.

**Before:** one bandpassed noise burst, sawtooth flag, 380 → 220 Hz, 0.30 s,
gain 0.50. One band, so one hiss — and unfixable by tuning, because
`playRecipe` renders either the oscillator or the noise, never both.

**After:**

| # | Role | Offset | Wave / path | Frequency sweep | Duration | Gain | Effective range |
|---|------|--------|-------------|-----------------|----------|------|-----------------|
| 1 | crack (transient) | 0 s | bandpassed noise | 3200 → 900 Hz | 0.05 s | 0.55 | **900 – 3200 Hz** |
| 2 | body | 0.008 s | sawtooth (tone) | 600 → 250 Hz | 0.22 s | 0.38 | **250 – 600 Hz fundamental**, harmonics to ~5 kHz |
| 3 | tail | 0.030 s | bandpassed noise | 700 → 300 Hz | 0.45 s | 0.70 | **300 – 700 Hz** |

Span 0.48 s, inside `MAX_DURATION` (2 s). **No layer's energy sits below
250 Hz**, and the only layer with a low end at all is the pitched one, whose
harmonic stack keeps speaking after the rolloff eats the fundamental.

Reasoning:

- The **crack** is broadband and high because that is where a laptop speaker is
  most efficient, and because a mechanical snap is what makes a launch read as
  a launch rather than a whoosh. 50 ms is a transient, not a note.
- The **body** is the only pitched layer and carries the weight. It falls by a
  factor of 2.4 (about 1.3 octaves), which is what reads as a heavy object
  leaving the tube — the Cob Cannon "poomf". It is pitched rather than noise
  precisely so that its harmonics survive the speaker rolloff.
- The **tail** starts 30 ms in, outlasts everything, and decays through the
  envelope's exponential ramp. It is the report rolling away.

**The gains are not comparable between layers, deliberately.** A Q = 1 bandpass
passes only a few percent of white-noise power, so a noise layer needs a much
larger authored gain than a tone layer to arrive at the same level. Measured
(see item 4): at 520 → 320 Hz the noise path lands **14.1 dB** below the tone
path at identical authored gain. This is documented in the recipe comment so
the next person does not "fix" the tail down to match the body.

### Measured level

Rendered offline with the Web Audio spec's bandpass biquad (Q = 1), the same
exponential envelope `playRecipe` applies, and a 1-pole 200 Hz highpass
standing in for laptop rolloff:

| Sound | RMS after 200 Hz highpass | Peak |
|---|---|---|
| Mortar, old | −41.5 dB | 0.103 |
| **Mortar, new** | **−30.6 dB** | 0.255 |
| `projectileFired` (QUIET tier, constant chatter) | −34.5 dB | 0.072 |
| `baseDamaged` (LOUD tier, the ceiling) | −23.0 dB | 0.539 |

**+10.9 dB** over the old Mortar. It now sits 3.9 dB above the projectile
chatter it must be heard over, and 7.6 dB below base damage, which a repeating
tower shot must not out-shout.

## Item 3 — the wave alerts

### `waveStarted`

**Before:** sawtooth 180 → 240 Hz, 0.7 s, gain 0.45, no noise. The owner is
right about it: a low buzzy waveform rising slowly with no transient is close
to a literal recipe for a flatulence sound, and its whole range straddles the
speaker rolloff.

**After — a two-tone rising figure, E5 then B5 a fifth above:**

| # | Role | Offset | Wave | Frequency | Duration | Gain | Effective range |
|---|------|--------|------|-----------|----------|------|-----------------|
| 1 | first note (E5) | 0 s | square | 660 Hz, steady | 0.16 s | 0.36 | **660 Hz + odd harmonics** |
| 2 | second note (B5) | 0.18 s | square | 990 Hz, steady | 0.34 s | 0.45 | **990 Hz + odd harmonics** |

Span 0.52 s — shorter than the old 0.7 s, because an alert should be crisp.

Reasoning: what carries alert meaning is *stepped* notes rather than a slide,
a clear rise, and pitches high enough to cut through a busy wave — the reasons
real warning signals are two-tone. The 20 ms gap between the notes articulates
them so the figure reads as two events, not one sweep. Squares because their
harmonic density is what survives a small speaker. A perfect fifth up is the
conventional "announcement" interval.

Measured: **−23.1 dB** after the 200 Hz highpass, versus −29.2 dB for the old
one — **+6.1 dB**, on top of a completely different character. Peak 0.315, so
`baseDamaged` (peak 0.539) is still clearly the loudest thing in the game.

### `bossWaveStarted` — yes, it needed the same treatment

**Before:** sawtooth 110 → 90 Hz, 1.2 s, gain 0.6.

The decision, with reasoning both ways:

- **The case for leaving it:** unlike a bandpassed noise burst, a sawtooth at
  110 Hz is *not* silent below the rolloff. Its harmonics at 220, 330, 440 Hz
  carry at −6, −9.5, −12 dB, so the pitch is still inferable. It is not the
  same bug class as the 25–90 Hz noise recipes.
- **The case for changing it, which won:** measured, it loses 3.9 dB passing
  the 200 Hz highpass (−24.5 → −28.5 dB) — it arrives as a thin buzz with its
  body missing. More importantly, it is *the same sound the owner complained
  about*: a slow, low, falling sawtooth. Fixing `waveStarted` and leaving this
  one would have left the boss sting as the last surviving example of the
  character he rejected, and would have broken the pairing — the two stings
  should be recognisably the same vocabulary so a player learns one shape.

**After — the same alert language inverted, A4 then D4 below, over a sustained
A3 for weight:**

| # | Role | Offset | Wave | Frequency | Duration | Gain | Effective range |
|---|------|--------|------|-----------|----------|------|-----------------|
| 1 | first note (A4) | 0 s | sawtooth | 440 Hz, steady | 0.30 s | 0.42 | **440 Hz + all harmonics** |
| 2 | second note (D4) | 0.32 s | sawtooth | 330 Hz, steady | 0.38 s | 0.40 | **330 Hz + all harmonics** |
| 3 | weight (A3) | 0.32 s | sawtooth | 220 Hz, steady | 0.85 s | 0.38 | **220 Hz + all harmonics** |

Span 1.17 s, comparable to the old 1.2 s. **Lowest note is 220 Hz**, above the
rolloff. The weight comes from the low note being *sustained and stacked under
the second note*, not from pitching the sting into the floor — which is this
project's stated principle.

Rising means a wave; falling means the thing to be afraid of. Sawtooth rather
than square keeps it distinct in timbre from the ordinary sting as well as in
direction.

Measured: **−27.6 dB** after the highpass versus −28.5 dB before — level is
roughly unchanged by design, since the tier is the same; what changed is that
the energy is now where the speaker can radiate it, and the shape reads as a
threat. Peak 0.539, matching `baseDamaged` exactly, which is the intended
ceiling for a once-per-ten-waves event.

## Item 4 — the enemy death sound (investigation only, no redesign)

### It is emitting, and nothing is suppressing it

Verified by driving a real kill through the real stack — real `GameEngine`,
real `FeedbackBus`, real `FeedbackManager`, real `AudioManager` — via
`addDefenderExplosion`, and logging every call that reached `playRecipe`:

```
PROBE enemy.isAlive = false
PROBE sound: hit:hit          mix=0.4 started=true recipe={"wave":"triangle","noise":false,"freqStart":320,"freqEnd":240,"duration":0.0245,"gain":0.1375}
PROBE sound: death-small:death mix=0.7 started=true recipe={"wave":"sawtooth","noise":true,"freqStart":520,"freqEnd":320,"duration":0.3,"gain":0.2875}
```

(This probe was temporary and has been deleted; it is not part of the commit.)

Each hypothesis, checked:

- **Dedupe key** — not the cause. The death carries `death-small:death`; the
  killing blow's hit sound carries `hit:hit`. Different keys, so they never
  collapse into each other. `started=true` on the log line is
  `reserveVoiceSlot` returning true, i.e. the death was not deduped away.
- **Mix tier** — not the cause. `MIX_TIERS['death-small'] = MID = 0.7`, applied
  correctly (`mix=0.7` above). It is not accidentally landing on the QUIET
  tier or on the `?? MID` fallback.
- **Voice cap** — not the cause. `started=true`; nothing was evicted.
- **Dispatch** — not the cause. `emitEnemyDeathFeedback` fires,
  `soundKeyFor('BasicEnemy', 'death')` resolves to `death-small`, and
  `resolveVoice` produces the intended post-fix 520 → 320 Hz recipe.

### What it actually is: the noise path costs ~14 dB that no recipe compensates

`AudioManager.createNoiseSource` renders `noise: true` as white noise through a
biquad bandpass. Web Audio's bandpass is the constant-0 dB-peak-gain form and
its Q defaults to **1**, so at a centre of ~400 Hz it passes only about 3% of
white-noise *power*. The recipe's `gain` is applied to the envelope, not as
compensation for that loss — so the same authored gain produces two very
different levels depending on which path renders it.

Measured, identical recipes rendered both ways (gain 0.5, 0.3 s):

| Sweep | Tone path | Noise path | Cost |
|---|---|---|---|
| 520 → 320 Hz | −23.6 dB | −37.9 dB | **−14.1 dB** |
| 700 → 300 Hz | −23.4 dB | −37.1 dB | **−13.6 dB** |
| 3200 → 900 Hz | −23.1 dB | −30.3 dB | −7.1 dB (wider passband) |

The consequence for the two sounds an ordinary kill starts **in the same
frame**, at the same `ctx.currentTime`:

| Sound | Authored gain × mix | Rendered RMS after 200 Hz highpass |
|---|---|---|
| `enemy:hit` (`hit:hit`, tone) | 0.1375 × 0.4 = **0.055** | **−40.8 dB** |
| `enemy:died` (`death-small`, noise) | 0.2875 × 0.7 = **0.201** | **−46.4 dB** |

**The death is authored 11 dB louder than the hit and arrives 5.6 dB quieter
than it.** And they overlap in band (the hit sits at 320 → 240 Hz, inside the
death's 520 → 320 Hz passband) and in time, at comparable peak amplitude
(0.053 vs 0.047). So the hit tick is the more salient of the two, and the death
reads as part of the impact rather than as its own event.

For scale: the whole death family measures −44 to −46 dB (`death-small` −45.7,
`death-medium` −44.5, `death-defender` −44.2) against `baseDamaged` at
−23.0 dB. That is **21–23 dB down** — a factor of 11 to 14 in amplitude. Titan
and Boss reach only −39.0 and −37.7 dB even on the LOUD tier. (Noise figures
vary by a few tenths of a dB between renders, since the source is random.)

### The answer to the question that was actually asked

**We would be shipping a bug that resembles the PvZ model, not choosing it.**

The PvZ design — silence for ordinary enemies, a distinct sound for the big
ones — is a legitimate choice, and if adopted deliberately it would mean
removing the ordinary death sound and *raising* the Titan/Boss ones. What is
happening now is different: all five death sounds are present, correctly
dispatched and correctly tiered, and all five are ~23 dB below the mix,
including the Titan and Boss ones that are supposed to be the payoff. The
resemblance to PvZ is superficial and does not extend to the part that makes
PvZ's version work.

There is a second, smaller effect worth knowing before deciding: because the
dedupe key is the sound key, a splash that kills six small enemies in one frame
plays **one** death sound, not six. That is correct and intended, but it means
a multi-kill currently sounds identical to a single kill — so a "big kill"
moment has no audio payoff at all today.

### Recommended fix (not applied — investigation only, per the task)

Compensate the noise path rather than raising every noise recipe's `gain` by
hand: either apply a per-path makeup gain in `createNoiseSource` (roughly
+13 dB for a Q=1 midrange band), or widen the bandpass by lowering Q, or apply
a Q-dependent makeup factor derived from the band's noise bandwidth. Whichever
is chosen, `enemyDied`, `defenderDied`, `bossDied`, and all five unit-voice
death entries, plus `artillery`, `fire`, `melee` and the Mortar's two noise
layers, are all affected. This is a mix change touching most of the sound set
and should be its own task with its own playtest.

## The 200 Hz derived audibility test

`UnitVoices.test.js`, inside the existing "noise voices stay above what a
laptop speaker reproduces" block, which already owns this rule and already
holds the floor as a literal (reading it from the module under test would make
the assertion true by construction).

It merges `SFX` and `UNIT_VOICES`, filters to recipes carrying `layers`,
expands each through the **same** `recipeLayers` the renderer uses, and asserts
`freqStart` and `freqEnd` of every layer — base layer included — are at or
above 200 Hz. It is derived from the tables, not from a hand-written list, so a
layered sound added to either table is covered the day it is written.

Two guards keep it honest:

- A vacuity guard asserting the derivation finds exactly
  `['bossWaveStarted', 'mortar', 'waveStarted']`. This is the assertion that
  went red before implementation, and it is what stops the `it.each` silently
  passing over an empty list.
- A second check running every layered **unit voice** through `resolveVoice`
  for every variant, because the death variant scales frequency by 0.8 and a
  layered voice that clears the floor as authored could still be dragged under
  it once resolved. Only the resolved recipe is ever played.

## Files changed

- `Frontend/src/component/GameLogic (MVC)/Feedback/SfxLibrary.js` — `layers`
  documented in the recipe shape; `recipeLayers` and `recipeSpan` added;
  `waveStarted` and `bossWaveStarted` redesigned.
- `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js` — `mortar`
  redesigned as three layers; `resolveVoice` now carries and scales layers;
  scaling factored into `scaleRecipe` / `scaleLayer`.
- `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js` —
  `playRecipe` renders every layer via a new `startLayer`; `activeVoices`
  entries hold `sources` rather than a single `source`; eviction stops all of
  them.
- `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js`
  — new `layered recipes` block (13 tests).
- `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SfxLibrary.test.js`
  — `recipeLayers`, `recipeSpan`, layered well-formedness, and the wave-sting
  alert-shape tests.
- `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js`
  — layer propagation through `resolveVoice`, the Mortar's artillery shape, and
  the derived 200 Hz layer floor.

## Concerns

1. **The noise-path level deficit is real, general, and not fixed here** (item
   4). Every `noise: true` recipe in the game is ~14 dB quieter than its
   authored gain implies. I did not change it because the task said to
   investigate and report, not redesign, and because it is a mix change
   touching most of the sound set. The Mortar's noise layers are authored
   around the deficit (gains 0.55 and 0.70) rather than fixing it, so **if the
   deficit is later corrected globally, the Mortar's two noise layers will need
   to come down or it will become the loudest thing in the game.** That
   dependency is noted in the recipe comment.
2. **The `artillery` voice (GrenadeDefender) now sits 13 dB below the Mortar**
   (−43.4 vs −30.6 dB). That gap is larger than the design intends — both are
   MID tier. It is the same noise-path deficit, and I left it alone as
   out-of-scope, but the two big guns being that far apart is audible.
3. **Eight pre-existing single-source recipes still sit at or below 200 Hz** —
   `defenderPlaced` (220→110), `defenderDied` (180→60), `enemyDied` (300→90),
   `bossDied` (160→40), `deployRejected` (140→120), `levelLost` (440→110), and
   `UNIT_VOICES.summon` (200→130). The new derived floor check covers layered
   recipes only, deliberately: extending it to every recipe would have required
   retuning eight sounds this task was not asked to touch. Three of those are
   `noise: true` (`defenderDied`, `enemyDied`, `bossDied`) and are therefore in
   the worst case — bandpassed with nothing above the rolloff to be heard by.
   Worth a follow-up.
4. **All of my level figures are simulated, not heard.** They come from an
   offline render implementing the Web Audio spec's bandpass biquad, the same
   exponential envelope `playRecipe` applies, and a 1-pole 200 Hz highpass as a
   stand-in for laptop rolloff. The relative comparisons should be sound; the
   absolute "will the owner like it" judgement is not something I can make
   without ears on it. The layer tables above are given so the owner can
   sanity-check the design before listening.
5. **A multi-kill sounds identical to a single kill** because dedupe is keyed by
   sound key. Correct as designed, but it means there is no audio payoff for a
   big splash. Flagging it as a design question, not a bug.
