# Clash samples — implementation report

Branch: `feat/clash-samples` (from `develop` at `703655a`)
Date: 2026-08-17

## Status

DONE.

## The owner's ask

> "The ground pound sound is so loud and it doesnt sound like clash of clan
> earthquake. You can find Earthquake_Spell.ogg in the downloads... You can
> also find a lot of Eagle Artillery audios in download as well. Incorporate
> those for titan and mortor."

Source files were staged (six `.ogg` files: `Earthquake_Spell`,
`EagleArtillery_Fire/Charge/Impact/Activate/Place`); the owner's `~/Downloads`
was not touched.

**I cannot hear any of these files, and neither can whoever reviews this PR
from the report alone.** Every trim point, gain number and file choice below
is a reasoned, documented guess, not a mix decision. All three shipped files
need the owner's ears before this is considered finished.

## What shipped

| Sound key | Source file | Variant | Wired? |
|---|---|---|---|
| `mortar` | `EagleArtillery_Fire.ogg` | `fire` (unchanged) | yes |
| `quake-impact` | `Earthquake_Spell.ogg` | `impact` (new) | yes |
| `quake-charge` | `EagleArtillery_Charge.ogg` | `charge` (new) | yes |
| `phase-change` | — | `phase` (new, no file yet) | entry added, no sample |
| — | `EagleArtillery_Impact.ogg` | — | not wired, recommendation only |
| — | `EagleArtillery_Activate.ogg` | — | not wired, recommendation only |
| — | `EagleArtillery_Place.ogg` | — | not wired, recommendation only |

## Problem 1 — the missing SAMPLE_VARIANTS entries (the eleventh guard)

`SAMPLE_VARIANTS` in `UnitSamples.js` had `fire`, `hit`, `melee`, `death` -
nothing for `charge`, `impact`, `phase`. `soundKeyFor` (`SoundGroups.js`),
`MIX_TIERS` and `UNIT_VOICES` all already knew about `quake-charge`/
`quake-impact`/`phase-change`; the sample-variant table didn't. Nothing
caught it because no sample existed under those keys to expose the fallback -
`playUnitVoice`'s `SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire` would
have silently handed a freshly-dropped Earthquake_Spell sample the untouched
`fire` transform: `playbackRate: 1, gainScale: 1, durationScale: 1` - full
gain, full 3.91s length.

**Fix:** added `charge`, `impact`, `phase` entries to `SAMPLE_VARIANTS`
(values and reasoning below).

**The durable fix (the guard):** added a new describe block in
`UnitSamples.test.js`, `every variant soundKeyFor special-cases has a sample
transform`. It reads `SoundGroups.js`'s own source (via `readFileSync` +
`stripComments` from `src/test/sourceFiles.js`, the house pattern this
project's other "ten guards that didn't guard" postmortem already
established - see `noRawCanvasColours.test.js`), regex-matches every
`variant === '...'` branch (`/variant === ['"]([a-z-]+)['"]/g`), and asserts
each one has a `SAMPLE_VARIANTS` entry:

```js
function branchedVariants(source) {
  return [...new Set(
    [...source.matchAll(/variant === ['"]([a-z-]+)['"]/g)].map((m) => m[1]),
  )];
}
```

This derives `['hit', 'melee', 'charge', 'impact', 'phase', 'death']` from
the real file, not from a second hand-typed list - the exact class of
mistake ("registered in three places, missed in the fourth") this bug
already was. `fire` is deliberately excluded from the derived set: it's not
a branch `soundKeyFor` checks for, it's the implicit default every other
variant falls through to, and it's already covered by the pre-existing
"plays fire untransformed" test plus the fact that removing it would break
the fallback (`?? SAMPLE_VARIANTS.fire`) for literally everything, which
would surface immediately and everywhere, not just here.

A companion test, `finds the branches this guard depends on, so it is not
vacuous`, pins the derived set itself, so a reformat that silently stops the
regex matching fails loudly instead of the `it.each` below just shrinking to
nothing.

Added matching production-level tests in `FeedbackManager.test.js` (`the
Titan abilities prefer a supplied sample, like every other voice`) that
exercise the full `FeedbackManager -> AudioManager.playSample` call with
`hasSample` mocked true, asserting the exact transform object passed is
`SAMPLE_VARIANTS.charge/impact/phase`, not `SAMPLE_VARIANTS.fire`.

## Problem 2 — loudness

