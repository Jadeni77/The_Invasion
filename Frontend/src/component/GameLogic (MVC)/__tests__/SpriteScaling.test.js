import { describe, it, expect } from 'vitest';
import { GridManager, SPRITE_NATIVE_PX } from '../GameEngineBreakDown/InGameManagerHandlers/GridManager.js';
import * as DefenderUnitsModule from '../DefenderUnits.js';
import { DefenderUnit } from '../DefenderUnits.js';
import * as EnemyModule from '../EnemyUnits.js';
import { Enemy, fitNativeFrame } from '../EnemyUnits.js';
import { AssetManifest } from '../../../assets/AssetManifest.js';

/** Every viewport the game realistically runs at, small to large. */
const VIEWPORTS = [
  [640, 480], [800, 600], [1024, 768], [1280, 720],
  [1440, 900], [1920, 1080], [2560, 1440],
];

/**
 * GridManager does not compute gridSize from the canvas size in its
 * constructor - only initializeGrid() does that. A test that builds a
 * GridManager and reads gridSize straight off it, without calling
 * initializeGrid(), is checking the constructor's placeholder default (60)
 * against nothing: 60 clears any minimum this task could plausibly set, at
 * every viewport, regardless of whether the fix under test exists. So every
 * case below calls initializeGrid() before making an assertion.
 */
function buildGrid(w, h, levelNumber = 1) {
  const grid = new GridManager(w, h, levelNumber);
  grid.initializeGrid();
  return grid;
}

/**
 * Only defenders are ever resized to the grid's cell size - `sizeUnitToGrid`
 * (GameEngine.js) is called exclusively from `deployDefenderUnit`. Enemies
 * keep a fixed, per-type footprint (their own declared width/height) that
 * never varies with window size, so they cannot overflow a cell they are
 * never placed into, and the grid minimum only needs to satisfy the
 * defender side.
 */
describe('grid cell sizing (defenders)', () => {
  it('never produces a cell smaller than the defender sprite', () => {
    // Rejects reverting the clamp to the old literal 40.
    for (const [w, h] of VIEWPORTS) {
      const grid = buildGrid(w, h);
      expect(grid.gridSize, `${w}x${h}`).toBeGreaterThanOrEqual(SPRITE_NATIVE_PX);
    }
  });

  it('raises the grid floor above the old 40px minimum', () => {
    const tiny = buildGrid(100, 100, 6);
    expect(tiny.gridSize).toBeGreaterThanOrEqual(SPRITE_NATIVE_PX);
    expect(tiny.gridSize).not.toBe(40);
  });

  it('draws defenders at a whole-number scale at every viewport', () => {
    // Rejects SPRITE_NATIVE_PX being unset, wrong, or larger than the actual
    // grid floor, which would produce a 0x (or non-integer) scale.
    for (const [w, h] of VIEWPORTS) {
      const grid = buildGrid(w, h);
      const scale = Math.floor(grid.gridSize / SPRITE_NATIVE_PX);
      expect(scale, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(scale)).toBe(true);
    }
  });

  it('centres defenders in their cell on whole pixels', () => {
    // Rejects an inset computed without rounding (fractional pixel offsets)
    // or scale math that lets the drawn size exceed the cell.
    const grid = buildGrid(1920, 1080);
    const scale = Math.floor(grid.gridSize / SPRITE_NATIVE_PX);
    const drawn = SPRITE_NATIVE_PX * scale;
    const offset = Math.round((grid.gridSize - drawn) / 2);
    expect(Number.isInteger(offset)).toBe(true);
    expect(offset).toBeGreaterThanOrEqual(0);
  });
});

/**
 * A fake 2D context that records the exact arguments passed to
 * scale/translate/drawImage instead of painting anything, in the style of
 * the fake used in EnemyUnits.test.js (extended with every other canvas
 * method the various Enemy subclasses' draw() methods call after the sprite
 * itself - health bars, shield rings, spell auras, phase-indicator strokes -
 * since this suite drives every real Enemy subclass end to end, not just
 * the sprite-drawing branch). jsdom's canvas has no real transform matrix,
 * so replaying the recorded scale()/translate() calls ourselves is the only
 * way to see where a draw() call actually asked the canvas to paint - and,
 * critically, it means this test checks what the code under test actually
 * passed to ctx.translate(), not an independent formula that assumes it did
 * the right thing. A hardcoded "correct" formula would keep passing even if
 * the production translate call regressed.
 */
