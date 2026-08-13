import { SFX } from './SfxLibrary.js';

/** Converts a 0..100 slider value to gain using a perceptual (squared) curve. */
export function volumeToGain(value) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  return (clamped / 100) ** 2;
}

/**
 * Owns the AudioContext and its gain graph, and renders SfxLibrary recipes.
 *
 * The context factory is injected so tests can supply a mock. Browsers refuse
 * to start an AudioContext without a user gesture, so the context is created
 * suspended and resume() must be called from a real click.
 */
export class AudioManager {
  constructor(contextFactory = () => new (window.AudioContext || window.webkitAudioContext)()) {
    this.contextFactory = contextFactory;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = this.contextFactory();

    // Order matters: tests assert master is the first gain created.
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
  }

  get isReady() {
    return Boolean(this.ctx) && this.ctx.state === 'running';
  }

  get musicBus() {
    return this.musicGain;
  }

  /** Must be called from a user gesture handler. */
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx.state !== 'running') return this.ctx.resume();
    return Promise.resolve();
  }

  setVolumes({ masterVolume, musicVolume, soundEffects }) {
    if (!this.ctx) this.init();
    this.masterGain.gain.value = volumeToGain(masterVolume);
    this.sfxGain.gain.value = volumeToGain(soundEffects);
    this.musicGain.gain.value = volumeToGain(musicVolume);
  }

  playSfx(id) {
    const recipe = SFX[id];
    if (!recipe || !this.ctx) return;

    const now = this.ctx.currentTime;
    const end = now + recipe.duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    envelope.gain.setValueAtTime(recipe.gain, now);
    // Exponential fade to near-silence; exponentialRamp cannot reach exactly 0.
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    const source = recipe.noise
      ? this.createNoiseSource(recipe)
      : this.createToneSource(recipe, now, end);

    source.connect(envelope);
    source.start(now);
    source.stop(end);
  }

  createToneSource(recipe, now, end) {
    const osc = this.ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(recipe.freqEnd, end);
    return osc;
  }

  createNoiseSource(recipe) {
    const frames = Math.floor(this.ctx.sampleRate * recipe.duration);
    const buffer = this.ctx.createBuffer(1, Math.max(1, frames), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }
}
