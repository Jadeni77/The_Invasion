# Defender Unlocking — Design

**Date:** 2026-08-19
**Status:** Approved schedule, pending owner review of this document
**Scope:** How a player comes to own each of the ten defenders. Not upgrading (the 5-level cap already
ships), not balance of the defenders themselves, not the chests' resource amounts.

## Problem

The owner's words: *"one defender per level win, each unlock must be worth using"*, with a concrete
anchor — *"the exploder and tank zombie is hard to kill"* at level 3 and 4, where the only defender the
player owns is the Shooter.

Two defects sit behind that.

**Nine of the ten defenders arrive from six treasure chests.** Chests are optional map landmarks. A
player who walks past `chest-2` never receives Grenadier or Healer, and nothing tells them what they
declined. Progression that can be missed by not clicking a thing is not progression.

**The chests are not spaced to the threats.** Verified against the level configs:

| Chest | Requires | Grants | The next new threat |
|---|---|---|---|
| chest-1 | level 1 | E-Gen, Barricade | L2 Fast Zombie |
| chest-2 | level 5 | Grenadier, Healer | L6 Shielder |
| chest-3 | level 8 | Frost Archer | L9 Swarm Witch |
| chest-4 | level 12 | Sniper, Ice Bomb | L13 Berserker |
| chest-5 | level 16 | Mortar | L17 Total Chaos |
| chest-6 | level 19 | Fire Blast | L20 Omega Wave |

Level 4 introduces **Tank Zombie at 1200 health**. The Shooter does 15 damage a shot. Nothing in that
table puts a damage answer in the player's hands before level 5 — Grenadier, the first defender that
meaningfully out-damages a Shooter, arrives from a chest gated on *finishing* level 5. The player is
asked to beat the Tank with the tool that cannot beat it, and the reward for doing so is the tool.

Level 20 hands Fire Blast to a player who has already won the campaign.

## The shape

**Winning a level grants a defender.** Nine unlocks, on the odd levels 1 through 17, so a win on an odd
level always brings something new and the last three levels are played with the complete kit. The
Shooter is owned from the start.

Two rules set the order:

1. **The unlock arrives before the threat it answers**, one level ahead, so the player meets each new
   enemy holding something that speaks to it.
2. **Cost tracks the energy curve.** A 120⚡ Mortar is unusable on level 4's 200 starting energy. The
   cheap tools come early because they are the only ones that can be afforded early.

| Win | Unlock | Cost | Covers | Because |
|---|---|---|---|---|
| 1 | **E-Gen** | 25 | L2–3 | 25 then 35 enemies on 120 and 160 energy. Economy before threats. |
| 3 | **Grenadier** | 60 | L4–5 | **Tank Zombie, 1200 health.** 40 damage against the Shooter's 15, with splash for the Skeleton Shooters behind it. |
| 5 | **Barricade** | 30 | L6–7 | Shield Wall and the enemy Healers are a grind, not a burst. 1000 health holds the line while damage accumulates. |
| 7 | **Healer** | 30 | L8–9 | Splitters, Minis and the Swarm Witch do steady chip damage across the whole line. Repair beats rebuilding. |
| 9 | **Sniper** | 100 | L10–11 | The first boss, now at a 1500 health floor, and the Vampire's self-heal. 50 damage at 550 range outpaces both. |
| 11 | **Frost Archer** | 35 | L12–13 | Ghost and Berserker are fast and hit hard. Slowing is worth more against them than against anything earlier. |
| 13 | **Ice Bomb** | 40 | L14–15 | Necromancer summons and Assassins arrive in groups. 200 splash clears them. |
| 15 | **Fire Blast** | 50 | L16–17 | Mage, then Total Chaos with all seventeen types at once. 300 splash. |
| 17 | **Mortar** | 120 | L18–20 | Titan at 5000 health, the Final Stand, the Omega Wave. 120 damage at 700 range. |

Even levels grant no defender. They are where the player uses the one they just received against the
threat it was chosen for.

## Chests

Chests keep their place as landmarks worth detouring for, and stop being the unlock path. They grant
**resources and card pieces** — pieces toward upgrading defenders the player already owns, which ties
them to the upgrade system rather than the unlock system.

No defender may be reachable only through a chest. A player who collects nothing still finishes the
campaign with all ten.

## Components

### The schedule is data, in one place

A single exported table maps a level to the defender winning it grants. It lives beside the level
configs, not inside the win handler, so the schedule can be read, tested, and changed without touching
game logic.