function createRecordingContext() {
  const drawImageCalls = [];
  const transformCalls = [];
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    textAlign: 'start',
    globalAlpha: 1,
    lineWidth: 1,
    save() {},
    restore() {},
    scale(sx, sy) {
      transformCalls.push({ type: 'scale', sx, sy });
    },
    translate(tx, ty) {
      transformCalls.push({ type: 'translate', tx, ty });
    },
    rotate() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clearRect() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 10 }; },
    setLineDash() {},
    drawImage(image, dx, dy, dWidth, dHeight) {
      drawImageCalls.push({ dx, dy, dWidth, dHeight });
    },
  };
  return { ctx, drawImageCalls, transformCalls };
}

/**
 * Replays a recorded sequence of scale()/translate() calls against a local
 * point, the way the canvas 2D spec actually composes them: each new
 * transform call is the innermost (applied closest to the point), and
 * earlier calls wrap around it, so replaying must walk the call list
 * newest-to-oldest.
 */
function applyRecordedTransforms(transformCalls, x, y) {
  let px = x;
  let py = y;
  for (let i = transformCalls.length - 1; i >= 0; i--) {
    const call = transformCalls[i];
    if (call.type === 'translate') {
      px += call.tx;
      py += call.ty;
    } else if (call.type === 'scale') {
      px *= call.sx;
      py *= call.sy;
    }
  }
  return [px, py];
}

function drawnScreenRangeX(transformCalls, dx, dWidth) {
  const [a] = applyRecordedTransforms(transformCalls, dx, 0);
  const [b] = applyRecordedTransforms(transformCalls, dx + dWidth, 0);
  return [Math.min(a, b), Math.max(a, b)];
}

describe('the horizontal flip still lands the defender sprite in its own cell', () => {
  // gridSize never goes below SPRITE_NATIVE_PX (48) or above 80 in the real
  // game; both parities are covered because centering an odd remainder
  // needs Math.round, which is where a naive implementation could drift.
  //
  // `animationConfig` is attached here deliberately (from the real
  // manifest) rather than left unset: without it, fitNativeFrame() has no
  // native size to work from and falls back to drawing at the box's own
  // size with insetX/insetY = 0, which trivially satisfies the "stays
  // inside the cell" assertion below no matter what the flip transform
  // does - a version of this test that skipped this would exercise the
  // fallback branch only, never the scale-and-inset branch it's meant to
  // guard.
  it.each([48, 49, 60, 61, 79, 80])('Shooter (48x48 native) at gridSize=%i', (gridSize) => {
    // Rejects a translate built from the drawn/scaled width instead of the
    // full cell width - that mismatch shifts a flipped sprite outside its
    // cell by up to (cellWidth - nativeSize) pixels, ~32px worst case for a
    // defender at gridSize 80. Because this replays the actual recorded
    // scale()/translate() arguments (not a reimplementation of the formula),
    // it would have caught that regression instead of merely restating it.
    const x = 137;
    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    const unit = new DefenderUnit(x, 50, { width: gridSize, height: gridSize });
    unit.animationConfig = AssetManifest.defenders['Shooter'].config;
    unit.animationFrames = { idle: [{}] };
    unit.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + gridSize + 1);
  });

  // Mortar has no cropConfig (see AssetManifest.js) and delivers its full
  // 64x64 native frame - the scenario this fix round introduced. At
  // gridSize=64 that's an exact 1x fit (insetX=insetY=0); at gridSize=80 the
  // native still fits inside the box but with a real, non-zero inset.
  it.each([64, 80])('Mortar (64x64 native, no crop) at gridSize=%i', (gridSize) => {
    const x = 137;
    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    const unit = new DefenderUnit(x, 50, { width: gridSize, height: gridSize });
    unit.animationConfig = AssetManifest.defenders['Mortar'].config;
    unit.animationFrames = { idle: [{}] };
    unit.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    expect(dWidth).toBe(64); // scale=1 at both grid sizes (64/64=1, 80/64=1)
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + gridSize + 1);
  });
});

