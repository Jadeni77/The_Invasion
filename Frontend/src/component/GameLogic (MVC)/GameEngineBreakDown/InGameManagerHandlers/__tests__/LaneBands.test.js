import { describe, it, expect, vi } from 'vitest';
import { GridManager } from '../GridManager.js';

function fakeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(),
    set fillStyle(v) { this._fills.push(v); },
    get fillStyle() { return this._fills.at(-1); },
    _fills: [],
  };
}

describe('lane bands', () => {
  it('draws one band per row', () => {
    // Rejects a fixed band count (e.g. always 1, or always the constructor's
    // deploymentGrid.length before initializeGrid runs) instead of one band
    // per row the level actually has.
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    expect(ctx.fillRect).toHaveBeenCalledTimes(grid.getRowsForLevel());
  });

  it('draws one band per row at a deeper level too', () => {
    // Rejects a hardcoded row count of 1 that happens to satisfy the test
    // above only because level 1 has a single row.
    const grid = new GridManager(1280, 720, 4);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    expect(ctx.fillRect).toHaveBeenCalledTimes(grid.getRowsForLevel());
    expect(grid.getRowsForLevel()).toBe(4);
  });

  it('alternates between two tones so adjacent rows are distinguishable', () => {
    // Rejects painting every row the same colour, which would make the grid
    // no more legible than the current invisible-until-highlighted state.
    const grid = new GridManager(1280, 720, 1);
    grid.levelNumber = 6;
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    const distinct = new Set(ctx._fills);
    expect(distinct.size).toBe(2);
  });

  it('leaves canvas state as it found it', () => {
    // Rejects an implementation that mutates fillStyle without a matching
    // save()/restore() pair - exactly the class of bug that leaked
    // CardPieceDrop's textAlign into later draws.
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('spans the full grid width', () => {
    // Rejects a band width derived from the constructor's placeholder
    // gridSize/cols (or a wrong literal) instead of the level's actual
    // column count times the current cell size.
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    const widths = ctx.fillRect.mock.calls.map((c) => c[2]);
    for (const w of widths) expect(w).toBe(grid.getColsForLevel() * grid.gridSize);
  });

  it('positions each band at the grid offset, one gridSize apart', () => {
    // Rejects bands positioned at raw row indices (ignoring gridOffsetX/Y) or
    // stacked at the same Y, which would overlap instead of tiling the rows.
    const grid = new GridManager(1280, 720, 3);
    grid.gridOffsetX = 82;
    grid.gridOffsetY = 44;
    grid.gridSize = 55;
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    const calls = ctx.fillRect.mock.calls;
    expect(calls[0]).toEqual([82, 44, grid.getColsForLevel() * 55, 55]);
    expect(calls[1]).toEqual([82, 44 + 55, grid.getColsForLevel() * 55, 55]);
    expect(calls[2]).toEqual([82, 44 + 110, grid.getColsForLevel() * 55, 55]);
  });
});
