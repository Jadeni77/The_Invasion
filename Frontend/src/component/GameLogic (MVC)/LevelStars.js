/*
 * How well a level was defended, in stars.
 *
 * These used to come from score: 100 x level for two stars, 150 x level for
 * three. Score is the sum of the bounties of the enemies killed, and a level's
 * roster is fixed - so the rating was all but decided before the player
 * started, and the only thing that moved it was which enemy types the spawner
 * happened to roll.
 *
 * Level 1 can produce 110 points at the very most, against a 150 threshold:
 * EVERY player got exactly two stars, however flawlessly they played. Level 9
 * tops out at 890 against 900 for two stars, so it could never award more than
 * one. Levels 2, 3, 4, 5, 8, 17, 19 and 20 could reach three or not depending
 * on the spawner's dice.
 *
 * So score keeps the job it is good at - gold, iron, grain and water are all
 * fractions of it - and the stars now report the part the player controls.
 * Neither signal below is new: GameEngine has always counted them, and the
 * `untouchable` and `perfect_defense` achievements already trusted them.
 * Nothing was reading them for the rating.
 */

/** The base starts here, and every enemy that reaches it takes ten. */
export const MAX_BASE_HEALTH = 100;

/** Half of it - the line between a comfortable win and a bare one. */
export const HALF_BASE_HEALTH = MAX_BASE_HEALTH / 2;

/**
 * Stars for a won level, from what reached the base and nothing else.
 *
 * Only ever called on a win, so one star is the floor: surviving is worth
 * something.
 *
 * Losing defenders deliberately does NOT cost a star. The first version of this
 * asked for a clean sheet on both counts, which put three stars out of reach on
 * every level fielding a Titan - 5000 health, hitting for 50 every two seconds,
 * so whatever stands in front of one dies while it is being worn down. That is
 * the same unreachable-tier bug this file exists to fix, one layer further in.
 *
 * Defenders lost is not ignored by the game: it is what the `perfect_defense`
 * achievement is for. It is just not what a star means.
 */
export function starsFor({ baseDamageTaken = 0 } = {}) {
    if (baseDamageTaken <= 0) return 3;
    if (baseDamageTaken <= HALF_BASE_HEALTH) return 2;
    return 1;
}

/**
 * The same verdict in a line, so the rating explains itself on the results
 * screen rather than looking arbitrary - which is exactly how the old one
 * looked, because it was.
 */
export function starReason({ baseDamageTaken = 0 } = {}) {
    if (baseDamageTaken <= 0) return "Nothing reached your base.";
    if (baseDamageTaken <= HALF_BASE_HEALTH) {
        return "The base took damage but held above half.";
    }
    return "You held the line, but only just.";
}