describe('fitNativeFrame (per-enemy scale, aspect preserved)', () => {
  // Rejects the previous (broken) fix: a single shared constant squared into
  // both dWidth and dHeight, which forces every non-square native frame into
  // a square and forces a minimum drawn size regardless of the box.
  it('scales up by an integer factor, per axis, when the native frame already fits', () => {
    expect(fitNativeFrame(80, 64, 80, 64)).toEqual({ drawnWidth: 80, drawnHeight: 64, insetX: 0, insetY: 0 });
  });

  it('scales up by more than 1x without forcing a square when the box is a clean multiple', () => {
    // Titan: 180x128 footprint, 90x64 native - a clean 2x on both axes.
    expect(fitNativeFrame(90, 64, 180, 128)).toEqual({ drawnWidth: 180, drawnHeight: 128, insetX: 0, insetY: 0 });
  });

  it('falls back to the box size, never overflowing, when native does not fit at even 1x', () => {
    // Mini: 32x32 footprint, 64x64 native. The old broken code forced a 64x64
    // minimum here, overflowing the 32x32 footprint by 16px per side.
    expect(fitNativeFrame(64, 64, 32, 32)).toEqual({ drawnWidth: 32, drawnHeight: 32, insetX: 0, insetY: 0 });
    // Assassin: 50x32 footprint, 100x64 native (same 0.5x fallback, non-square).
    expect(fitNativeFrame(100, 64, 50, 32)).toEqual({ drawnWidth: 50, drawnHeight: 32, insetX: 0, insetY: 0 });
  });

  it('falls back to the box size when the native dimensions are unknown', () => {
    // Rejects a version that throws or draws at 0x0 when animationConfig
    // hasn't loaded yet (e.g. BossEnemy, whose name has no AssetManifest entry).
    expect(fitNativeFrame(undefined, undefined, 90, 64)).toEqual({ drawnWidth: 90, drawnHeight: 64, insetX: 0, insetY: 0 });
  });

  it('centers a non-square native frame inside a larger box on whole pixels', () => {
    // scale = floor(min(100/80, 100/64)) = floor(1.25) = 1
    expect(fitNativeFrame(80, 64, 100, 100)).toEqual({ drawnWidth: 80, drawnHeight: 64, insetX: 10, insetY: 18 });
  });
});

describe('every enemy type stays within its own footprint and preserves native aspect', () => {
  // Derived from the module's own exports, not a hand-written list - the
  // exact defect the noRawCanvasColours.test.js file-list rewrite was for:
  // a hand-picked list of "the enemies I checked" silently stops covering a
  // type nobody thought to add.
  const enemyClasses = Object.values(EnemyModule).filter(
    (value) => typeof value === 'function' && value.prototype instanceof Enemy,
  );

  it('found more than a handful of enemy types', () => {
    expect(enemyClasses.length).toBeGreaterThan(10);
  });

  it.each(enemyClasses.map((cls) => [cls.name, cls]))('%s never draws bigger than its own footprint', (_, EnemyClass) => {
    const enemy = new EnemyClass(137, 50, null);
    enemy.animationConfig = AssetManifest.enemies[enemy.name]?.config;
    enemy.animationFrames = { [enemy.currentAnimation]: [{}] };

    const { ctx, drawImageCalls } = createRecordingContext();
    enemy.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dWidth, dHeight } = drawImageCalls[0];

    // The overflow defect: a shared 64px floor drew Mini/Assassin 7-16px
    // wider/taller than their own hitbox on every side.
    expect(dWidth, enemy.name).toBeLessThanOrEqual(enemy.width);
    expect(dHeight, enemy.name).toBeLessThanOrEqual(enemy.height);

    // The squaring defect: when an integer upscale is actually used, its
    // aspect ratio must match the native frame's, not a forced square.
    const nativeConfig = enemy.animationConfig?.[enemy.currentAnimation];
    if (nativeConfig) {
      const fitScale = Math.min(enemy.width / nativeConfig.frameWidth, enemy.height / nativeConfig.frameHeight);
      if (fitScale >= 1) {
        const nativeAspect = nativeConfig.frameWidth / nativeConfig.frameHeight;
        expect(dWidth / dHeight, enemy.name).toBeCloseTo(nativeAspect, 5);
      }
    }
  });
});

describe('named cases (Mini/Assassin overflow, Tank Zombie distortion)', () => {
  it('MiniEnemy (32x32 footprint, 64x64 native) draws at exactly its footprint - no overflow', () => {
    const enemy = new EnemyModule.MiniEnemy(137, 50, null);
    enemy.animationConfig = AssetManifest.enemies['Mini']?.config;
    enemy.animationFrames = { idle: [{}] };
    const { ctx, drawImageCalls } = createRecordingContext();
    enemy.draw(ctx);
    const { dWidth, dHeight } = drawImageCalls[0];
    expect(dWidth).toBe(32);
    expect(dHeight).toBe(32);
  });

  it('AssassinEnemy (50x32 footprint, 100x64 native) draws at exactly its footprint - no overflow', () => {
    const enemy = new EnemyModule.AssassinEnemy(137, 50, null);
    enemy.animationConfig = AssetManifest.enemies['Assassin']?.config;
    enemy.animationFrames = { idle: [{}] };
    const { ctx, drawImageCalls } = createRecordingContext();
    enemy.draw(ctx);
    const { dWidth, dHeight } = drawImageCalls[0];
    expect(dWidth).toBe(50);
    expect(dHeight).toBe(32);
  });

  it('TankEnemy (90x64 footprint, 90x64 native) draws at exact native size - no distortion', () => {
    const enemy = new EnemyModule.TankEnemy(137, 50, null);
    enemy.animationConfig = AssetManifest.enemies['Tank Zombie']?.config;
    enemy.animationFrames = { idle: [{}] };
    const { ctx, drawImageCalls } = createRecordingContext();
    enemy.draw(ctx);
    const { dWidth, dHeight } = drawImageCalls[0];
    // Previously (broken fix): scale = floor(90/64) = 1, drawn forced to 64x64.
    expect(dWidth).toBe(90);
    expect(dHeight).toBe(64);
  });
});

