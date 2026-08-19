# Mortar landing sound + sample unit split — implementation report

Branch: `feat/mortar-landing-and-sample-split` (from `develop` at `815d508`)
Date: 2026-08-17

## Status

DONE.

## The owner's ask

Verbatim: "I want the landing sound from eagle artillery... All eagle
artillery sound changes should belong to mortor, and then the earthquake
belong to titan only."

Mid-task clarification, verbatim: "嘟嘟嘟 is the current sound when the shot
lands on enemy. Keep that, but add the eagle artillery landing sound before
it." The Mortar's landing was not silent - the shared `hit` sound already
plays for every enemy the splash catches - and the new sound had to be
additive, leading it rather than replacing it.

**I cannot hear any of this, and neither can whoever reads this report.**
Every trim point and gain number below is a reasoned, documented guess from
waveform measurements, not a mix decision. Both need the owner's ears before
this is considered finished.

## Task 1 — enforce the unit split

### `quake-charge.wav` deleted

It held `EagleArtillery_Charge.ogg` content under the Titan's wind-up key -
exactly the cross-contamination the owner's rule forbids. Deleted; `quake-charge`
falls back to its synthesized voice (`UNIT_VOICES['quake-charge']`, unchanged).

### Confirmed independently: `Earthquake_Spell.ogg` has no wind-up to extract

