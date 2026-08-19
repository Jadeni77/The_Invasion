# Visual Direction — Design

**Date:** 2026-08-15
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

The game has no visual identity. Three idioms coexist across the interface:

- navy and gold fantasy — `#0f3460`, `#ffd700`
- Flat-UI defaults — `#e74c3c`, `#3498db`, `#f39c12`, `#27ae60`
- parchment and brown — `#8b6f4b`, `#d4c0a1`

They are spread over **162 distinct colour literals in 10 stylesheets, with zero CSS variables**. Nothing
holds them in agreement, so each screen drifted on its own.

This is the same failure the audio had, in a different medium. "The sounds don't sound like a game,
but rather all kind of different sound merge into the game" was diagnosed as an absent shared
identity, and the fix was to settle one and enforce it. The interface needs the same treatment, in
the same order: decide the identity, put it in a token layer, then apply it.

Two smaller faults compound it:

- **The game has no typography at all.** `font-family: "Pixel"` appears twice in `Lobby.css`, but there
  is no font file in the repository, no `@font-face` rule and no CDN import. It has silently fallen
  back to sans-serif. `GameBoard.css` asks for Arial. Nothing else sets a family.
- **Pixel art renders at fractional scale.** Confirmed by inspection: the sprites are pixel art, so
  `imageSmoothingEnabled = false` is correct. But cells are any integer from 40 to 80 while the art is
  48px, so the ratio is almost never whole and pixel rows come out uneven.

## Identity: cartoon-military

Chunky stylised militarism — sandbags, crates, riveted metal, stencilled lettering, warm earth tones
carrying bold accent colours. Readable and playful in the way Plants vs. Zombies is, without being a
garden.

This settles a tension the audio spec recorded and deliberately deferred to this work: the defenders
are named Sniper, Mortar, Grenadier, Barricade and E-Gen, which pulls against a whimsical direction.
Cartoon-military resolves it without renaming anything — a decision that would otherwise reach card
data, save files and the backend. The undead roster then reads as the threat pressing against a warm,
solid, defensible base.

## Token layer

A single `tokens.css` holds every visual constant as a CSS custom property, and all ten stylesheets
consume it.

**This is the load-bearing part of the spec.** Without it, "restyle" means editing 162 literals by
hand, and the drift returns as soon as the next screen is written. The tokens are what make the
identity enforceable rather than aspirational.

Token groups, each with semantic names rather than literal ones (`--surface-raised`, not `--tan-2`):

| Group | Covers |
|---|---|
| Palette | Surfaces, text, borders, and the semantic accents: energy, danger, success, warning |
| Spacing | One scale, used for padding, gaps and margins |
| Radii | Corner rounding, including the pill and the panel |
| Borders | Widths, including the thick cartoon outline |
| Shadows | Drop shadow, inner shadow, and the pressed state |
| Type | Family, weights, sizes, line heights, letter spacing |

### Starting palette

Concrete values so implementation is unambiguous. They are a starting point to tune by eye — colour
judgements cannot be verified without looking at them.

| Token | Value | Role |
|---|---|---|
| `--surface-base` | `#2f2a1d` | Deepest background |
| `--surface-panel` | `#4a4231` | Panels, modals |
| `--surface-raised` | `#6b5c40` | Buttons, cards at rest |
| `--surface-sunken` | `#241f16` | Wells, slots, disabled |
| `--edge-outline` | `#1a160f` | The thick cartoon outline |
| `--edge-highlight` | `#a8906a` | Top bevel |
| `--text-primary` | `#f5ecd8` | Body text |
| `--text-muted` | `#b8a888` | Secondary text |
| `--accent-energy` | `#ffd700` | Energy, currency, stars |
| `--accent-danger` | `#d94f3d` | Damage, loss, rejection |
| `--accent-success` | `#5fa855` | Confirmation, rewards |
| `--accent-info` | `#4a9cc4` | Frost, information |

`--accent-energy` keeps the existing `#ffd700`, which is already the most-used accent in the codebase
and is the one colour with an established meaning.

### The canvas is the other half, and it cannot read CSS variables

The battlefield is drawn on a canvas from JavaScript. Lane bands, the base, explosion effects, grid
highlights and damage numbers all take their colours from string literals in `.js` files —
`"brown"`, `"darkgoldenrod"`, `"#FF4444"` — and `ctx.fillStyle` cannot resolve `var(--surface-panel)`.
There are **53 literal `fillStyle` assignments** in the game logic today, against 162 colour literals
in CSS. The canvas is not a rounding error; it is a quarter of the problem.

So a CSS-only token layer would leave half the game's colour outside it, and the two halves would
drift apart exactly the way the ten stylesheets already have. **This spec is not worth doing if the
canvas is excluded.**

The tokens are therefore defined once in JavaScript and generated into CSS at build time, rather than
authored in CSS and mirrored by hand. A hand-kept mirror is two sources that must agree, which is this
codebase's most repeated defect — the two `calculateStars` implementations, the duplicated
`SOUND_KEYS` array, `AnimationSources` and `AnimationManager` keying differently. One source, two
consumers.

### Enforcement

Two tests, both deriving their file lists from the directory rather than a hand-written array, so a
newly added file cannot slip past:

- **No stylesheet outside the generated token sheet contains a raw colour literal** — no hex, `rgb()`,
  `rgba()` or named colour.
- **No canvas drawing code assigns a colour literal** to `fillStyle`, `strokeStyle` or `shadowColor`;
  it must come from the token module.

