import { describe, it, expect, beforeEach } from 'vitest';
import { Enemy, RangeEnemy, AssassinEnemy, BombEnemy } from '../EnemyUnits.js';
import { FireBlast, BasicDefender } from '../DefenderUnits.js';
import { DEFAULT_SETTINGS, saveSettings } from '../Feedback/SettingsStore.js';

const CARD = { level: 1, image: null };

/**
 * A minimal fake 2D context, in the style of the fake used in
 * GameEngineBreakDown/__tests__/canvasState.test.js, extended to record the
 * fillStyle in effect at each fillRect call so we can tell the health-bar
 * rects (red/lime) apart from the unit's own fallback-body rect.
 */
function createRecordingContext() {
  const calls = [];
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    textAlign: 'start',
    globalAlpha: 1,
    lineWidth: 1,
    save() {},
    restore() {},
    scale() {},
    translate() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect(x, y, w, h) {
      calls.push({ fillStyle: ctx.fillStyle, x, y, w, h });
    },
    fillText() {},
    strokeText() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clearRect() {},
    drawImage() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 10 }; },
    setLineDash() {},
  };
  return { ctx, calls };
}

function damagedEnemy() {
  const enemy = new Enemy(0, 0, { health: 100 });
  enemy.takeDamage(20); // health 80 < maxHealth 100; still alive (satisfies the gate's other condition)
  return enemy;
}

describe('Enemy.draw health bar respects showHealthBars', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it('draws the red/lime health bar rects when showHealthBars is true', () => {
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, showHealthBars: true } });
    const enemy = damagedEnemy();
    const { ctx, calls } = createRecordingContext();

    enemy.draw(ctx);

    const healthBarCalls = calls.filter((c) => c.fillStyle === 'red' || c.fillStyle === 'lime');
    expect(healthBarCalls.length).toBe(2);
  });

  it('omits the red/lime health bar rects when showHealthBars is false', () => {
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, showHealthBars: false } });
    const enemy = damagedEnemy();
    const { ctx, calls } = createRecordingContext();

    enemy.draw(ctx);

    const healthBarCalls = calls.filter((c) => c.fillStyle === 'red' || c.fillStyle === 'lime');
    expect(healthBarCalls.length).toBe(0);
  });
});

/**
 * Enemy targeting must ignore consumable spells (Fire Blast, Ice Bomb) so
 * enemies walk past them as though the cell were empty. This is enforced in
 * three independent places inside EnemyUnits.js:
 *  - the base Enemy.updateBehavior melee bounding-box search (Item 1)
 *  - Enemy.findClosestDefender, used by all ranged/special enemies (Item 2)
 *  - two subclasses that copy-paste their own target search instead of
 *    reusing the above: AssassinEnemy's critical-strike search and
 *    BombEnemy's self-destruct proximity check (Item 3)
 */
describe('melee Enemy.updateBehavior ignores consumable spells (Item 1)', () => {
  function createMeleeEnemy() {
    return new Enemy(0, 0, {
      isAttacker: true,
      attackDamage: 10,
      attackRate: 60,
      speed: 1,
      width: 40,
      height: 40,
    });
  }

  it('does not enter its attacking state or stop moving when the only nearby unit is a spell', () => {
    const enemy = createMeleeEnemy();
    const spell = new FireBlast(0, 0, CARD); // fully overlaps the enemy's bounding box
    const startingX = enemy.x;

    enemy.update([spell]);

    expect(enemy.isAttacking).toBe(false);
    expect(enemy.x).toBeGreaterThan(startingX);
  });

  it('does enter its attacking state against an ordinary defender in the same position', () => {
    const enemy = createMeleeEnemy();
    const defender = new BasicDefender(0, 0, CARD); // same bounding box the spell occupied above
    const startingX = enemy.x;

    enemy.update([defender]);

    expect(enemy.isAttacking).toBe(true);
    expect(enemy.x).toBe(startingX);
  });

  it('still reaches an ordinary defender positioned behind a spell', () => {
    const enemy = createMeleeEnemy();
    const spell = new FireBlast(0, 0, CARD); // sits directly in the enemy's path
    const defender = new BasicDefender(200, 0, CARD); // further along, behind the spell

    for (let i = 0; i < 300 && !enemy.isAttacking; i++) {
      enemy.update([spell, defender]);
    }

    // Proof of reaching the defender, not merely "isAttacking is true for some
    // reason" - a broken enemy that gets stuck on the spell at x=0 would also
    // leave isAttacking true (against the spell) without ever moving.
    expect(enemy.x).toBeGreaterThanOrEqual(defender.x - enemy.width);
    expect(enemy.isAttacking).toBe(true);
  });
});