Decoded the file and measured it myself (Python, windowed RMS/peak over the
raw PCM, not a re-statement of the owner's numbers):

```
[ 0.00s- 0.30s] rms=-12.8dB peak=-0.2dB   <- matches the owner's figures exactly
[ 1.20s- 1.50s] rms=-10.5dB peak=-0.0dB
[ 1.50s- 3.00s] rms=-10.8..-11.8dB, peak ~0dB throughout
[ 3.30s- 3.60s] rms=-23.5dB peak=-11.4dB
[ 3.60s- 3.90s] rms=-39.8dB peak=-26.2dB
```

Finer 50ms windows across the first second show the peak (-0.2dB) landing in
the *first* 50ms window, not building up to it - there is no quiet-then-rising
wind-up phase anywhere in the file, it opens at the hit and stays loud until
it decays. This matches the owner's reading and rules out any trim of this
file as a `quake-charge` replacement. `quake-charge` stays synthesized.

### Cross-contamination guard (new)

`Feedback/SampleProvenance.js` (new) declares which source pack each
committed sample was cut from (`mortar`/`mortar-impact` → Eagle Artillery,
`quake-impact` → Earthquake_Spell) - this fact cannot be derived from code,
only from how each file was made.

`Feedback/__tests__/SampleProvenance.test.js` (new) derives everything else:
which sample files actually exist (from `SAMPLE_URLS`, glob-derived from the
real filesystem) and which real unit classes can reach a given sound key.
That second part needs two mechanisms, because `soundKeyFor` itself works two
ways: a unit-*sensitive* key (`mortar`) is reachable exactly where the real
`FIRE_SIGNATURES` table says so, checked by probing `soundKeyFor` across every
real exported class. A unit-*agnostic* key (`quake-charge`/`quake-impact`/
`phase-change`/`mortar-impact` all resolve the same way regardless of which
unit is asked, by design) can't be answered by asking `soundKeyFor` at all -
it's answered by reading `FeedbackManager.js`'s own event-routing table to
find which event maps to that variant, then searching the real
`DefenderUnits.js`/`EnemyUnits.js` source for that literal event string. A
dedicated test reproduces the original bug directly: declaring
`quake-charge`'s (real, Titan-only-reachable) content as Eagle Artillery
sourced fails the check, exactly as it should have the first time.

`quake-impact.wav` and `mortar.wav` are unchanged.

## Task 2 — the Mortar's shell landing

### What actually plays today, and the ordering it produces

Traced the real path: `DefenderUnits.js`'s `createExplosion` calls
`GameEngine.addDefenderExplosion`, which loops every enemy inside the splash
radius and calls `emitFeedback('enemy:hit', ...)` for each - resolving (no
`hit.wav` is committed) to the shared **synthesized** `hit` voice via
`soundKeyFor(unitType, 'hit') → 'hit'`. `AudioManager`'s 40ms dedupe collapses
however many enemies the splash caught into one play of that sound, since
every hit shares the dedupe key `hit:hit` regardless of which enemy it was.
That is the "嘟嘟嘟" the owner already likes.

The new `defender:shellLanded` emit is placed at the *top* of `createExplosion`,
before `addDefenderExplosion` is called - so in code order the landing is
scheduled first and the hit(s) that follow it are additive, never suppressing
it (different dedupe key: `mortar-impact:landing` vs `hit:hit`).

**Caveat I verified rather than assumed:** both calls happen in one synchronous
JS tick with no I/O between them, so both reach `AudioManager` reading the
identical `ctx.currentTime` - the mock `AudioContext` used across this test
suite models `currentTime` as a plain field that only changes when a test
explicitly advances it, and the Web Audio spec itself quantizes `currentTime`
per render quantum, so in real playback the two `source.start(now)` calls are
very likely to land at the same instant too. Code order alone does not,
therefore, guarantee an audible gap. I chose **not** to add an artificial delay
(the codebase already has a precedent for one - cluster shells' `setTimeout` -
but reusing it here would delay real splash damage application for a cosmetic
audio gap, and risk destabilizing `addDefenderExplosion`'s heavily-tested
timing). Instead I leaned on level: the landing (~-9.9dBFS) sits roughly 15dB
above the synthesized `hit` (~-25.2dBFS, see below), so its transient reads as
the foreground sound even at identical start times. **This is a judgment call
the owner should verify by ear** - if the tie is audible and unsatisfying, a
small real offset is the next lever, not a bigger one.

### Registration - the five places, and which have guards

| Place | Guarded automatically? |
|---|---|
| `SOUND_KEYS` | **No** - nothing forces an entry to exist; a forgotten one is caught only by the dedicated tests written for this feature. |
| `soundKeyFor` branch | **No** - same as above. Omitting it would not throw or fail any pre-existing test: `soundKeyFor(anything, 'landing')` would fall through to `FIRE_SIGNATURES.Mortar` and silently resolve to `'mortar'` (the Mortar's own fire key) instead of a dedicated one - exactly the "degrades silently" failure mode the task warned about. |
| `MIX_TIERS` | **Yes** - `SoundGroups.test.js`'s `every declared key has a tier` walks `SOUND_KEYS` and fails on any key missing a tier. Confirmed live: it failed before I added the entry. |
| `UNIT_VOICES` | **Yes** - `UnitVoices.test.js`'s `has exactly one voice per declared sound key` asserts `Object.keys(UNIT_VOICES)` and `SOUND_KEYS` are the same set, both directions. Confirmed live: failed with a length mismatch before I added the recipe. |
| `SAMPLE_VARIANTS` | **Yes** - `UnitSamples.test.js`'s derived guard (regex over `soundKeyFor`'s own source) requires every branched variant to have an entry; `'landing'` was picked up automatically once the `soundKeyFor` branch existed, and its pinned "so this is not vacuous" list needed updating to include it. |

So: three of five have a structural guard that would catch a future regression;
`SOUND_KEYS` and the `soundKeyFor` branch do not, and rely entirely on the
tests added in this task (`SoundGroups.test.js`'s "the Mortar's shell landing"
block, and the `DefenderUnits.audioEvents.test.js`/`FeedbackManager.test.js`
tests that exercise the real emit path end to end).

### The sample: trim and gain

`EagleArtillery_Impact.ogg` measured (independently, matching the task's
figures): 2.52s, peak -0.2dB, mean -9 to -11dB for the first ~1.3s, then a
genuine decay through -15dB, -20dB, -26dB down to -33.6dB by 2.5s - a long,
continuous rumble, not a single sharp hit-then-silence.

**Trimmed to ~0.58s** (`ffmpeg -t 0.6 -af "afade=t=out:st=0.48:d=0.12"`): the
attack transient (rises to near-peak within ~30ms) plus the sustained "boom"
body, released over a 120ms fade rather than cut cold at the source's own
decay curve (which doesn't start meaningfully until ~1.3s - too late for a
shell impact). Verified the fade reaches true silence at the file's end (last
sample = 0), no click. This is shorter than `quake-impact.wav`'s 1.2s trim on
purpose: one shell landing once is a smaller moment than a three-wave
board-wide earthquake.