This is the same reasoning as the audio floor test forbidding a recipe below 200 Hz. A convention
nothing enforces is a convention that decays, and this project has already watched that happen twice.

## Structural metaphor, in this game's terms

The owner's direction was to adopt Plants vs. Zombies' structural *metaphors* without copying its
structure. So the ideas are rendered in this game's own vocabulary:

| The PvZ idea | Here |
|---|---|
| Lawn stripes marking lanes | Alternating lane bands across the battlefield, drawn as canvas fills |
| A house you are defending | The base given real visual weight at the left edge, rather than an implied boundary |
| Seed packets as physical objects | Cards framed as supply crates with stencilled labels; cooldown as a visible sweep over the card |

Every one is achievable in code. Nothing here waits on art assets.

The lane bands matter beyond decoration: the game is played on a grid, and today the grid is only
visible when highlighted. Permanent, low-contrast lane banding tells the player where a unit can go
and which row an enemy is walking down, which is information the current board withholds.

## Typography

**Display face:** Black Ops One, self-hosted as woff2. A military stencil face, chunky enough to carry
the cartoon direction, and SIL Open Font Licensed. Used for headings, the HUD readouts, numbers and
button labels — roughly 30KB for the single weight it ships.

**Body text:** the system sans stack. No download, renders natively on every platform, and body copy
is not where the identity lives.

Self-hosted rather than loaded from a CDN, so the game keeps working offline and does not depend on a
third party staying up.

`font-variant-numeric: tabular-nums` is preserved wherever it is already applied. It was added to stop
the top bar shifting as values change width, and a font change is exactly the sort of edit that would
silently undo it.

## Sprite scaling

One defender sheet was opened and inspected directly (`basic-defender-idle.png`): it is pixel art.
`imageSmoothingEnabled = false` is therefore right for it, and smoothing is not the answer — it would
blur what is meant to be crisp. **Only that one sheet was checked**, so the implementation must confirm
the enemy art is pixel art too before applying the same rule to it; if any sheet turns out to be a
smooth illustration, it wants the opposite treatment and should be reported rather than forced.

`AssetManifest` already crops **48×48** out of each 64px frame via `cropConfig`, so the real art is
48px. `GridManager` computes `gridSize` as
`min(floor(availableWidth / cols), floor(availableHeight / rows), 80)`, clamped up to 40 — any integer
from 40 to 80. The ratio `gridSize / 48` is therefore almost never whole.

**Fix:** render sprites at integer scale only — 1×, i.e. their native 48px — centred within the cell,
and raise the minimum cell size from 40 to 48.

- Above 48px cells, the sprite sits at 1× with padding, crisp at every window size.
- The minimum rises to 48 so a sprite can never overflow its own cell.

The cost is a little responsive range: on very small viewports the grid reaches its minimum sooner
than today. The owner accepted this trade explicitly.

**The implementation must check whether enemy entries also carry `cropConfig`.** It was observed on
defender entries; whether the enemy half of the manifest crops has not been verified, and enemy frames
are not uniformly 64px — Basic Zombie's attack sheet is 80×64. Each side's real art size must be
established from the manifest rather than assumed.

## Also in scope

- **A settings button in the lobby.** One already exists in the game top bar; the lobby has none, and
  now that there is audio to configure it needs one.
- **Stars styled on the results screen and level select.** Both already render — `Lobby.jsx` draws a
  five-star row per level and `GameBoard.jsx` shows a star count on results. They need the new
  treatment, not new behaviour.

## Out of scope

- **Unlock flows** — the two `MapLayout` TODOs for chest and level-completion unlocks. Feature work
  with its own design questions; separate spec.
- **Renaming any unit.** Cartoon-military is chosen partly so that renaming is unnecessary.
- **Anything requiring art assets the owner would have to source or commission.**
- **The star rating's meaning.** Stars are computed, stored and displayed already. Whether earning them
  should reward more is a game-design question, not a visual one.

## Testing

**jsdom has no layout engine**, so CSS cannot be verified automatically. This is the same limit that
applied to the results-screen overflow fix, and it is stated here so the plan does not pretend
otherwise. Appearance is confirmed by the owner looking at it.

What is mechanically testable, and will be tested:

| Test | Asserts |
|---|---|
| Token coverage, CSS | No stylesheet outside the generated token sheet contains a raw colour literal; file list derived from the directory |
| Token coverage, canvas | No drawing code assigns a colour literal to `fillStyle`, `strokeStyle` or `shadowColor` |
| Token completeness | Every custom property referenced by a stylesheet is defined in the token source |
| One source of truth | The generated CSS token sheet matches the JavaScript token module — it fails if the sheet is edited by hand or regeneration is skipped |
| Font availability | The declared display family has a matching `@font-face` and the file exists — the bug that made "Pixel" silently do nothing |
| Integer sprite scale | For every cell size `GridManager` can produce, the sprite scale is a whole number |
| Minimum cell size | `GridManager` never returns a cell smaller than the sprite's native size |
| Tabular numerals preserved | The elements that carry `tabular-nums` today still carry it |

## Success criteria

1. Every screen reads as one game rather than three.
2. No stylesheet outside `tokens.css` contains a raw colour literal.
3. The game has a real display font, and it is actually loaded.
4. Pixel art is crisp at every window size the game supports.
5. Lane bands make the grid legible without needing to be highlighted.
6. The base reads as a place being defended.
7. Cards read as physical objects, with cooldown visible on the card.
8. The lobby has a settings button.
9. The full test suite passes.
