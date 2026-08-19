# Sampled Audio with Synthesis Fallback — Design

**Date:** 2026-08-14
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

The per-unit audio system on `feature/per-unit-audio` (PR #5) gives all 29 units distinct synthesized
voices. Two problems remain after listening to it.

### The synthesis has a quality ceiling

Every sound is a single oscillator with a linear frequency slide and an exponential gain fade, or a
burst of bandpass-filtered noise. Real game sound effects are layered: a gunshot is a click transient,
plus a body, plus a tail, each with its own pitch and filter envelope. One layer and one envelope
cannot sound like that no matter how the numbers are tuned.

Synthesis was the right call when the alternative was no audio at all. It is the wrong call for "29
units that each sound good."

### Some units are still silent

- **Spells make no sound when they detonate.** `FireBlast` and `IceBomb` contain no `emitFeedback`
  calls at all, so casting one produces only the shared placement sound. Their voices exist in the
  table and are unreachable.
- **`enemy:hit` has a single emit site** — the plain-projectile branch. Sniper (direct damage), Mortar
  (splash), GrenadeDefender (explosion) and FrostArcher (`onHit` callback) all land hits silently.
  Only `BasicDefender` produces hit sounds.

## Division of labour

The project owner supplies the audio files. This is deliberate: choosing samples that *sound good* is
the one step that requires hearing them, and the implementer cannot. Kenney's CC0 packs (Impact Sounds,
Digital Audio) are a good fit and take minutes to download.

Everything downstream — discovery, loading, mapping, variants, fallback, tests — is built here.

CC0 also keeps this clear of the asset-licensing exposure recorded against the sprite assets.

## Design

### Discovery by convention

Files live at `Frontend/src/assets/audio/units/<ClassName>.<ext>`, where `<ClassName>` is the unit's
class name — the same key the existing voice table uses.

A new module `Feedback/UnitSamples.js` discovers them at build time:

```js
const modules = import.meta.glob('/src/assets/audio/units/*.{ogg,wav,mp3}', {
  eager: true, query: '?url', import: 'default',
});
```

It maps each file's basename (without extension) to its hashed URL. Dropping a file into that folder
makes it available with no code change.

**The basename extraction is a separate pure function** so it can be unit-tested; `import.meta.glob`
itself resolves at build time and cannot be exercised from a test.

### Loading

`AudioManager` gains `loadSamples(urlMap)`: for each entry, fetch the URL, `decodeAudioData` the
response, and cache the resulting `AudioBuffer` in a `Map` keyed by name.

Called once from `GameContext`, on the same first-click gesture that resumes the `AudioContext`.

**Each file's failure is isolated.** A fetch or decode error is caught per file and logged; that unit
falls back to synthesis and every other file still loads. One bad download must not silence the game.

### Playback

`AudioManager.playSample(name, transform, dedupeKey)` mirrors `playRecipe`: it reuses the same envelope
shape, the same `sfxGain` bus, the same 40ms dedupe window and the same 12-voice cap. Only the source
node differs — an `AudioBufferSourceNode` instead of an oscillator or noise buffer.

Variants become buffer transforms rather than recipe scalings:

| Variant | Transform | Rationale |
|---|---|---|
| `fire` | as recorded | the sample is the signature |
| `hit` | `gain × 0.55`, stopped at 35% of the buffer's duration | a hit is a clipped, quieter version of the unit's sound |
| `death` | `playbackRate 0.75` | pitches down and lengthens in one operation — the natural analogue of the synth `death` variant's freq × 0.5 and duration × 2.5 |

Truncation is achieved by calling `stop()` at `now + buffer.duration × 0.35`, with the gain envelope's
fade targeting that same time so the cut is not an audible click. `death`'s effective duration is
`buffer.duration / 0.75`, and the envelope must use that value rather than the raw buffer duration or
the sound will be cut off early.

### Unrecognised filenames must be visible

