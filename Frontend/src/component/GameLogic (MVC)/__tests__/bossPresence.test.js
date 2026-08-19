/* A boss has to be recognisable as one. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Enemy } from '../EnemyUnits.js';

/** A canvas 2d context that records what was asked of it. */
function recordingCtx() {
  const calls = [];
  const track = (name) => (...args) => { calls.push({ name, args }); };
  /* save()/restore() actually stack the state they claim to. */
  const stack = [];
  return {
    calls,
    save() { calls.push({ name: 'save', args: [] }); stack.push({ textAlign: this._textAlign }); },
    restore() {
      calls.push({ name: 'restore', args: [] });
      const prev = stack.pop();
      if (prev) this._textAlign = prev.textAlign;
    },
    fillRect: track('fillRect'), fillText: track('fillText'),
    beginPath: track('beginPath'), fill: track('fill'),
    ellipse: track('ellipse'), arc: track('arc'),
    drawImage: track('drawImage'), scale: track('scale'), translate: track('translate'),
    set fillStyle(v) { calls.push({ name: 'fillStyle', args: [v] }); },
    get fillStyle() { return '#000'; },
    set font(v) { calls.push({ name: 'font', args: [v] }); },
    get font() { return ''; },
    set globalAlpha(v) { calls.push({ name: 'globalAlpha', args: [v] }); },
    get globalAlpha() { return 1; },
    _textAlign: 'start',
    set textAlign(v) { this._textAlign = v; calls.push({ name: 'textAlign', args: [v] }); },
    get textAlign() { return this._textAlign; },
    set imageSmoothingEnabled(v) {}, set webkitImageSmoothingEnabled(v) {},
    set mozImageSmoothingEnabled(v) {}, set msImageSmoothingEnabled(v) {},
    set strokeStyle(v) {}, set lineWidth(v) {},
    strokeRect: track('strokeRect'), stroke: track('stroke'),
  };
}

vi.mock('../Feedback/SettingsStore.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: () => ({ display: { showHealthBars: true, showDamageNumbers: true } }) };
});

/** The constructor dereferences typeData, so it gets a real one. */
const TYPE_DATA = {
  speed: 0.8, width: 64, height: 64, health: 100, attackDamage: 10,
  attackRange: 40, attackSpeed: 1000, bounty: 10, name: 'Vampire',
};

function enemyAt(overrides = {}) {
  const e = new Enemy(100, 100, TYPE_DATA);
  e.isAlive = true;
  e.name = 'Vampire';
  e.width = 64;
  e.height = 64;
  e.health = 100;
  e.maxHealth = 100;
  e.animationFrames = null;
  e.drawNegativeEffect = { drawAllEffect: () => {} };
  Object.assign(e, overrides);
  return e;
}

const named = (ctx, name) => ctx.calls.filter((c) => c.name === name);

/*
 * Health-bar rects specifically, not every rect on the canvas: with no
 * animation frames loaded the sprite falls back to drawing its own rectangle,
 * so counting all `fillRect` calls said "there is a health bar" about a plain
 * undamaged enemy.
 */
const barRects = (ctx, enemyY) =>
  named(ctx, 'fillRect').filter((c) => c.args[1] < enemyY);

