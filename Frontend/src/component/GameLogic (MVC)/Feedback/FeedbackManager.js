import { resolveVoice } from './UnitVoices.js';
import { SFX } from './SfxLibrary.js';

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
   * Plays a unit's own voice for one variant, keyed so repeats collapse.
   *
   * fallbackRecipe overrides the generic sound used when the unit is
   * unrecognised - e.g. an unknown defender should fall back to
   * SFX.defenderDied, not the enemy death squelch.
   */
  playUnitVoice(unitName, variant, fallbackRecipe) {
    this.audio.playRecipe(
      resolveVoice(unitName, variant, undefined, fallbackRecipe),
      `${unitName}:${variant}`,
    );
  }

  attach() {
    const on = (event, handler) => this.unsubscribers.push(this.bus.on(event, handler));

    on('defender:placed', () => this.audio.playSfx('defenderPlaced'));

    on('defender:died', ({ unitType }) => {
      this.playUnitVoice(unitType, 'death', SFX.defenderDied);
      this.juice.addTrauma(0.15);
    });

    on('projectile:fired', ({ defenderType }) => this.playUnitVoice(defenderType, 'fire'));

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

    on('energy:collected', () => this.audio.playSfx('energyCollected'));

    on('deploy:rejected', () => this.audio.playSfx('deployRejected'));

    on('base:damaged', () => {
      this.audio.playSfx('baseDamaged');
      this.juice.addTrauma(0.5);
      this.juice.triggerFlash('#ff0000', 250);
    });

    on('wave:started', ({ isBoss }) => {
      this.audio.playSfx(isBoss ? 'bossWaveStarted' : 'waveStarted');
    });

    on('level:won', () => this.audio.playSfx('levelWon'));
    on('level:lost', () => this.audio.playSfx('levelLost'));

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
