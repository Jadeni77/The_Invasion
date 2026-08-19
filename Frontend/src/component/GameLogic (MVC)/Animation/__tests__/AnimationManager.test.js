import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationManager } from '../AnimationManager.js';
import { AssetManifest } from '../../../../assets/AssetManifest.js';

/*
 * Bug: the enemy Healer (EnemyUnits.js HealerEnemy) and the defender Healer
 * (DefenderUnits.js HealerDefender) share the literal unit-type name "Healer".
 */

// jsdom does not implement image decoding or a real canvas 2d context, so
// both are stubbed here the same way other tests in this suite fake canvas
// drawing (see GameEngineBreakDown/__tests__/canvasState.test.js).
function stubImageAndCanvas() {
  class FakeImage {
    set src(_value) {
      // AnimationManager awaits an onload/onerror event via a Promise;
      // resolve it asynchronously like a real image load would.
      Promise.resolve().then(() => {
        this.complete = true;
        this.naturalWidth = 64;
        if (this.onload) this.onload();
      });
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', FakeImage);

  const originalCreateElement = document.createElement.bind(document);
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: () => {} }),
        };
      }
      return originalCreateElement(tag);
    });

  return () => {
    vi.unstubAllGlobals();
    createElementSpy.mockRestore();
  };
}

/** Sprite-file config in the shape AnimationManager.loadUnitAnimation expects. */
function animationFiles(frameCount) {
  return {
    idle: { path: 'idle.png', frameCount, frameWidth: 64, frameHeight: 64 },
    attack: { path: 'attack.png', frameCount, frameWidth: 64, frameHeight: 64 },
  };
}

describe('AnimationManager category isolation (enemy vs. defender "Healer")', () => {
  let restore;

  beforeEach(() => {
    restore = stubImageAndCanvas();
  });

  afterEach(() => {
    restore();
  });

  it('keeps a shared unit name from overwriting across enemy and defender categories', async () => {
    const manager = new AnimationManager();

    // Enemy Healer: AssetManifest.enemies.Healer.config.attack is 21 frames.
    await manager.loadUnitAnimation('Healer', animationFiles(21), 'enemies');
    // Defender Healer: AssetManifest.defenders.Healer.config.attack is 4 frames.
    await manager.loadUnitAnimation('Healer', animationFiles(4), 'defenders');

    expect(manager.hasAnimation('Healer', 'enemies')).toBe(true);
    expect(manager.hasAnimation('Healer', 'defenders')).toBe(true);

    // Each category must resolve to its own frame data, not whichever
    // loaded second.
    expect(manager.getFrames('Healer', 'attack', 'enemies')).toHaveLength(21);
    expect(manager.getFrames('Healer', 'attack', 'defenders')).toHaveLength(4);
  });
});

/*
 * Guard test: this class of bug is any unit-type name that appears in both
 * AssetManifest.enemies and AssetManifest.defenders.
 */
const sharedUnitTypeNames = Object.keys(AssetManifest.enemies).filter((name) =>
  Object.prototype.hasOwnProperty.call(AssetManifest.defenders, name),
);

describe('guard: names shared between AssetManifest.enemies and AssetManifest.defenders stay isolated per category', () => {
  let restore;

  beforeEach(() => {
    restore = stubImageAndCanvas();
  });

  afterEach(() => {
    restore();
  });

  // If this fails with an empty list, either a shared name was removed
  // (e.g. the Healer/Healer collision was disambiguated) or the manifest
  // shape changed - update or remove this guard accordingly rather than
  // letting it pass vacuously.
  it('finds at least one shared unit-type name to guard', () => {
    expect(sharedUnitTypeNames.length).toBeGreaterThan(0);
  });

  it.each(sharedUnitTypeNames)(
    '"%s" resolves to its own enemy and defender frame counts, not whichever loaded second',
    async (unitTypeName) => {
      const manager = new AnimationManager();

      const enemyConfig = AssetManifest.enemies[unitTypeName].config;
      const defenderConfig = AssetManifest.defenders[unitTypeName].config;

      const toAnimationFiles = (config, label) =>
        Object.fromEntries(
          Object.entries(config).map(([animName, cfg]) => [
            animName,
            { path: `${label}-${animName}.png`, ...cfg },
          ]),
        );

      await manager.loadUnitAnimation(
        unitTypeName,
        toAnimationFiles(enemyConfig, 'enemy'),
        'enemies',
      );
      await manager.loadUnitAnimation(
        unitTypeName,
        toAnimationFiles(defenderConfig, 'defender'),
        'defenders',
      );

      expect(manager.hasAnimation(unitTypeName, 'enemies')).toBe(true);
      expect(manager.hasAnimation(unitTypeName, 'defenders')).toBe(true);

      for (const [animName, cfg] of Object.entries(enemyConfig)) {
        expect(manager.getFrames(unitTypeName, animName, 'enemies')).toHaveLength(
          cfg.frameCount,
        );
      }
      for (const [animName, cfg] of Object.entries(defenderConfig)) {
        expect(
          manager.getFrames(unitTypeName, animName, 'defenders'),
        ).toHaveLength(cfg.frameCount);
      }
    },
  );
});
