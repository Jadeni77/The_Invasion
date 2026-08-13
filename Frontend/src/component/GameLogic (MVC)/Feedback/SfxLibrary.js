/**
 * Synth recipes for every game sound. Pure data, no Web Audio types, so this
 * is testable without an AudioContext and tunable without touching playback.
 *
 * wave      - oscillator shape
 * freqStart - Hz at note start
 * freqEnd   - Hz at note end (a slide from freqStart)
 * duration  - seconds
 * gain      - peak gain, 0..1, before bus volumes are applied
 * noise     - when true, plays a filtered noise burst instead of a tone
 */
export const SFX = {
  // Placing a unit: short low thunk.
  defenderPlaced:   { wave: 'sine',     freqStart: 220, freqEnd: 110, duration: 0.12, gain: 0.5, noise: false },
  // Losing a unit: descending crumble.
  defenderDied:     { wave: 'sawtooth', freqStart: 180, freqEnd: 60,  duration: 0.35, gain: 0.4, noise: true  },
  // Firing: quick upward blip.
  projectileFired:  { wave: 'square',   freqStart: 640, freqEnd: 880, duration: 0.06, gain: 0.18, noise: false },
  // Enemy taking damage: dull tick.
  enemyHit:         { wave: 'triangle', freqStart: 320, freqEnd: 240, duration: 0.07, gain: 0.25, noise: false },
  // Enemy death: short noisy squelch.
  enemyDied:        { wave: 'sawtooth', freqStart: 300, freqEnd: 90,  duration: 0.22, gain: 0.4, noise: true  },
  // Boss death: long low roar.
  bossDied:         { wave: 'sawtooth', freqStart: 160, freqEnd: 40,  duration: 0.9,  gain: 0.6, noise: true  },
  // Collecting energy: bright rising ping.
  energyCollected:  { wave: 'sine',     freqStart: 880, freqEnd: 1320, duration: 0.15, gain: 0.35, noise: false },
  // Rejected action: dull buzz.
  deployRejected:   { wave: 'square',   freqStart: 140, freqEnd: 120, duration: 0.14, gain: 0.25, noise: false },
  // Base hit: urgent alarm.
  baseDamaged:      { wave: 'sawtooth', freqStart: 440, freqEnd: 220, duration: 0.4,  gain: 0.55, noise: false },
  // Wave incoming: horn.
  waveStarted:      { wave: 'sawtooth', freqStart: 180, freqEnd: 240, duration: 0.7,  gain: 0.45, noise: false },
  // Boss wave: lower, longer sting.
  bossWaveStarted:  { wave: 'sawtooth', freqStart: 110, freqEnd: 90,  duration: 1.2,  gain: 0.6, noise: false },
  // Victory: rising fanfare note.
  levelWon:         { wave: 'triangle', freqStart: 523, freqEnd: 1046, duration: 0.8, gain: 0.5, noise: false },
  // Defeat: descending tone.
  levelLost:        { wave: 'triangle', freqStart: 440, freqEnd: 110, duration: 1.1,  gain: 0.5, noise: false },
};

export const SFX_IDS = Object.keys(SFX);