describe('Enemy.findClosestDefender ignores consumable spells (Item 2)', () => {
  function createRangedEnemy() {
    return new RangeEnemy(0, 0, null);
  }

  it('returns null when the only candidate is a spell', () => {
    const enemy = createRangedEnemy();
    const spell = new FireBlast(50, 0, CARD);

    expect(enemy.findClosestDefender([spell])).toBeNull();
  });

  it('returns an ordinary defender candidate', () => {
    const enemy = createRangedEnemy();
    const defender = new BasicDefender(50, 0, CARD);

    expect(enemy.findClosestDefender([defender])).toBe(defender);
  });

  it('skips a nearer spell to find the ordinary defender standing behind it (skip semantics, not early exit)', () => {
    const enemy = createRangedEnemy();
    const spell = new FireBlast(20, 0, CARD); // closer to the enemy
    const defender = new BasicDefender(120, 0, CARD); // farther away, behind the spell

    expect(enemy.findClosestDefender([spell, defender])).toBe(defender);
  });
});

describe('RangeEnemy.updateBehavior ignores consumable spells (Item 2, behavioural)', () => {
  function createRangedEnemy() {
    return new RangeEnemy(0, 0, null);
  }

  it('does not enter its attacking state or stop moving when the only nearby unit is a spell', () => {
    const enemy = createRangedEnemy();
    const spell = new FireBlast(50, 0, CARD); // well within the 150 attack range

    enemy.update([spell]);

    expect(enemy.isAttacking).toBe(false);
    expect(enemy.isMoving).toBe(true);
    expect(enemy.x).toBeGreaterThan(0);
  });

  it('does enter its attacking state against an ordinary defender in the same position', () => {
    const enemy = createRangedEnemy();
    const defender = new BasicDefender(50, 0, CARD);

    enemy.update([defender]);

    expect(enemy.isAttacking).toBe(true);
    expect(enemy.isMoving).toBe(false);
  });
});

describe('AssassinEnemy critical strike ignores consumable spells (Item 3)', () => {
  function createAssassin() {
    return new AssassinEnemy(0, 0, null);
  }

  it('does not burn its one-shot strike on a spell', () => {
    const assassin = createAssassin();
    const spell = new FireBlast(0, 0, CARD); // overlaps the assassin's bounding box

    assassin.updateBehavior([spell]);

    expect(assassin.hasStruck).toBe(false);
    expect(assassin.isAttacking).toBe(false);
  });

  it('still strikes an ordinary defender in the same position', () => {
    const assassin = createAssassin();
    const defender = new BasicDefender(0, 0, CARD);

    assassin.updateBehavior([defender]);

    expect(assassin.hasStruck).toBe(true);
    expect(assassin.isAttacking).toBe(true);
  });
});

describe('BombEnemy self-destruct ignores consumable spells (Item 3)', () => {
  function createBomb() {
    const bomb = new BombEnemy(0, 0, null);
    bomb.gameEngine = { explosions: [] };
    return bomb;
  }

  it('does not self-destruct near a spell', () => {
    const bomb = createBomb();
    const spell = new FireBlast(0, 0, CARD); // within the explosion trigger radius

    bomb.updateBehavior([spell]);

    expect(bomb.shouldExplode).toBe(false);
    expect(bomb.isAlive).toBe(true);
  });

  it('still self-destructs near an ordinary defender in the same position', () => {
    const bomb = createBomb();
    const defender = new BasicDefender(0, 0, CARD);

    bomb.updateBehavior([defender]);

    expect(bomb.shouldExplode).toBe(true);
    expect(bomb.isAlive).toBe(false);
  });
});