The owner's complaint predates the sample: the *synthesized* ground pound
was already "so loud." All three quake keys sit at the **LOUD** mix tier
(1.0), same as `baseDamaged`/`boss`/`titan`. Both supplied Eagle Artillery
files and the Earthquake Spell peak at essentially 0dBFS (measured:
Earthquake_Spell -12.2dB mean / 0.0dB peak; Eagle Artillery files -11.2 to
-12.7dB mean / -0.1 to -0.4dB peak). Doing nothing (`gainScale: 1`, fire's
default) would have made the sample-based ground pound *louder* than the
version already judged too loud.

**Lever chosen: `SAMPLE_VARIANTS` `gainScale`, not the tier, not the file.**

- **Not the tier** (`MIX_TIERS['quake-impact']` etc.): that constant is
  shared with `baseDamaged` and `boss`, and several passing tests assert
  `mixGainFor(soundKeyFor('TitanEnemy', variant)) === mixGainFor('baseDamaged')`
  for exactly this reason - the tier encodes "how much this MOMENT matters,"
  documented at length in `SoundGroups.js`'s own comments, and that argument
  doesn't change just because one file happens to be mastered hot. Lowering
  it would also quiet the *synthesized* fallback and touch two sounds this
  task never asked about.
- **Not the file** (baking a level cut into the shipped `.wav` via ffmpeg):
  would work, but is invisible to a future maintainer reading
  `UnitSamples.js` - nothing there would explain why the sample is quieter
  than its measured source - and would have to be redone by ear for every
  new file dropped under these keys later.
- **The variant's `gainScale`** is the exact lever `hit`/`melee` already use
  to sit quieter than their tier alone dictates. It's self-documenting in
  the one file that owns sample behavior, and it's per-variant rather than
  per-file, so it survives a future re-record.

Values: `impact.gainScale = 0.6` (vs fire's 1), `charge.gainScale = 0.45`
(kept below impact's, preserving the synth recipe's own wind-up-quieter-
than-impact relationship - `UNIT_VOICES['quake-charge'].gain` 0.30 vs
`UNIT_VOICES['quake-impact'].gain` 0.60), `phase.gainScale = 0.6` (same
reasoning as impact, added ahead of any phase-change sample existing, since
the LOUD-tier-meets-hot-sample problem is a property of the tier, not of one
file).

## Problem 3 — duration vs. the ability window

Verified against `EnemyUnits.js`'s `TitanEnemy.performGroundPound` directly,
not just the task's approximation: charge fires at t=0; impact (all three
waves, as layers) fires at t=500ms; the pound fully resolves and the Titan
resumes moving at t=1300ms. So: `quake-charge`'s window is ~500ms;
`quake-impact` has until ~1300ms (ideally with margin before the Titan can
act again).

`Earthquake_Spell.ogg` is 3.91s - roughly 3x the whole ability.
`EagleArtillery_Charge.ogg` is 3.06s - roughly 6x its 500ms window.

**Lever chosen: trim the files with ffmpeg, `durationScale` stays 1 for
both.** Read `AudioManager.playSample` before assuming `durationScale` was
the right tool: when `durationScale < 1` it doesn't cut the buffer cleanly -
`envelope.gain` ramps *continuously* from peak at t=0 to near-silence at the
computed end, across the ENTIRE truncated length (the branch built for
`hit`, which masks a hard cut at 35% of a ~70ms sound). Applied to a
1.2s-or-longer clip, that ramp is a fast, continuous fade dominating the
whole sound from the first frame - the opposite of "let the earthquake
rumble and then stop." `source.stop(end)` does genuinely stop the buffer at
the computed time regardless of `durationScale`, so length is capped either
way; the difference is only the fade shape, and the flat-then-brief-release
shape (`durationScale >= 1` branch) is the one that preserves the file's own
character. So: trim the source with ffmpeg, keep `durationScale: 1`, and let
`playSample`'s existing hold-then-release tail handle a clean stop.

- **`quake-impact.wav`**: trimmed from 3.91s to **1.2s** (`-t 1.2`), with a
  0.15s ffmpeg `afade=out` baked in to avoid a click at the cut. A
  0.3s-window loudness scan across the whole source (`-11 to -13dB mean, 0dB
  peak` throughout) showed the file is fairly uniform start to finish, not a
  single transient followed by decay - so trimming the head is as
  representative as any other window, and 1.2s comfortably precedes the
  1.3s point where the Titan resumes moving.