**Gain (`SAMPLE_VARIANTS.landing`): `gainScale: 0.65`.** The file peaks at
essentially the same near-0dBFS mastering as every other sample here. At
`gainScale: 1` (fire's value) it would land at *exactly* the Mortar's own fire
sample's level (`SAMPLE_BASE_GAIN(0.7) * 1 * MID(0.7) = 0.49`), leaving no
margin for "heavy but not the loudest thing in the game" - especially with
`titan`/`boss`/`quake-impact` already authored to peak at 0.55-0.60 in the
LOUD tier. `0.65` puts the landing at `0.7 * 0.65 * 0.7 ≈ 0.32` (~-9.9dBFS),
below the Mortar's own fire and well below every LOUD-tier sound.

**Combined level with the hit sound it precedes:** the synthesized `hit`
fallback (no `hit.wav` is committed) resolves to `UNIT_VOICES.hit.gain(0.25) *
VARIANTS.hit.gainScale(0.55) * QUIET(0.4) ≈ 0.055` (~-25.2dBFS) - about 15dB
under the landing. Summing two signals 15dB apart raises the combined peak by
well under 1dB over the landing alone, so the pairing reads as "landing, with
a quiet accent under it," not as two competing sounds. This is the reasoning,
not a listened confirmation.

**Synthesized fallback** (`UNIT_VOICES['mortar-impact']`, for players without
the sample): a three-layer crack/body/tail recipe in the same vocabulary as
the Mortar's own launch and the Titan's `quake-impact` - a broadband debris
crack (brightest, shortest), one pitched falling body layer (the felt thud,
the lesson the Mortar's own launch already paid for: a noise-only impact is a
hiss with no note), and a broadband settling tail. Every frequency clears
200Hz with margin (lowest is 260Hz) - the sub-200Hz laptop-speaker floor guard
in `UnitVoices.test.js` is authored-recipe-wide and was **not** weakened or
special-cased for this entry; the new recipe is simply covered by it like
every other. Span 0.38s, comfortably under `quake-impact`'s 0.65s and inside
`MAX_DURATION`.

## Tests

**TDD note, honestly:** the five registration edits (`SOUND_KEYS`,
`soundKeyFor`, `MIX_TIERS`, `UNIT_VOICES`, `SAMPLE_VARIANTS`) were made
together, then the full suite was run before any dedicated test for the new
key existed. That run genuinely went RED against three *pre-existing* derived
guards (not yet updated for the new key):

```
UnitSamples.test.js > finds the branches this guard depends on...  (FAIL - missing 'landing')
UnitVoices.test.js  > covers every recipe in both tables...         (FAIL - layer count 14 vs 16)
UnitVoices.test.js  > finds every layered sound in both tables...   (FAIL - missing 'mortar-impact')
```

GREEN after updating those three pinned literals - the exact "guard that
guards" behavior these derived checks exist for. The *new*, feature-specific
tests (dedicated `mortar-impact`/`landing` describe blocks in
`SoundGroups.test.js`, `UnitVoices.test.js`, `UnitSamples.test.js`,
`FeedbackManager.test.js`, `DefenderUnits.audioEvents.test.js`, and all of
`SampleProvenance.test.js`) were written alongside rather than strictly before
the implementation they check - I did not observe a true red phase for those
specific assertions, and I'm not claiming one.

**Full suite:**
```
$ npx vitest run
 Test Files  44 passed (44)
      Tests  1352 passed (1352)
```
1298 (baseline at `815d508`) + 54 new tests, no regressions. Re-confirmed
green with the commit checked out alone (playtest hack stashed, suite run,
hack restored).

**What each new test rejects (selected):**
- `resolves the landing variant to mortar-impact` - rejects a missing
  `soundKeyFor` branch (silent fallback to `'mortar'`, the fire key).
- `is a sound of its own, distinct from...quake-impact` - rejects reusing the
  `'impact'` variant name, which would cross-contaminate the split.
- `gives the landing a lower gainScale than fire...` - rejects leaving
  `SAMPLE_VARIANTS.landing` at 1, which would make the sample the loudest
  thing at its tier.
- `plays both the landing and the splash hit...` / `leads the hit sound
  rather than trailing it` - the "both sounds actually start" requirement:
  rejects a shared or colliding dedupe key, and rejects the wrong call order.
- `%s is reachable only by the unit its declared source pack belongs to`
  (`SampleProvenance.test.js`) - rejects exactly the original bug, reproduced
  directly against `quake-charge` in a dedicated test.

**Mutation testing (two verified, both restored after):**

1. Simulated "landing fires too early" by adding a second
   `emitFeedback('defender:shellLanded', ...)` call inside `attack()` (at
   launch, not landing). Result: 2 tests failed in
   `DefenderUnits.audioEvents.test.js` - `emits defender:shellLanded exactly
   when the shell actually lands` (`expected length 1, got 2`) and `does not
   emit the landing sound before the shell lands` (`expected length 0, got
   1`). Reverted; file back to 23/23.
2. Swapped `createExplosion`'s statement order (moved the emit to *after*
   `addDefenderExplosion`). Result: exactly 1 test failed - `emits the
   landing sound before addDefenderExplosion applies splash damage...` -
   `AssertionError: expected 10 to be less than 9` (the invocation-order
   indices reversed). Every other test in the file stayed green. Reverted;
   file back to 23/23.

