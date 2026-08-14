import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';
import { FeedbackManager } from '../FeedbackManager.js';
import { DEFAULT_SETTINGS } from '../SettingsStore.js';

describe('FeedbackManager', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = { playSfx: vi.fn(), setVolumes: vi.fn() };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('plays the placement sound when a defender is placed', () => {
    bus.emit('defender:placed', { type: 'Shooter' });
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
  });

  it('plays the collection sound when energy is collected', () => {
    bus.emit('energy:collected', { amount: 25 });
    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected');
  });

  it('shows a damage number when an enemy is hit', () => {
    bus.emit('enemy:hit', { damage: 12, x: 30, y: 40 });
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
    expect(audio.playSfx).toHaveBeenCalledWith('enemyHit');
  });

  it('shakes and flashes when the base is damaged', () => {
    bus.emit('base:damaged', { damage: 10 });
    expect(audio.playSfx).toHaveBeenCalledWith('baseDamaged');
    expect(juice.addTrauma).toHaveBeenCalled();
    expect(juice.triggerFlash).toHaveBeenCalled();
  });

  it('uses the boss sound and hit-stop for a boss death', () => {
    bus.emit('enemy:died', { isBoss: true, x: 1, y: 2 });
    expect(audio.playSfx).toHaveBeenCalledWith('bossDied');
    expect(juice.triggerHitStop).toHaveBeenCalled();
  });

  it('uses the ordinary sound and no hit-stop for a normal death', () => {
    bus.emit('enemy:died', { isBoss: false, x: 1, y: 2 });
    expect(audio.playSfx).toHaveBeenCalledWith('enemyDied');
    expect(juice.triggerHitStop).not.toHaveBeenCalled();
  });

  it('distinguishes boss waves from ordinary waves', () => {
    bus.emit('wave:started', { number: 3, isBoss: false });
    expect(audio.playSfx).toHaveBeenCalledWith('waveStarted');
    audio.playSfx.mockClear();
    bus.emit('wave:started', { number: 4, isBoss: true });
    expect(audio.playSfx).toHaveBeenCalledWith('bossWaveStarted');
  });

  it('plays win and lose stings', () => {
    bus.emit('level:won', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon');
    bus.emit('level:lost', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelLost');
  });

  it('forwards volumes and toggles to audio and juice on settings change', () => {
    manager.applySettings(DEFAULT_SETTINGS);
    expect(audio.setVolumes).toHaveBeenCalledWith(DEFAULT_SETTINGS.audio);
    expect(juice.setEnabled).toHaveBeenCalledWith({
      screenShake: DEFAULT_SETTINGS.display.screenShake,
      showDamageNumbers: DEFAULT_SETTINGS.display.showDamageNumbers,
    });
  });

  it('stops responding after detach', () => {
    manager.detach();
    bus.emit('energy:collected', { amount: 1 });
    expect(audio.playSfx).not.toHaveBeenCalled();
  });
});
