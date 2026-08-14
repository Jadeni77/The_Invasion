import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';
import { FeedbackManager } from '../FeedbackManager.js';
import { DEFAULT_SETTINGS } from '../SettingsStore.js';
import { resolveVoice, UNIT_VOICES } from '../UnitVoices.js';

describe('FeedbackManager', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = { playSfx: vi.fn(), playRecipe: vi.fn(), setVolumes: vi.fn() };
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
    // Hit sound is now per-unit (Task 3): the shared 'enemyHit' sfx was replaced
    // by a playRecipe call keyed to the unit's own voice.
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('TankEnemy', 'hit'),
      'TankEnemy:hit',
    );
  });

  it('shakes and flashes when the base is damaged', () => {
    bus.emit('base:damaged', { damage: 10 });
    expect(audio.playSfx).toHaveBeenCalledWith('baseDamaged');
    expect(juice.addTrauma).toHaveBeenCalled();
    expect(juice.triggerFlash).toHaveBeenCalled();
  });

  it('uses the boss sound and hit-stop for a boss death', () => {
    // Death sound is now per-unit (Task 3): the shared 'bossDied' sfx was replaced
    // by a playRecipe call keyed to the unit's own voice; the boss branch now only
    // controls the extra shake and hit-stop, not which sound plays.
    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('BossEnemy', 'death'),
      'BossEnemy:death',
    );
    expect(juice.triggerHitStop).toHaveBeenCalled();
  });

  it('uses the ordinary sound and no hit-stop for a normal death', () => {
    // Death sound is now per-unit (Task 3): the shared 'enemyDied' sfx was replaced
    // by a playRecipe call keyed to the unit's own voice.
    bus.emit('enemy:died', { unitType: 'BasicEnemy', isBoss: false, x: 1, y: 2 });
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('BasicEnemy', 'death'),
      'BasicEnemy:death',
    );
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

describe('per-unit voices', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = { playSfx: vi.fn(), playRecipe: vi.fn(), setVolumes: vi.fn() };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('plays the firing defender its own voice', () => {
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('Sniper', 'fire'),
      'Sniper:fire',
    );
  });

  it('gives two different defenders different firing sounds', () => {
    bus.emit('projectile:fired', { defenderType: 'Sniper' });
    bus.emit('projectile:fired', { defenderType: 'Mortar' });

    const [first, second] = audio.playRecipe.mock.calls;
    expect(first[0]).not.toEqual(second[0]);
    expect(first[1]).not.toBe(second[1]);
  });

  it('plays the dying enemy its own death voice', () => {
    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('TitanEnemy', 'death'),
      'TitanEnemy:death',
    );
  });

  it('plays the hit enemy its own hit voice and still shows a damage number', () => {
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('TankEnemy', 'hit'),
      'TankEnemy:hit',
    );
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
  });

  it('plays the dying defender its own death voice and still shakes', () => {
    bus.emit('defender:died', { unitType: 'Mortar', x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('Mortar', 'death'),
      'Mortar:death',
    );
    expect(juice.addTrauma).toHaveBeenCalled();
  });

  it('keeps boss deaths dramatic - hit stop and heavy shake', () => {
    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });

    expect(juice.triggerHitStop).toHaveBeenCalled();
    expect(juice.addTrauma).toHaveBeenCalledWith(0.6);
  });

  it('deployment stays ONE shared sound regardless of unit', () => {
    bus.emit('defender:placed', { type: 'Sniper' });
    bus.emit('defender:placed', { type: 'Mortar' });

    expect(audio.playSfx).toHaveBeenCalledTimes(2);
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('falls back without throwing when an event carries no unit type', () => {
    expect(() => bus.emit('enemy:died', { isBoss: false, x: 1, y: 2 })).not.toThrow();
    expect(audio.playRecipe).toHaveBeenCalled();
  });

  it('leaves non-unit events on the shared sounds', () => {
    bus.emit('energy:collected', { amount: 25 });
    bus.emit('level:won', {});

    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected');
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon');
  });
});
