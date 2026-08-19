# Artillery and alert sounds — implementation report

Branch: `feat/artillery-and-alert-sounds` (from `develop` at `44fe448`)
Date: 2026-08-15

## Status

DONE_WITH_CONCERNS — two rounds. Round 1 built layering and redesigned the two
sounds; round 2 fixed the systemic noise-path defect round 1's investigation
found, and re-authored everything that had been written around it.

## Summary

1. `AudioManager` learned layered recipes. A recipe may carry `layers`;
   the whole thing is one voice and one dedupe slot.
2. The Mortar is now three-layer artillery: crack, falling body, decaying tail.
3. `waveStarted` is now a two-tone rising alert. `bossWaveStarted` got the same
   treatment inverted (falling), and the reasoning for doing so is below.
4. The enemy death sound was **emitting correctly and suppressed by nothing**.
   It was inaudible because the `noise: true` render path silently cost ~14 dB
   that no recipe compensated for.
5. **(Round 2)** That defect is fixed at its root: authored `gain` now means
   the same level on both render paths. Every sound written around the old
   deficit has been re-authored, and the seven sub-200 Hz recipes lifted.

## Test results

| | Tests | Files |
|---|---|---|
| Baseline at `44fe448` | 589 passed | 27 |
| After round 1 | 642 passed | 27 |
| **After round 2** | **702 passed** | 27 |

`cd Frontend && npm test` — 702 passed (702), 27 files, output pristine.
`cd Frontend && npm run lint` — clean, no output.

113 tests added, none deleted. Two existing tests were modified in round 2 and
both are documented where they changed: the noise-chain wiring assertion (the
signal path genuinely gained a stage) and one round-1 layering test that
assumed one gain node per layer.

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

### Recommended fix (applied in round 2 — see below)

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

## Files changed (round 2 adds to the round-1 list below)

- `AudioManager.js` — `NOISE_BANDPASS_Q` and `noiseMakeupGain` added and
  documented; `createNoiseSource` sets Q explicitly and inserts the makeup
  stage.
- `SfxLibrary.js` — six recipes lifted above the floor; header records why.
- `UnitVoices.js` — `summon` lifted; Mortar's three gains re-authored.
- `__tests__/AudioManager.test.js` — the equal-gain guard with its independent
  numerical integration; mock gained `Q`; noise-chain wiring assertion updated.
- `__tests__/UnitVoices.test.js` — floor check extended to every authored
  recipe and layer.
- `__tests__/EnemyUnits.audioEvents.test.js` — fake context gained `Q`;
  swallowed-error guard added.

## Files changed (round 1)

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

---

# Round 2 — fixing the noise path at its root

## The defect

`gain: 0.5` meant two different loudnesses depending on `noise`, a boolean
elsewhere in the same recipe. That is the bug. It explains three symptoms the
owner reported as unrelated — the inaudible Mortar, the inaudible enemy deaths,
and the death family sitting ~22 dB under `baseDamaged` — because every one of
those is a `noise: true` recipe.

## TDD evidence (round 2)

### RED

The equal-gain guard, written before the fix, measuring through the mock graph:

```
FAIL > authored gain means the same level on both render paths
  a noise burst at 520->320Hz  : expected 15.493901554505863 to be <= 2
  a noise burst at 700->300Hz  : expected 15.004290985446804 to be <= 2
  a noise burst at 900->400Hz  : expected 13.878220566868894 to be <= 2
  a noise burst at 3200->900Hz : expected  9.709419166071747 to be <= 2
  a noise burst at 250->220Hz  : expected 17.843825772645930 to be <= 2
  defenderDied[0]              : expected 21.337959442472364 to be <= 2
  enemyDied[0]                 : expected 19.367001959565297 to be <= 2
  bossDied[0]                  : expected 22.466761132697673 to be <= 2
  artillery[0]                 : expected 15.630002568406230 to be <= 2
  mortar[0]                    : expected  9.709419166071747 to be <= 2
  mortar[2]                    : expected 15.004290985446804 to be <= 2
  death-small[0] / death-medium[0] / death-defender[0] / titan[0] / boss[0] — same
 Test Files  2 failed | 25 passed (27)
      Tests  30 failed | 664 passed (694)
```

