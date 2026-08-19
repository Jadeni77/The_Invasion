import { SFX, recipeLayers } from './SfxLibrary.js';
import { MAX_DURATION } from './UnitVoices.js';

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

/*
 * Default depth for an amplitude-modulated layer that does not specify its
 * own: how far the trough dips below peak, as a fraction of peak.
 */
export const DEFAULT_MODULATION_DEPTH = 0.6;

/**
 * Q of the noise bandpass, set explicitly rather than left to
 * BiquadFilterNode's default because noiseMakeupGain is derived from it. Two
 * places depending on one unstated default is how they drift apart silently.
 */
export const NOISE_BANDPASS_Q = 1;

/*
 * Restores the level a bandpass takes out of a noise burst, so that `gain`
 * means the same loudness whether a recipe renders as a tone or as noise.
 */
export function noiseMakeupGain(freqStart, freqEnd, sampleRate, q = NOISE_BANDPASS_Q) {
  const centre = Math.sqrt(freqStart * freqEnd);
  const powerGain = Math.min(1, (Math.PI * centre) / (q * sampleRate));
  return 1 / Math.sqrt(powerGain);
}

/* Owns the AudioContext and its gain graph, and renders SfxLibrary recipes. */
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
    // One entry per SOUND, oldest first - a layered recipe contributes a
    // single entry holding all of its sources, not one entry per layer.
    this.activeVoices = [];        // { sources, endTime }
    this.samples = new Map(); // unit name -> AudioBuffer
  }

  /* Builds the AudioContext and its gain graph. */
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

  playSfx(id, mixGain = 1) {
    this.playRecipe(SFX[id], id, mixGain);
  }

  /*
   * Enforces the dedupe window and the voice cap shared by playRecipe and
   * playSample.
   */
  reserveVoiceSlot(dedupeKey, now) {
    const lastPlayed = this.lastPlayedAt.get(dedupeKey);
    if (lastPlayed !== undefined && now - lastPlayed < DEDUPE_WINDOW_SECONDS) return false;
    this.lastPlayedAt.set(dedupeKey, now);

    // Drop voices that have already finished before judging the cap.
    this.activeVoices = this.activeVoices.filter((voice) => voice.endTime > now);
    if (this.activeVoices.length >= MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      // Every source of the evicted sound, or a layered voice would keep
      // sounding through the layers eviction forgot about.
      for (const source of oldest.sources) {
        try {
          source.stop(now);
        } catch {
          // Already stopped; nothing to do.
        }
      }
    }

    return true;
  }

  /* Plays any recipe, keyed for deduplication. */
  playRecipe(recipe, dedupeKey, mixGain = 1) {
    if (!recipe || !this.ctx) return;

    const now = this.ctx.currentTime;
    if (!this.reserveVoiceSlot(dedupeKey, now)) return;

    const layers = recipeLayers(recipe);
    const sources = layers.map((layer) => this.startLayer(layer, now, mixGain));
    // The slot is held until the last layer to FINISH, which is not
    // necessarily the last one declared.
    const endTime = Math.max(...layers.map((layer) => now + layer.offset + layer.duration));

    this.activeVoices.push({ sources, endTime });
  }

  /*
   * Builds and schedules one layer, returning the node to stop if the voice is
   * evicted.
   */
  startLayer(layer, triggerTime, mixGain) {
    const start = triggerTime + layer.offset;
    const end = start + layer.duration;
    const peak = Math.max(0.0001, layer.gain * mixGain);

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    if (layer.modulationHz) {
      this.scheduleModulatedEnvelope(
        envelope.gain, peak, start, end,
        layer.modulationHz, layer.modulationDepth ?? DEFAULT_MODULATION_DEPTH,
      );
    } else {
      envelope.gain.setValueAtTime(peak, start);
      // Exponential fade to near-silence; exponentialRamp cannot reach exactly 0.
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    }

    const { source, output } = layer.noise
      ? this.createNoiseSource(layer, start, end)
      : this.createToneSource(layer, start, end);

    output.connect(envelope);
    source.start(start);
    source.stop(end);

    return source;
  }

  /*
   * Schedules a repeated ramp pattern on a gain AudioParam so a sustained
   * layer's LEVEL rises and falls at `hz` times a second, instead of decaying
   * once.
   */
  scheduleModulatedEnvelope(gainParam, peak, start, end, hz, depth) {
    const trough = Math.max(0.0001, peak * (1 - depth));
    const halfPeriod = 1 / (2 * hz);

    gainParam.setValueAtTime(peak, start);
    let time = start;
    let atPeak = true;
    while (time + halfPeriod < end) {
      time += halfPeriod;
      atPeak = !atPeak;
      gainParam.exponentialRampToValueAtTime(atPeak ? peak : trough, time);
    }
    gainParam.exponentialRampToValueAtTime(0.0001, end);
  }

  /* Fetches and decodes every supplied sample. */
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

  /* Plays a loaded sample, applying a variant transform. */
  playSample(name, transform, dedupeKey, mixGain = 1) {
    const buffer = this.samples.get(name);
    if (!buffer || !this.ctx) return;

    const now = this.ctx.currentTime;
    if (!this.reserveVoiceSlot(dedupeKey, now)) return;

    const rawDuration = (buffer.duration / transform.playbackRate) * transform.durationScale;
    const duration = Math.min(rawDuration, MAX_DURATION);
    const end = now + duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    const peakGain = Math.max(0.0001, SAMPLE_BASE_GAIN * transform.gainScale * mixGain);
    envelope.gain.setValueAtTime(peakGain, now);
    if (transform.durationScale < 1) {
      // Truncated (hit): exponentialRamp cannot reach exactly 0.
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      // Full-length sample: hold the level, then release only over the tail.
      const release = Math.min(0.03, duration * 0.2);
      envelope.gain.setValueAtTime(peakGain, end - release);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = transform.playbackRate;
    source.connect(envelope);
    source.start(now);
    source.stop(end);

    this.activeVoices.push({ sources: [source], endTime: end });
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

  /*
   * Builds a white-noise burst filtered through a bandpass whose center
   * frequency sweeps recipe.freqStart -> recipe.freqEnd, so a noise unit's
   * authored frequency curve actually shapes its timbre instead of being dead
   * data.
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
    filter.Q.value = NOISE_BANDPASS_Q;
    filter.frequency.setValueAtTime(recipe.freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(recipe.freqEnd, end);

    const makeup = this.ctx.createGain();
    makeup.gain.value = noiseMakeupGain(recipe.freqStart, recipe.freqEnd, this.ctx.sampleRate);

    source.connect(filter);
    filter.connect(makeup);

    return { source, output: makeup };
  }
}
