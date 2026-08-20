/*
 * A defender stops shooting for a moment after every kill.
 *
 * Reported from play: "when the shooter killed an enemy, it waits a couple
 * milliseconds before attacking the next one."
 *
 * It is not the fire rate and it is not the projectile's flight time. It is one
 * word in `canAttack`:
 *
 *     for (const enemy of enemies) {
 *       if (!enemy.isAlive) return;      // <- return, not continue
 *
 * That leaves the method entirely on the FIRST corpse it meets, returning
 * undefined - which reads as "no target" - without looking at the live enemies
 * behind it. And a corpse is not removed on death: GameEngine keeps it in
 * `enemies` until its death animation finishes.
 *
 * So every defender goes quiet for the length of a death animation, whenever a
 * corpse sits ahead of its next target in the array. Which is the ordinary case,
 * since the enemy you kill first is the one that spawned first.
 *
 * It is on the base class, so it is every defender, not only the Shooter.
 */
import { describe, it, expect } from 'vitest';
import { BasicDefender } from '../DefenderUnits.js';

const ONE_SECOND_AGO = -5000; // any time far enough back that the cooldown is up

function enemyAt(x, { alive = true } = {}) {
    return { x, y: 100, width: 64, height: 64, isAlive: alive };
}

/** A Shooter at the left edge, with `enemies` on the board. */
function shooterSeeing(enemies) {
    const shooter = new BasicDefender(100, 100, { level: 1 });
    shooter.lastAttackTime = ONE_SECOND_AGO;
    shooter.gameEngine = { enemies, canvasWidth: 800 };
    return shooter;
}

describe('a defender deciding whether it can shoot', () => {
    it('shoots at a live enemy in range', () => {
        expect(shooterSeeing([enemyAt(150)]).canAttack(0)).toBe(true);
    });

    /* The bug, exactly: the corpse of what it just killed is still in the
       array, in front of the enemy behind it. */
    it('shoots past the corpse of the one it just killed', () => {
        const shooter = shooterSeeing([
            enemyAt(140, { alive: false }),   // just killed, still animating
            enemyAt(160),                     // next in line, well in range
        ]);

        expect(shooter.canAttack(0)).toBe(true);
    });

    it('shoots past several corpses', () => {
        const shooter = shooterSeeing([
            enemyAt(120, { alive: false }),
            enemyAt(130, { alive: false }),
            enemyAt(170),
        ]);

        expect(shooter.canAttack(0)).toBe(true);
    });

    it('holds fire when the only enemies are dead', () => {
        const shooter = shooterSeeing([enemyAt(150, { alive: false })]);

        expect(shooter.canAttack(0)).toBe(false);
    });

    it('holds fire when the live enemy is out of range', () => {
        // range is 200; 700 is far beyond it.
        expect(shooterSeeing([enemyAt(700)]).canAttack(0)).toBe(false);
    });

    it('holds fire when an enemy has not walked on screen yet', () => {
        // Enemies spawn at about -100 and should not be shot before they appear.
        expect(shooterSeeing([enemyAt(-90)]).canAttack(0)).toBe(false);
    });

    /* The rate still governs: this is not a licence to fire every frame. */
    it('still waits out its fire rate', () => {
        const shooter = shooterSeeing([enemyAt(150)]);
        shooter.lastAttackTime = 0;

        expect(shooter.canAttack(1)).toBe(false);
        expect(shooter.canAttack((shooter.fireRate * 1000) / 60)).toBe(true);
    });

    /* undefined is falsy, so the bug was invisible at the call site - it read as
       "no target" rather than as a mistake. */
    it('answers with a boolean, not undefined', () => {
        expect(typeof shooterSeeing([enemyAt(150, { alive: false })]).canAttack(0))
            .toBe('boolean');
    });
});

/*
 * The other half of the same report, which turned out NOT to be the cause.
 *
 * A Shooter's attack() is the projectile's onHit callback, and the `now` its
 * closure carries is the moment the shot was fired - not the moment the arrow
 * lands. CombatManager has already recorded that timestamp, so writing it again
 * was redundant. It was also unsafe: fire twice before the first arrow lands, as
 * a fast Shooter can, and the older landing writes the older time back, letting
 * the next shot come early.
 */
describe('a landing arrow and the cooldown', () => {
    it('does not rewind the cooldown to when the shot was fired', () => {
        const shooter = shooterSeeing([enemyAt(150)]);
        const target = { isAlive: true, takeDamage: () => {} };

        shooter.lastAttackTime = 1000;   // a later shot has already been fired
        shooter.attack(target, 0);       // an older arrow lands, carrying now=0

        expect(shooter.lastAttackTime).toBe(1000);
    });

    it('still deals its damage when the arrow lands', () => {
        const shooter = shooterSeeing([enemyAt(150)]);
        let dealt = 0;
        shooter.attack({ isAlive: true, takeDamage: (n) => { dealt = n; } }, 0);

        expect(dealt).toBe(shooter.attackDamage);
    });
});
