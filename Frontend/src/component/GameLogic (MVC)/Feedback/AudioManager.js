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

/**
 * Default depth for an amplitude-modulated layer that does not specify its
 * own: how far the trough dips below peak, as a fraction of peak. 0.6 is deep
 * enough to read as movement without dropping near silence between pulses,
 * which would sound like stutter rather than rumble.
 */
export const DEFAULT_MODULATION_DEPTH = 0.6;

/**
 * Q of the noise bandpass, set explicitly rather than left to
 * BiquadFilterNode's default because noiseMakeupGain is derived from it. Two
 * places depending on one unstated default is how they drift apart silently.
 */
export const NOISE_BANDPASS_Q = 1;

/**
 * Restores the level a bandpass takes out of a noise burst, so that `gain`
 * means the same loudness whether a recipe renders as a tone or as noise.
 *
 * THE BUG THIS FIXES. A tone reaches the envelope at full scale. Noise reaches
 * it having lost everything outside a narrow band - at a Q=1 midrange centre,
 * about 97% of its power - so `gain: 0.5` was roughly 14dB quieter on the
 * noise path than on the tone path. That single defect made the original
 * Mortar inaudible, made enemy deaths inaudible, and held the whole death
 * family ~22dB under baseDamaged, Titan and Boss included. Compensating here
 * rather than in the recipes means authors never have to know which path their
 * sound takes.
 *
 * THE DERIVATION. For a 2nd-order bandpass with unity peak gain, the
 * equivalent noise bandwidth is (pi/2)(f0/Q) Hz. White noise emerges with
 * power scaled by that bandwidth over the Nyquist span, i.e.
 *
 *     powerGain = ((pi/2)(f0/Q)) / (sampleRate/2) = pi*f0 / (Q*sampleRate)
 *
 * and the makeup is 1/sqrt(powerGain), which restores the burst's RMS to what
 * an unfiltered one would have had. `centre` is the geometric mean of the
 * sweep's endpoints, which is where an exponential sweep spends its time.
 *
 * ACCURACY, AND WHAT WOULD INVALIDATE IT. That identity is the analog one; the
 * digital biquad departs from it as the centre approaches a significant
 * fraction of the sample rate. Checked against direct numerical integration of
 * the biquad's response (see AudioManager.test.js, which integrates |H(f)|^2
 * independently), it is within 0.06dB at 200Hz, 0.16dB at 520Hz, 0.53dB at
 * 1700Hz and 1.0dB at 3200Hz - all inaudible - but reaches 2.6dB by 8kHz and
 * would keep growing. It would also be invalidated by changing
 * NOISE_BANDPASS_Q without changing this, or by giving the filter a Q that
 * varies across the sweep. The clamp below keeps the degenerate case
 * (bandwidth wider than the spectrum) from returning a makeup under 1 and
 * quietening sounds instead of leaving them alone.
 */
