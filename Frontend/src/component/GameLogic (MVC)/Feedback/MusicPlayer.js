/**
 * A minimal looping chord bed. Deliberately simple: this is ambience so the
 * Music Volume slider controls something real, not a composed soundtrack.
 *
 * Uses lookahead scheduling - a coarse timer that schedules precise Web Audio
 * start times slightly ahead of the clock. setInterval alone is far too jittery
 * to drive audio directly.
 */

/** Am - F - C - G, one chord per bar, as raw frequencies in Hz. */
export const PROGRESSION = [
  [220.00, 261.63, 329.63], // Am
  [174.61, 220.00, 261.63], // F
  [130.81, 164.81, 196.00], // C
  [196.00, 246.94, 293.66], // G
];

const SECONDS_PER_CHORD = 2;
const LOOKAHEAD_SECONDS = 0.5;
const TICK_MS = 50;

export class MusicPlayer {
  constructor(audioManager) {
    this.audio = audioManager;
    this.timer = null;
    this.nextChordTime = 0;
    this.chordIndex = 0;
  }

  get isPlaying() {
    return this.timer !== null;
  }

  start() {
    if (this.timer !== null) return;
    const ctx = this.audio.ctx;
    if (!ctx) return;

    this.nextChordTime = ctx.currentTime;
    this.chordIndex = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Schedules every chord that starts inside the lookahead window. */
  tick() {
    const ctx = this.audio.ctx;
    if (!ctx) return;

    while (this.nextChordTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleChord(PROGRESSION[this.chordIndex], this.nextChordTime);
      this.nextChordTime += SECONDS_PER_CHORD;
      this.chordIndex = (this.chordIndex + 1) % PROGRESSION.length;
    }
  }

  scheduleChord(frequencies, startTime) {
    const ctx = this.audio.ctx;
    const endTime = startTime + SECONDS_PER_CHORD;

    for (const frequency of frequencies) {
      const envelope = ctx.createGain();
      envelope.connect(this.audio.musicBus);
      // Slow swell in and out so chords blend rather than click.
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.08, startTime + 0.4);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, startTime);
      osc.connect(envelope);
      osc.start(startTime);
      osc.stop(endTime);
    }
  }
}
