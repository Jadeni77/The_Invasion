/* The board fits the board, and it is the same board on every device. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GridManager, SPRITE_NATIVE_PX } from '../GridManager.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const boardJsx = readFileSync(
  join(HERE, '..', '..', '..', '..', 'GameRendering', 'GameBoard.jsx'),
  'utf8',
);

/** The logical size the component declares, read from source rather than guessed. */
function logicalSize() {
  const w = /const LOGICAL_WIDTH\s*=\s*(\d+)/.exec(boardJsx);
  const h = /const LOGICAL_HEIGHT\s*=\s*(\d+)/.exec(boardJsx);
  return { w: Number(w?.[1]), h: Number(h?.[1]) };
}

const LEVELS = [1, 2, 3, 5, 10, 20];

describe('the playfield is a fixed size, not the window size', () => {
  it('declares a logical width and height', () => {
    const { w, h } = logicalSize();
    expect(w, 'LOGICAL_WIDTH not found').toBeGreaterThan(0);
    expect(h, 'LOGICAL_HEIGHT not found').toBeGreaterThan(0);
  });

  it('sizes the canvas from those, not from the container', () => {
    // `canvas.width = container.clientWidth` is the line this replaces.
    expect(boardJsx).toMatch(/canvasRef\.current\.width\s*=\s*LOGICAL_WIDTH/);
    expect(boardJsx).not.toMatch(/canvasRef\.current\.width\s*=\s*container\.clientWidth/);
  });

  it('puts the base at a fixed distance, so a lane is the same length everywhere', () => {
    // This was `container.clientWidth * 0.9`, which is what made a phone lane a
    // third of a laptop's.
    expect(boardJsx).toMatch(/defenseLineX\s*=\s*LOGICAL_WIDTH\s*\*\s*0\.9/);
    expect(boardJsx).not.toMatch(/defenseLineX\s*=\s*container\.clientWidth/);
  });

  it('maps pointer coordinates back through the scale factor', () => {
    // The bitmap and its CSS box are now different sizes, so a raw
    // `clientX - rect.left` lands in the wrong column on any screen that is not
    // exactly LOGICAL_WIDTH wide.
    expect(boardJsx).toMatch(/canvas\.width\s*\/\s*rect\.width/);
    expect(boardJsx).toMatch(/canvas\.height\s*\/\s*rect\.height/);
  });
});

describe('every deployable cell is on the board and in front of the base', () => {
  const { w, h } = logicalSize();

  it.each(LEVELS)('level %i grid starts inside the canvas', (level) => {
    const grid = new GridManager(w, h, level);
    grid.initializeGrid();
    // A negative offset is the bug: the first column rendered off the left edge
    // and could not be clicked.
    expect(grid.gridOffsetX, `level ${level} offset`).toBeGreaterThanOrEqual(0);
    expect(grid.gridOffsetY, `level ${level} offset`).toBeGreaterThanOrEqual(0);
  });

  it.each(LEVELS)('level %i grid ends inside the canvas', (level) => {
    const grid = new GridManager(w, h, level);
    grid.initializeGrid();
    const right = grid.gridOffsetX + grid.getColsForLevel() * grid.gridSize;
    const bottom = grid.gridOffsetY + grid.getRowsForLevel() * grid.gridSize;
    expect(right, `level ${level} right edge`).toBeLessThanOrEqual(w);
    expect(bottom, `level ${level} bottom edge`).toBeLessThanOrEqual(h);
  });

  it.each(LEVELS)('level %i never puts a cell behind the base', (level) => {
    const grid = new GridManager(w, h, level);
    grid.initializeGrid();
    const defenseLineX = w * 0.9;
    for (const row of grid.deploymentGrid) {
      for (const cell of row) {
        expect(
          cell.x + grid.gridSize,
          `level ${level} cell (${cell.row},${cell.col}) is past the base`,
        ).toBeLessThanOrEqual(defenseLineX);
      }
    }
  });

  it('keeps cells at least as large as the art they hold', () => {
    const grid = new GridManager(w, h, 5);
    grid.initializeGrid();
    // The clamp that caused the overflow is fine in itself - the board just has
    // to be big enough to honour it.
    expect(grid.gridSize).toBeGreaterThanOrEqual(SPRITE_NATIVE_PX);
  });

  it('leaves a real walk between the spawn point and the base', () => {
    // Enemies spawn at getEnemySpawnX(). The complaint this fixes was that the
    // walk was too short to react to; assert it is a substantial fraction of the
    // board rather than a handful of pixels.
    const grid = new GridManager(w, h, 5);
    const spawnX = grid.getEnemySpawnX();
    const lane = w * 0.9 - spawnX;
    // 1252px on a 1280px board: the enemy crosses nearly all of it. The number
    // that matters is the comparison - the same walk measured 451px on a 390px
    // phone under the old screen-sized playfield, under a third of a laptop's.
    expect(lane).toBeGreaterThan(w * 0.95);
    expect(lane, 'a phone used to get 451px of walk').toBeGreaterThan(451 * 2);
  });
});