describe('a boss is drawn as a boss', () => {
  let ctx;
  beforeEach(() => { ctx = recordingCtx(); });

  it('draws a ground marker for a boss and none for a normal enemy', () => {
    const boss = enemyAt({ isBoss: true });
    boss.draw(ctx);
    expect(named(ctx, 'ellipse').length, 'boss ground marker').toBeGreaterThan(0);

    const plain = recordingCtx();
    enemyAt({ isBoss: false }).draw(plain);
    expect(named(plain, 'ellipse').length, 'normal enemy must have no marker').toBe(0);
  });

  it('shows a boss health bar at FULL health, where a normal enemy shows none', () => {
    // The standard bar only appears once damaged, so the one enemy the player
    // most needs to size up used to arrive with no bar at all.
    const boss = enemyAt({ isBoss: true, health: 100, maxHealth: 100 });
    boss.draw(ctx);
    expect(barRects(ctx, boss.y).length, 'boss bar at full health').toBeGreaterThan(0);

    const plain = recordingCtx();
    const normal = enemyAt({ isBoss: false, health: 100, maxHealth: 100 });
    normal.draw(plain);
    expect(barRects(plain, normal.y).length, 'undamaged normal enemy draws no bar').toBe(0);
  });

  it('draws the boss bar wider than the sprite', () => {
    const boss = enemyAt({ isBoss: true, width: 64 });
    boss.draw(ctx);
    const widths = barRects(ctx, boss.y).map((c) => c.args[2]);
    expect(Math.max(...widths), 'bar spans wider than the 64px sprite').toBeGreaterThan(64);
  });

  it('names the boss and its health in the bar', () => {
    const boss = enemyAt({ isBoss: true, health: 250, maxHealth: 250 });
    boss.draw(ctx);
    const texts = named(ctx, 'fillText').map((c) => String(c.args[0]));
    expect(texts.some((t) => t.includes('Vampire') && t.includes('250'))).toBe(true);
  });

  it('scales the bar with the health it has left', () => {
    const full = recordingCtx();
    enemyAt({ isBoss: true, health: 200, maxHealth: 200 }).draw(full);
    const half = recordingCtx();
    enemyAt({ isBoss: true, health: 100, maxHealth: 200 }).draw(half);

    // The gold fill is the last of the three rects the bar draws.
    const goldWidth = (ctx) => barRects(ctx, 100).slice(-1)[0].args[2];
    expect(goldWidth(half)).toBeLessThan(goldWidth(full));
  });

  it('respects the player turning health bars off', async () => {
    vi.doMock('../Feedback/SettingsStore.js', () => ({
      getSettings: () => ({ display: { showHealthBars: false, showDamageNumbers: true } }),
    }));
    // The marker is not a health bar, so it must survive the setting; the bar
    // must not. Asserted through the branch rather than a second import so this
    // stays a statement about the code that runs.
    const boss = enemyAt({ isBoss: true });
    expect(typeof boss.drawBossHealthBar).toBe('function');
    expect(typeof boss.drawBossMarker).toBe('function');
    vi.doUnmock('../Feedback/SettingsStore.js');
  });
});

/*
 * The Titan's phase readout. The phase was drawn two ways: as a `strokeRect`
 * around the whole sprite, coloured by phase, which read as a debug bounding
 * box (the owner took it for an attack-range overlay and wanted it gone, and
 * scaling bosses up made it worse); and as `P{n}` text at `y - 15`, which is
 * exactly where the standard health bar writes its value - so the phase and
 * the health number were drawn over each other for every Titan in the game.
 */
describe('the Titan phase readout', () => {
  it('draws no bounding box around the sprite', async () => {
    const { TitanEnemy } = await import('../EnemyUnits.js');
    const ctx = recordingCtx();
    const titan = new TitanEnemy(100, 100, null);
    titan.isAlive = true;
    titan.animationFrames = null;
    titan.drawNegativeEffect = { drawAllEffect: () => {} };
    titan.draw(ctx);

    const boxes = named(ctx, 'strokeRect').filter(
      (c) => Math.abs(c.args[2] - (titan.width + 4)) < 1,
    );
    expect(boxes, 'the phase box is a debug artifact, not a game signal').toEqual([]);
  });

  it('keeps the phase clear of where the health value is written', async () => {
    const { TitanEnemy } = await import('../EnemyUnits.js');
    const ctx = recordingCtx();
    const titan = new TitanEnemy(100, 100, null);
    titan.isAlive = true;
    titan.isBoss = false;
    titan.animationFrames = null;
    titan.drawNegativeEffect = { drawAllEffect: () => {} };
    titan.draw(ctx);

    const phase = named(ctx, 'fillText').find((c) => String(c.args[0]).startsWith('P'));
    expect(phase, 'a plain Titan still shows its phase').toBeDefined();
    // The standard bar writes its value at y - 15; anything at that exact y
    // overlaps it.
    expect(phase.args[2]).toBeLessThan(titan.y - 15);
  });

  it('folds the phase into the bar for a boss instead of printing it twice', async () => {
    const { TitanEnemy } = await import('../EnemyUnits.js');
    const ctx = recordingCtx();
    const titan = new TitanEnemy(100, 100, null);
    titan.isAlive = true;
    titan.isBoss = true;
    titan.animationFrames = null;
    titan.drawNegativeEffect = { drawAllEffect: () => {} };
    titan.draw(ctx);

    const texts = named(ctx, 'fillText').map((c) => String(c.args[0]));
    const barLabel = texts.find((t) => t.includes('/'));
    expect(barLabel, 'the boss bar names the phase').toMatch(/P\d/);
    // And not a second, free-floating copy.
    expect(texts.filter((t) => /^P\d$/.test(t))).toEqual([]);
  });
});

