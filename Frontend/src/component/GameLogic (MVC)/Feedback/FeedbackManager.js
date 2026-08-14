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

  attach() {
    const on = (event, handler) => this.unsubscribers.push(this.bus.on(event, handler));

    on('defender:placed', () => this.audio.playSfx('defenderPlaced'));

    on('defender:died', () => {
      this.audio.playSfx('defenderDied');
      this.juice.addTrauma(0.15);
    });

    on('projectile:fired', () => this.audio.playSfx('projectileFired'));

    on('enemy:hit', ({ damage, x, y }) => {
      this.audio.playSfx('enemyHit');
      this.juice.addDamageNumber(x, y, damage);
    });

    on('enemy:died', ({ isBoss }) => {
      if (isBoss) {
        this.audio.playSfx('bossDied');
        this.juice.addTrauma(0.6);
        this.juice.triggerHitStop(80);
      } else {
        this.audio.playSfx('enemyDied');
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
