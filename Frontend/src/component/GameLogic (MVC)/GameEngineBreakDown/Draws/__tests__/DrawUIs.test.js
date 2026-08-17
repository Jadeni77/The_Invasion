import { describe, it, expect, vi } from 'vitest';
import { DrawUIs } from '../DrawUIs.js';
import { GridManager } from '../../InGameManagerHandlers/GridManager.js';

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(v) { this._fills.push(v); },
    get fillStyle() { return this._fills.at(-1); },
    set strokeStyle(v) { this._strokes.push(v); },
    get strokeStyle() { return this._strokes.at(-1); },
    lineWidth: 1,
    _fills: [],
    _strokes: [],
  };
}

function makeGameEngine(levelNumber) {
  const canvasWidth = 1280;
  const canvasHeight = 720;
  const gridManager = new GridManager(canvasWidth, canvasHeight, levelNumber);
  gridManager.initializeGrid();
  return {
    canvasWidth,
    canvasHeight,
    defenseLineX: canvasWidth - 60,
    gridManager,
  };
}

describe('drawBackground base rendering', () => {
  it('sizes the base to the grid rows, not a fixed fraction of canvas height', () => {
    // Rejects the old fixed canvasHeight*0.3..0.7 sizing, which drew the same
    // base height at level 1 (1 row) and level 6 (6 rows) - the exact defect
    // this task calls out ("meets the playfield exactly").
    const shallow = makeGameEngine(1);
    const deep = makeGameEngine(6);

    const ctxShallow = fakeCtx();
    new DrawUIs(shallow).drawBackground(ctxShallow);

    const ctxDeep = fakeCtx();
    new DrawUIs(deep).drawBackground(ctxDeep);

    const bodyShallow = ctxShallow.fillRect.mock.calls.find((c) => c[0] === shallow.defenseLineX);
    const bodyDeep = ctxDeep.fillRect.mock.calls.find((c) => c[0] === deep.defenseLineX);

    expect(bodyShallow[3]).toBe(shallow.gridManager.getRowsForLevel() * shallow.gridManager.gridSize);
    expect(bodyDeep[3]).toBe(deep.gridManager.getRowsForLevel() * deep.gridManager.gridSize);
    expect(bodyDeep[3]).not.toBe(bodyShallow[3]);
  });

  it('places the base on the defended (right) edge, not the enemy entry side', () => {
    // Rejects positioning the base at x=0 or gridOffsetX (the left strip
    // where enemies spawn and walk on) - the brief's original drawBase draft
    // used that side, which is the wrong side of this battlefield.
    const engine = makeGameEngine(3);
    const ctx = fakeCtx();
    new DrawUIs(engine).drawBackground(ctx);

    const body = ctx.fillRect.mock.calls.find((c) => c[0] === engine.defenseLineX);
    expect(body).toBeDefined();
    expect(engine.defenseLineX).toBeGreaterThan(engine.gridManager.gridOffsetX);
  });

  it('leaves canvas state as it found it', () => {
    // Rejects a version that sets fillStyle/strokeStyle/lineWidth for the
    // base without a matching save()/restore() pair - the same class of bug
    // that leaked CardPieceDrop's textAlign into later draws.
    const engine = makeGameEngine(2);
    const ctx = fakeCtx();
    new DrawUIs(engine).drawBackground(ctx);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('does not draw a degenerate rectangle when there is no room for the base', () => {
    // Rejects an implementation missing the width/height guard, which would
    // hand fillRect a zero or negative width.
    const engine = makeGameEngine(1);
    engine.defenseLineX = engine.canvasWidth;
    const ctx = fakeCtx();
    new DrawUIs(engine).drawBackground(ctx);
    const body = ctx.fillRect.mock.calls.find((c) => c[0] === engine.defenseLineX);
    expect(body).toBeUndefined();
  });

  it('does not throw when the grid has not been created yet', () => {
    // Rejects an implementation that assumes gridManager always exists and
    // crashes on the first frame drawn before initialize() finishes.
    const engine = makeGameEngine(1);
    engine.gridManager = null;
    const ctx = fakeCtx();
    expect(() => new DrawUIs(engine).drawBackground(ctx)).not.toThrow();
  });
});
