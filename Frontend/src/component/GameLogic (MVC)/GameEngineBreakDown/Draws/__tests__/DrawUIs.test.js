import { describe, it, expect, vi } from 'vitest';
import { DrawUIs } from '../DrawUIs.js';
import { GridManager } from '../../InGameManagerHandlers/GridManager.js';

/**
 * A ctx that remembers which fillStyle was in force for each fillRect.
 * fakeCtx() below records fillStyle assignments and fillRect calls in two
 * unrelated lists, which is enough for geometry but says nothing about what
 * colour any given rectangle actually came out - and "what colour was this
 * rectangle" is precisely the question the base/grass regression turns on.
 */
function recordingCtx() {
  const rects = [];
  return {
    save: vi.fn(),
    restore: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    rects,
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: this.fillStyle });
    },
  };
}

/** WCAG 2.x relative luminance / contrast ratio, for #rrggbb inputs. */
function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

/**
 * The base was painted in the grass token twice: Task 4's review caught it,
 * fix round 3 changed the body to a distinct token, and Task 6's rewrite of
 * the whole base block set it back to surfacePanel. Nothing failed either
 * time, because every existing test here asks about geometry.
 *
 * These tests read the colours drawBackground actually hands to fillRect and
 * compare the base's against the terrain it is drawn over, so they do not
 * depend on which token anyone picks - only on the two remaining
 * distinguishable. A rename, a re-tune of the palette, or another wholesale
 * rewrite of the block all stay green as long as the base is still visible.
 */
describe('the base is distinguishable from the terrain it sits on', () => {
  // Not 4.5:1 or 3:1: this is a large filled shape against a background,
  // not text, and the branch deliberately uses close-valued earth tones for
  // the terrain. 1.5:1 is "an eye can see an edge here", and it is far
  // enough above the 1.000:1 that shipped twice to catch a recurrence
  // without dictating the palette.
  const MIN_RATIO = 1.5;

  function drawnBase(levelNumber) {
    const engine = makeGameEngine(levelNumber);
    const ctx = recordingCtx();
    new DrawUIs(engine).drawBackground(ctx);

    const baseWidth = engine.canvasWidth - engine.defenseLineX;
    return {
      engine,
      // Full-canvas-width fills are the terrain bands (sky, the two grass
      // bands, the road); the base is the only thing drawn at defenseLineX.
      terrain: ctx.rects.filter((r) => r.x === 0 && r.w === engine.canvasWidth),
      body: ctx.rects.find((r) => r.x === engine.defenseLineX && r.w === baseWidth),
      edge: ctx.rects.find((r) => r.x === engine.defenseLineX && r.w < baseWidth),
    };
  }

  it('paints the base body in a different colour from every terrain band it overlaps', () => {
    // Rejects `ctx.fillStyle = colors.surfacePanel` for the body - the grass
    // token, at 1.000:1, which hid roughly two thirds of the wall - and any
    // other token that happens to equal a band's colour.
    const { terrain, body } = drawnBase(4);
    expect(body, 'no base body fill found').toBeDefined();
    expect(terrain.length, 'expected the sky/grass/road bands to be drawn').toBeGreaterThan(2);

    const collisions = terrain.filter((band) => band.fill === body.fill);
    expect(
      collisions,
      `base body (${body.fill}) is the same colour as ${collisions.length} terrain band(s)`,
    ).toEqual([]);
  });

  it('keeps the base readable against the terrain, not merely a different hex', () => {
    // Rejects a "fix" that swaps in a token one step away on the same ramp -
    // technically not equal, still invisible in practice. This is the check
    // that would have failed had someone answered the 1.000:1 report by
    // nudging the value instead of choosing a distinct one.
    const { terrain, body } = drawnBase(4);
    for (const band of terrain) {
      const ratio = contrastRatio(body.fill, band.fill);
      expect(
        ratio,
        `base body ${body.fill} vs terrain band ${band.fill} is only ${ratio.toFixed(3)}:1`,
      ).toBeGreaterThanOrEqual(MIN_RATIO);
    }
  });

  it('keeps the lit playfield-facing edge distinct from the body it edges', () => {
    // Rejects painting the edge strip in the body's own colour (or in
    // accentEnergy, which the windows on the same wall already use) - either
    // way the wall stops reading as lit from the side enemies come from.
    const { body, edge } = drawnBase(4);
    expect(edge, 'no playfield-facing edge strip found').toBeDefined();
    expect(edge.fill).not.toBe(body.fill);
    expect(contrastRatio(edge.fill, body.fill)).toBeGreaterThanOrEqual(MIN_RATIO);
  });

  it('holds at every level row count, since the base spans more of the grass as it grows', () => {
    // The overlap that made this visible depends on the base's height, which
    // is the level's row count. Checking one level could pass on a level
    // whose base barely reaches the grass bands.
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const { terrain, body } = drawnBase(level);
      for (const band of terrain) {
        expect(
          contrastRatio(body.fill, band.fill),
          `level ${level}: base ${body.fill} vs band ${band.fill}`,
        ).toBeGreaterThanOrEqual(MIN_RATIO);
      }
    }
  });
});

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

    // Y position, not just height: a baseY stuck at 0 (or any value other
    // than the grid's own offset) would detach the base from the playfield
    // - sliding it to the top of the canvas - while still passing a
    // height-only check, since height alone says nothing about where the
    // rectangle actually sits.
    expect(bodyShallow[1]).toBe(shallow.gridManager.gridOffsetY);
    expect(bodyDeep[1]).toBe(deep.gridManager.gridOffsetY);

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
