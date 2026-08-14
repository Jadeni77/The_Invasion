import { describe, it, expect, beforeEach } from 'vitest';
import { DrawExplosionEffect } from '../DrawExplosionEffect.js';
import { DEFAULT_SETTINGS, saveSettings } from '../../../Feedback/SettingsStore.js';

function setQuality(quality) {
  saveSettings({
    ...DEFAULT_SETTINGS,
    display: { ...DEFAULT_SETTINGS.display, graphicsQuality: quality },
  });
}

describe('DrawExplosionEffect.particleScale', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it("returns 0.3 for 'low' quality", () => {
    setQuality('low');
    const effect = new DrawExplosionEffect({});
    expect(effect.particleScale()).toBe(0.3);
  });

  it("returns 1 for 'medium' quality", () => {
    setQuality('medium');
    const effect = new DrawExplosionEffect({});
    expect(effect.particleScale()).toBe(1);
  });

  it("returns 1.5 for 'high' quality", () => {
    setQuality('high');
    const effect = new DrawExplosionEffect({});
    expect(effect.particleScale()).toBe(1.5);
  });

  it('falls back to 1 for an unrecognised quality value', () => {
    setQuality('ultra');
    const effect = new DrawExplosionEffect({});
    expect(effect.particleScale()).toBe(1);
  });

  it('never scales the base-8 burst emitter below 1 particle at low quality', () => {
    setQuality('low');
    const effect = new DrawExplosionEffect({});
    const particleCount = Math.max(1, Math.round(8 * effect.particleScale()));
    expect(particleCount).toBeGreaterThanOrEqual(1);
  });

  it('never scales the base-12 fireball emitter below 1 particle at low quality', () => {
    setQuality('low');
    const effect = new DrawExplosionEffect({});
    const particleCount = Math.max(1, Math.round(12 * effect.particleScale()));
    expect(particleCount).toBeGreaterThanOrEqual(1);
  });
});