Full suite re-run after both restorations: **1352/1352 passing.**

## Files changed

- `Frontend/src/assets/audio/units/quake-charge.wav` - deleted.
- `Frontend/src/assets/audio/units/mortar-impact.wav` - new, trimmed/converted
  from `EagleArtillery_Impact.ogg`.
- `Frontend/src/assets/audio/units/README.md` - untucked `quake-charge.wav`
  back to outstanding/synthesized with the no-wind-up finding recorded, added
  a "one pack per unit" rule section, added the "Mortar shell landing"
  section, updated the 70% tier list.
- `Feedback/SoundGroups.js` - `mortar-impact` in `SOUND_KEYS`, a `'landing'`
  branch in `soundKeyFor`, a `MIX_TIERS` entry (MID).
- `Feedback/UnitVoices.js` - `UNIT_VOICES['mortar-impact']` synthesized
  recipe.
- `Feedback/UnitSamples.js` - `SAMPLE_VARIANTS.landing`.
- `Feedback/FeedbackManager.js` - routes `defender:shellLanded` through
  `playUnitVoice`.
- `Feedback/SampleProvenance.js` - new; source-pack manifest.
- `DefenderUnits.js` - `createExplosion` emits `defender:shellLanded` before
  `addDefenderExplosion`.
- Tests updated/added: `SoundGroups.test.js`, `UnitVoices.test.js`,
  `UnitSamples.test.js`, `FeedbackManager.test.js`,
  `DefenderUnits.audioEvents.test.js`, `SampleProvenance.test.js` (new).

**Not touched:** `GameLevelConfigs.js` - the owner's uncommitted playtest
hack, left exactly as found, not staged, not committed.

## Concerns for the owner

- The landing/hit ordering tie (both scheduled at the same audio-clock
  instant) is a real, verified technical fact, not a hypothetical - if it
  reads as simultaneous rather than "landing first" in play, that's the first
  thing to revisit, with a real (small) scheduling offset as the fix.
- The 0.58s trim point and the 0.65 gainScale are reasoned guesses from
  waveform measurements. So is the synthesized fallback's balance against the
  Mortar's own launch sound. All three need the owner's ears.
- `quake-charge` has no sample again and needs a genuine wind-up recording
  (not an Eagle Artillery cut) if the owner wants one restored.