```js
/* Winning a level grants the defender listed against it. */
export const LEVEL_UNLOCKS = {
  1: "E-Gen",
  3: "Grenadier",
  5: "Barricade",
  7: "Healer",
  9: "Sniper",
  11: "Frost Archer",
  13: "Ice Bomb",
  15: "Fire Blast",
  17: "Mortar",
};

/** The defender granted for winning `levelId`, or null. */
export function defenderUnlockedBy(levelId) {
  return LEVEL_UNLOCKS[levelId] ?? null;
}
```

### Granting is shared with the chest path

`collectTreasure` already builds a card correctly — checks for a duplicate, allocates an id that two
grants in one batch cannot collide on, and fills in `piecesNeeded` and `upgradeCost`. That logic moves
into one helper so the level-win path cannot drift from it:

```js
/**
 * The card list with `defenderName` added, or the same list if already owned.
 *
 * The id is computed from the list being built rather than from `prev.cards`,
 * so two defenders granted in one update cannot receive the same id.
 */
export function withDefender(cards, defenderName) {
  if (cards.some((card) => card.name === defenderName)) return cards;
  return [...cards, {
    id: Math.max(...cards.map((c) => c.id), 0) + 1,
    name: defenderName,
    level: 1,
    pieces: 0,
    piecesNeeded: getPiecesNeeded(defenderName),
    upgradeCost: getUpgradeCost(defenderName, 1),
  }];
}
```

Both `collectTreasure` and the win handler call it. Nothing else constructs a card.

### The win handler grants, then persists

`onWinCb` already updates `playerData` with resources, `completedLevels`, `unlockedLevels` and
`levelStars` in one `setPlayerData`. The defender joins that same update — the player sees it before any
request goes out, matching how chest rewards already behave, so a dead backend cannot swallow a reward
the player was shown.

Persistence reuses the existing `POST /api/player/unlock-defender`, which the chest path already calls.
**No backend change is needed for the unlock itself.**

Granting is idempotent: `withDefender` returns the list unchanged when the defender is owned, so
replaying level 3 does not produce a second Grenadier.

### The player is told

Winning a level that grants a defender must say so, with the same weight the chest reward has. The
existing `chestReward` notice and its audio already do this job for chests; the win screen shows the
defender by name and art, and the unlock sound plays.

A player who replays a level they have already cleared is shown nothing — there is nothing to tell.

## Existing saves

A save made before this change may hold defenders from chests, hold none, or hold some at levels the
new schedule has not reached. All three are fine and need no migration:

- `withDefender` skips a defender already owned, so a player who has Grenadier from `chest-2` simply
  keeps it and wins nothing new for level 3.
- A player who has cleared levels 1–8 without collecting chests is missing the defenders those wins
  would have granted. **On the first load after this ships, the win handler is not what fixes that** —
  a reconciliation runs once against `completedLevels`, granting every defender the player's cleared
  levels entitle them to. Without it, an existing save is permanently short of tools it earned.

## Testing

Guards, in the durable form this project has settled on — assert what is allowed, and reject the
complement:

1. **Every defender is reachable by playing.** Walk `defenderUnitClasses`; every name must appear in
   `LEVEL_UNLOCKS` or be the starting Shooter. This is the guard that would have caught the original
   defect, and it catches a new defender added without a home.
2. **Every name in the schedule is a defender that exists.** The mirror of the level-19 enemy-type bug:
   a typo grants nothing, in silence.
3. **No unlock is scheduled after the level it answers.** Assert the anchor directly — a damage answer
   above the Shooter's is owned before level 4 — rather than restating the whole table.
4. **The schedule is affordable when it arrives.** Each defender's cost is within the starting energy of
   the level that first has it. A 120⚡ unlock at level 4 fails here.
5. **Granting is idempotent.** Winning the same level twice yields one card.
6. **No chest grants a defender.** `chestDefenders` returns empty for every chest in `chestsData`.
7. **Reconciliation covers a legacy save.** A save with `completedLevels: [1..8]` and no cards ends up
   holding every defender levels 1–7 grant.

Tests derive costs and names from the source tables rather than restating them, so tuning a defender's
cost does not fail a test that was right.

## Out of scope

- Rebalancing the defenders themselves. This spec decides *when* a player receives each one.
- The chests' resource and piece amounts. Pieces replace defenders as the chest reward; how many is a
  separate tuning pass.
- The star economy, which remains an open design question.