Plus the seven sub-200 Hz recipes, each named individually:

```
 defenderPlaced : expected 110 to be greater than or equal to 200
 defenderDied   : expected 180 to be greater than or equal to 200
 enemyDied      : expected  90 to be greater than or equal to 200
 bossDied       : expected 160 to be greater than or equal to 200
 deployRejected : expected 140 to be greater than or equal to 200
 levelLost      : expected 110 to be greater than or equal to 200
 summon         : expected 130 to be greater than or equal to 200
```

The first red run of the equal-gain guard failed with `NaN` rather than a
number, because the model was reading `NOISE_BANDPASS_Q` from production, which
did not exist yet. That is a test failing for the wrong reason, so the model
was given its own `ASSUMED_Q` and a separate assertion pinning production to
it — which is what produced the honest dB figures above.

### GREEN

```
 Test Files  27 passed (27)
      Tests  702 passed (702)
```

## The fix, and how it is derived

`AudioManager.noiseMakeupGain(freqStart, freqEnd, sampleRate, q)` — a constant
gain stage inserted **inside** `createNoiseSource`, after the bandpass, so
recipe authors never have to know which path their sound takes.

For a 2nd-order bandpass with unity peak gain, the equivalent noise bandwidth
is `(π/2)(f₀/Q)` Hz. White noise emerges with its power scaled by that
bandwidth over the Nyquist span:

```
powerGain = ((π/2)(f₀/Q)) / (sampleRate/2) = π·f₀ / (Q·sampleRate)
makeup    = 1 / sqrt(powerGain)
```

`f₀` is the geometric mean of the sweep endpoints, which is where an
exponential sweep spends its time. The result restores the burst's RMS to what
an unfiltered one would have had — so a noise recipe and a sawtooth recipe at
the same authored gain now reach the same RMS, since uniform noise and a
sawtooth happen to share an RMS of 1/√3.

`Q` is now **set explicitly** on the filter rather than left to
`BiquadFilterNode`'s default, because the makeup is derived from it and two
places depending on one unstated default is how they drift apart silently. A
test asserts the filter really carries that Q.

### Accuracy, and what would invalidate it

The identity above is the analog one; the digital biquad departs from it as the
centre approaches a significant fraction of the sample rate. Checked against
**direct numerical integration of |H(f)|² over the biquad's response** — a
genuinely different derivation, so agreement is evidence rather than tautology:

| centre | error of closed form |
|---|---|
| 200 Hz | 0.06 dB |
| 520 Hz | 0.16 dB |
| 1700 Hz | 0.53 dB |
| 3200 Hz | 1.02 dB |
| 5000 Hz | 1.60 dB |
| 8000 Hz | 2.61 dB |

All in-band values are inaudible. It would be invalidated by: changing
`NOISE_BANDPASS_Q` without changing the formula; giving the filter a Q that
varies across the sweep; or authoring noise centres above roughly 5 kHz. The
`Math.min(1, powerGain)` clamp keeps the degenerate case (bandwidth wider than
the spectrum) from returning a makeup below 1 and quietening sounds instead of
leaving them alone.

The test suite carries the numerical integration and asserts every authored
noise recipe lands within **2 dB** of a tone at the same gain, derived from the
tables so a noise recipe written later is covered the day it is written.

## Corrected Mortar layer table

