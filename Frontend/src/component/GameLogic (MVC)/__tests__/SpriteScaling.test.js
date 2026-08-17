import { describe, it, expect } from 'vitest';
import {
  GridManager,
  SPRITE_NATIVE_PX,
  ENEMY_NATIVE_PX,
  MIN_CELL_PX,
} from '../GameEngineBreakDown/InGameManagerHandlers/GridManager.js';
import { DefenderUnit } from '../DefenderUnits.js';
import { Enemy } from '../EnemyUnits.js';

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
 * every viewport, regardless of whether the fix under test exists. That
 * would be a sixth guard that doesn't guard, so every case below calls
 * initializeGrid() before making an assertion.
 */
function buildGrid(w, h, levelNumber = 1) {
  const grid = new GridManager(w, h, levelNumber);
  grid.initializeGrid();
  return grid;
}

describe('sprite scaling', () => {
  it('derives MIN_CELL_PX from the larger of the two native sizes', () => {
    // Rejects a MIN_CELL_PX that is hardcoded to one side's number (e.g. left
    // at 48) instead of actually accounting for the other side.
    expect(MIN_CELL_PX).toBe(Math.max(SPRITE_NATIVE_PX, ENEMY_NATIVE_PX));
    expect(MIN_CELL_PX).toBeGreaterThanOrEqual(ENEMY_NATIVE_PX);
    expect(MIN_CELL_PX).toBeGreaterThanOrEqual(SPRITE_NATIVE_PX);
  });

  it('never produces a cell smaller than the larger native sprite it must hold', () => {
    // Rejects reverting the clamp to the old literal 40, or clamping only to
    // SPRITE_NATIVE_PX (48) while leaving enemies (native 64) able to
    // overflow a 48-63px cell.
    for (const [w, h] of VIEWPORTS) {
      const grid = buildGrid(w, h);
      expect(grid.gridSize, `${w}x${h}`).toBeGreaterThanOrEqual(MIN_CELL_PX);
    }
  });

  it('raises the grid floor above the old 40px minimum', () => {
    // Rejects an implementation that left the "minimum for playability"
    // clamp at 40 (or renamed the constant but forgot to change the value).
    const tiny = buildGrid(100, 100, 6);
    expect(tiny.gridSize).toBeGreaterThanOrEqual(MIN_CELL_PX);
    expect(tiny.gridSize).not.toBe(40);
  });

  it('draws defenders at a whole-number scale at every viewport', () => {
    // Rejects a fix that raises the floor but leaves SPRITE_NATIVE_PX unset,
    // wrong, or larger than the actual grid floor, which would produce a 0x
    // (or non-integer) defender scale at small viewports.
    for (const [w, h] of VIEWPORTS) {
      const grid = buildGrid(w, h);
      const scale = Math.floor(grid.gridSize / SPRITE_NATIVE_PX);
      expect(scale, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(scale)).toBe(true);
    }
  });

  it('draws enemies at a whole-number scale at every viewport', () => {
    // Rejects reusing the defender constant for enemies (48 does not divide
    // evenly against the enemy floor the same way, and more importantly does
    // not correspond to any real enemy asset dimension) or omitting
    // ENEMY_NATIVE_PX entirely.
    for (const [w, h] of VIEWPORTS) {
      const grid = buildGrid(w, h);
      const scale = Math.floor(grid.gridSize / ENEMY_NATIVE_PX);
      expect(scale, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(scale)).toBe(true);
    }
  });

  it('centres both sides in their cell on whole pixels', () => {
    // Rejects an inset computed without rounding (fractional pixel offsets)
    // or one that can go negative (drawn art bigger than the cell).
    const grid = buildGrid(1920, 1080);
    for (const nativePx of [SPRITE_NATIVE_PX, ENEMY_NATIVE_PX]) {
      const scale = Math.floor(grid.gridSize / nativePx);
      const drawn = nativePx * scale;
      const offset = Math.round((grid.gridSize - drawn) / 2);
      expect(Number.isInteger(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * A minimal fake 2D context that records the exact arguments passed to
 * scale/translate/drawImage instead of painting anything, in the style of
 * the fake used in EnemyUnits.test.js. jsdom's canvas has no real transform
 * matrix, so replaying these recorded calls ourselves is the only way to see
 * where a draw() call actually asked the canvas to paint - and, critically,
 * it means this test checks what the code under test actually passed to
 * ctx.translate(), not an independent formula that assumes it did the right
 * thing. A hardcoded "correct" formula would keep passing even if the
 * production translate call regressed.
 */
function createRecordingContext() {
  const drawImageCalls = [];
  const transformCalls = [];
  const ctx = {
    fillStyle: '#000000',
    font: '10px sans-serif',
    save() {},
    restore() {},
    scale(sx, sy) {
      transformCalls.push({ type: 'scale', sx, sy });
    },
    translate(tx, ty) {
      transformCalls.push({ type: 'translate', tx, ty });
    },
    fillRect() {},
    fillText() {},
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

describe('the horizontal flip still lands the sprite in its own cell', () => {
  // gridSize never goes below MIN_CELL_PX (64) or above 80 in the real game;
  // both parities are covered because centering an odd remainder needs
  // Math.round, which is where a naive implementation could drift.
  it.each([64, 65, 70, 71, 79, 80])('defender at gridSize=%i', (gridSize) => {
    // Rejects a translate built from the drawn/scaled width instead of the
    // full cell width - that mismatch shifts a flipped sprite outside its
    // cell by up to (cellWidth - nativeSize) pixels, ~16px worst case for a
    // defender at gridSize 80. Because this replays the actual recorded
    // scale()/translate() arguments (not a reimplementation of the formula),
    // it would have caught that regression instead of merely restating it.
    const x = 137;
    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    const unit = new DefenderUnit(x, 50, { width: gridSize, height: gridSize });
    unit.animationFrames = { idle: [{}] };
    unit.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + gridSize + 1);
  });

  it.each([64, 65, 70, 71, 79, 80])('enemy at gridSize=%i', (gridSize) => {
    const x = 137;
    const { ctx, drawImageCalls, transformCalls } = createRecordingContext();
    const enemy = new Enemy(x, 50, { width: gridSize, height: gridSize });
    enemy.animationFrames = { idle: [{}] };
    enemy.draw(ctx);

    expect(drawImageCalls).toHaveLength(1);
    const { dx, dWidth } = drawImageCalls[0];
    const [left, right] = drawnScreenRangeX(transformCalls, dx, dWidth);
    expect(left).toBeGreaterThanOrEqual(x - 1);
    expect(right).toBeLessThanOrEqual(x + gridSize + 1);
  });
});
