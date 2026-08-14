import { describe, it, expect } from 'vitest';
import { SFX, SFX_IDS } from '../SfxLibrary.js';

const REQUIRED_IDS = [
  'defenderPlaced', 'defenderDied', 'projectileFired', 'enemyHit',
  'enemyDied', 'bossDied', 'energyCollected', 'deployRejected',
  'baseDamaged', 'waveStarted', 'bossWaveStarted', 'levelWon', 'levelLost',
];

describe('SfxLibrary', () => {
  it('defines every sound the event catalog requires', () => {
    for (const id of REQUIRED_IDS) {
      expect(SFX, `missing sound: ${id}`).toHaveProperty(id);
    }
  });

  it('exposes SFX_IDS matching the SFX keys', () => {
    expect([...SFX_IDS].sort()).toEqual(Object.keys(SFX).sort());
  });

  it.each(Object.entries(SFX))('recipe %s is well formed', (id, recipe) => {
    expect(Number.isFinite(recipe.freqStart), `${id} freqStart`).toBe(true);
    expect(Number.isFinite(recipe.freqEnd), `${id} freqEnd`).toBe(true);
    expect(recipe.freqStart).toBeGreaterThan(0);
    expect(recipe.freqEnd).toBeGreaterThan(0);
    expect(recipe.freqStart).toBeLessThan(20000);
    expect(recipe.freqEnd).toBeLessThan(20000);
  });

  it.each(Object.entries(SFX))('recipe %s has a sane duration and gain', (id, recipe) => {
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.duration, `${id} must stay short enough not to overlap itself`).toBeLessThanOrEqual(2);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(1);
  });

  it.each(Object.entries(SFX))('recipe %s uses a valid oscillator type', (id, recipe) => {
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(recipe.wave);
  });
});
