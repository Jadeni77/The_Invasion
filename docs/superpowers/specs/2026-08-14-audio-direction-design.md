# Audio Direction and Full Coverage — Design

**Date:** 2026-08-14
**Status:** Approved, ready for implementation planning
**Scope:** Frontend only. No backend or database changes.

## Problem

Three complaints, one underlying cause.

**"The sounds don't sound like a game — all kinds of different sound merged into it."** This is not a
coverage problem. It is an audio *direction* problem: the sounds have no shared identity. Samples drawn
from several packs carry different room tone, mastering and stylistic intent, and no amount of adding
more will make them cohere.

**"Every actionable item should have sound."** Several things the player causes or watches are silent:
enemy ranged fire, enemy melee attacks, enemy spells, and enemy summons.

**"The skeleton attack and projectile don't seem to correlate."** The attack animation and the
projectile are driven by two independent timers, so they cannot line up.

A fourth issue shaped the design: sourcing 29 per-unit sounds is itself what pushes toward mixing packs.
Reducing the count is therefore part of fixing cohesion, not separate from it.

## Sonic identity

**Cartoon arcade, in the manner of Plants vs. Zombies.** Playful and exaggerated: soft pops for firing,
squelches and comic thuds for deaths, warm and bouncy throughout.

Chosen over gritty-military and retro-chiptune for two reasons. It matches the enemy roster — Mushrooms,
Golems, Skeletons — and the visual direction the project is moving toward. And obviously-unreal sounds
cohere far more easily than realistic ones, which expose mismatched recordings badly.

**All samples come from a single pack.** This one constraint does more for cohesion than any per-sound
tuning. Mixing packs is what produced the current mishmash.

Note this pulls against the defenders' military names — Sniper, Mortar, Grenadier. That tension is
acknowledged and left for the visual-direction work to resolve; it does not block this spec.

### Mix hierarchy

The game currently has no foreground and background — everything competes. Three tiers:

| Tier | Sounds | Gain multiplier |
|---|---|---|
| Loud | base damaged, boss death, level won, level lost | `1.0` |
| Mid | ordinary deaths, spells, artillery, summons, heals | `0.7` |
| Quiet | projectiles, hits, energy pickup | `0.4` |

The multiplier is applied on top of a sound's own gain, so a sample's inherent loudness still matters —
the tier sets its ceiling relative to the others.

Projectiles and hits fire constantly, so they must sit under everything else. They currently do not,
which is a large part of why the mix reads as noise.

## Taxonomy

Sound identity is by **archetype**, not by unit. Several units resolving to one sound is the intended
design, not a compromise: a Shooter and a Skeleton firing a basic projectile carry no information that
distinguishing them would convey.

**Shared archetypes**

| Sound | Used by |
|---|---|
| `projectile` | BasicDefender, RangeEnemy, and any basic ranged attack on either side |
| `artillery` | GrenadeDefender |
| `magic` | FrostArcher, IceBomb, MageEnemy spells |
| `fire` | FireBlast |
| `heal` | HealerDefender, HealerEnemy |
| `melee` | all enemy melee attacks |
| `summon` | NecromancerEnemy, SplitterEnemy |

The existing shared `hit` sound is reused unchanged and is not one of the new files.

**Deaths, tiered by size rather than species**

| Sound | Used by |
|---|---|
| `death-small` | BasicEnemy, FastEnemy, MiniEnemy, SwarmLeader |
| `death-medium` | every ordinary enemy not listed as small, excluding the two signature enemies below |
| `death-defender` | any defender destroyed |

**Signature overrides** — four units keep their own identity because the distinction carries real
information: `Mortar`, `Sniper`, `TitanEnemy`, `BossEnemy`.

That is **14 new combat sounds**. The nine existing game-event sounds (deploy, energy collected, deploy
rejected, base damaged, wave started, boss wave, level won, level lost, and the shared hit) continue to
work as they are and can be replaced later.

**No architectural change is required for grouping.** `UnitVoices` is already a name-keyed lookup, so
several units mapping to one sound is expressible today. What changes is the table's contents and the
addition of an archetype layer that resolves a unit name to its category before lookup.

## Coverage

Sounds are added for the four silent actionable events:

- **Enemy ranged fire** — `CombatManager.updateEnemyCombat`, where enemy projectiles are created.
- **Enemy melee attack** — the `attack()` overrides in `EnemyUnits.js`. Each enemy class implements its
  own; the implementation must locate each rather than assume a shared path.
- **Enemy spells** — `MageEnemy`'s fireball and icebolt, where spell projectiles are created.
- **Enemy summons** — `NecromancerEnemy` and `SplitterEnemy`, where a spawned enemy is created.

All four use the existing dedupe window, so several enemies acting in one frame produce one sound rather
than a stack.

## The skeleton sync fix

`RangeEnemy.updateBehavior` sets `isAttacking = true` and runs a frame-based `attackCountdown`, driving
the **animation**. `CombatManager.updateEnemyCombat` independently checks `canAttack(now)` against
`lastAttackTime` — a time-based cooldown on the gameplay clock — and creates the **projectile**.

Two clocks, two cooldowns, no coupling. They drift apart immediately and can never align. Worse,
`isAttacking` is set true on *every frame* a target is in range, so the attack animation plays
continuously while projectiles leave on a separate cadence.

**Fix:** the animation is triggered where the projectile is actually created. `CombatManager` sets the
attacking state at that moment; `updateBehavior` stops driving animation state and handles only movement
and targeting. One event drives the animation and the sound together.

This is the same code site as the enemy-fire sound, which is why the two are specified together.

## Testing

| Test | Asserts |
|---|---|
| Archetype resolution | Each unit resolves to its documented category; a signature unit resolves to its own sound, not its category |
| Grouping is real | BasicDefender and RangeEnemy resolve to the same `projectile` sound |
| Death tiering | A small enemy, a medium enemy and Titan each resolve to different death sounds |
| Mix hierarchy | Each tier's gain multiplier is applied, and quiet-tier sounds are quieter than loud-tier ones |
| Coverage | Enemy ranged fire, melee, spells and summons each emit their event with the enemy's type |
| No double-emit | An enemy attack produces exactly one sound event, not one per damaged target |
| Sync | Creating an enemy projectile sets the attacking animation state; `updateBehavior` no longer sets it |
| Sync regression | An enemy in range but not firing is not stuck in its attack animation |

The **sync regression test is load-bearing.** The current bug is precisely that `isAttacking` is true
whenever a target is in range; a fix that only added the new trigger without removing the old one would
leave the animation permanently on and look unchanged in play.

## Out of scope

- **Music.** The synthesized chord bed is unchanged. Replacing it with a real track needs loop-point
  handling and belongs in its own spec.
- Sourcing or selecting the sample files. The project owner supplies them, as established previously.
- Renaming the military-sounding defenders to match the cartoon direction — a visual-direction question.
- The pre-existing splash double-award and the non-integer sprite scaling, both recorded in known issues.

## Success criteria

1. All samples come from a single pack and share an obvious character.
2. A Shooter and a Skeleton firing produce the same sound.
3. Mortar, Sniper, Titan and Boss remain individually recognisable.
4. A small enemy and a medium enemy die with audibly different weight.
5. Projectiles and hits sit clearly beneath deaths and explosions in the mix.
6. Enemy ranged fire, melee, spells and summons all produce sound.
7. A skeleton's attack animation plays when it fires, and only when it fires.
8. The full test suite passes.
