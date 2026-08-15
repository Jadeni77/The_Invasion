import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setFrameDeltaMs } from '../Animation/FrameTime.js';
import { RangeEnemy } from '../EnemyUnits.js';
import * as DefenderModule from '../DefenderUnits.js';
import { DefenderUnit, Mortar, GrenadeDefender, HealerDefender } from '../DefenderUnits.js';
import { defenderUnitClasses } from '../DefenderClassUtils.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';
import { AssetManifest } from '../../../assets/AssetManifest.js';

/**
 * Playtest fix, bug 3: "the skeleton's attack sprite sheet only plays partway".
 *
 * The previous fix held the attack animation for a fixed
 * ATTACK_ANIMATION_LOCK_FRAMES = 20 (~333ms at 60fps). The Skeleton Shooter's
 * attack sheet is 10 frames at 10fps = 1000ms, so barely a third of it ever
 * reached the screen. Raising the constant is not available either: the sheet
 * at its authored speed is LONGER than the skeleton's 833ms firing cadence
 * (attackRate 50), so it would still be mid-swing when the next shot arrived
 * and would latch on permanently - the bug the lock was added to fix.
 *
 * The requirement the owner set is that every sheet plays in full, so playback
 * is derived from the cadence instead: one full pass per attack, over
 * min(authored sheet duration, cadence). Longer-than-cadence sheets compress to
 * fit; shorter ones keep their authored speed and hand back to idle rather than
 * being stretched into slow motion.
 *
 * Every test here reads its frame counts and fps from the real AssetManifest,
 * so it is measuring the sheets the game actually ships.
 */

/**
 * These tests drive unit.update() by hand, standing in for GameEngine's loop,
 * and count ticks. Animation advances by whatever real time the engine says the
 * frame covered (Animation/FrameTime.js), so the loop is pinned to 60Hz here to
 * give those tick counts a fixed meaning. Playback at other refresh rates is
 * what AnimationFrameDelta.test.js measures.
 */
const FRAME_MS_60HZ = 1000 / 60;

beforeEach(() => {
  setFrameDeltaMs(FRAME_MS_60HZ);
});

/** Sprite data in the shape GameEngine hands a unit after loading. */
function withManifestAnimations(unit, category, manifestName) {
  const config = AssetManifest[category][manifestName].config;
  unit.animationConfig = config;
  unit.animationFrames = Object.fromEntries(
    Object.entries(config).map(([animation, { frameCount }]) => [
      animation,
      Array.from({ length: frameCount }, (_, index) => `${animation}:${index}`),
    ]),
  );
  return unit;
}

function createEngine() {
  return {
    emitFeedback: vi.fn(),
    addDefenderExplosion: vi.fn(),
    projectiles: [],
    enemyProjectiles: [],
    explosions: [],
    enemies: [],
    defenders: [],
    canvasWidth: 800,
    gameOver: false,
  };
}

/** The frame indices displayed, in order, while the unit is mid-attack. */
function recordAttackFrames(unit, tick, tickBudget) {
  const shown = [];
  for (let i = 0; i < tickBudget; i++) {
    tick(i);
    if (unit.currentAnimation === 'attack') shown.push(unit.animationFrame);
    else if (shown.length > 0) break; // handed back to idle/move
  }
  return shown;
}

function everyFrameIndex(frameCount) {
  return Array.from({ length: frameCount }, (_, index) => index);
}

/** Asserts one complete, non-repeating pass over the sheet. */
function expectExactlyOneFullPass(shown, frameCount, label) {
  expect([...new Set(shown)].sort((a, b) => a - b), `${label}: frames shown`).toEqual(
    everyFrameIndex(frameCount),
  );
  for (let i = 1; i < shown.length; i++) {
    // A restart mid-cycle means the sheet played more than once per attack.
    expect(shown[i], `${label}: frame ${i} of the observed sequence`).toBeGreaterThanOrEqual(
      shown[i - 1],
    );
  }
}