- **`quake-charge.wav`**: trimmed from 3.06s to **0.45s**, but from the
  *end*, not the start. A 0.5s-window scan showed a monotonic rise from
  -22dB mean near t=0 to -12.7dB mean near t=3.0s - a genuine building
  charge-up, so the head is quiet and the tail is where the tension reads.
  Took the last 0.45s (`-ss 2.61 -t 0.45`) so the wind-up plays the climactic
  part of the recording, with a 0.04s fade-in (cutting into the middle of an
  ongoing sound) and a 0.05s fade-out baked in via ffmpeg.
  - **Ffmpeg pitfall hit and worked around:** doing the trim and the fades
    in one pass (`-ss 2.61 -t 0.45 -af "afade=..."` on the original file)
    measured as **near-total silence** (mean/max -91dB) despite the plain
    trim alone measuring correctly (-12.6dB mean, -0.2dB max) - `afade`'s
    `st` parameter appears to read against the pre-seek timeline when `-ss`
    precedes it in a single pass, so a fade "starting" at 0 or 0.40 lands
    outside the already-elapsed seek window and the whole clip renders past
    the fade's endpoint (silence). Fixed by trimming to an intermediate file
    first (fresh PTS at 0), then applying the fades in a second pass on that
    intermediate. Confirmed by measuring both versions before shipping
    either.
- **`mortar.wav`**: no trim. `EagleArtillery_Fire.ogg` is 0.82s;
  `Mortar.fireRate` is 360 (several seconds between shots at normal frame
  rate), so the file finishes long before the next shot regardless.

## Format conversion

README (`Frontend/src/assets/audio/units/README.md`) requires `.wav` or
`.mp3` - Safari has gaps decoding `.ogg`. All three files were converted to
**`.wav`** (44.1kHz, stereo, `pcm_s16le`) via ffmpeg, matching the format the
README's own Kenney recommendation uses. `mortar.wav` is a straight
container/codec conversion with no other processing; `quake-impact.wav` and
`quake-charge.wav` combine the trim + fade described above with the same
format conversion in one pass.

## The other three files: recommendation, not wired

- **`EagleArtillery_Impact.ogg` (2.52s).** No existing sound key needs it,
  but there's a real gap it would suit: `Mortar`'s shell has a genuine
  travel/impact split in code already (`shellTravelTime`, `pendingShells`,
  `createExplosion` in `DefenderUnits.js`) and **the shell landing emits no
  feedback event at all** - only the launch (`projectile:fired`) makes a
  sound today. Wiring this would mean a new `emitFeedback` call at the
  landing site, a new sound key, and `FeedbackManager`/`SoundGroups`
  wiring - a real feature, not a file drop, so it's out of scope here and
  left as a recommendation.
- **`EagleArtillery_Activate.ogg` (2.69s).** Best candidate for a future
  `phase-change` sample: unlike the ground pound, the phase transition has
  no tight multi-wave schedule to fit inside (the visual shockwave timer is
  ~0.67s, but the stun effect it triggers lasts a full 5s), so a ~2.5s
  "activation" sound plausibly fits without trimming - unverified by ear.
  The `SAMPLE_VARIANTS.phase` entry added in this task is ready for it.
- **`EagleArtillery_Place.ogg` (1.08s).** The task's own instinct is right -
  this suits `defenderPlaced` - but `defenderPlaced` plays through
  `playSfx`, which has no sample-preferring path at all; only
  `playUnitVoice` checks `hasSample`/`playSample`. Extending it would mean
  giving `playSfx` (or the `defender:placed` handler specifically) the same
  `hasSample` branch `playUnitVoice` has, plus a `SAMPLE_VARIANTS`-equivalent
  transform for SFX ids, plus tests for that new branch - real, testable
  scope, not a file drop, so left unwired. Also worth noting for whoever
  picks this up: `defenderPlaced` fires on every placement (QUIET tier, 0.4)
  and is very likely much shorter than 1.08s in its synth form, so the file
  would probably need trimming too.

## Tests

**TDD evidence.**

RED (before any `UnitSamples.js` change):
```
$ npx vitest run ".../UnitSamples.test.js" ".../FeedbackManager.test.js"
 Test Files  2 failed (2)
      Tests  12 failed | 66 passed (78)
```
Failures were exactly the expected shape: `SAMPLE_VARIANTS.charge/impact/phase`
reading as `undefined`, and `FeedbackManager` calling `playSample` with
`SAMPLE_VARIANTS.fire`'s `{1,1,1}` object instead of the per-variant one.

