import { describe, it, expect, beforeEach } from 'vitest';
import { JuiceManager, MAX_HIT_STOP_MS, MAX_SHAKE_PIXELS } from '../JuiceManager.js';

describe('JuiceManager', () => {
  let juice;

  beforeEach(() => {
    juice = new JuiceManager();
  });

  describe('screen shake', () => {
    it('is still when no trauma has been added', () => {
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });

    it('offsets the view after trauma', () => {
      juice.addTrauma(1);
      const { x, y } = juice.getShakeOffset();
      expect(Math.abs(x) + Math.abs(y)).toBeGreaterThan(0);
    });

    it('never exceeds the maximum displacement', () => {
      juice.addTrauma(10); // deliberately over-large
      for (let i = 0; i < 50; i++) {
        const { x, y } = juice.getShakeOffset();
        expect(Math.abs(x)).toBeLessThanOrEqual(MAX_SHAKE_PIXELS);
        expect(Math.abs(y)).toBeLessThanOrEqual(MAX_SHAKE_PIXELS);
      }
    });

    it('decays back to stillness over time', () => {
      juice.addTrauma(1);
      juice.update(2000);
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });

    it('produces no shake when disabled', () => {
      juice.setEnabled({ screenShake: false });
      juice.addTrauma(1);
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('hit stop', () => {
    it('is not frozen by default', () => {
      expect(juice.isFrozen()).toBe(false);
    });

    it('freezes after being triggered', () => {
      juice.triggerHitStop(50);
      expect(juice.isFrozen()).toBe(true);
    });

    it('unfreezes once the duration elapses', () => {
      juice.triggerHitStop(50);
      juice.update(60);
      expect(juice.isFrozen()).toBe(false);
    });

    it('clamps requests to the maximum', () => {
      juice.triggerHitStop(5000);
      juice.update(MAX_HIT_STOP_MS + 1);
      expect(juice.isFrozen()).toBe(false);
    });
  });

  describe('damage numbers', () => {
    it('starts with none', () => {
      expect(juice.damageNumbers).toHaveLength(0);
    });

    it('adds one with its position and value', () => {
      juice.addDamageNumber(10, 20, 35);
      expect(juice.damageNumbers[0]).toMatchObject({ x: 10, damage: 35 });
    });

    it('drifts upward and fades as time passes', () => {
      juice.addDamageNumber(10, 100, 5);
      const startY = juice.damageNumbers[0].y;
      juice.update(200);
      expect(juice.damageNumbers[0].y).toBeLessThan(startY);
      expect(juice.damageNumbers[0].alpha).toBeLessThan(1);
    });

    it('is frame-rate independent (single update vs many small updates)', () => {
      // Ensure the implementation computes position from originY and ageMs,
      // not by decrementing y each frame (which would accelerate drift on higher framerates)
      const juice1 = new JuiceManager();
      const juice2 = new JuiceManager();

      juice1.addDamageNumber(10, 100, 5);
      juice2.addDamageNumber(10, 100, 5);

      // Advance juice1 with a single 300ms update
      juice1.update(300);

      // Advance juice2 with many small 10ms updates totaling 300ms
      for (let i = 0; i < 30; i++) {
        juice2.update(10);
      }

      // Both should be at identical y and alpha
      expect(juice1.damageNumbers[0].y).toBe(juice2.damageNumbers[0].y);
      expect(juice1.damageNumbers[0].alpha).toBe(juice2.damageNumbers[0].alpha);
    });

    it('expires them', () => {
      juice.addDamageNumber(10, 20, 5);
      juice.update(2000);
      expect(juice.damageNumbers).toHaveLength(0);
    });

    it('adds none when disabled', () => {
      juice.setEnabled({ showDamageNumbers: false });
      juice.addDamageNumber(10, 20, 5);
      expect(juice.damageNumbers).toHaveLength(0);
    });
  });

  describe('flash', () => {
    it('is absent by default', () => {
      expect(juice.getFlash()).toBeNull();
    });

    it('reports colour and fades out', () => {
      juice.triggerFlash('#ff0000', 200);
      expect(juice.getFlash().color).toBe('#ff0000');
      const initial = juice.getFlash().alpha;
      juice.update(100);
      expect(juice.getFlash().alpha).toBeLessThan(initial);
      juice.update(200);
      expect(juice.getFlash()).toBeNull();
    });
  });
});
