# Per-Unit Audio Voices — Design

**Date:** 2026-08-13
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

The audio layer merged in PR #3 gives the game 13 shared sound effects keyed by *event*: every defender
fires with the same `projectileFired` blip, every enemy dies with the same `enemyDied` squelch. A
player cannot tell a Sniper from a Mortar, or a Titan's death from a Basic Enemy's, without looking.

Two events already carry the information needed to fix this and their handlers discard it:

| Event | Payload today | Carries unit identity? |
|---|---|---|
| `defender:placed` | `{ type }` | Yes — ignored |
| `projectile:fired` | `{ defenderType }` | Yes — ignored |
| `enemy:hit` | `{ damage, x, y }` | No |
| `enemy:died` | `{ isBoss, x, y }` | No |
| `defender:died` | `{ x, y }` | No |

The roster is **29 units**: 10 defenders and 19 enemies, excluding the two base classes.

## Design

### One signature per unit

A new module `Feedback/UnitVoices.js` maps unit class name to a single characteristic recipe — that
unit's *voice* — using the existing `SfxLibrary` recipe shape (`wave`, `freqStart`, `freqEnd`,
`duration`, `gain`, `noise`).

Voices are hand-tuned so each unit's character reads: a Sniper is a sharp high crack, a Mortar a low
heavy thump, a FrostArcher a bright shimmer, a TitanEnemy a deep groan.

The keys are class names, matching what the emit sites already send (`this.constructor.name`).

### Variants derive rather than being authored

A unit's other sounds are produced by transforming its signature, not by authoring separate recipes:

| Variant | Derivation | Used by |
|---|---|---|
| `fire` | the signature unchanged | `projectile:fired` |
| `hit` | `duration × 0.35`, `gain × 0.55` | `enemy:hit` |
| `death` | `freq × 0.5`, `duration × 2.5`, `gain × 1.15` | `enemy:died`, `defender:died` |

A single exported function resolves them:

```
resolveVoice(unitName, variant) -> recipe
```

This is what makes a unit recognisable as *itself* in every context — you learn the Mortar once and
know it whether it is firing or dying. It also keeps the table at 29 entries instead of ~90, and
removes the failure mode where independently authored recipes drift out of character over time.

**Derived values must be clamped** to the ranges the existing `SfxLibrary` tests already enforce:
duration at most 2 seconds, gain at most 1, frequencies within 20–20000 Hz. A signature near those
limits would otherwise derive an invalid recipe.

**Unknown unit names fall back** to the existing generic recipes (`projectileFired`, `enemyHit`,
`enemyDied`) rather than going silent or throwing. A unit added later is quieter than intended, never
broken.

### Voice limiting

`AudioManager` currently creates nodes for every `playSfx` call unconditionally. That is acceptable
while most sounds are shared and brief; it stops being acceptable once 19 enemy types have distinct
deaths. Two mechanisms:

**A dedupe window.** The same unit and variant requested within **40ms** plays once. This matters more
than the cap. When a Grenadier's splash kills six Basic Enemies on a single frame, the game currently
triggers six identical sounds whose amplitudes sum — six times the intended level, which clips and
reads as a single distorted noise rather than six kills. Dedupe turns it into one clean sound.

**A concurrency cap.** At most **12** voices sound simultaneously; exceeding it stops the oldest
still-playing voice. Twelve is high enough that normal play never reaches it and low enough to prevent
a runaway wave from saturating the mix.

Both live in `AudioManager` so every caller benefits, including the existing shared sounds.

### Payload extensions

Three emit sites gain the unit type they currently omit. All three use the key **`unitType`**, carrying
the class name:

- `enemy:hit` and `enemy:died` in `GameEngine.js` — the enemy's class name.
- `defender:died` in `GameEngine.js` — the defender's class name.

`defender:placed` and `projectile:fired` need no change. Note they use different key names for the same
concept (`type` and `defenderType` respectively) — a pre-existing inconsistency. Renaming them is
deliberately out of scope here; it would touch working handlers for no behavioural gain. New sites use
`unitType` consistently, and a future cleanup can unify all three.

### Units that never fire

Barricade, EnergyGenerator, Fire Blast and Ice Bomb never emit `projectile:fired`, so their signature
is only ever heard through the `death` variant. Their signatures should be tuned so that the *derived*
death sound is the one that reads well, rather than tuning a `fire` sound that will never play.

Note also that on this branch spells no longer emit `defender:died` at all — casting is not a death —
so Fire Blast and Ice Bomb voices exist only for fallback completeness and to satisfy the coverage
test. They should still be authored rather than left absent, so the table stays exhaustive.

### Deployment stays shared

`defender:placed` continues to play the single shared `defenderPlaced` sound and continues to ignore
its `type` payload. This is a deliberate product decision: placement is a confirmation that an action
registered, and one consistent sound communicates that better than ten variations.

## Testing

| Test | Asserts |
|---|---|
| **Voice coverage** | Every class exported from `DefenderUnits.js` and `EnemyUnits.js`, excluding the `DefenderUnit` and `Enemy` base classes, has an entry in the voice table |
| Variant derivation | `resolveVoice` returns exact expected values for each variant, given a known signature |
| Derived clamping | A signature at the limits still derives a recipe within duration ≤ 2s, gain ≤ 1, frequency 20–20000 |
| Unknown unit fallback | An unrecognised name returns the generic recipe for that variant, and does not throw |
| Dedupe window | The same unit and variant twice inside 40ms produces one sound; outside 40ms, two |
| Dedupe is per unit | Two *different* units in the same frame both play — dedupe must not collapse distinct sounds |
| Concurrency cap | The 13th simultaneous voice stops the oldest; 12 or fewer are untouched |
| Existing sounds unaffected | Shared event sounds still play as before |

The **voice coverage test is the load-bearing one.** Without it, adding a unit class silently produces
a unit that falls back to the generic sound, and nobody notices until someone plays that level. It
should fail loudly and name the missing unit.

The dedupe-is-per-unit test is the counterpart that stops the dedupe window from becoming too
aggressive — a window keyed only on time rather than on unit identity would silence genuinely distinct
simultaneous sounds, which is worse than the stacking it fixes.

## Out of scope

- Per-unit *visual* feedback. This spec covers audio only.
- Enemy attack sounds. `enemyProjectiles.push` and `spellProjectiles.push` still emit nothing, as
  recorded in known-issue #7.
- Music. The chord bed is unchanged.
- Rebalancing. Recorded separately; see the balance findings in the known-issues document.

## Success criteria

1. Each of the 29 units has a distinct, hand-tuned voice.
2. A unit is recognisable as the same unit whether it is firing, being hit, or dying.
3. Deployment plays one shared sound regardless of unit.
4. Six simultaneous identical kills produce one clean sound, not six stacked.
5. Two different units dying simultaneously both play.
6. Adding a unit class without a voice fails the test suite by name.
7. The full test suite passes.