GREEN (after adding the three `SAMPLE_VARIANTS` entries):
```
$ npx vitest run ".../UnitSamples.test.js" ".../FeedbackManager.test.js"
 Test Files  2 passed (2)
      Tests  78 passed (78)
```

Full suite:
```
$ npm test -- --run
 Test Files  43 passed (43)
      Tests  1298 passed (1298)
```
1282 (baseline at `703655a`) + 16 new tests (13 in `UnitSamples.test.js`, 3
in `FeedbackManager.test.js`), no regressions.

**What each new test rejects (selected):**

- `gives the impact a lower gainScale than fire...` - rejects leaving
  `impact.gainScale` at 1 (silently inheriting fire's identity transform,
  the exact bug this task fixes).
- `keeps the charge quieter than the impact...` - rejects making both
  equally loud, losing the wind-up-before-the-thing relationship.
- `does not truncate charge, impact or phase...` - rejects "fixing" length
  with `durationScale < 1` instead of trimming the file, which would apply
  the wrong (continuous, `hit`-style) fade shape to a >1s sound.
- `finds the branches this guard depends on...` - rejects a future edit to
  `soundKeyFor` that reformats its branches in a way the derivation regex
  stops matching (the guard silently going vacuous rather than failing).
- `%s has a SAMPLE_VARIANTS entry` (`it.each` over the derived set) -
  rejects a future variant added to `soundKeyFor` without a matching
  `SAMPLE_VARIANTS` entry - this is the guard for problem 1 specifically.
- `plays the %s sample with its own transform, not fire's`
  (`FeedbackManager.test.js`) - rejects `playUnitVoice` calling `playSample`
  with the right sound key but the wrong (fallback) transform object -
  exercises the full production wiring, not just the table in isolation.

**Mutation testing (two verified, both restored after):**

1. Removed the `SAMPLE_VARIANTS.impact` entry entirely. Result: 6 of 27
   tests in `UnitSamples.test.js` failed, including
   `every variant soundKeyFor special-cases has a sample transform > impact
   has a SAMPLE_VARIANTS entry` with message `SAMPLE_VARIANTS.impact is
   missing: expected { …(6) } to have property "impact"` - the new guard,
   confirmed to actually guard. Restored; full file back to 27/27.
2. Set `SAMPLE_VARIANTS.impact.gainScale` back to `1` (fire's value,
   i.e. "the loudness fix was never made"). Result: exactly 1 test failed -
   `gives the impact a lower gainScale than fire...` -
   `AssertionError: expected 1 to be less than 1` - every other test stayed
   green, confirming this is the one and only test protecting that specific
   decision. Restored; full file back to 27/27.

Full suite re-run after both restorations: **1298/1298 passing.**

## Files changed

- `Frontend/src/component/GameLogic (MVC)/Feedback/UnitSamples.js` - added
  `charge`/`impact`/`phase` to `SAMPLE_VARIANTS`, with the reasoning above
  written into the header comment.
- `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js` -
  new tests for the three variants' values, plus the derived guard.
- `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js` -
  new tests exercising the production `playSample` call for
  charge/impact/phase.
- `Frontend/src/assets/audio/units/mortar.wav`,
  `Frontend/src/assets/audio/units/quake-charge.wav`,
  `Frontend/src/assets/audio/units/quake-impact.wav` - the converted,
  trimmed samples.
- `Frontend/src/assets/audio/units/README.md` - ticked `mortar.wav`, added a
  "Titan ground pound" section ticking `quake-charge.wav`/`quake-impact.wav`
  and listing `phase-change.wav` as still outstanding, updated the 100% tier
  line to mention the three quake/phase keys.

**Not touched:** `GameLevelConfigs.js` - the owner's uncommitted playtest
hack, left exactly as found, not staged.

## Concerns for the owner

- **Every number above (trim points, gain reductions) is my best-effort
  reasoning from waveform measurements, not from listening.** The
  `quake-charge` trim point in particular is a guess about where "the
  climax" sits in a file I can't hear - it might need to move earlier or
  later once played back.
- `quake-impact.wav`'s fade-out necessarily softens whatever was happening
  in the source's final 150ms (a trade-off for a clean stop, not a lossless
  trim).
- If `phase-change` gets a sample later, `SAMPLE_VARIANTS.phase` is ready,
  but its `gainScale`/duration assumptions haven't been checked against any
  real file.
