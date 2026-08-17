# Hammer and quake sounds — implementation report

Branch: `feat/hammer-and-quake-sounds` (from `develop` at `43f6730`)
Date: 2026-08-17

## Status

DONE.

## Summary

1. **Removing a defender now makes a sound.** `GameEngine.removeDefenderAt`
   emits `defender:removed` exactly once, only on the branch where a live
   defender was actually found and spliced out of `this.defenders`. A click
   on empty ground, and a click on an already-dead defender, take neither
   branch and stay silent.
2. `FeedbackManager` routes `defender:removed` to a new `defenderRemoved`
   SFX entry through `playSfx` — a game event, like `defenderPlaced`, not a
   unit voice, because the removal is the player's action, not the unit's.
   Tier: **MID** (0.7), heavier than `defenderPlaced`'s QUIET (0.4) — placing
   happens constantly during setup and should stay in the background;
   removing is a deliberate, consequential choice and is authored to feel
   like one.
3. `quake-impact` (the Titan's ground-pound impact) is rebuilt around the
   owner's Clash-of-Clans brief without violating the 200 Hz floor: it leads
   with a stone-crack transient, carries a new amplitude-modulated mid-band
   "rumble" layer for the low-thud impression, keeps its one pitched falling
   body (the Mortar's lesson — a noise-only slam is a hiss), and adds a
   debris tail that outlasts every other layer. `quake-charge` (the wind-up)
   is untouched and pinned by a regression test.
4. `AudioManager` gained a real primitive to support that: layers may now
   declare `modulationHz`/`modulationDepth`, rendered by
   `scheduleModulatedEnvelope` as a repeated ramp pattern (alternating
   `setValueAtTime`/`exponentialRampToValueAtTime` targets), because the
   engine had no way to express a gain that rises and falls more than once
   per layer. `UnitVoices.scaleRecipe` was extended to carry those two
   fields through `resolveVoice` unscaled, the same way it already carries
   `layers` through — without that, the field would have been silently
   dropped the moment any layered voice was resolved for playback.

## Where the removal sound is emitted, and why there

`GameBoard.jsx:267` (`removeDefender(x, y)`) → `GameContext.jsx:872`
(`removeDefender`, a thin `gameState === 'inGame'` gate) →
`GameEngine.js:567` (`removeDefenderAt`), which is the only place that knows
whether a defender was *actually* removed — it owns the hit-test, the
alive-check, and the `defenders.splice`. Emitting anywhere upstream would
mean re-deriving "was something removed" from the boolean return value, which
is exactly the kind of duplicate logic that drifts. The call sits at
`GameEngine.js:604`, immediately after the splice and before `return true`:

```js
this.defenders.splice(i, 1);
console.log(`Removed defender: ${defender.name}`);
this.emitFeedback('defender:removed', { type: defender.constructor.name });
return true;
```

The dead-defender branch (`if (!defender.isAlive) return;`) and the
fall-through `return false` at the end of the loop both reach no emit call at
all.

**Tier:** MID (0.7), via `MIX_TIERS.defenderRemoved` in `SoundGroups.js`.
Justification: the owner said "probably not the quiet tier" because removal
is a deliberate, considered act (giving up a placed defender), unlike
placement (frequent, low-stakes, background) which stays QUIET. MID puts it
beside the other single-action sounds (artillery, magic, melee, the death
family) without competing with `baseDamaged`, `boss`, or a Titan ability at
LOUD.

**Character:** a two-layer recipe — a dull, falling wood knock (triangle,
360→215 Hz, 0.10s, gain 0.5) with a brief bright metal clink 15ms later
(noise, bandpass 1800→650 Hz, 0.05s, gain 0.30). Short and dry throughout;
nothing rings or decays slowly, because this is a removal, not a death.

## The rebuilt quake-impact — full layer table

All six layers below share `wave: 'sawtooth'` (irrelevant for the five
`noise: true` layers, which render as bandpassed noise instead of a tone).

| Layer | Role | Noise | Sweep (Hz) | Duration | Gain | Offset | Modulation |
|---|---|---|---|---|---|---|---|
| crack | stone shatter, leads | yes | 3400 → 1000 | 0.07s | 0.60 | 0 | — |
| body | the one pitched layer | no | 420 → **260** | 0.38s | 0.58 | 0.015s | — |
| rumble | low-thud impression | yes | 310 → **260** | 0.45s | 0.50 | 0.020s | 5 Hz, depth 0.65 |
| debris | aftermath scatter, outlasts all | yes | 520 → 270 | 0.60s | 0.16 | 0.050s | — |
| echo 2 (wave 2) | crack's echo, at the 2nd ground-pound wave | yes | 1000 → 400 | 0.22s | 0.30 | 0.200s | — |
| echo 3 (wave 3) | crack's echo again, 3rd wave | yes | 800 → 320 | 0.20s | 0.18 | 0.400s | — |

**Lowest authored frequency: 260 Hz** (both the body's and the rumble's
`freqEnd`) — 60 Hz clear of the literal 200 Hz guard, and it also clears that
same guard applied *after* the death variant's 0.8 pitch-scale
(260 × 0.8 = 208 ≥ 200), which `UnitVoices.test.js` checks for every layered
voice in the table regardless of whether production ever actually resolves
this sound through that variant (it doesn't — `resolveVoice` falls back to
identity scaling for `'impact'`). Span: 0.65s (the debris layer ends last),
inside the 2s `MAX_DURATION` ceiling. `quake-charge` is unchanged — pinned by
a new regression test against its exact prior recipe.

The 5 Hz modulation rate on the rumble layer was chosen to coincide with the
200ms gap between the three ground-pound waves (1/5 Hz = 200ms), so the
pulsing echoes the attack's own rhythm rather than fighting it.

## Can the engine express amplitude modulation? Yes, after a small addition — here's what it took

Before this change, `AudioManager.startLayer` built exactly one envelope
shape per layer: `setValueAtTime(peak, start)` then a single
`exponentialRampToValueAtTime(0.0001, end)`. There was no LFO node, no
periodic-modulation primitive, and no way for a layer's gain to rise and fall
more than once — a static decay was the only shape available, so a "rumbling"
mid-band layer without modification would have been a real bass problem
wearing a mid-band frequency, i.e. exactly the static layer the task warned
against faking.

What it took: `scheduleModulatedEnvelope(gainParam, peak, start, end, hz,
depth)`, added to `AudioManager.js`. It schedules the same two primitives
repeatedly — alternating the target between `peak` and a quieter `trough`
every half period (`1/(2*hz)`), closing with the existing fade-to-floor — so
a layer whose recipe declares `modulationHz` gets a pulsing envelope instead
of a single decay. This is opt-in per layer (`if (layer.modulationHz)`), so
every one of the 20-odd existing recipes renders exactly as before. If a
future sound needed a smoother (non-exponential-segment) modulation shape, an
actual LFO node — a second oscillator at `hz`, scaled and connected into
`envelope.gain` — would be the next step; nothing here needed it yet.

## I cannot hear any of this

Every level, tier, and frequency choice above is reasoned from the synthesis
parameters and the existing guard tests (the 200 Hz floor, the noise/tone
gain-parity model, the relative gains within each recipe) — not from
listening, which I have no way to do. The rumble's modulation depth (0.65),
its rate (5 Hz), and its balance against the crack/body/debris are informed
guesses that need the owner's ears before they're treated as final.

## TDD evidence

### RED (representative excerpts)

`removeDefenderAt` before the fix — clicking on a defender emitted nothing:

```
FeedbackManager > plays the removal sound when a defender is removed
AssertionError: expected "vi.fn()" to be called with arguments: [ 'defenderRemoved', 0.7 ]
Number of calls: 0

SfxLibrary > defines every sound the event catalog requires
AssertionError: missing sound: defenderRemoved
```

The rebuilt quake-impact, before authoring the rumble layer:

```
the ground pound rebuilt > carries a mid-band rumble layer whose GAIN is modulated, not a static low band
AssertionError: no amplitude-modulated layer found: expected undefined to be defined

resolveVoice carries amplitude modulation through > keeps modulationHz and modulationDepth on a layer that declares them
AssertionError: expected undefined to be 5
```

The AM primitive, before `scheduleModulatedEnvelope` existed:

```
amplitude-modulated layers (rumble) > schedules more than one ramp for a modulated layer, not the single decay a static layer gets
AssertionError: expected 1 to be greater than 2
```

### GREEN

`npx vitest run` after implementation: **1282 passed (1282)**, 43 files,
output pristine.

## Mutation testing (two verified, both restored)

**1. Removal sound firing on a click that removes nothing (Task 1's named
requirement).** Temporarily moved the `emitFeedback('defender:removed', ...)`
call to the top of `removeDefenderAt`, before the hit-test, so it fired on
every call regardless of outcome. Ran `GameEngine.test.js`:

```
GameEngine.removeDefenderAt > does not emit when the click lands on empty ground
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
GameEngine.removeDefenderAt > does not emit when the click lands on an already-dead defender
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
GameEngine.removeDefenderAt > frees the grid cell and still emits together, not one without the other
AssertionError: expected "vi.fn()" to be called once, but got 2 times
3 failed | 17 passed (20)
```

Restored the guarded call; re-ran — 20/20 passing again.

**2. A static layer faking the quake-impact rumble.** Temporarily deleted
`modulationHz`/`modulationDepth` from the rumble layer in `UnitVoices.js`
(leaving its frequencies and gain untouched — exactly "a static layer faking
the effect"). Ran `UnitVoices.test.js`:

```
the ground pound rebuilt > carries a mid-band rumble layer whose GAIN is modulated, not a static low band
AssertionError: no amplitude-modulated layer found: expected undefined to be defined
resolveVoice carries amplitude modulation through > carries the real quake-impact rumble layer's modulation through resolveVoice
AssertionError: expected undefined to be defined
2 failed | 151 passed (153)
```

Restored the fields; re-ran — 153/153 passing again, and the full suite back
to 1282/1282.

## Test summary

`cd Frontend && npx vitest run` — **1282 passed (1282)**, 43 files, output
pristine. Baseline at `43f6730` was 1248 passed; +34 net. That figure is
larger than the number of hand-written `it(...)` blocks alone (roughly 21:
4 in `GameEngine.test.js`, 2 in `FeedbackManager.test.js`, 1 in
`SoundGroups.test.js`, 6 in `AudioManager.test.js`, 8 in `UnitVoices.test.js`)
because several existing checks in `AudioManager.test.js` and
`UnitVoices.test.js` are `it.each` loops derived from the recipe tables
themselves (e.g. "authored above the laptop speaker floor", "lands where its
authored gain says it should") — adding layers to `quake-impact` and a new
`defenderRemoved` recipe grows those loops' row counts automatically, which
is the whole point of deriving them rather than hand-listing cases. A
handful of existing `UnitVoices.test.js`/`SfxLibrary.test.js` assertions were
also updated in place — the layer-count literal and its comment, two
layered-recipe-name lists, and one index-based assertion rewritten to find
the body layer by shape instead of position — each documented at the point
of change.

`cd Frontend && npm run lint` — clean, no output, across every file touched.

## Files changed

- `Frontend/src/component/GameLogic (MVC)/GameEngine.js` — emit
  `defender:removed` in `removeDefenderAt`.
- `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js` —
  route `defender:removed` to `playSfx`.
- `Frontend/src/component/GameLogic (MVC)/Feedback/SfxLibrary.js` — new
  `defenderRemoved` recipe.
- `Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js` — new
  `defenderRemoved` MIX_TIERS entry.
- `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js` —
  rebuilt `quake-impact`; `scaleRecipe` carries `modulationHz`/
  `modulationDepth` through.
- `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js` — new
  `scheduleModulatedEnvelope` and `DEFAULT_MODULATION_DEPTH`; `startLayer`
  branches on `layer.modulationHz`.
- Tests updated/added in: `__tests__/GameEngine.test.js`,
  `Feedback/__tests__/{AudioManager,FeedbackManager,SfxLibrary,SoundGroups,
  UnitVoices}.test.js`.
- Untouched, as instructed: `GameEngineBreakDown/GameLevelConfigs.js`
  (pre-existing uncommitted playtest hack — not staged, not reverted).

## Concerns

- All character and level judgments above (the AM depth/rate, the
  crack/body/rumble/debris balance, the wood/metal balance on the hammer
  sound) are reasoned from synthesis math, not from listening. They should
  be treated as a first pass pending the owner's ears.
- The `modulationHz`/`modulationDepth` mechanism is new and used by exactly
  one layer so far. It is opt-in and covered directly, but it is a small
  addition to a heavily-tested core file (`AudioManager.js`) and is worth a
  second look if more sounds start leaning on it.
