import { resolveVoice } from './UnitVoices.js';
import { SAMPLE_VARIANTS } from './UnitSamples.js';
import { soundKeyFor, mixGainFor } from './SoundGroups.js';
import { colors } from '../../../style/tokens.js';

/* Translates gameplay events into sound and juice. */
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

    // The hammer/shovel tool removing a deployed defender: a game event, like
    // defenderPlaced, not a unit voice - it is the PLAYER'S action, not the
    // unit's, so it plays through playSfx rather than playUnitVoice.
    on('defender:removed', () => this.audio.playSfx('defenderRemoved', mixGainFor('defenderRemoved')));

    on('defender:died', ({ unitType }) => {
      this.playUnitVoice(unitType, 'death');
      this.juice.addTrauma(0.15);
    });

    on('projectile:fired', ({ defenderType }) => this.playUnitVoice(defenderType, 'fire'));

    /*
     * The Mortar's shell landing - additive, not a replacement for the shared
     * 'hit' sound that already plays for every enemy the splash catches (see
     * GameEngine.addDefenderExplosion's 'enemy:hit' emits).
     */
    on('defender:shellLanded', ({ defenderType }) => this.playUnitVoice(defenderType, 'landing'));

    // The four things a player watches an enemy do. Melee uses its own variant
    // so a strike resolves to the shared melee sound whichever enemy swung;
    // the rest are acting sounds, which is what the fire variant means here.
    on('enemy:fired', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:melee', ({ unitType }) => this.playUnitVoice(unitType, 'melee'));
    on('enemy:spell', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:summon', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:heal', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));

    /*
     * The Titan's two AoE abilities, which were the loudest things in the game
     * and made no sound at all.
     */
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

    /**
     * A chest opening in the lobby. One event, two sounds: unlocking a defender
     * is rarer than gaining resources and gets the grander of the two, chosen
     * here rather than by the caller so the lobby never has to know sound keys.
     */
    on('treasure:collected', ({ unlockedDefenders } = {}) => {
      const key = unlockedDefenders?.length ? 'defenderUnlocked' : 'treasureCollected';
      this.audio.playSfx(key, mixGainFor(key));
    });

    /* Winning a level that grants a defender. The same fanfare a chest gets
       for the same news - where the defender came from is not the point. */
    on('defender:unlocked', () => {
      this.audio.playSfx('defenderUnlocked', mixGainFor('defenderUnlocked'));
    });

    on('energy:collected', () => this.audio.playSfx('energyCollected', mixGainFor('energyCollected')));

    on('deploy:rejected', () => this.audio.playSfx('deployRejected', mixGainFor('deployRejected')));

    on('base:damaged', () => {
      this.audio.playSfx('baseDamaged', mixGainFor('baseDamaged'));
      this.juice.addTrauma(0.5);
      this.juice.triggerFlash(colors.accentDanger, 250);
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
