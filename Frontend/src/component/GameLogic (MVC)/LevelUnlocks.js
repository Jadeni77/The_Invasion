/*
 * Which defender a level win hands the player.
 *
 * The nine unlocks sit on the odd levels 1 through 17, so a win on an odd level
 * always brings something new and the last three levels are played with the
 * complete kit. The Shooter is owned from the start.
 *
 * Two rules set the order, and both are guarded:
 *
 *   The unlock arrives one level BEFORE the threat it answers, so the player
 *   meets each new enemy holding something that speaks to it. Grenadier lands on
 *   winning level 3 because level 4 introduces the Tank Zombie at 1200 health,
 *   against a Shooter's 15 damage a shot.
 *
 *   Cost tracks the energy curve. A 120-energy Mortar is unusable on level 4's
 *   200 starting energy, so the cheap tools come early - they are the only ones
 *   that can be afforded early.
 *
 * See docs/superpowers/specs/2026-08-19-defender-unlocking-design.md.
 */

/** The defender granted for winning each level. */
export const LEVEL_UNLOCKS = {
  1: "E-Gen",         // L2-3: 25 then 35 enemies. Economy before threats.
  3: "Grenadier",     // L4-5: Tank Zombie, 1200 health.
  5: "Barricade",     // L6-7: the Shield Wall grind needs a line that holds.
  7: "Healer",        // L8-9: Splitters and the Swarm Witch chip everything.
  9: "Sniper",        // L10-11: the first boss, and the Vampire's self-heal.
  11: "Frost Archer", // L12-13: Ghost and Berserker are fast and hit hard.
  13: "Ice Bomb",     // L14-15: Necromancer summons, Assassins, in groups.
  15: "Fire Blast",   // L16-17: Mage, then all seventeen types at once.
  17: "Mortar",       // L18-20: Titan, the Final Stand, the Omega Wave.
};

/** The defender every player owns before winning anything. */
export const STARTING_DEFENDER = "Shooter";

/** The defender granted for winning `levelId`, or null. */
export function defenderUnlockedBy(levelId) {
  return LEVEL_UNLOCKS[levelId] ?? null;
}

/**
 * Every defender the levels in `completedLevels` entitle a player to.
 *
 * Used to reconcile a save made before unlocks moved onto levels: such a save
 * has cleared levels whose defenders it never received, and the win handler
 * only ever fires on a NEW win, so nothing else would give them out.
 */
export function defendersEarnedBy(completedLevels = []) {
  return completedLevels
    .map((levelId) => defenderUnlockedBy(levelId))
    .filter(Boolean);
}
