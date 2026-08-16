import { resolveVoice } from './UnitVoices.js';
import { SAMPLE_VARIANTS } from './UnitSamples.js';
import { soundKeyFor, mixGainFor } from './SoundGroups.js';

/**
 * Translates gameplay events into sound and juice.
 *
 * This is the single place that knows an enemy death should make a noise, and
 * the single place settings gate feedback. GameEngine emits semantic events and
 * knows nothing about audio.
 */
export class FeedbackManager {
  constructor(bus, audioManager, juiceManager) {
    this.bus = bus;
    this.audio = audioManager;
    this.juice = juiceManager;
    this.unsubscribers = [];
  }

  /**
   * Plays a unit's own sound, preferring a supplied sample over the synthesized
   * voice. The decision is per unit, so samples can be adopted one at a time and
   * every unit still makes a sound.
   */
  playUnitVoice(unitName, variant) {
    const soundKey = soundKeyFor(unitName, variant);
    const dedupeKey = `${soundKey}:${variant}`;
    const mixGain = mixGainFor(soundKey);

    if (this.audio.hasSample?.(soundKey)) {
      this.audio.playSample(soundKey, SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire, dedupeKey, mixGain);
      return;
    }

    this.audio.playRecipe(resolveVoice(soundKey, variant), dedupeKey, mixGain);
  }

  attach() {
    const on = (event, handler) => this.unsubscribers.push(this.bus.on(event, handler));

    on('defender:placed', () => this.audio.playSfx('defenderPlaced', mixGainFor('defenderPlaced')));

    on('defender:died', ({ unitType }) => {
      this.playUnitVoice(unitType, 'death');
      this.juice.addTrauma(0.15);
    });

    on('projectile:fired', ({ defenderType }) => this.playUnitVoice(defenderType, 'fire'));

    // The four things a player watches an enemy do. Melee uses its own variant
    // so a strike resolves to the shared melee sound whichever enemy swung;
    // the rest are acting sounds, which is what the fire variant means here.
    on('enemy:fired', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:melee', ({ unitType }) => this.playUnitVoice(unitType, 'melee'));
    on('enemy:spell', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:summon', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:heal', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));

    /**
     * The Titan's two AoE abilities, which were the loudest things in the game
     * and made no sound at all.
     *
     * The charge is a SEPARATE event from the impact, not a decoration on it,
     * because the 500ms between them is the whole point: it is the window in
     * which a player can still move a defender out. A single event at the
     * moment of damage would explain the death rather than prevent it.
     *
     * The shake is deliberately below base:damaged's 0.5 for the pound and
     * level with it for the phase change, and both are gated by the screen
     * shake setting like every other trauma call here.
     */
    on('enemy:groundPoundCharge', ({ unitType }) => this.playUnitVoice(unitType, 'charge'));

    on('enemy:groundPoundImpact', ({ unitType }) => {
      this.playUnitVoice(unitType, 'impact');
      this.juice.addTrauma(0.35);
    });

    on('enemy:phaseChange', ({ unitType }) => {
      this.playUnitVoice(unitType, 'phase');
      this.juice.addTrauma(0.45);
    });

    on('enemy:hit', ({ unitType, damage, x, y }) => {
      this.playUnitVoice(unitType, 'hit');
      this.juice.addDamageNumber(x, y, damage);
    });

    on('enemy:died', ({ unitType, isBoss }) => {
      this.playUnitVoice(unitType, 'death');
      if (isBoss) {
        this.juice.addTrauma(0.6);
        this.juice.triggerHitStop(80);
      } else {
        this.juice.addTrauma(0.08);
      }
    });

    on('energy:collected', () => this.audio.playSfx('energyCollected', mixGainFor('energyCollected')));

    on('deploy:rejected', () => this.audio.playSfx('deployRejected', mixGainFor('deployRejected')));

    on('base:damaged', () => {
      this.audio.playSfx('baseDamaged', mixGainFor('baseDamaged'));
      this.juice.addTrauma(0.5);
      this.juice.triggerFlash('#ff0000', 250);
    });

    on('wave:started', ({ isBoss }) => {
      const id = isBoss ? 'bossWaveStarted' : 'waveStarted';
      this.audio.playSfx(id, mixGainFor(id));
    });

    on('level:won', () => this.audio.playSfx('levelWon', mixGainFor('levelWon')));
    on('level:lost', () => this.audio.playSfx('levelLost', mixGainFor('levelLost')));

    return () => this.detach();
  }

  detach() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  applySettings(settings) {
    this.audio.setVolumes(settings.audio);
    this.juice.setEnabled({
      screenShake: settings.display.screenShake,
      showDamageNumbers: settings.display.showDamageNumbers,
    });
  }
}