export function noiseMakeupGain(freqStart, freqEnd, sampleRate, q = NOISE_BANDPASS_Q) {
  const centre = Math.sqrt(freqStart * freqEnd);
  const powerGain = Math.min(1, (Math.PI * centre) / (q * sampleRate));
  return 1 / Math.sqrt(powerGain);
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
    // Set once construction has failed, so we don't keep retrying (and
    // re-logging) a doomed AudioContext on every subsequent init() call.
    this._unavailable = false;
    this.lastPlayedAt = new Map(); // dedupe key -> AudioContext time
    // One entry per SOUND, oldest first - a layered recipe contributes a
    // single entry holding all of its sources, not one entry per layer.
    this.activeVoices = [];        // { sources, endTime }
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

  playSfx(id, mixGain = 1) {
    this.playRecipe(SFX[id], id, mixGain);
  }

  /**
   * Enforces the dedupe window and the voice cap shared by playRecipe and
   * playSample. Returns whether the caller may proceed; when it may, the
   * dedupe key has been recorded and room has been made in activeVoices
   * (evicting the oldest voice early if the cap was full).
   *
   * Kept as one method so the two call sites can't drift: the cap and dedupe
   * logic used to be copied verbatim in both places.
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

  /**
   * Plays any recipe, keyed for deduplication.
   *
   * Two limits keep a busy wave readable. The same key inside DEDUPE_WINDOW_SECONDS
   * plays once - six splash kills would otherwise start six identical sounds whose
   * amplitudes sum to six times the intended level, which clips. And no more than
   * MAX_VOICES sound at once; beyond that the oldest is stopped early.
   *
   * A layered recipe (see SfxLibrary's header) renders one source per layer but
   * is ONE sound to both limits: reserveVoiceSlot is called once, before any
   * layer is built, and all the layers land in a single activeVoices entry.
   * Charging per layer instead would triple a three-layer sound's voice
   * pressure, and would break dedupe outright, since each layer would carry its
   * own key and so could never collapse against the repeat it is meant to
   * suppress.
   */
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

  /**
   * Builds and schedules one layer, returning the node to stop if the voice is
   * evicted. Each layer gets its own envelope, so layers can decay at their
   * own rates - the point of the crack/body/tail split - and its own start
   * time, so `offset` actually places it in the sound.
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

  /**
   * Schedules a repeated ramp pattern on a gain AudioParam so a sustained
   * layer's LEVEL rises and falls at `hz` times a second, instead of decaying
   * once.
   *
   * WHY THIS EXISTS RATHER THAN A LOWER-PITCHED LAYER. "Low and rumbling" is
   * normally reached for as a sub-bass frequency, and this codebase has
   * already paid for that mistake once - see SfxLibrary.js and UnitVoices.js's
   * headers: the Mortar and the whole death family were originally authored
   * at 25-90Hz and were completely inaudible on a laptop speaker, because
   * those speakers have essentially no output down there. Amplitude
   * modulation is the other route to the same impression: ears read a
   * few-Hz wobble in LOUDNESS as low-frequency movement even when the
   * carrier sits well above the rolloff, the way a tremolo effect reads as
   * "throbbing" without the pitch itself ever going anywhere near sub-bass.
   *
   * HOW. AudioManager has no LFO node in its graph - no second oscillator
   * modulating a gain via .connect() - so this is expressed the only way the
   * two primitives every other envelope here is built from allow: a repeated
   * ramp pattern, alternating the AudioParam's target between `peak` and a
   * quieter `trough` every half period, and closing with the same
   * fade-to-floor every other envelope ends on. If a future sound needed a
   * smoother (non-exponential-segment) modulation shape, an actual LFO node
   * - a second oscillator at `hz`, scaled and offset, connected into
   * envelope.gain - would be the next step; nothing here needs it yet.
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
   * Shares the dedupe window and voice cap with playRecipe via reserveVoiceSlot
   * - only the source node and envelope shape differ. Effective duration divides
   * by playbackRate, because pitching a sample down lengthens it; using the raw
   * buffer duration would cut every death sound off early. That duration is then
   * clamped to MAX_DURATION, the same cap resolveVoice applies to synthesized
   * recipes, so one long file can't occupy a shared voice slot for seconds.
   *
   * The envelope shape depends on whether this variant truncates the buffer
   * (transform.durationScale < 1, i.e. hit): a real sample isn't tuned around
   * the synth envelope's exponential decay from the first sample, so ramping
   * across the whole duration would fade audible content to near-silence a
   * quarter of the way through. Every variant except hit therefore holds the
   * gain flat and ramps only across a short release tail at the end. hit keeps
   * the full-length ramp because it truncates the buffer at 35% - the long fade
   * is what masks that truncation's click.
   */
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

  /**
   * Builds a white-noise burst filtered through a bandpass whose center
   * frequency sweeps recipe.freqStart -> recipe.freqEnd, so a noise unit's
   * authored frequency curve actually shapes its timbre instead of being
   * dead data. The buffer source is the node to start/stop; the makeup gain
   * is the node to connect onward, since the source's raw output is neither
   * filtered nor level-corrected.
   *
   * The makeup stage is what makes `gain` mean one thing across both render
   * paths - see noiseMakeupGain. It is a plain constant gain rather than part
   * of the envelope so that the two concerns stay separable: the envelope
   * shapes the sound, this only undoes the filter's loss.
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