A file named for something that is not a unit class — a typo, or `Zombie.ogg` when the class is
`BasicEnemy` — would load successfully and then never play, silently. On load, any sample name that does
not match a key in the voice table is logged as a warning naming the file. A misnamed file is then a
visible mistake rather than a sound that mysteriously never happens.

### Where the fallback decision lives

**In `FeedbackManager`, not `AudioManager`.** The manager calls `audio.hasSample(unitName)` — a plain
string lookup, so `AudioManager` still holds no knowledge of units — and routes to either
`playSample` or `playRecipe(resolveVoice(...))`.

This preserves the separation established on the previous branch, and it is what makes incremental
adoption work: every unit makes a sound from the first commit, and each file added takes over for that
unit silently.

The existing synthesized voice table is **kept, not deleted.** It is the fallback.

### The two silent-unit fixes

- `FireBlast.activate()` and `IceBomb.activate()` emit `projectile:fired` with their class name at the
  moment of detonation, reaching their existing voices.
- `enemy:hit` gains emits so that Sniper (direct damage in its `attack()`), Mortar (splash), and
  GrenadeDefender (explosion) hits are audible, alongside FrostArcher's `onHit` callback. The
  implementation must locate each unit's real damage-application point rather than assuming a shared
  path — the previous branch established that these four defenders attack through four different
  mechanisms.

The 40ms dedupe window means a splash hitting six enemies of the same type still produces one hit
sound rather than six stacked — the same protection that already applies to deaths.

### The filename checklist

`Frontend/src/assets/audio/units/README.md` lists all 29 expected filenames, grouped into defenders
and enemies, noting that any missing file falls back to synthesis. This is the working checklist for
adding files.

## Testing

| Test | Asserts |
|---|---|
| Basename mapping | A glob path maps to the bare class name, for each supported extension |
| `hasSample` | False before loading, true after a successful load, false for an unknown name |
| Load isolation | One file failing to fetch or decode leaves the others loaded |
| Fallback routing | A unit with no sample plays its synthesized recipe; a unit with a sample plays the buffer |
| Variant transforms | `death` sets `playbackRate` 0.75; `hit` reduces gain and truncates; `fire` is untransformed |
| Dedupe and cap apply to samples | The same sample key twice inside 40ms plays once; the cap still stops the oldest |
| Spell detonation emits | `FireBlast.activate()` and `IceBomb.activate()` each emit `projectile:fired` with their class name |
| New hit emits | Splash and direct-damage paths emit `enemy:hit` carrying the enemy's `unitType` |
| Existing voices unaffected | Every unit still produces a sound with zero sample files present |

The **fallback-routing test is load-bearing.** Without it, a mistake in the `hasSample` branch could
route every unit down one path — either ignoring supplied samples entirely, or silencing every unit
that lacks one. Both would be invisible to the other tests.

The **"existing voices unaffected with zero files" test** is what guarantees the branch can merge before
any audio file exists.

## Out of scope

- **Music.** The synthesized chord bed is unchanged. Replacing it with a supplied track needs
  loop-point handling to avoid an audible seam, and belongs in its own spec.
- Sourcing or selecting the audio files.
- The remaining items in known-issues #12: `BossEnemy` being unimported dead code, and Mortar's firing
  sound not being frame-synced with its shell's visual launch.
- Rebalancing, recorded as known-issue #10.

## Success criteria

1. Dropping `<ClassName>.ogg` into the units folder makes that unit play the sample, with no code change.
2. A unit with no sample file still plays its synthesized voice.
3. With zero sample files present, the game sounds exactly as it does today.
4. One corrupt or missing file does not prevent other samples from loading.
5. Samples obey the same dedupe window and voice cap as synthesized sounds.
6. Casting a Fire Blast or Ice Bomb produces a sound.
7. Sniper, Mortar, GrenadeDefender and FrostArcher hits produce a sound.
8. The full test suite passes.
