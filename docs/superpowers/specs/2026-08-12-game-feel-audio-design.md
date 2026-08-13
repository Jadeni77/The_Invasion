# Game Feel, Audio, and UI Bug Fixes — Design

**Date:** 2026-08-12
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

The Invasion has no audio and no game feel. Three specific defects motivate this work:

1. **No audio exists.** There is no `Audio`, no `AudioContext`, and no sound file anywhere in the
   project.
2. **The settings panel is decorative.** `SettingModal.jsx` renders 11 controls. It writes them to
   `localStorage` under the key `gameSettings`, and nothing ever reads that key back. The three
   volume sliders adjust audio that does not exist. The "Screen Shake" toggle controls a feature
   that was never built.
3. **In-game text jumps sideways.** Reported as happening "when the sun energy is present."

There is also a latent canvas bug, found while diagnosing (3), that has not yet been reported as a
visible symptom but will eventually cause the same class of failure.

## Root cause analysis

### Bug A — top bar text shift (the reported bug)

This is HTML layout reflow, not a canvas problem.

- `.game-top-bar` is `display: flex` with `justify-content: space-between`
  (`Frontend/src/style/GameBoard.css:14-16`).
- Its three children — `.energy-container`, `.score-container`, `.base-health-container` — have no
  fixed width.
- `.energy-value` declares `min-width: 35px` with the comment `/* Reserve space for 3 digits */`
  (`GameBoard.css:50-51`). `min-width` is a floor, not a fixed width. In-game energy is clamped to
  **9999** (`GameEngine.js:182`), so a fourth digit overflows the reservation and the container
  grows.
- `.score-value` (`GameBoard.css:69`) has no `min-width` at all, and score increases without bound.
- `font-variant-numeric: tabular-nums` appears nowhere in the project. In a proportional font,
  digit glyphs have unequal widths, so `50 → 88` changes pixel width even at a constant digit
  count.

Under `justify-content: space-between`, any width change in one flex child repositions its
siblings. Collecting an energy orb changes the energy number, so the neighbouring text visibly
shifts — exactly the reported trigger.

### Bug B — canvas state leak (latent, found during diagnosis)

Across the draw modules there are **19** assignments of `ctx.textAlign = "center"` and **zero**
assignments returning it to `"left"` or `"start"`. The canvas 2D default is `"start"`.

Commit `6802da2` ("not shift text left when energy is generated") fixed exactly this class of bug by
wrapping `EnergyDrop.draw()` in `ctx.save()` / `ctx.restore()`. The sibling file was missed:
`CardPieceDrop.js:80` sets `ctx.textAlign = "center"` and the file contains no `save`/`restore` at
all. `DrawUIs.drawNormalWaveInfo` (`DrawUIs.js:151-155`) likewise sets `textAlign`, `textBaseline`,
and `fillStyle` unguarded.

Once an unguarded draw runs, every later `fillText` written to assume left alignment renders
centred on its x coordinate, which reads on screen as text jumping left. `textBaseline = "middle"`
leaks identically in the vertical axis.

This is a separate bug from A. It does not currently produce the reported symptom, because the
energy-drop path was already guarded and `drawUI` runs before the drops in `GameEngine.draw()`. It
is fixed here because it is the same hygiene failure and is cheap to eliminate permanently.

## Architecture

An event bus decouples the game engine from feedback. `GameEngine` emits semantic events and never
imports an audio or effects module. This keeps `GameEngine.js` (1300 lines) from growing, gives one
choke point for settings gating, and makes feedback testable without audio hardware.

New directory: `Frontend/src/component/GameLogic (MVC)/Feedback/`

| Module | Responsibility | Depends on |
|---|---|---|
| `FeedbackBus.js` | Pub/sub: `on` / `off` / `emit`. | nothing |
| `SfxLibrary.js` | Pure data: sound id → synth recipe. | nothing |
| `AudioManager.js` | Owns `AudioContext` and the gain graph. `playSfx(id)`. | `SfxLibrary` |
| `MusicPlayer.js` | Lookahead-scheduled chord loop. | `AudioManager` |
| `JuiceManager.js` | Shake, hit-stop, damage numbers, flash. | nothing |
| `FeedbackManager.js` | Maps events → audio + juice, gated by settings. | all above |
| `SettingsStore.js` | localStorage persistence, defaults, subscription. | nothing |

### Audio

All sound is synthesized at runtime with Web Audio. No audio files are added to the repository.

Graph: `sfxGain → masterGain → destination` and `musicGain → masterGain → destination`. The three
existing sliders map onto exactly these three gain nodes.

Volume uses a perceptual curve, `gain = (value / 100) ** 2`, not the raw linear slider value. A
linear mapping bunches all perceived loudness at the top of the slider's travel.

Music is a minimal scheduled chord progression. It will sound like chiptune ambience, not a
composed soundtrack. This is accepted so the Music Volume slider controls something real.

### Juice

Screen shake uses a trauma model: `addTrauma(n)`, with displacement proportional to `trauma²`
decaying at roughly 1.5 per second. Squaring keeps small hits subtle and makes large ones violent;
linear shake reads as uniform mush.

Shake is applied as a `ctx.translate` around **world** drawing only, inside a `save`/`restore`
pair, so the HUD does not move with it.

## Event catalog

