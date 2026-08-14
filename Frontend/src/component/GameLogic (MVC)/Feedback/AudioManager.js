import { SFX } from './SfxLibrary.js';

/** Converts a 0..100 slider value to gain using a perceptual (squared) curve. */
export function volumeToGain(value) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  return (clamped / 100) ** 2;
}

/** The same sound key repeated inside this window plays once. */
export const DEDUPE_WINDOW_SECONDS = 0.04;

/** Maximum simultaneously sounding voices. */
export const MAX_VOICES = 12;

/** Base gain applied to every sample before its variant gainScale. */
export const SAMPLE_BASE_GAIN = 0.7;

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
    // Set once construction has failed, so we don't keep retrying (and
    // re-logging) a doomed AudioContext on every subsequent init() call.
    this._unavailable = false;
    this.lastPlayedAt = new Map(); // dedupe key -> AudioContext time
    this.activeVoices = [];        // { source, endTime }, oldest first
    this.samples = new Map(); // unit name -> AudioBuffer
  }

  /**
   * Builds the AudioContext and its gain graph. Never throws: environments
   * that block or lack Web Audio (Tor Browser, dom.webaudio.enabled=false,
   * fingerprint-blocking extensions, non-browser renders, ...) leave this.ctx
   * null and every other method degrades to a silent no-op.
   */
  init() {
    if (this.ctx || this._unavailable) return;

    try {
      this.ctx = this.contextFactory();

      // Order matters: tests assert master is the first gain created.
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
    } catch (err) {
      console.error('AudioManager: Web Audio unavailable; continuing without sound.', err);
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this._unavailable = true;
    }
  }

  get isReady() {
    return Boolean(this.ctx) && this.ctx.state === 'running';
  }

  get musicBus() {
    if (!this.ctx) return null;
    return this.musicGain;
  }

  /** Must be called from a user gesture handler. */
  resume() {
    if (!this.ctx) this.init();
    if (!this.ctx) return Promise.resolve();
    if (this.ctx.state !== 'running') return this.ctx.resume();
    return Promise.resolve();
  }

  setVolumes({ masterVolume, musicVolume, soundEffects }) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    this.masterGain.gain.value = volumeToGain(masterVolume);
    this.sfxGain.gain.value = volumeToGain(soundEffects);
    this.musicGain.gain.value = volumeToGain(musicVolume);
  }

  playSfx(id) {
    this.playRecipe(SFX[id], id);
  }

  /**
   * Plays any recipe, keyed for deduplication.
   *
   * Two limits keep a busy wave readable. The same key inside DEDUPE_WINDOW_SECONDS
   * plays once - six splash kills would otherwise start six identical sounds whose
   * amplitudes sum to six times the intended level, which clips. And no more than
   * MAX_VOICES sound at once; beyond that the oldest is stopped early.
   */
  playRecipe(recipe, dedupeKey) {
    if (!recipe || !this.ctx) return;

    const now = this.ctx.currentTime;

    const lastPlayed = this.lastPlayedAt.get(dedupeKey);
    if (lastPlayed !== undefined && now - lastPlayed < DEDUPE_WINDOW_SECONDS) return;
    this.lastPlayedAt.set(dedupeKey, now);

    // Drop voices that have already finished before judging the cap.
    this.activeVoices = this.activeVoices.filter((voice) => voice.endTime > now);
    if (this.activeVoices.length >= MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      try {
        oldest.source.stop(now);
      } catch {
        // Already stopped; nothing to do.
      }
    }

    const end = now + recipe.duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    envelope.gain.setValueAtTime(recipe.gain, now);
    // Exponential fade to near-silence; exponentialRamp cannot reach exactly 0.
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    const { source, output } = recipe.noise
      ? this.createNoiseSource(recipe, now, end)
      : this.createToneSource(recipe, now, end);

    output.connect(envelope);
    source.start(now);
    source.stop(end);

    this.activeVoices.push({ source, endTime: end });
  }

  /**
   * Fetches and decodes every supplied sample.
   *
   * Failures are isolated per file: one bad download or corrupt file leaves that
   * unit on its synthesized voice while every other sample still loads.
   */
  async loadSamples(urlMap) {
    if (!this.ctx) return;

    await Promise.all(Object.entries(urlMap).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = await response.arrayBuffer();
        this.samples.set(name, await this.ctx.decodeAudioData(encoded));
      } catch (err) {
        console.error(`Could not load audio sample "${name}" from ${url}:`, err);
      }
    }));
  }

  hasSample(name) {
    return this.samples.has(name);
  }

  /**
   * Plays a loaded sample, applying a variant transform.
   *
   * Shares the dedupe window, voice cap and envelope with playRecipe - only the
   * source node differs. Effective duration divides by playbackRate, because
   * pitching a sample down lengthens it; using the raw buffer duration would cut
   * every death sound off early.
   */
  playSample(name, transform, dedupeKey) {
    const buffer = this.samples.get(name);
    if (!buffer || !this.ctx) return;

    const now = this.ctx.currentTime;

    const lastPlayed = this.lastPlayedAt.get(dedupeKey);
    if (lastPlayed !== undefined && now - lastPlayed < DEDUPE_WINDOW_SECONDS) return;
    this.lastPlayedAt.set(dedupeKey, now);

    this.activeVoices = this.activeVoices.filter((voice) => voice.endTime > now);
    if (this.activeVoices.length >= MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      try {
        oldest.source.stop(now);
      } catch {
        // Already stopped; nothing to do.
      }
    }

    const duration = (buffer.duration / transform.playbackRate) * transform.durationScale;
    const end = now + duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    envelope.gain.setValueAtTime(SAMPLE_BASE_GAIN * transform.gainScale, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = transform.playbackRate;
    source.connect(envelope);
    source.start(now);
    source.stop(end);

    this.activeVoices.push({ source, endTime: end });
  }

  /**
   * Builds an oscillator. For a tone, the node that is started/stopped and
   * the node that is connected onward are the same object.
   */
  createToneSource(recipe, now, end) {
    const osc = this.ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(recipe.freqEnd, end);
    return { source: osc, output: osc };
  }

  /**
   * Builds a white-noise burst filtered through a bandpass whose center
   * frequency sweeps recipe.freqStart -> recipe.freqEnd, so a noise unit's
   * authored frequency curve actually shapes its timbre instead of being
   * dead data. The buffer source is the node to start/stop; the filter is
   * the node to connect onward, since the source's raw output is unfiltered.
   */
  createNoiseSource(recipe, now, end) {
    const frames = Math.floor(this.ctx.sampleRate * recipe.duration);
    const buffer = this.ctx.createBuffer(1, Math.max(1, frames), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(recipe.freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(recipe.freqEnd, end);

    source.connect(filter);

    return { source, output: filter };
  }
}