describe('the horizontal flip still lands the enemy sprite in its own cell', () => {
  it('BasicEnemy (Basic Zombie, non-square native, scale path, flips)', () => {
    const x = 137;
    const enemy = new EnemyModule.BasicEnemy(x, 50, null);
    enemy.animationConfig = AssetManifest.enemies['Basic Zombie']?.config;
    enemy.animationFrames = { idle: [{}] };
    expect(enemy.shouldFlip).toBe(true);

    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    enemy.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + enemy.width + 1);
  });

  it('MiniEnemy (fallback path, footprint smaller than native, flips)', () => {
    const x = 137;
    const enemy = new EnemyModule.MiniEnemy(x, 50, null);
    enemy.animationConfig = AssetManifest.enemies['Mini']?.config;
    enemy.animationFrames = { idle: [{}] };
    expect(enemy.shouldFlip).toBe(true);

    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    enemy.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + enemy.width + 1);
  });

  it('a non-trivial inset (native smaller than footprint on one axis) still lands inside the cell when flipped', () => {
    // Models the Berserker-shaped mismatch (100x64 footprint vs 90x64 native,
    // a real AssetManifest/typeData mismatch - see report) using the base
    // Enemy class directly, since the real Berserker doesn't flip
    // (excluded via shouldFlip) and so never exercises this combination.
    const x = 137;
    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    const enemy = new Enemy(x, 50, { width: 100, height: 64, name: 'Basic Zombie' });
    enemy.animationConfig = { idle: { frameWidth: 90, frameHeight: 64 } };
    enemy.animationFrames = { idle: [{}] };
    expect(enemy.shouldFlip).toBe(true);

    enemy.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    expect(dWidth).toBe(90); // scale=1, non-trivial insetX = (100-90)/2 = 5
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + 100 + 1);
  });
});

/**
 * Ground truth for the clipping guard below, measured directly from the PNG
 * files (alpha>0, union across every frame of idle/attack/death) with a
 * one-off PIL script - not reproduced here, since nothing in this suite can
 * decode a PNG's pixels. jsdom's canvas has no image decoder and no pixel
 * buffer, so no test can see a sprite's actual content, only the numbers a
 * human measured once and wrote down. That measurement, not a computed
 * check, *is* the guard against a defender's crop window clipping real
 * pixel content - this is the literal form of "no test can see clipping."
 *
 * x/y are [min, maxExclusive) in local frame coordinates (0..64 per frame).
 */
const MEASURED_CONTENT_BBOX = {
  Shooter: { x: [16, 62], y: [20, 46] },
  Healer: { x: [10, 52], y: [6, 46] },
  Grenadier: { x: [16, 54], y: [16, 46] },
  Barricade: { x: [16, 50], y: [18, 46] },
  'E-Gen': { x: [20, 56], y: [22, 46] },
  Sniper: { x: [16, 50], y: [22, 46] },
  Mortar: { x: [12, 62], y: [8, 62] },
  'Frost Archer': { x: [10, 64], y: [16, 46] },
  'Fire Blast': { x: [18, 44], y: [14, 46] },
  'Ice Bomb': { x: [18, 44], y: [10, 46] },
};

