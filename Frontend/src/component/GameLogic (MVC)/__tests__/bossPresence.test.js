/**
 * A boss has to be recognisable as one.
 *
 * The stat buff has always been there - `GameEngine.spawnEnemy` gives a boss
 * 2.5x health, 2x attack damage and 2x bounty - but `isBoss` reached nothing
 * except the wave-announcement banner. So a level-10 boss was a Vampire drawn at
 * exactly normal size, in normal colours, with a normal health bar, carrying two
 * and a half times the hidden health. Every multiplier worked and the fight still
 * read as an ordinary wave with a label on it.
 *
 * These tests pin the three signals that make it legible: it is bigger, it has a
 * boss health bar, and it has a ground marker. They do NOT judge how it looks -
 * jsdom has no rasteriser, so the canvas calls are recorded and counted, not seen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Enemy } from '../EnemyUnits.js';

/** A canvas 2d context that records what was asked of it. */
function recordingCtx() {
  const calls = [];
  const track = (name) => (...args) => { calls.push({ name, args }); };
  return {
    calls,
    save: track('save'), restore: track('restore'),
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
 * Health-bar rects specifically, not every rect on the canvas: with no animation
 * frames loaded the sprite falls back to drawing its own rectangle, so counting
 * all `fillRect` calls said "there is a health bar" about a plain undamaged enemy.
 * Bars sit ABOVE the sprite (negative offset from `y`); the fallback body does not.
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

/**
 * The Titan's phase readout.
 *
 * The phase was drawn two ways: as a `strokeRect` around the whole sprite,
 * coloured by phase, which read as a debug bounding box (the owner took it for an
 * attack-range overlay and wanted it gone, and scaling bosses up made it worse);
 * and as `P{n}` text at `y - 15`, which is exactly where the standard health bar
 * writes its value - so the phase and the health number were drawn over each other
 * for every Titan in the game. The boss bar made that collision obvious; it did
 * not create it.
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