describe('a ranged enemy plays its whole attack sheet once per shot', () => {
  const SKELETON = 'Skeleton Shooter';
  const SHEET = AssetManifest.enemies[SKELETON].config.attack;

  function createSkeleton() {
    const engine = createEngine();
    const skeleton = withManifestAnimations(new RangeEnemy(0, 0, null), 'enemies', SKELETON);
    skeleton.gameEngine = engine;
    const defender = {
      x: 60, y: 0, width: 40, height: 40, isAlive: true,
      takeDamage: vi.fn(() => false),
    };
    return { engine, skeleton, defender, combat: new CombatManager(engine) };
  }

  it('is the case the fixed lock could not serve', () => {
    // The premise, asserted rather than asserted-in-a-comment: this sheet is
    // genuinely longer than the cadence, so "play it at authored speed once per
    // shot" is impossible and compression is the only way to show all of it.
    const skeleton = new RangeEnemy(0, 0, null);
    const authoredMs = (SHEET.frameCount / SHEET.fps) * 1000;
    const cadenceMs = (skeleton.attackRate * 1000) / 60;

    expect(SHEET.frameCount).toBeGreaterThan(1);
    expect(authoredMs).toBeGreaterThan(cadenceMs);
  });

  it('shows every frame of the sheet between one shot and the next', () => {
    // Rejects BOTH wrong implementations at once: the fixed 20-frame lock stops
    // at roughly frame 3 of 10, and leaving the sheet at its authored 1000ms
    // never reaches the last frame before the 833ms cadence restarts it.
    const { skeleton, defender, combat } = createSkeleton();
    const cadenceFrames = skeleton.attackRate;

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    const shown = recordAttackFrames(
      skeleton,
      () => skeleton.update([defender]),
      cadenceFrames + 1,
    );

    expectExactlyOneFullPass(shown, SHEET.frameCount, 'skeleton');
  });

  it('finishes the sheet by the time the next shot is due', () => {
    // "Compressed to fit" means fit: the swing is over, not merely started,
    // when the cooldown next allows a shot.
    const { skeleton, defender, combat } = createSkeleton();
    const cadenceFrames = skeleton.attackRate;

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    // One tick of slack: the animation steps in whole 60fps frames while the
    // cooldown is wall-clock, so the two can land a frame apart.
    for (let i = 0; i < cadenceFrames + 1; i++) skeleton.update([defender]);

    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.currentAnimation).not.toBe('attack');
  });

  it('starts the sheet from the beginning on each shot', () => {
    const { skeleton, defender, combat } = createSkeleton();

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    for (let i = 0; i < 20; i++) skeleton.update([defender]);
    expect(skeleton.animationFrame).toBeGreaterThan(0); // mid-sheet

    combat.updateEnemyCombat([defender], [skeleton], 1000 + (skeleton.attackRate * 1000) / 60);

    expect(skeleton.animationFrame).toBe(0);
  });
});

describe('a sheet shorter than the cadence keeps its authored speed', () => {
  const SHEET = AssetManifest.defenders.Mortar.config.attack;

  it('does not stretch the Mortar sheet across its six-second reload', () => {
    // Rejects: deriving the frame duration as cadence / frameCount outright.
    // The Mortar fires every 360 frames (6s) and its attack sheet is 3 frames
    // at 6fps; stretched, each frame would hold for two seconds, which reads as
    // slow motion rather than as a firing animation.
    const engine = createEngine();
    const mortar = withManifestAnimations(new Mortar(0, 0, { level: 1, image: null }), 'defenders', 'Mortar');
    mortar.gameEngine = engine;
    const target = { x: 400, y: 0, width: 64, height: 64, isAlive: true, takeDamage: vi.fn(() => false) };

    mortar.attack(target, 1000);
    const shown = recordAttackFrames(mortar, () => mortar.update([target], [mortar]), mortar.fireRate + 5);

    const authoredTicks = Math.round(((SHEET.frameCount / SHEET.fps) * 1000) / FRAME_MS_60HZ);
    const cadenceTicks = mortar.fireRate;
    expect(authoredTicks).toBeLessThan(cadenceTicks); // premise: it is the shorter one

    expectExactlyOneFullPass(shown, SHEET.frameCount, 'mortar');
    expect(shown.length).toBeLessThanOrEqual(authoredTicks + 2);
  });
});

describe('defender playback is no longer quantised by integer frame counting', () => {
  it('gives the Grenadier sheet its authored length, not a truncated one', () => {
    // The old path advanced a frame every Math.floor(60 / config.fps) game
    // frames. At the Grenadier's 11fps that floors 5.45 to 5, running the sheet
    // ~9% fast; at 18fps (Healer, Frost Archer) it floors 3.33 to 3, ~11% fast.
    const engine = createEngine();
    const grenadier = withManifestAnimations(
      new GrenadeDefender(0, 0, { level: 1, image: null }), 'defenders', 'Grenadier',
    );
    grenadier.gameEngine = engine;
    const sheet = AssetManifest.defenders.Grenadier.config.attack;
    const target = { x: 150, y: 0, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };

    grenadier.attack(target, 1000);
    const shown = recordAttackFrames(
      grenadier, () => grenadier.update([target], [grenadier]), grenadier.fireRate + 5,
    );

    const authoredTicks = ((sheet.frameCount / sheet.fps) * 1000) / FRAME_MS_60HZ;
    const truncatedTicks = Math.floor(60 / sheet.fps) * sheet.frameCount;
    expect(truncatedTicks).toBeLessThan(authoredTicks - 1); // premise: truncation really did shorten it

    expectExactlyOneFullPass(shown, sheet.frameCount, 'grenadier');
    expect(shown.length).toBeGreaterThan(truncatedTicks);
    expect(shown.length).toBeCloseTo(authoredTicks, -0.5);
  });
});