The old gains were authored *around* the deficit, so the two noise layers
carried inflated numbers (0.55, 0.70) against the sawtooth's 0.38 just to be
heard. Once the path was corrected those became a ~14 dB overshoot, and the
tail — meant to sit underneath — measured the **loudest** layer of the three
(−22.3 dB against the body's −28.6 dB). Re-authored against corrected levels:

| # | Role | Offset | Wave / path | Frequency sweep | Duration | Gain (was) | Effective range | Isolated level |
|---|------|--------|-------------|-----------------|----------|------------|-----------------|----------------|
| 1 | crack | 0 s | bandpassed noise | 3200 → 900 Hz | 0.05 s | **0.28** (0.55) | 900 – 3200 Hz | −29.7 dB |
| 2 | body | 0.008 s | sawtooth (tone) | 600 → 250 Hz | 0.22 s | **0.60** (0.38) | 250 – 600 Hz + harmonics | −24.9 dB |
| 3 | tail | 0.030 s | bandpassed noise | 700 → 300 Hz | 0.45 s | **0.20** (0.70) | 300 – 700 Hz | −32.1 dB |

Span 0.48 s, nothing below 250 Hz — character unchanged. The balance now reads
straight off the gains: body loudest, crack an accent over it, tail underneath
both, which is what the design intended and what the old numbers inverted.

**Whole sound: −26.9 dB, peak 0.405.** Against the Mortar as it actually
shipped (−44.1 dB) that is **+17.2 dB**, not the +10.9 dB reported in round 1.
It moved because the path fix itself contributes most of the difference, and
because the target level moved: `artillery`, its MID-tier peer, also gained
~15 dB from the fix, so leaving the Mortar at its round-1 level would have put
it *below* the lighter gun.

## Where the death family now sits

Gains untouched, per instruction — only the render path changed.

| Sound | Tier | Before | **After** | Change |
|---|---|---|---|---|
| `hit` tick (tone, reference) | QUIET | −40.8 dB | −40.8 dB | unchanged |
| `death-small` | MID | −45.7 dB | **−30.3 dB** | +15.4 dB |
| `death-medium` | MID | −44.5 dB | **−26.7 dB** | +17.8 dB |
| `death-defender` | MID | −44.2 dB | **−27.3 dB** | +16.9 dB |
| `titan` | LOUD | −39.0 dB | **−21.9 dB** | +17.1 dB |
| `boss` | LOUD | −37.7 dB | **−20.6 dB** | +17.1 dB |
| `baseDamaged` (tone, reference) | LOUD | −23.0 dB | −23.0 dB | unchanged |

**Is a death still masked by the simultaneous hit tick? No — the relationship
has inverted.** `death-small` was 4.9 dB *quieter* than the hit tick that fires
in the same frame on the same enemy; it is now **10.5 dB louder** than it. The
death is now unambiguously the foreground event of a kill, which is what the
mix tiers said it should be all along (MID 0.7 over QUIET 0.4).

Against `baseDamaged`: `death-small` sits 7.3 dB below it, `death-medium`
3.7 dB below, `death-defender` 4.3 dB below — all sensible for MID under LOUD.
`titan` and `boss` now sit 1.1 dB and 2.4 dB **above** `baseDamaged`. That is
consistent with the tier table rather than a bug (all three are LOUD, and the
big deaths carry higher authored gains than base damage), but it does mean a
boss death is now the loudest single event in the game. Flagged for the owner
rather than changed, since the instruction was not to redesign the death
sounds.

## Is `artillery` still 13 dB below `mortar`?

**No. It was the same deficit.** `artillery` is a `noise: true` recipe and
gained ~15 dB from the path fix with no change to its authored values:

| | Before | After |
|---|---|---|
| `mortar` | −41.5 dB (as shipped: −44.1) | **−26.9 dB** |
| `artillery` | −43.4 dB | **−28.0 dB** |
| gap | 13 dB (round-1 Mortar vs artillery) | **1.1 dB** |

They now sit within about 1 dB of each other, which is what the mix tiers say
should happen — both are MID. The distinction between them lives in character,
not level: a 0.48 s three-layer artillery piece against a 0.14 s single burst.
If the owner wants the Mortar to dominate its peer, that is a tier decision,
not a defect.

## The 200 Hz floor, extended (closing round-1 concern 3)

The floor check now walks **every authored recipe and every layer in both
tables** — 33 layers across 28 recipes — not just the layered ones. Its
non-vacuity is pinned by asserting the recipe count and the extra-layer count
(5: waveStarted +1, bossWaveStarted +2, mortar +2) rather than a bare list.

The seven that were under it were lifted, each keeping the **direction** and,
where it survived, the **ratio** of its original sweep, so the authored
character is preserved and only the register moved:

| Recipe | Before | After | Note |
|---|---|---|---|
| `defenderPlaced` | 220 → 110 | **440 → 220** | 2:1 preserved |
| `defenderDied` | 180 → 60 | **540 → 270** | 2:1 (was 3:1) |
| `enemyDied` | 300 → 90 | **660 → 220** | 3:1 preserved |
| `bossDied` | 160 → 40 | **880 → 220** | 4:1 preserved |
| `deployRejected` | 140 → 120 | **280 → 240** | ratio preserved exactly |
| `levelLost` | 440 → 110 | **440 → 220** | keeps the authored 440 start; now mirrors `levelWon`'s octave rise with an octave fall |
| `summon` | 200 → 130 | **330 → 220** | 1.5:1 (was 1.54:1) |

`defenderDied` and `bossDied` are unreachable dead data — `defender:died` and a
boss kill both resolve through `soundKeyFor` to unit voices, never to these SFX
entries. They were lifted anyway for consistency; see concerns.

## A test-hygiene bug found along the way

`EnemyUnits.audioEvents.test.js`'s fake AudioContext was missing the bandpass
`Q`. Once `createNoiseSource` started setting it, every `noise: true` recipe in
that suite threw — and **all 38 tests stayed green**, because `FeedbackBus`
deliberately isolates throwing handlers (right for production: one bad
subscriber must not break the game loop) and the suite counts voices at
`reserveVoiceSlot`, which runs *before* the sources are built.

That is the same failure shape as the original bug: a green suite over silent
audio. Fixed, and guarded — `runApproach` now captures `console.error` during
the run and a new test asserts nothing was swallowed, with a non-vacuity check
that the melee voice really is a noise recipe and that voices were produced.
Mutation-checked: removing `Q` from the mock again fails that test with
`expected [ …(18) ] to deeply equal []`.

## Concerns

Round-1 concerns 1 and 3 are closed by round 2. Concern 2 is answered above
(the gap was the same deficit; it is now 1.1 dB). What remains:

1. **`titan` and `boss` can clip at extreme volume settings.** With the path
   corrected they peak at 1.26 and 1.27 before the bus gains. At the shipped
   defaults (master 80, sfx 70 → combined 0.31) that is 0.39 — no problem. They
   exceed full scale only when `soundEffects` is 100 **and** `masterVolume` is
   above ~89. The cause is crest factor, not the compensation being wrong:
   bandpassed noise restored to a tone's RMS is Gaussian and peaks at ~2× its
   RMS, where a sawtooth peaks at 1.73× and a square at 1×. So noise recipes
   need roughly 6 dB more headroom than tones at equal loudness. I did not trim
   their gains because the instruction was explicitly not to redesign the death
   sounds before the owner hears them. Options if it bites: trim `titan`/`boss`
   gains, or add a limiter on the sfx bus.
2. **`defenderDied` and `bossDied` are unreachable dead data.** Nothing plays
   them — `defender:died` and boss kills both resolve through `soundKeyFor` to
   unit voices. They are still required by `SfxLibrary.test.js`'s
   `REQUIRED_IDS` and are still maintained (lifted above the floor this round),
   which is wasted effort and a trap for the next person tuning "the boss death
   sound". Deleting them is a small, separate change.
3. **All of my level figures are simulated, not heard.** They come from an
   offline render implementing the Web Audio spec's bandpass biquad, the same
   exponential envelope `playRecipe` applies, and a 1-pole 200 Hz highpass as a
   stand-in for laptop rolloff. The relative comparisons should be sound — and
   round 2's equal-gain invariant is additionally verified in the suite by a
   second, independent derivation — but the absolute "will the owner like it"
   judgement needs ears. The layer tables above are given so the owner can
   sanity-check the design before listening.
4. **A multi-kill sounds identical to a single kill** because dedupe is keyed by
   sound key. Correct as designed, but it means there is no audio payoff for a
   big splash. Now more noticeable, since deaths are ~17 dB louder than they
   were. Flagging it as a design question, not a bug.
5. **The whole sound set got louder this round.** Nine recipes gained 15-22 dB
   with no change to their authored values. The mix was balanced by ear (or by
   nobody) against the broken path, so relationships that looked right before
   may not now — `titan`/`boss` overtaking `baseDamaged` is one example that
   showed up in measurement. This wants a playtest pass over the whole set, not
   just the sounds named in this task.