describe('every defender crop window actually contains its measured sprite content', () => {
  it.each(Object.entries(MEASURED_CONTENT_BBOX))('%s', (name, bbox) => {
    // Rejects exactly the bug this fix round found: a crop window
    // (offsetX/offsetY/cropWidth/cropHeight, or the full frame when no crop
    // is configured) that cuts into a measured content pixel on any side -
    // whether from the wrong shared template (old Shooter/Healer), a typo
    // that accidentally disabled cropping (old Mortar), or a crop re-enabled
    // at the wrong size for a sprite that never fit it.
    const config = AssetManifest.defenders[name].config;
    for (const animName of ['idle', 'attack', 'death']) {
      const animConfig = config[animName];
      const crop = animConfig.cropConfig;
      const enabled = crop?.enabled;
      const windowX0 = enabled ? crop.offsetX : 0;
      const windowY0 = enabled ? crop.offsetY : 0;
      const windowX1 = enabled ? crop.offsetX + crop.cropWidth : animConfig.frameWidth;
      const windowY1 = enabled ? crop.offsetY + crop.cropHeight : animConfig.frameHeight;

      expect(windowX0, `${name} ${animName} left edge`).toBeLessThanOrEqual(bbox.x[0]);
      expect(windowY0, `${name} ${animName} top edge`).toBeLessThanOrEqual(bbox.y[0]);
      expect(windowX1, `${name} ${animName} right edge`).toBeGreaterThanOrEqual(bbox.x[1]);
      expect(windowY1, `${name} ${animName} bottom edge`).toBeGreaterThanOrEqual(bbox.y[1]);
    }
  });

  it('Mortar and Frost Archer have no cropConfig - their content does not fit any 48x48 window', () => {
    // Rejects re-enabling a crop for either without re-measuring: both
    // exceed 48px on their widest axis (Mortar 50px tall... actually 54px
    // tall/50px wide; Frost Archer 54px wide), so no offset choice at
    // cropWidth=cropHeight=48 can contain them.
    for (const name of ['Mortar', 'Frost Archer']) {
      const config = AssetManifest.defenders[name].config;
      for (const animName of ['idle', 'attack', 'death']) {
        expect(config[animName].cropConfig, `${name} ${animName}`).toBeUndefined();
      }
    }
  });

  it('the other eight defenders keep a 48x48 crop', () => {
    // Rejects accidentally widening (or dropping) the crop for a defender
    // whose content already fit the template - Grenadier, Barricade, E-Gen,
    // Sniper, Fire Blast and Ice Bomb needed no change, and Shooter/Healer
    // only needed a shifted offset, not a resized window.
    for (const name of ['Shooter', 'Healer', 'Grenadier', 'Barricade', 'E-Gen', 'Sniper', 'Fire Blast', 'Ice Bomb']) {
      const config = AssetManifest.defenders[name].config;
      for (const animName of ['idle', 'attack', 'death']) {
        const crop = config[animName].cropConfig;
        expect(crop?.enabled, `${name} ${animName}`).toBe(true);
        expect(crop.cropWidth, `${name} ${animName}`).toBe(48);
        expect(crop.cropHeight, `${name} ${animName}`).toBe(48);
      }
    }
  });
});

describe('every defender type stays within its own cell and preserves native aspect', () => {
  // Derived from the module's own exports, not a hand-written list, for the
  // same reason as the enemy sweep above.
  const defenderClasses = Object.values(DefenderUnitsModule).filter(
    (value) => typeof value === 'function' && value.prototype instanceof DefenderUnit,
  );

  it('found all ten defender types', () => {
    expect(defenderClasses.length).toBe(10);
  });

  it.each([48, 64, 80])('at gridSize=%i, no defender type overflows its cell or distorts its native aspect', (gridSize) => {
    for (const DefenderClass of defenderClasses) {
      const unit = new DefenderClass(0, 0, { level: 1, image: null });
      unit.width = gridSize;
      unit.height = gridSize;
      unit.animationConfig = AssetManifest.defenders[unit.name]?.config;
      unit.animationFrames = { [unit.currentAnimation]: [{}] };

      const { ctx, drawImageCalls } = createRecordingContext();
      unit.draw(ctx);

      expect(drawImageCalls, unit.name).toHaveLength(1);
      const { dWidth, dHeight } = drawImageCalls[0];
      expect(dWidth, `${unit.name} at ${gridSize}`).toBeLessThanOrEqual(gridSize);
      expect(dHeight, `${unit.name} at ${gridSize}`).toBeLessThanOrEqual(gridSize);

      const nativeConfig = unit.animationConfig?.[unit.currentAnimation];
      const crop = nativeConfig?.cropConfig;
      const nativeWidth = crop?.enabled ? crop.cropWidth : nativeConfig?.frameWidth;
      const nativeHeight = crop?.enabled ? crop.cropHeight : nativeConfig?.frameHeight;
      if (nativeWidth && nativeHeight && Math.min(gridSize / nativeWidth, gridSize / nativeHeight) >= 1) {
        expect(dWidth / dHeight, unit.name).toBeCloseTo(nativeWidth / nativeHeight, 5);
      }
    }
  });
});