describe('every defender that attacks plays its full sheet once, at every level', () => {
  /**
   * Derived, not listed. The manifest key is what AssetManifest is keyed by and
   * defenderUnitClasses is the module's own map from it to the class, so a new
   * defender is covered as soon as it is registered - the same reason bug 1's
   * hand-written list let a silent unit through.
   */
  const attackingDefenders = Object.entries(defenderUnitClasses)
    .filter(([manifestName, DefenderClass]) => {
      const probe = new DefenderClass(0, 0, { level: 1, image: null });
      // CombatManager's own gate for "this unit takes a shot".
      return probe.attackDamage > 0 && probe.range > 0 && AssetManifest.defenders[manifestName];
    })
    .flatMap(([manifestName, DefenderClass]) =>
      [1, 3, 5].map((level) => [`${DefenderClass.name} L${level}`, manifestName, DefenderClass, level]),
    );

  it('derives a non-trivial list of units and levels', () => {
    const names = attackingDefenders.map(([label]) => label);
    expect(names).toEqual(
      expect.arrayContaining(['BasicDefender L1', 'BasicDefender L3', 'Mortar L1', 'Sniper L5']),
    );
  });

  it.each(attackingDefenders)('%s plays its sheet exactly once per shot', (label, manifestName, DefenderClass, level) => {
    const engine = createEngine();
    const defender = withManifestAnimations(
      new DefenderClass(0, 0, { level, image: null }), 'defenders', manifestName,
    );
    defender.gameEngine = engine;

    const distance = ((defender.minimumRange || 0) + defender.range) / 2;
    const target = {
      x: defender.x + defender.width / 2 + distance - 20,
      y: defender.y + defender.height / 2 - 20,
      width: 40, height: 40, id: 'target',
      isAlive: true, isSpawned: false, frozen: false, slowed: false,
      health: 100, maxHealth: 100, attackDamage: 0,
      takeDamage: vi.fn(() => false),
    };
    engine.enemies = [target];

    new CombatManager(engine).updateDefenderCombat([defender], [target], 100000);

    const cadenceTicks = defender.fireRate;
    const shown = recordAttackFrames(
      defender, () => defender.update([target], [defender]), cadenceTicks + 2,
    );
    const sheet = AssetManifest.defenders[manifestName].config.attack;

    expectExactlyOneFullPass(shown, sheet.frameCount, label);
    // Back to idle before the next shot: an attack animation still running when
    // the unit fires again is the latch this whole fix exists to prevent.
    expect(defender.currentAnimation, `${label}: animation after one cadence`).not.toBe('attack');
  });
});

describe('the Healer plays its heal animation once per heal', () => {
  it('hands back to idle instead of holding the sheet for a fixed 180 frames', () => {
    // The Healer's own timer held the attack animation for 180 frames (3s)
    // while its heal cadence is 120 frames (2s), so the sheet looped rather
    // than playing once - the same shape as the Mortar's firing timer.
    const engine = createEngine();
    const healer = withManifestAnimations(
      new HealerDefender(0, 0, { level: 1, image: null }), 'defenders', 'Healer',
    );
    healer.gameEngine = engine;
    healer.healingCountdown = 1;
    const ally = {
      id: 'ally', isAlive: true, health: 10, maxHealth: 100,
      x: 0, y: 0, width: 64, height: 64,
    };

    const shown = recordAttackFrames(
      healer, () => healer.update([], [healer, ally]), healer.healingRate + 2,
    );
    const sheet = AssetManifest.defenders.Healer.config.attack;

    expectExactlyOneFullPass(shown, sheet.frameCount, 'healer');
  });
});

describe('the module no longer exports a fixed animation lock', () => {
  it('has no attackAnimationLock field left on a defender', async () => {
    // Known issue 15: DefenderUnits.js read `this.attackAnimationLock <= 0` in a
    // guard that was never assigned, so it was always undefined and the guard
    // never ran. Cadence-derived playback supersedes it; this asserts the dead
    // field is gone rather than merely unused.
    const source = Object.values(DefenderModule).filter((value) => typeof value === 'function');
    expect(source.length).toBeGreaterThan(0);
    expect(new Mortar(0, 0, { level: 1, image: null })).not.toHaveProperty('attackAnimationLock');
    expect(new DefenderUnit(0, 0, {})).not.toHaveProperty('attackAnimationLock');
  });

  it('no longer exports ATTACK_ANIMATION_LOCK_FRAMES', async () => {
    const EnemyModule = await import('../EnemyUnits.js');
    expect(EnemyModule).not.toHaveProperty('ATTACK_ANIMATION_LOCK_FRAMES');
  });
});