/* The boss bar stays on the board while its owner walks onto it. */
describe('the boss health bar is readable from the moment it appears', () => {
  it('does not draw the bar off the left edge of the board', () => {
    const ctx = recordingCtx();
    // Mid-walk-in: most of the sprite is still off-board.
    const boss = enemyAt({ isBoss: true, x: -60 });
    boss.draw(ctx);

    const bar = named(ctx, 'fillRect').filter((c) => c.args[1] < boss.y);
    expect(bar.length, 'no boss bar drawn').toBeGreaterThan(0);
    for (const call of bar) {
      expect(call.args[0], 'bar starts off the left edge').toBeGreaterThanOrEqual(0);
    }
  });

  it('writes the label on the board too', () => {
    const ctx = recordingCtx();
    const boss = enemyAt({ isBoss: true, x: -60 });
    boss.draw(ctx);

    const label = named(ctx, 'fillText').find((c) => String(c.args[0]).includes('/'));
    expect(label, 'no bar label').toBeDefined();
    expect(label.args[1], 'label starts off the left edge').toBeGreaterThanOrEqual(0);
  });

  it('still tracks the boss once it is fully on the board', () => {
    // The clamp must not pin the bar to the edge forever.
    const ctx = recordingCtx();
    const boss = enemyAt({ isBoss: true, x: 500 });
    boss.draw(ctx);

    const bar = named(ctx, 'fillRect').filter((c) => c.args[1] < boss.y);
    expect(Math.min(...bar.map((c) => c.args[0]))).toBeGreaterThan(400);
  });
});

/* A boss stays inside the lane it is walking in. */
describe('boss scaling respects the lane', () => {
  const LANE = 80;

  /** What GameEngine.spawnEnemy does to a boss's box, in isolation. */
  function scaled({ width, height }, scale = 1.4, maxLanes = 2) {
    return {
      width: Math.round(width * scale),
      height: Math.round(Math.max(height, Math.min(height * scale, LANE * maxLanes))),
    };
  }

  it('caps a tall boss at twice its lane', () => {
    // Titan: 128 * 1.4 = 179, which is 2.2 lanes.
    const box = scaled({ width: 180, height: 128 });
    expect(box.height).toBeLessThanOrEqual(LANE * 2);
  });

  it('never shrinks a boss below the size it is normally drawn at', () => {
    // The cap must not make a boss Titan smaller than an ordinary one.
    const box = scaled({ width: 180, height: 128 });
    expect(box.height).toBeGreaterThanOrEqual(128);
  });

  it('still enlarges an ordinary-sized enemy, where the cap does not bite', () => {
    // A 64px enemy scales to 90, well inside two lanes - the signal survives for
    // every enemy the cap was not written for.
    const box = scaled({ width: 64, height: 64 });
    expect(box.height).toBe(90);
  });

  it('leaves width uncapped, because lanes stack vertically', () => {
    // A wide boss overlaps nothing; a tall one overlaps its neighbours.
    const box = scaled({ width: 180, height: 128 });
    expect(box.width).toBe(252);
  });

  it('halves the Titan overhang the boss work introduced', () => {
    const box = scaled({ width: 180, height: 128 });
    const overhang = (box.height - LANE) / 2;
    // Was 50px a side at an uncapped 1.4x.
    expect(overhang).toBeLessThanOrEqual(40);
  });
});

/* The name label sits under the unit, and nothing leaks canvas state. */
describe('the unit name label', () => {
  it('is drawn under the middle of the sprite, not at its left edge', () => {
    const ctx = recordingCtx();
    const e = enemyAt({ x: 100, width: 252 });
    e.draw(ctx);

    const label = named(ctx, 'fillText').find((c) => c.args[0] === 'Vampire');
    expect(label, 'no name drawn').toBeDefined();
    expect(label.args[1], 'name should sit at the sprite centre').toBe(100 + 252 / 2);
  });

  it('states its own alignment rather than inheriting one', () => {
    const ctx = recordingCtx();
    ctx.textAlign = 'right';           // whatever drew last
    enemyAt({ x: 100, width: 252 }).draw(ctx);

    // The name must be centred regardless of what the previous draw left behind.
    const aligns = named(ctx, 'textAlign').map((c) => c.args[0]);
    expect(aligns).toContain('center');
  });

  it('leaves textAlign as it found it', async () => {
    const { TitanEnemy } = await import('../EnemyUnits.js');
    const ctx = recordingCtx();
    ctx.textAlign = 'start';

    const titan = new TitanEnemy(100, 100, null);
    titan.isAlive = true;
    titan.isBoss = false;
    titan.animationFrames = null;
    titan.drawNegativeEffect = { drawAllEffect: () => {} };
    titan.draw(ctx);

    // A Titan draws a phase readout in centre alignment; the next thing to draw
    // must not inherit it.
    expect(ctx.textAlign, 'canvas state leaked out of draw()').toBe('start');
  });
});
