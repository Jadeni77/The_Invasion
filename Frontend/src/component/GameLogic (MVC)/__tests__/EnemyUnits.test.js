import { describe, it, expect, beforeEach } from 'vitest';
import { Enemy } from '../EnemyUnits.js';
import { DEFAULT_SETTINGS, saveSettings } from '../Feedback/SettingsStore.js';

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
