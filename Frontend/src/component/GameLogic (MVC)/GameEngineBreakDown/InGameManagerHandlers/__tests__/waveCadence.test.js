/*
 * When the next wave arrives, and what the countdown says about it.
 *
 * The countdown was a lie, in two different ways, and level 1 showed both.
 *
 * It vanished mid-level: while a wave was still spawning the timer returned 0
 * and the UI drew nothing, so wave 2's five enemies arrived over ten seconds
 * with no indicator at all.
 *
 * And it read a number the game did not honour. Once a wave was fully spawned
 * the timer counted toward a fifteen-second cap - but three rules raced for the
 * next wave, and the first of them ("board clear, and three seconds since this
 * wave started") fires the instant the last enemy dies. Level 1's opening wave
 * contains ONE zombie, so killing it summoned wave 2 immediately while the
 * screen still read ten.
 *
 * A countdown cannot describe a race. So there is one rule: a set gap, armed
 * when a wave finishes arriving, that nothing shortens.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    WaveManager, PREP_TIME_MS, WAVE_GAP_MS, WAVE_CLEAR_SCORE,
} from '../WaveManager.js';

/** Level 1's real shape: a single zombie first, then five, then five. */
function levelOne() {
    return {
        waves: 3,
        totalEnemiesToSpawn: 11,
        enemySpawnInterval: 3000,
        maxActiveEnemies: 3,
        availableEnemyTypes: ['Basic Zombie'],
        isEndless: false,
        waveConfigurations: [
            { enemyCount: 1, spawnInterval: 3000, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
            { enemyCount: 5, spawnInterval: 2500, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
            { enemyCount: 5, spawnInterval: 2000, enemyTypes: ['Basic Zombie'], spawnPattern: 'standard' },
        ],
    };
}

describe('the gap between waves', () => {
    let wm;
    let engine;
    let alive;

    /** Drive the manager to `now`, with `enemyCount` enemies on the board. */
    const tick = (now, enemyCount = alive) => {
        engine.gameClock.now = now;
        alive = enemyCount;
        wm.update(now, enemyCount, false);
    };

    beforeEach(() => {
        alive = 0;
        engine = {
            gameClock: { now: 0 },
            enemies: [],
            canvasWidth: 800,
            canvasHeight: 600,
            inGameScore: 0,
            updateScoreCb: vi.fn(),
            dropEnergy: vi.fn(),
            showWaveAnnouncement: vi.fn(),
        };
        wm = new WaveManager(levelOne(), vi.fn(), engine);
        wm.reset();
    });

    /** Wave 1 begins, its one zombie spawns, and the wave is done arriving. */
    const throughWaveOne = () => {
        tick(PREP_TIME_MS);      // wave 1 starts
        tick(PREP_TIME_MS + 16); // its single enemy spawns
        tick(PREP_TIME_MS + 32); // and the wave is recognised as fully spawned
    };

    it('counts down the gap once a wave has finished arriving', () => {
        throughWaveOne();

        expect(wm.currentWave).toBe(1);
        expect(wm.getTimeUntilNextWave()).toBe(WAVE_GAP_MS / 1000);

        engine.gameClock.now = PREP_TIME_MS + WAVE_GAP_MS - 2500;
        expect(wm.getTimeUntilNextWave()).toBe(3);
    });

    /* The bug, exactly: one zombie, killed at once, and the next wave came. */
    it('does not summon the next wave when the board clears', () => {
        throughWaveOne();

        // Killed immediately. Under the old rules this started wave 2 on the spot.
        tick(PREP_TIME_MS + 3500, 0);

        expect(wm.currentWave, 'clearing the board buys nothing').toBe(1);
        expect(wm.getTimeUntilNextWave()).toBeGreaterThan(0);
    });

    /* The rule the report named: "it instantly spawns when certain amount of
       enemies are not in the map." Two stragglers used to do it after six
       seconds. */
    it('does not summon the next wave when only a straggler is left', () => {
        throughWaveOne();

        tick(PREP_TIME_MS + 7000, 1);

        expect(wm.currentWave).toBe(1);
    });

    it('arrives when the countdown reaches zero, and not before', () => {
        throughWaveOne();
        // Read from the manager rather than recomputed here: the test above
        // already checks that this instant is WAVE_GAP_MS away.
        const due = wm.nextWaveAt;

        tick(due - 1, 0);
        expect(wm.currentWave, 'one millisecond early').toBe(1);

        tick(due, 0);
        expect(wm.currentWave).toBe(2);
        expect(wm.getTimeUntilNextWave(), 'wave 2 is arriving, nothing to wait for').toBe(0);
    });

    it('shows nothing while a wave is still arriving', () => {
        tick(PREP_TIME_MS);
        tick(PREP_TIME_MS + 16);
        tick(PREP_TIME_MS + 32);
        tick(PREP_TIME_MS + 32 + WAVE_GAP_MS, 0); // wave 2 begins, five to spawn

        expect(wm.currentWave).toBe(2);
        expect(wm.waveEnemiesSpawned).toBeLessThan(5);
        expect(wm.getTimeUntilNextWave()).toBe(0);
    });

    /* Every enemy the level declares gets onto the board. The forced
       progression this replaces reset the spawn counter mid-wave, so a wave
       still spawning simply lost the rest of its enemies. */
    it('lets a slow wave finish spawning before the next is scheduled', () => {
        throughWaveOne();

        // Wave 2 asks for five at 2500ms each - twelve seconds of arriving,
        // where the old rule forced wave 3 at fifteen from the wave's start.
        let deliveredByWaveTwo = 0;
        for (let t = wm.nextWaveAt; t <= wm.nextWaveAt + 40_000; t += 250) {
            tick(t, 0);
            if (wm.currentWave === 2) {
                deliveredByWaveTwo = Math.max(deliveredByWaveTwo, wm.waveEnemiesSpawned);
            }
            if (wm.currentWave === 3) break;
        }

        expect(deliveredByWaveTwo, 'all five arrived before wave 3 was scheduled').toBe(5);
        expect(wm.currentWave, 'and wave 3 did arrive').toBe(3);
    });

    it('waits nothing out after the final wave', () => {
        wm.currentWave = 3;
        wm.waveActive = true;
        wm.waveEnemiesSpawned = 5;
        tick(60_000, 0);

        expect(wm.allWavesComplete).toBe(true);
        expect(wm.getTimeUntilNextWave()).toBe(0);
        expect(wm.nextWaveAt, 'nothing is scheduled after the last wave').toBeNull();
    });

    it('leaves the prep before wave 1 as it was', () => {
        expect(wm.getTimeUntilNextWave()).toBe(PREP_TIME_MS / 1000);

        engine.gameClock.now = PREP_TIME_MS - 1000;
        expect(wm.getTimeUntilNextWave()).toBe(1);

        tick(PREP_TIME_MS - 1);
        expect(wm.currentWave).toBe(0);
        tick(PREP_TIME_MS);
        expect(wm.currentWave).toBe(1);
    });

    it('gives the player a gap long enough to plant something', () => {
        // The number matters, so it is asserted rather than derived away.
        expect(WAVE_GAP_MS).toBeGreaterThanOrEqual(5000);
        expect(WAVE_GAP_MS).toBeLessThanOrEqual(15000);
    });

    /*
     * Clearing a wave pays. completeWave() has existed all along - written,
     * tested, and called from nowhere - so no player had ever received the
     * score or the energy it grants. With the gap between waves now fixed,
     * killing the last enemy promptly earned nothing at all without it.
     */
    describe('clearing a wave', () => {
        it('pays nothing while an enemy is still alive', () => {
            tick(PREP_TIME_MS);            // wave 1 begins and spawns its zombie
            tick(PREP_TIME_MS + 16, 1);    // fully spawned, one still up
            tick(PREP_TIME_MS + 32, 1);

            expect(engine.inGameScore).toBe(0);
            expect(engine.dropEnergy).not.toHaveBeenCalled();
        });

        it('pays when the last one dies', () => {
            tick(PREP_TIME_MS);
            tick(PREP_TIME_MS + 16, 1);
            tick(PREP_TIME_MS + 32, 0);    // killed

            expect(engine.inGameScore).toBe(WAVE_CLEAR_SCORE * 1);
            expect(engine.dropEnergy).toHaveBeenCalledTimes(1);
        });

        /* update() runs every frame, and the board stays empty for the whole
           eight-second gap. Without a latch this pays hundreds of times. */
        it('pays exactly once, however long the board stays empty', () => {
            tick(PREP_TIME_MS);
            tick(PREP_TIME_MS + 16, 1);
            tick(PREP_TIME_MS + 32, 0);
            const afterFirstClear = engine.inGameScore;

            for (let t = 48; t < WAVE_GAP_MS; t += 100) tick(PREP_TIME_MS + t, 0);

            expect(engine.inGameScore).toBe(afterFirstClear);
            expect(engine.dropEnergy).toHaveBeenCalledTimes(1);
        });

        it('pays again for the next wave, scaled to it', () => {
            tick(PREP_TIME_MS);
            tick(PREP_TIME_MS + 16, 1);
            tick(PREP_TIME_MS + 32, 0);            // wave 1 cleared: 10
            const due = wm.nextWaveAt;
            tick(due, 0);                          // wave 2 begins
            for (let t = 0; t <= 15_000; t += 250) tick(due + t, 0);

            // Wave 2 is worth twice wave 1, and its five enemies never appear on
            // the board in this harness, so it clears as soon as it is spawned.
            expect(engine.inGameScore).toBe(WAVE_CLEAR_SCORE * 1 + WAVE_CLEAR_SCORE * 2);
        });
    });
});
