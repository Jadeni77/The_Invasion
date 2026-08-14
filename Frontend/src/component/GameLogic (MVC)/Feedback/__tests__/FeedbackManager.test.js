import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';
import { FeedbackManager } from '../FeedbackManager.js';
import { DEFAULT_SETTINGS } from '../SettingsStore.js';
import { resolveVoice, UNIT_VOICES } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';
import { SAMPLE_VARIANTS } from '../UnitSamples.js';

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
    // Asserted against a literal expected recipe (not resolveVoice() itself):
    // the fire variant applies no scaling, so this should equal Sniper's raw
    // UNIT_VOICES signature. Comparing to resolveVoice('Sniper', 'fire') would
    // just check the implementation against itself - it would pass no matter
    // how resolveVoice derived the recipe.
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'square', noise: false, freqStart: 1400, freqEnd: 700, duration: 0.05, gain: 0.3 },
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
    // Literal expected recipe: TitanEnemy's signature is
    // { wave: 'sawtooth', freqStart: 100, freqEnd: 50, duration: 0.4, gain: 0.55, noise: true },
    // and the death variant scales freq by 0.5, duration by 2.5, gain by 1.15.
    // Computed here with the same arithmetic resolveVoice performs (not by
    // calling resolveVoice), so a change to either the signature or the
    // VARIANTS.death scale factors would actually break this test.
    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'sawtooth', noise: true, freqStart: 100 * 0.5, freqEnd: 50 * 0.5, duration: 0.4 * 2.5, gain: 0.55 * 1.15 },
      'TitanEnemy:death',
    );
  });

  it('plays the hit enemy its own hit voice and still shows a damage number', () => {
    // Literal expected recipe: TankEnemy's signature is
    // { wave: 'sawtooth', freqStart: 150, freqEnd: 90, duration: 0.22, gain: 0.4, noise: true },
    // and the hit variant scales duration by 0.35 and gain by 0.55 (freq
    // unscaled). See the note above on why this is spelled out rather than
    // compared against resolveVoice('TankEnemy', 'hit').
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'sawtooth', noise: true, freqStart: 150, freqEnd: 90, duration: 0.22 * 0.35, gain: 0.4 * 0.55 },
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

describe('death fallback selection (defender vs enemy)', () => {
  // Regression coverage for: resolveVoice's fallback used to map every
  // unrecognised unit's death to SFX.enemyDied unconditionally, so an
  // unrecognised DEFENDER played the enemy squelch. defender:died must now
  // fall back to SFX.defenderDied instead, while enemy:died is unaffected.
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

  it('falls back to the DEFENDER squelch for an unrecognised defender death', () => {
    bus.emit('defender:died', { unitType: 'SomeUnknownDefender', x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      SFX.defenderDied,
      'SomeUnknownDefender:death',
    );
  });

  it('falls back to the ENEMY squelch for an unrecognised enemy death', () => {
    bus.emit('enemy:died', { unitType: 'SomeUnknownEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      SFX.enemyDied,
      'SomeUnknownEnemy:death',
    );
  });
});

describe('sample-or-synth routing', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = {
      playSfx: vi.fn(), playRecipe: vi.fn(), playSample: vi.fn(),
      hasSample: vi.fn(() => false), setVolumes: vi.fn(),
    };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('falls back to the synthesized voice when no sample exists', () => {
    audio.hasSample.mockReturnValue(false);

    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalled();
    expect(audio.playSample).not.toHaveBeenCalled();
  });

  it('plays the sample when one exists', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playSample).toHaveBeenCalledWith(
      'TitanEnemy', SAMPLE_VARIANTS.death, 'TitanEnemy:death',
    );
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('decides per unit, not globally', () => {
    audio.hasSample.mockImplementation((name) => name === 'Mortar');

    bus.emit('projectile:fired', { defenderType: 'Mortar' });
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playSample).toHaveBeenCalledWith('Mortar', SAMPLE_VARIANTS.fire, 'Mortar:fire');
    expect(audio.playRecipe).toHaveBeenCalledOnce();
  });

  it('uses the hit transform for hits and still shows a damage number', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playSample).toHaveBeenCalledWith(
      'TankEnemy', SAMPLE_VARIANTS.hit, 'TankEnemy:hit',
    );
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
  });

  it('keeps boss deaths weighty regardless of source', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });

    expect(juice.triggerHitStop).toHaveBeenCalled();
    expect(juice.addTrauma).toHaveBeenCalledWith(0.6);
  });

  it('leaves deployment on the shared sound even with samples present', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('defender:placed', { type: 'Mortar' });

    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
    expect(audio.playSample).not.toHaveBeenCalled();
  });
});
