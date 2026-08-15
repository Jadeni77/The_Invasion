import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';
import { FeedbackManager } from '../FeedbackManager.js';
import { DEFAULT_SETTINGS } from '../SettingsStore.js';
import { resolveVoice, UNIT_VOICES } from '../UnitVoices.js';
import { SAMPLE_VARIANTS } from '../UnitSamples.js';
import { mixGainFor } from '../SoundGroups.js';

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
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced', mixGainFor('defenderPlaced'));
  });

  it('plays the collection sound when energy is collected', () => {
    bus.emit('energy:collected', { amount: 25 });
    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected', mixGainFor('energyCollected'));
  });

  it('shows a damage number when an enemy is hit', () => {
    // Hit sound is shared by sound key (Task 2): every unit's hit resolves to
    // the 'hit' archetype, so the lookup key is 'hit', not the unit's name.
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('hit', 'hit'),
      'hit:hit',
      mixGainFor('hit'),
    );
  });

  it('shakes and flashes when the base is damaged', () => {
    bus.emit('base:damaged', { damage: 10 });
    expect(audio.playSfx).toHaveBeenCalledWith('baseDamaged', mixGainFor('baseDamaged'));
    expect(juice.addTrauma).toHaveBeenCalled();
    expect(juice.triggerFlash).toHaveBeenCalled();
  });

  it('uses the boss sound and hit-stop for a boss death', () => {
    // Death sound is keyed by sound key (Task 2): BossEnemy keeps a signature
    // of its own ('boss'), so the lookup key is 'boss', not 'BossEnemy'; the
    // boss branch only controls the extra shake and hit-stop, not which sound
    // plays.
    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('boss', 'death'),
      'boss:death',
      mixGainFor('boss'),
    );
    expect(juice.triggerHitStop).toHaveBeenCalled();
  });

  it('uses the ordinary sound and no hit-stop for a normal death', () => {
    // Death sound is keyed by sound key (Task 2): BasicEnemy is a small enemy,
    // so it resolves to the shared 'death-small' archetype.
    bus.emit('enemy:died', { unitType: 'BasicEnemy', isBoss: false, x: 1, y: 2 });
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('death-small', 'death'),
      'death-small:death',
      mixGainFor('death-small'),
    );
    expect(juice.triggerHitStop).not.toHaveBeenCalled();
  });

  it('distinguishes boss waves from ordinary waves', () => {
    bus.emit('wave:started', { number: 3, isBoss: false });
    expect(audio.playSfx).toHaveBeenCalledWith('waveStarted', mixGainFor('waveStarted'));
    audio.playSfx.mockClear();
    bus.emit('wave:started', { number: 4, isBoss: true });
    expect(audio.playSfx).toHaveBeenCalledWith('bossWaveStarted', mixGainFor('bossWaveStarted'));
  });

  it('plays win and lose stings', () => {
    bus.emit('level:won', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon', mixGainFor('levelWon'));
    bus.emit('level:lost', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelLost', mixGainFor('levelLost'));
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
    // the fire variant applies no scaling, so this should equal the 'sniper'
    // sound key's raw UNIT_VOICES signature. Sniper keeps a signature of its
    // own (Task 1's soundKeyFor), so the lookup and dedupe key are 'sniper',
    // not 'Sniper'. Comparing to resolveVoice('sniper', 'fire') would just
    // check the implementation against itself - it would pass no matter how
    // resolveVoice derived the recipe.
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'square', noise: false, freqStart: 1400, freqEnd: 700, duration: 0.05, gain: 0.3 },
      'sniper:fire',
      mixGainFor('sniper'),
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
    // Literal expected recipe: TitanEnemy keeps a death signature of its own
    // (soundKeyFor resolves it to 'titan'), whose UNIT_VOICES entry is
    // { wave: 'sawtooth', freqStart: 100, freqEnd: 50, duration: 0.4, gain: 0.55, noise: true },
    // and the death variant scales freq by 0.5, duration by 2.5, gain by 1.15.
    // Computed here with the same arithmetic resolveVoice performs (not by
    // calling resolveVoice), so a change to either the signature or the
    // VARIANTS.death scale factors would actually break this test.
    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'sawtooth', noise: true, freqStart: 100 * 0.5, freqEnd: 50 * 0.5, duration: 0.4 * 2.5, gain: 0.55 * 1.15 },
      'titan:death',
      mixGainFor('titan'),
    );
  });

  it('plays the hit enemy the shared hit voice and still shows a damage number', () => {
    // Literal expected recipe: every hit resolves to the shared 'hit' sound
    // key (soundKeyFor), NOT to TankEnemy's own fire/death signature. That
    // key's UNIT_VOICES entry is
    // { wave: 'triangle', freqStart: 320, freqEnd: 240, duration: 0.07, gain: 0.25, noise: false },
    // and the hit variant scales duration by 0.35 and gain by 0.55 (freq
    // unscaled). See the note above on why this is spelled out rather than
    // compared against resolveVoice('hit', 'hit').
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      { wave: 'triangle', noise: false, freqStart: 320, freqEnd: 240, duration: 0.07 * 0.35, gain: 0.25 * 0.55 },
      'hit:hit',
      mixGainFor('hit'),
    );
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
  });

  it('plays the dying defender its own death voice and still shakes', () => {
    // Mortar has no death signature of its own; soundKeyFor buckets every
    // defender death into the shared 'death-defender' key.
    bus.emit('defender:died', { unitType: 'Mortar', x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('death-defender', 'death'),
      'death-defender:death',
      mixGainFor('death-defender'),
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
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced', mixGainFor('defenderPlaced'));
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('falls back without throwing when an event carries no unit type', () => {
    expect(() => bus.emit('enemy:died', { isBoss: false, x: 1, y: 2 })).not.toThrow();
    expect(audio.playRecipe).toHaveBeenCalled();
  });

  it('leaves non-unit events on the shared sounds', () => {
    bus.emit('energy:collected', { amount: 25 });
    bus.emit('level:won', {});

    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected', mixGainFor('energyCollected'));
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon', mixGainFor('levelWon'));
  });
});

describe('death fallback selection (defender vs enemy)', () => {
  // Pre-Task-2, resolveVoice took a fallbackRecipe override so an
  // unrecognised DEFENDER's death played SFX.defenderDied rather than the
  // enemy squelch; defender:died supplied that override.
  //
  // Task 2 removed the override parameter entirely (round 2 fix): playUnitVoice
  // now resolves through soundKeyFor first, which always returns one of the 15
  // declared sound keys (see SoundGroups.SOUND_KEYS) - never something absent
  // from UNIT_VOICES. Both names below are unrecognised BY soundKeyFor (neither
  // is in its DEFENDERS/SMALL_ENEMIES lists), so both land on the same generic
  // 'death-medium' bucket, which DOES have a UNIT_VOICES entry. The
  // defender-vs-enemy distinction this block used to protect is now delivered
  // upstream instead: a RECOGNISED defender resolves to the fully-populated
  // 'death-defender' key (see 'plays the dying defender its own death voice
  // and still shakes' above, and SoundGroups.test.js's 'defenders share one
  // death sound'). SFX.defenderDied/SFX.enemyDied are never played from this
  // call site anymore, and resolveVoice no longer has a parameter that could
  // reach them here even if soundKeyFor's mapping ever stopped being total.
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

  it('an unrecognised defender name resolves to the generic death-medium sound, not SFX.defenderDied', () => {
    bus.emit('defender:died', { unitType: 'SomeUnknownDefender', x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('death-medium', 'death'),
      'death-medium:death',
      mixGainFor('death-medium'),
    );
  });

  it('an unrecognised enemy name also resolves to death-medium, not SFX.enemyDied', () => {
    bus.emit('enemy:died', { unitType: 'SomeUnknownEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('death-medium', 'death'),
      'death-medium:death',
      mixGainFor('death-medium'),
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

    // TitanEnemy keeps its own death signature, so it resolves to the 'titan'
    // sound key rather than a group key.
    expect(audio.playSample).toHaveBeenCalledWith(
      'titan', SAMPLE_VARIANTS.death, 'titan:death', mixGainFor('titan'),
    );
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('decides per sound key, not globally', () => {
    // Mortar keeps its own firing signature ('mortar'); Sniper keeps its own
    // ('sniper'). Sample presence is checked per resolved sound key, so
    // supplying a mortar sample does not make the sniper sound sampled too.
    audio.hasSample.mockImplementation((name) => name === 'mortar');

    bus.emit('projectile:fired', { defenderType: 'Mortar' });
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playSample).toHaveBeenCalledWith(
      'mortar', SAMPLE_VARIANTS.fire, 'mortar:fire', mixGainFor('mortar'),
    );
    expect(audio.playRecipe).toHaveBeenCalledOnce();
  });

  it('uses the hit transform for hits and still shows a damage number', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    // Every hit resolves to the shared 'hit' sound key, not TankEnemy's name.
    expect(audio.playSample).toHaveBeenCalledWith(
      'hit', SAMPLE_VARIANTS.hit, 'hit:hit', mixGainFor('hit'),
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

    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced', mixGainFor('defenderPlaced'));
    expect(audio.playSample).not.toHaveBeenCalled();
  });

  it('a Shooter and a Skeleton firing share one sound and one dedupe key', () => {
    audio.hasSample.mockReturnValue(false);

    bus.emit('projectile:fired', { defenderType: 'BasicDefender' });
    bus.emit('projectile:fired', { defenderType: 'RangeEnemy' });

    const keys = audio.playRecipe.mock.calls.map((call) => call[1]);
    expect(keys[0]).toBe('projectile:fire');
    expect(new Set(keys).size).toBe(1);
  });

  it('Mortar keeps a sound of its own', () => {
    audio.hasSample.mockReturnValue(false);

    bus.emit('projectile:fired', { defenderType: 'Mortar' });
    bus.emit('projectile:fired', { defenderType: 'GrenadeDefender' });

    const keys = audio.playRecipe.mock.calls.map((call) => call[1]);
    expect(new Set(keys).size).toBe(2);
  });
});