| Event | Payload | Sound | Juice |
|---|---|---|---|
| `defender:placed` | type, row, col | soft thunk | — |
| `defender:died` | type, x, y | crumble | small shake |
| `projectile:fired` | defenderType | per-type pew | — |
| `enemy:hit` | damage, x, y | thud | damage number |
| `enemy:died` | type, x, y, isBoss | squelch / boss roar | shake, hit-stop if boss |
| `energy:collected` | amount | bright ping | — |
| `deploy:rejected` | reason | dull buzz | — |
| `base:damaged` | damage | alarm | strong shake, red flash |
| `wave:started` | number, isBoss | horn / boss sting | — |
| `level:won` | — | fanfare | — |
| `level:lost` | — | descending tone | — |

## Settings wiring

`SettingsStore` replaces the dead local state in `SettingModal.jsx`. Every control is either wired
to real behaviour or honestly disabled.

| Setting | Resolution |
|---|---|
| Master / Music / SFX volume | Wired to the three gain nodes |
| Screen shake | Wired to `JuiceManager` |
| Show damage numbers | Wired to `JuiceManager` |
| Show health bars | Wired to `DrawEntities` |
| Graphics quality | Particle-count multiplier: low 0.3, medium 1.0, high 1.5 |
| Auto-collect energy | Wired to `DropManager` |
| Confirm deployment | Wired to a deploy confirmation step |
| Show tutorial hints | **Disabled, "Coming Soon"** — no tutorial exists to hook it to |
| Auto-deploy defenders | Remains disabled, as it already is |

"Show tutorial hints" is deliberately disabled rather than wired. There is no tutorial system in the
codebase; leaving the toggle live would recreate the exact problem this work is fixing.

`Cancel` must revert to the last-applied snapshot. Today it appears to work only because the state
was local and discarded on unmount; with a persistent store, reverting becomes real behaviour that
must be implemented.

## Technical constraints

1. **Autoplay policy.** Browsers refuse to start an `AudioContext` without a user gesture. It is
   created suspended and `resume()`d on the first click, in the Lobby, before gameplay begins, so
   the first shot of a match is not silent.
2. **Hit-stop must not desynchronise wave timers.** Hit-stop freezes `update()` for a few frames.
   If `WaveManager` measures elapsed time with `Date.now()`, freezing updates while wall-clock time
   advances produces a catch-up burst of enemies on resume. Hit-stop is capped at 80ms, and the
   implementation must verify whether wave timing is frame-driven or wall-clock-driven before
   enabling it. If wall-clock, hit-stop must also offset the timer origin.
3. **Shake must not move the HUD.** See Architecture → Juice.

## Bug fixes

**Bug A.** Apply `font-variant-numeric: tabular-nums` to all numeric readouts in the top bar, and
give `.energy-value`, `.score-value`, and `.health-value` explicit widths sized for their maximum
digit count (energy is capped at 9999, so four digits). This addresses both the digit-count jump and
the proportional-digit jump.

**Bug B.** Wrap every `draw*` method in `save`/`restore`, starting with the unguarded
`CardPieceDrop.draw` and `DrawUIs.drawNormalWaveInfo`. Enforced by regression test.

## Testing

Add `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` to `devDependencies`, and
configure vitest with the jsdom environment. The project currently has vitest but no component
testing capability.

| Target | Coverage |
|---|---|
| `FeedbackBus` | on/emit/off, multiple subscribers, unsubscribe during emit |
| `SfxLibrary` | Every id yields a valid recipe; durations bounded; no `NaN` |
| `AudioManager` | Mocked `AudioContext`: graph wiring, volume curve, silence at 0, resume-on-gesture |
| `MusicPlayer` | Fake timers: scheduler advances, loop wraps, respects `musicGain` |
| `JuiceManager` | Trauma decays to 0, offset bounded, shake suppressed when disabled, hit-stop expires, damage numbers expire |
| `FeedbackManager` | Event → correct sound + juice; settings gating |
| `SettingsStore` | Defaults, persistence, missing keys, corrupt JSON |
| Canvas state (Bug B) | Proxy `ctx` recording property writes; assert `textAlign`, `textBaseline`, `fillStyle` unchanged after every `draw*` |

The canvas regression test is the one that would have caught the `CardPieceDrop` leak.

### Known verification limit

jsdom has no layout engine — `offsetWidth` is always `0`. A test that genuinely proves "the text did
not shift" is **not possible** in jsdom. The Bug A test asserts only that `tabular-nums` and the
fixed widths are applied. That is a proxy for the fix, not proof of it. Visual confirmation in the
running game is required, and is an accepted, deliberate limitation rather than an oversight. Real
proof would require a browser-driven test such as Playwright, which was considered and declined to
avoid adding a browser-test toolchain.

## Out of scope

Deferred to their own spec → plan → implementation cycles:

- **UI visual system.** 112 distinct hex colours across the CSS with no design tokens.
  `Lobby.css` is 1075 lines, `GameBoard.css` 862.
- **UX clarity and onboarding.** No tutorial exists; the "tutorial zone" is only a label on levels
  1–3 in `MapLayout.jsx:6`.
- **Accessibility and keyboard support.** No `aria-*`, no `role=`, and no key handlers exist
  anywhere in the JSX. The game is mouse-only.
- **Canvas background art.** Sky, grass, and road are three solid `fillRect` calls in
  `DrawUIs.js:19-40`.

## Success criteria

1. Collecting energy, gaining score, and taking base damage never reposition adjacent top-bar text.
2. No `draw*` method leaks canvas state; the regression test proves it.
3. Every gameplay event in the catalog produces audible feedback.
4. Every control in the settings panel either changes real behaviour or is visibly disabled.
5. Settings persist across reloads; `Cancel` reverts.
6. The full test suite passes.
