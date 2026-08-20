/*
 * What the stars are a verdict on.
 *
 * They used to be a verdict on the score: 100 x level for two, 150 x level for
 * three. Score is the sum of the bounties of the enemies killed, and every
 * level's roster is fixed - so the rating was settled before the player
 * started, and the only thing that moved it was which types the spawner rolled.
 *
 * Level 1 fields eleven Basic Zombies at ten points each. 110 against a 150
 * threshold: two stars for everyone, forever, which is how this was reported -
 * "I got two stars on level 1 without an enemy touching my defender at all."
 * Level 9 tops out at 890 against 900 for two stars, so one star was its
 * ceiling.
 */
import { describe, it, expect } from 'vitest';
import {
    starsFor, starReason, MAX_BASE_HEALTH, HALF_BASE_HEALTH,
} from '../LevelStars.js';

/** Every enemy that reaches the base takes ten off it. */
const leaks = (n) => ({ baseDamageTaken: n * 10, defendersLost: 0 });

describe('stars for a level', () => {
    it('gives three when nothing reached the base', () => {
        expect(starsFor({ baseDamageTaken: 0 })).toBe(3);
    });

    /* The reported case - level 1 played perfectly, rated two - is guarded
       through the path that records it, in starsAwarded.test.jsx. Repeating it
       here would only restate the case above. */

    /*
     * Losing defenders must not cost a star. Requiring a clean sheet on both
     * counts - which the first version of this did - put three stars out of
     * reach on every level fielding a Titan: 5000 health, hitting for 50 every
     * two seconds, so whatever holds it dies while it is worn down. That is the
     * same unreachable tier this file exists to remove.
     */
    it('does not dock a star for defenders lost, which some levels force', () => {
        expect(starsFor({ baseDamageTaken: 0, defendersLost: 1 })).toBe(3);
        expect(starsFor({ baseDamageTaken: 0, defendersLost: 12 })).toBe(3);
    });

    it('gives two while the base is above half', () => {
        expect(starsFor(leaks(1))).toBe(2);
        expect(starsFor({ baseDamageTaken: HALF_BASE_HEALTH })).toBe(2);
    });

    it('gives one when the base is past half', () => {
        expect(starsFor({ baseDamageTaken: HALF_BASE_HEALTH + 10 })).toBe(1);
        expect(starsFor(leaks(9))).toBe(1);
    });

    /* Called only on a win, and a win is worth something. */
    it('never gives zero', () => {
        expect(starsFor({ baseDamageTaken: MAX_BASE_HEALTH - 10 })).toBeGreaterThan(0);
    });

    it('rates the defence, not the score', () => {
        // Two runs of the same level: one flawless, one leaky. Score does not
        // appear in the call at all, which is the point.
        expect(starsFor({ baseDamageTaken: 0 })).toBeGreaterThan(starsFor(leaks(8)));
    });

    it('rises as the defence improves, never falls', () => {
        const rated = [9, 6, 5, 1, 0].map((n) => starsFor(leaks(n)));
        const sorted = [...rated].sort((a, b) => a - b);
        expect(rated).toEqual(sorted);
    });
});

describe('the line that explains it', () => {
    it('says what earned three', () => {
        expect(starReason({ baseDamageTaken: 0 })).toMatch(/nothing reached your base/i);
    });

    it('says the same thing however many defenders were lost', () => {
        expect(starReason({ baseDamageTaken: 0, defendersLost: 4 }))
            .toEqual(starReason({ baseDamageTaken: 0 }));
    });

    it('distinguishes a comfortable win from a bare one', () => {
        const comfortable = starReason(leaks(2));
        const bare = starReason(leaks(9));
        expect(comfortable).not.toEqual(bare);
        expect(bare).toMatch(/just/i);
    });
});
