import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {
  AudioManager, volumeToGain, DEDUPE_WINDOW_SECONDS, MAX_VOICES,
  NOISE_BANDPASS_Q, noiseMakeupGain,
} from '../AudioManager.js';
import { MAX_DURATION, UNIT_VOICES } from '../UnitVoices.js';
import { SFX, recipeLayers } from '../SfxLibrary.js';

function createMockContext() {
  const made = { gains: [], oscillators: [], buffers: [], filters: [] };
  const gainNode = () => {
    const node = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    made.gains.push(node);
    return node;
  };
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: { id: 'destination' },
    createGain: vi.fn(gainNode),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      made.oscillators.push(osc);
      return osc;
    }),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      made.buffers.push(src);
      return src;
    }),
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: 0.4 })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(256) })),
    createBiquadFilter: vi.fn(() => {
      const filter = {
        type: 'lowpass',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        // Deliberately NOT BiquadFilterNode's real default of 1: the makeup
        // gain is derived from Q, so a test has to be able to tell
        // "AudioManager set this" from "it happened to already be right".
        Q: { value: -1, setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
      made.filters.push(filter);
      return filter;
    }),
    resume: vi.fn(function () { this.state = 'running'; return Promise.resolve(); }),
    sampleRate: 44100,
  };
  return { ctx, made };
}

describe('AudioManager', () => {
  let ctx, made, audio;

  beforeEach(() => {
    ({ ctx, made } = createMockContext());
    audio = new AudioManager(() => ctx);
    audio.init();
  });

  it('builds a master, sfx, and music gain graph', () => {
    expect(ctx.createGain).toHaveBeenCalledTimes(3);
    // sfx and music both route into master; master routes to destination.
    expect(made.gains[0].connect).toHaveBeenCalledWith(ctx.destination);
    expect(made.gains[1].connect).toHaveBeenCalledWith(made.gains[0]);
    expect(made.gains[2].connect).toHaveBeenCalledWith(made.gains[0]);
  });

  it('applies a squared perceptual volume curve, not linear', () => {
    audio.setVolumes({ masterVolume: 50, musicVolume: 100, soundEffects: 0 });
    expect(made.gains[0].gain.value).toBeCloseTo(0.25); // (50/100)^2
    expect(made.gains[2].gain.value).toBeCloseTo(1);    // (100/100)^2
    expect(made.gains[1].gain.value).toBeCloseTo(0);    // (0/100)^2
  });

  it('is silent at volume 0', () => {
    audio.setVolumes({ masterVolume: 0, musicVolume: 0, soundEffects: 0 });
    expect(made.gains[0].gain.value).toBe(0);
  });

  it('clamps out-of-range volumes into 0..100', () => {
    audio.setVolumes({ masterVolume: 150, musicVolume: -20, soundEffects: 70 });
    expect(made.gains[0].gain.value).toBeCloseTo(1);
    expect(made.gains[2].gain.value).toBe(0);
  });

  it('creates a suspended context and only resumes on request', () => {
    expect(ctx.resume).not.toHaveBeenCalled();
    audio.resume();
    expect(ctx.resume).toHaveBeenCalledOnce();
  });

  it('plays a tone for an oscillator-based sound', () => {
    audio.resume();
    audio.playSfx('projectileFired');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    const osc = made.oscillators[0];
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });

  it('plays a noise burst for a noise-based sound', () => {
    audio.resume();
    audio.playSfx('enemyDied');
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it('ignores an unknown sound id without throwing', () => {
    audio.resume();
    expect(() => audio.playSfx('nope')).not.toThrow();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('does not throw when playing before init', () => {
    const fresh = new AudioManager(() => createMockContext().ctx);
    expect(() => fresh.playSfx('enemyHit')).not.toThrow();
  });

  it('connects oscillator-based sound envelope to sfx gain', () => {
    audio.resume();
    audio.playSfx('projectileFired');
    expect(made.gains[3].connect).toHaveBeenCalledWith(made.gains[1]);
  });

  it('connects noise-based sound envelope to sfx gain', () => {
    audio.resume();
    audio.playSfx('enemyDied');
    expect(made.gains[3].connect).toHaveBeenCalledWith(made.gains[1]);
  });
});

describe('noise timbre (bandpass filtering)', () => {
  const NOISE_RECIPE = { wave: 'sawtooth', freqStart: 120, freqEnd: 60, duration: 0.3, gain: 0.5, noise: true };
  const TONE_RECIPE = { wave: 'square', freqStart: 640, freqEnd: 880, duration: 0.06, gain: 0.18, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('creates a bandpass filter driven by the recipe frequencies for a noise recipe', () => {
    const { ctx, made, audio } = readyAudio();

    audio.playRecipe(NOISE_RECIPE, 'noise-unit:fire');

    expect(ctx.createBiquadFilter).toHaveBeenCalledOnce();
    const filter = made.filters[0];
    expect(filter.type).toBe('bandpass');
    expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(NOISE_RECIPE.freqStart, 0);
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      NOISE_RECIPE.freqEnd,
      NOISE_RECIPE.duration,
    );
  });

  it('creates no biquad filter for a tone recipe', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(TONE_RECIPE, 'tone-unit:fire');

    expect(ctx.createBiquadFilter).not.toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('still connects a noise recipe to the sfx bus through the filter', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe(NOISE_RECIPE, 'noise-unit:fire');

    const filter = made.filters[0];
    const source = made.buffers[0];
    const envelope = made.gains[3];
    const makeup = made.gains[4];
    // The chain gained a stage: the bandpass throws away most of the noise's
    // power, and the makeup gain puts it back so that `gain` means the same
    // loudness here as it does on the tone path (see noiseMakeupGain). The
    // raw source still reaches nothing directly.
    expect(source.connect).toHaveBeenCalledWith(filter);
    expect(filter.connect).toHaveBeenCalledWith(makeup);
    expect(makeup.connect).toHaveBeenCalledWith(envelope);
    expect(envelope.connect).toHaveBeenCalledWith(made.gains[1]);
  });

  it('still connects a tone recipe directly to the envelope (no filter in the path)', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe(TONE_RECIPE, 'tone-unit:fire');

    const osc = made.oscillators[0];
    const envelope = made.gains[3];
    expect(osc.connect).toHaveBeenCalledWith(envelope);
    expect(envelope.connect).toHaveBeenCalledWith(made.gains[1]);
  });
});

describe('layered recipes', () => {
  /**
   * A recipe may carry `layers`: further recipes, each with an `offset` in
   * seconds from the trigger. AudioManager renders the base recipe and every
   * layer, but the result is ONE sound - one voice against MAX_VOICES and one
   * dedupe slot. Without that accounting a three-layer sound would triple the
   * voice pressure and its layers would each burn a slot, so twelve of them
   * would silence everything else in the game.
   *
   * The mechanism exists because a single source cannot be artillery:
   * playRecipe renders either an oscillator or a bandpassed noise burst, never
   * both, and a cannon needs a crack, a body and a tail sounding together.
   */
  const LAYERED = {
    wave: 'square', freqStart: 800, freqEnd: 400, duration: 0.05, gain: 0.5, noise: false,
    layers: [
      { offset: 0.02, wave: 'sawtooth', freqStart: 600, freqEnd: 300, duration: 0.20, gain: 0.4, noise: false },
      { offset: 0.05, wave: 'sawtooth', freqStart: 700, freqEnd: 350, duration: 0.30, gain: 0.3, noise: true },
    ],
  };
  const SINGLE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('starts one source per layer, the base recipe included', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(LAYERED, 'Mortar:fire');

    // Two tone layers (base + first layer) and one noise layer.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('starts each layer at its own offset from the trigger', () => {
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 5;

    audio.playRecipe(LAYERED, 'Mortar:fire');

    expect(made.oscillators[0].start).toHaveBeenCalledWith(5);
    expect(made.oscillators[1].start).toHaveBeenCalledWith(5 + 0.02);
    expect(made.buffers[0].start).toHaveBeenCalledWith(5 + 0.05);
  });

  it('stops each layer after its own duration, not the base layer’s', () => {
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 5;

    audio.playRecipe(LAYERED, 'Mortar:fire');

    expect(made.oscillators[0].stop).toHaveBeenCalledWith(5 + 0.05);
    expect(made.oscillators[1].stop).toHaveBeenCalledWith(5 + 0.02 + 0.20);
    expect(made.buffers[0].stop).toHaveBeenCalledWith(5 + 0.05 + 0.30);
  });

  it('gives every layer its own envelope at its own gain, all on the sfx bus', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe(LAYERED, 'Mortar:fire', 0.7);

    // gains[0..2] are master/sfx/music; one envelope per layer follows. A
    // noise layer also builds a constant makeup gain, which is not an
    // envelope - envelopes are the nodes that get a scheduled peak.
    const envelopes = made.gains.slice(3).filter((g) => g.gain.setValueAtTime.mock.calls.length > 0);
    expect(envelopes).toHaveLength(3);
    const peaks = envelopes.map((g) => g.gain.setValueAtTime.mock.calls[0][0]);
    expect(peaks).toEqual([0.5 * 0.7, 0.4 * 0.7, 0.3 * 0.7].map((v) => expect.closeTo(v, 10)));
    for (const envelope of envelopes) {
      expect(envelope.connect).toHaveBeenCalledWith(made.gains[1]);
    }
  });

  it('drives a noise layer’s bandpass from that layer’s own frequencies', () => {
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 5;

    audio.playRecipe(LAYERED, 'Mortar:fire');

    // Rejects an implementation that renders layers but hands each one the
    // BASE recipe's sweep, which would collapse a three-band sound to one band.
    expect(made.filters).toHaveLength(1);
    expect(made.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(700, 5 + 0.05);
    expect(made.filters[0].frequency.exponentialRampToValueAtTime)
      .toHaveBeenCalledWith(350, 5 + 0.05 + 0.30);
  });

  it('treats a layer with no offset as landing on the trigger', () => {
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 5;

    audio.playRecipe({ ...SINGLE, layers: [{ ...SINGLE, wave: 'square' }] }, 'k');

    expect(made.oscillators[1].start).toHaveBeenCalledWith(5);
  });

  it('counts the whole layered sound as ONE voice against the cap', () => {
    const { made, audio } = readyAudio();

    // Three sources each; if layers counted individually the cap would be
    // reached after four sounds and eviction would start there.
    for (let i = 0; i < MAX_VOICES; i++) audio.playRecipe(LAYERED, `unit${i}:fire`);

    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);
    expect(made.buffers.every((src) => src.stop.mock.calls.length === 1)).toBe(true);
  });

  it('stops every layer of the voice the cap evicts, not just its first source', () => {
    const { made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) audio.playRecipe(LAYERED, `unit${i}:fire`);
    audio.playRecipe(SINGLE, 'overflow:fire');

    // The first sound's three sources are the oldest voice; all three must be
    // stopped early, or an evicted layer keeps sounding past its eviction.
    expect(made.oscillators[0].stop.mock.calls.length).toBe(2);
    expect(made.oscillators[1].stop.mock.calls.length).toBe(2);
    expect(made.buffers[0].stop.mock.calls.length).toBe(2);
    // The second sound is still untouched.
    expect(made.oscillators[2].stop.mock.calls.length).toBe(1);
  });

  it('takes ONE dedupe slot for the whole sound, not one per layer', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(LAYERED, 'Mortar:fire');
    audio.playRecipe(LAYERED, 'Mortar:fire');

    // The repeat is suppressed entirely: still three sources, not six. A
    // per-layer dedupe would instead let the repeat's later layers through,
    // because each layer would carry its own key.
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('does not let its own layers dedupe each other away', () => {
    const { ctx, audio } = readyAudio();

    // Three layers that are byte-identical apart from their offsets. Keyed per
    // layer they would collapse to one; keyed per sound all three must sound.
    audio.playRecipe({
      ...SINGLE,
      layers: [{ ...SINGLE, offset: 0.01 }, { ...SINGLE, offset: 0.02 }],
    }, 'k');

    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('holds the voice slot until the last layer’s tail, not the base layer’s', () => {
    const { ctx, made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) audio.playRecipe(LAYERED, `unit${i}:fire`);
    // Past the 0.05s base layer but well inside the 0.35s tail. The voices are
    // still sounding, so the cap must still evict rather than find free room.
    ctx.currentTime = 0.1;
    audio.playRecipe(SINGLE, 'overflow:fire');

    expect(made.oscillators[0].stop.mock.calls.length).toBe(2);
  });

  it('releases the voice slot once even the last layer has finished', () => {
    const { ctx, made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) audio.playRecipe(LAYERED, `unit${i}:fire`);
    ctx.currentTime = 0.4; // past 0.05 + 0.30
    audio.playRecipe(SINGLE, 'later:fire');

    expect(made.oscillators[0].stop.mock.calls.length).toBe(1);
  });

  it('leaves a recipe with no layers rendering exactly as before', () => {
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 5;

    audio.playRecipe(SINGLE, 'Sniper:fire');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
    expect(made.gains).toHaveLength(4); // master, sfx, music, one envelope
    expect(made.oscillators[0].start).toHaveBeenCalledWith(5);
    expect(made.oscillators[0].stop).toHaveBeenCalledWith(5 + SINGLE.duration);
    expect(made.gains[3].gain.setValueAtTime).toHaveBeenCalledWith(SINGLE.gain, 5);
    expect(made.gains[3].connect).toHaveBeenCalledWith(made.gains[1]);
  });

  it('treats an empty layers array as a plain one-source recipe', () => {
    const { ctx, made, audio } = readyAudio();

    audio.playRecipe({ ...SINGLE, layers: [] }, 'k');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(made.gains).toHaveLength(4);
  });
});

/**
 * The invariant that was silently false for 589 tests.
 *
 * `gain: 0.5` meant two different loudnesses depending on `noise`, a boolean
 * elsewhere in the same recipe. AudioManager renders a noise recipe through a
 * bandpass, which throws away everything outside a narrow band - about 97% of
 * white noise's power at a Q=1 midrange centre - while a tone recipe reaches
 * the envelope at full scale. Measured, that put the noise path ~14dB under
 * the tone path at identical authored gain.
 *
 * It explains three separate symptoms the owner reported as unrelated: the
 * original Mortar being inaudible, enemy deaths being inaudible, and the whole
 * death family sitting ~22dB under baseDamaged, Titan and Boss included. Every
 * one of those is a `noise: true` recipe.
 *
 * These tests model the rendered level from what AudioManager actually
 * schedules on the mock graph. The bandpass's noise power gain is obtained by
 * NUMERICALLY INTEGRATING |H(f)|^2 across the spectrum, which is a different
 * derivation from the closed-form equivalent-noise-bandwidth identity
 * noiseMakeupGain uses - so agreement between them is evidence, not a
 * tautology. A test that reused the production formula could only prove the
 * code equals itself.
 */
describe('authored gain means the same level on both render paths', () => {
  /** RMS of a full-scale oscillator, by shape. */
  const WAVE_RMS = {
    sine: Math.SQRT1_2, square: 1, sawtooth: 1 / Math.sqrt(3), triangle: 1 / Math.sqrt(3),
  };
  /** RMS of the uniform [-1,1) buffer createNoiseSource fills. */
  const UNIFORM_NOISE_RMS = 1 / Math.sqrt(3);

  /**
   * The Q this model assumes, stated independently of the production constant
   * so that the model keeps working - and keeps failing honestly - even when
   * the production side does not exist or is wrong. A separate test below
   * pins production to this value.
   */
  const ASSUMED_Q = 1;

  /**
   * White-noise power gain of the Web Audio bandpass at `centre`, by direct
   * integration of the biquad's magnitude response over 0..Nyquist. The
   * coefficients are the spec's constant-0dB-peak-gain bandpass.
   */
  function bandpassNoisePowerGain(centre, q, sampleRate, bins = 8192) {
    const w0 = (2 * Math.PI * centre) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - alpha) / a0;

    let total = 0;
    for (let i = 0; i < bins; i++) {
      const w = (Math.PI * (i + 0.5)) / bins;
      const cw = Math.cos(w), sw = Math.sin(w);
      const c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
      const numRe = b0 + b2 * c2, numIm = -(b2 * s2);
      const denRe = 1 + a1 * cw + a2 * c2, denIm = -(a1 * sw + a2 * s2);
      total += (numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm);
    }
    return total / bins;
  }

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  /**
   * Peak output amplitude of a single-layer recipe, read off the graph
   * AudioManager built rather than assumed: the envelope's scheduled peak,
   * times every constant gain in the path (the makeup node, if any), times the
   * source's own RMS after whatever filtering it went through.
   */
  function renderedLevel(recipe, mixGain = 1) {
    const { ctx, made, audio } = readyAudio();
    audio.playRecipe(recipe, 'level-probe', mixGain);

    const built = made.gains.slice(3); // past master, sfx, music
    const envelope = built.find((g) => g.gain.setValueAtTime.mock.calls.length > 0);
    // Anything else in the path is a constant gain, i.e. makeup. Before the
    // fix there is none, and the product is 1 - which is exactly the state
    // this suite has to be able to observe and reject.
    const makeup = built
      .filter((g) => g.gain.setValueAtTime.mock.calls.length === 0)
      .reduce((product, g) => product * g.gain.value, 1);

    const envelopePeak = envelope.gain.setValueAtTime.mock.calls[0][0];
    const sourceRms = recipe.noise
      ? UNIFORM_NOISE_RMS * Math.sqrt(bandpassNoisePowerGain(
        Math.sqrt(recipe.freqStart * recipe.freqEnd), ASSUMED_Q, ctx.sampleRate,
      ))
      : WAVE_RMS[recipe.wave];

    return envelopePeak * makeup * sourceRms;
  }

  const dbBetween = (a, b) => 20 * Math.log10(a / b);

  /** How far apart two paths may land and still be "the same level". */
  const TOLERANCE_DB = 2;

  const SWEEPS = [[520, 320], [700, 300], [900, 400], [3200, 900], [250, 220]];

  it.each(SWEEPS)('a noise burst at %s->%sHz matches a tone at the same gain', (from, to) => {
    const shared = { wave: 'sawtooth', freqStart: from, freqEnd: to, duration: 0.3, gain: 0.5 };

    const tone = renderedLevel({ ...shared, noise: false });
    const noise = renderedLevel({ ...shared, noise: true });

    // Same envelope shape and duration on both sides, so comparing the levels
    // the two paths reach is a fair comparison of the paths themselves.
    expect(Math.abs(dbBetween(noise, tone)), `${from}->${to}Hz differs by dB`)
      .toBeLessThanOrEqual(TOLERANCE_DB);
  });

  it('holds across the whole authored gain range, not just at one level', () => {
    for (const gain of [0.05, 0.2, 0.5, 0.9]) {
      const shared = { wave: 'sawtooth', freqStart: 520, freqEnd: 320, duration: 0.2, gain };
      const gap = dbBetween(renderedLevel({ ...shared, noise: true }), renderedLevel({ ...shared, noise: false }));
      expect(Math.abs(gap), `gain ${gain}`).toBeLessThanOrEqual(TOLERANCE_DB);
    }
  });

  it('holds after the mix tier is applied, so tiers still mean what they say', () => {
    const shared = { wave: 'sawtooth', freqStart: 660, freqEnd: 300, duration: 0.2, gain: 0.4 };
    const gap = dbBetween(renderedLevel({ ...shared, noise: true }, 0.4), renderedLevel({ ...shared, noise: false }, 0.4));
    expect(Math.abs(gap)).toBeLessThanOrEqual(TOLERANCE_DB);
  });

  /**
   * Derived from the recipe tables, so a noise recipe authored later is
   * covered the day it is written. Each is compared against a tone carrying
   * the SAME authored gain - which is the whole claim: gain means one thing.
   */
  const authoredNoiseLayers = Object.entries({ ...SFX, ...UNIT_VOICES })
    .flatMap(([id, recipe]) => recipeLayers(recipe).map((layer, index) => [`${id}[${index}]`, layer]))
    .filter(([, layer]) => layer.noise);

  it('finds the authored noise recipes, so the checks below are not vacuous', () => {
    expect(authoredNoiseLayers.length).toBeGreaterThanOrEqual(8);
  });

  it.each(authoredNoiseLayers)('%s lands where its authored gain says it should', (id, layer) => {
    const asNoise = renderedLevel({ ...layer, noise: true });
    const asTone = renderedLevel({ ...layer, wave: 'sawtooth', noise: false });

    expect(Math.abs(dbBetween(asNoise, asTone)), `${id} differs by dB`).toBeLessThanOrEqual(TOLERANCE_DB);
  });

  it('puts the makeup gain inside the noise path and nowhere near the tone path', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe({ wave: 'square', freqStart: 640, freqEnd: 880, duration: 0.06, gain: 0.2, noise: false }, 'tone');

    // A tone reaches the envelope at full scale already; a makeup node here
    // would make gain mean something different again.
    expect(made.gains).toHaveLength(4); // master, sfx, music, envelope
  });

  it('derives the makeup from the filter Q it actually sets on the bandpass', () => {
    // Rejects a makeup computed for one Q while the filter is built with
    // another - the two would drift apart silently and only be audible.
    const { made, audio } = readyAudio();

    audio.playRecipe({ wave: 'sawtooth', freqStart: 520, freqEnd: 320, duration: 0.2, gain: 0.5, noise: true }, 'n');

    expect(made.filters[0].Q.value).toBe(NOISE_BANDPASS_Q);
    // ...and that Q is the one this file's independent model assumes, so the
    // agreement measured above is agreement about the real filter.
    expect(NOISE_BANDPASS_Q).toBe(ASSUMED_Q);
  });

  it('never attenuates: a band wider than the spectrum needs no makeup', () => {
    // Guards the clamp. Above roughly a fifth of the sample rate the
    // closed-form bandwidth exceeds Nyquist, and an unclamped formula would
    // return a makeup below 1 and start quietening sounds it should leave be.
    expect(noiseMakeupGain(19000, 19000, 44100)).toBe(1);
    expect(noiseMakeupGain(200, 200, 44100)).toBeGreaterThan(1);
  });

  it('needs more makeup for a narrow low band than a wide high one', () => {
    // The whole point of deriving it per recipe rather than using one
    // constant: the loss depends on where the band sits.
    expect(noiseMakeupGain(300, 300, 44100)).toBeGreaterThan(noiseMakeupGain(3000, 3000, 44100));
  });
});

describe('AudioManager when the AudioContext cannot be constructed', () => {
  // Simulates Tor Browser, dom.webaudio.enabled=false, fingerprint-blocking
  // extensions, or any other environment where `new AudioContext()` throws.
  // init() must never throw, and every other method must degrade to a
  // silent no-op instead of crashing the caller (GameProvider's render body).
  function createThrowingAudioManager() {
    return new AudioManager(() => {
      throw new Error('AudioContext construction blocked');
    });
  }

  it('init() does not throw and leaves ctx null', () => {
    const audio = createThrowingAudioManager();
    expect(() => audio.init()).not.toThrow();
    expect(audio.ctx).toBeNull();
  });

  it('setVolumes() does not throw with no context', () => {
    const audio = createThrowingAudioManager();
    expect(() => audio.setVolumes({ masterVolume: 50, musicVolume: 50, soundEffects: 50 })).not.toThrow();
  });

  it('resume() does not throw and still returns a Promise', () => {
    const audio = createThrowingAudioManager();
    let result;
    expect(() => { result = audio.resume(); }).not.toThrow();
    expect(result).toBeInstanceOf(Promise);
  });

  it('playSfx() does not throw with no context', () => {
    const audio = createThrowingAudioManager();
    expect(() => audio.playSfx('enemyHit')).not.toThrow();
  });

  it('musicBus getter does not throw and returns null', () => {
    const audio = createThrowingAudioManager();
    expect(() => audio.musicBus).not.toThrow();
    expect(audio.musicBus).toBeNull();
  });

  it('all of the above still hold true after calling init() explicitly first', () => {
    const audio = createThrowingAudioManager();
    audio.init();
    expect(() => audio.setVolumes({ masterVolume: 50, musicVolume: 50, soundEffects: 50 })).not.toThrow();
    expect(() => audio.resume()).not.toThrow();
    expect(() => audio.playSfx('enemyHit')).not.toThrow();
    expect(audio.musicBus).toBeNull();
  });
});

describe('volumeToGain', () => {
  it('converts valid 0–100 slider values to squared gain', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(50)).toBeCloseTo(0.25);
  });

  it('handles undefined by returning 0', () => {
    expect(volumeToGain(undefined)).toBe(0);
  });

  it('handles NaN by returning 0', () => {
    expect(volumeToGain(NaN)).toBe(0);
  });

  it('handles null by returning 0', () => {
    expect(volumeToGain(null)).toBe(0);
  });

  it('handles non-numeric string by returning 0', () => {
    expect(volumeToGain('foo')).toBe(0);
  });
});

describe('voice limiting', () => {
  const RECIPE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('exposes the configured window and cap', () => {
    expect(DEDUPE_WINDOW_SECONDS).toBe(0.04);
    expect(MAX_VOICES).toBe(12);
  });

  it('plays a recipe object directly', () => {
    const { ctx, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'Sniper:fire');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('collapses the same key repeated inside the window', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'BasicEnemy:death');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('plays the same key again once the window has passed', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    ctx.currentTime += 0.05;
    audio.playRecipe(RECIPE, 'BasicEnemy:death');

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('does not collapse DIFFERENT keys in the same frame', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'TitanEnemy:death');
    audio.playRecipe(RECIPE, 'Sniper:fire');

    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('stops the oldest voice when the cap is exceeded', () => {
    const { made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }
    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);

    audio.playRecipe(RECIPE, 'overflow:death');

    // The oldest voice is stopped a second time, early.
    expect(made.oscillators[0].stop.mock.calls.length).toBe(2);
  });

  it('leaves voices untouched at exactly the cap', () => {
    const { made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }

    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);
  });

  it('forgets voices that have already finished', () => {
    const { ctx, made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }
    // Advance past the recipe duration so every voice has ended naturally.
    // The cap should then have room again without stopping anything early.
    ctx.currentTime += 1;
    audio.playRecipe(RECIPE, 'later:death');

    expect(made.oscillators[0].stop.mock.calls.length).toBe(1);
  });

  it('still plays shared sounds through playSfx', () => {
    const { ctx, audio } = readyAudio();
    audio.playSfx('enemyHit');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('dedupes playSfx by its sound id', () => {
    const { ctx, audio } = readyAudio();
    audio.playSfx('enemyHit');
    audio.playSfx('enemyHit');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('ignores an unknown sound id without throwing', () => {
    const { audio } = readyAudio();
    expect(() => audio.playSfx('nope')).not.toThrow();
  });
});

describe('samples', () => {
  const FIRE = { playbackRate: 1, gainScale: 1, durationScale: 1 };
  const DEATH = { playbackRate: 0.75, gainScale: 1, durationScale: 1 };
  const HIT = { playbackRate: 1, gainScale: 0.55, durationScale: 0.35 };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  function stubFetchOk() {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no samples before loading', () => {
    const { audio } = readyAudio();
    expect(audio.hasSample('Mortar')).toBe(false);
  });

  it('loads and caches a sample', async () => {
    stubFetchOk();
    const { audio } = readyAudio();

    await audio.loadSamples({ Mortar: '/assets/Mortar.ogg' });

    expect(audio.hasSample('Mortar')).toBe(true);
    expect(audio.hasSample('Sniper')).toBe(false);
  });

  it('isolates a failed fetch so other samples still load', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (
      String(url).includes('Broken')
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    )));
    const { audio } = readyAudio();

    await audio.loadSamples({ Broken: '/a/Broken.ogg', Mortar: '/a/Mortar.ogg' });

    expect(audio.hasSample('Broken')).toBe(false);
    expect(audio.hasSample('Mortar')).toBe(true);
  });

  it('isolates a failed decode the same way', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    ctx.decodeAudioData = vi.fn((_buf) => Promise.reject(new Error('bad audio')));

    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    expect(audio.hasSample('Mortar')).toBe(false);
  });

  it('does not throw when loading with no context', async () => {
    const audio = new AudioManager(() => { throw new Error('no web audio'); });
    audio.init();
    await expect(audio.loadSamples({ Mortar: '/a/Mortar.ogg' })).resolves.toBeUndefined();
  });

  it('plays a loaded sample through the sfx bus', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
    const src = made.buffers.at(-1);
    expect(src.start).toHaveBeenCalled();
    expect(src.stop).toHaveBeenCalled();
    // envelope is the most recently created gain, and must reach the sfx bus
    expect(made.gains.at(-1).connect).toHaveBeenCalledWith(made.gains[1]);
  });

  it('applies the variant playbackRate', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', DEATH, 'Mortar:death');

    expect(made.buffers.at(-1).playbackRate.value).toBeCloseTo(0.75);
  });

  it('lengthens death rather than cutting it off early', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', DEATH, 'Mortar:death');

    // buffer 0.4s at rate 0.75 lasts 0.5333s, so stop must be later than 0.4
    const stopAt = made.buffers.at(-1).stop.mock.calls[0][0];
    expect(stopAt).toBeGreaterThan(ctx.currentTime + 0.4);
  });

  it('truncates hit', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', HIT, 'Mortar:hit');

    const stopAt = made.buffers.at(-1).stop.mock.calls[0][0];
    expect(stopAt).toBeCloseTo(ctx.currentTime + 0.4 * 0.35);
  });

  it('clamps a long sample duration to MAX_DURATION so it cannot hog a voice slot', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    ctx.decodeAudioData = vi.fn(() => Promise.resolve({ duration: 4 }));
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    // 4s buffer / 0.75 playback rate would be 5.33s uncapped - well over MAX_DURATION.
    audio.playSample('Mortar', DEATH, 'Mortar:death');

    const stopAt = made.buffers.at(-1).stop.mock.calls[0][0];
    expect(stopAt).toBeCloseTo(ctx.currentTime + MAX_DURATION);
  });

  it('holds a fire sample flat well into the second half of playback', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' }); // buffer.duration is 0.4s

    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    const envelope = made.gains.at(-1);
    const peakGain = 0.7 * FIRE.gainScale;
    const halfway = ctx.currentTime + 0.4 / 2;

    // A second setValueAtTime call re-pins the peak gain at the start of the
    // release tail. It must land after the halfway point of the buffer,
    // proving the level was held flat rather than decaying across the whole
    // sample the way the synth envelope does.
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledTimes(2);
    const [heldValue, heldAt] = envelope.gain.setValueAtTime.mock.calls[1];
    expect(heldValue).toBeCloseTo(peakGain);
    expect(heldAt).toBeGreaterThan(halfway);
  });

  it('does not hold a hit sample - its ramp spans the whole truncated duration', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', HIT, 'Mortar:hit');

    const envelope = made.gains.at(-1);
    // Only the initial peak is pinned - no second "hold" event - so the
    // exponential ramp decays across the entire (already truncated) buffer.
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledTimes(1);
    expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(1);
  });

  it('ignores an unloaded sample without throwing', () => {
    const { ctx, audio } = readyAudio();
    expect(() => audio.playSample('NoSuch', FIRE, 'NoSuch:fire')).not.toThrow();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('applies the dedupe window to samples', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', FIRE, 'Mortar:fire');
    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
  });

  it('counts samples against the voice cap', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    for (let i = 0; i < MAX_VOICES + 1; i++) {
      audio.playSample('Mortar', FIRE, `key${i}`);
    }

    expect(made.buffers[0].stop.mock.calls.length).toBe(2);
  });
});

describe('playRecipe and playSample sharing state', () => {
  const RECIPE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };
  const FIRE = { playbackRate: 1, gainScale: 1, durationScale: 1 };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  function stubFetchOk() {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws synthesized and sampled voices from the same 12-voice budget', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    // Fill the shared cap, alternating recipe and sample voices.
    for (let i = 0; i < MAX_VOICES; i++) {
      if (i % 2 === 0) {
        audio.playRecipe(RECIPE, `recipe${i}:death`);
      } else {
        audio.playSample('Mortar', FIRE, `sample${i}:fire`);
      }
    }
    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);
    expect(made.buffers.every((src) => src.stop.mock.calls.length === 1)).toBe(true);

    // One more voice - a sample this time - must evict the oldest voice
    // (the very first, a recipe/oscillator voice) early, proving both call
    // types draw from the one shared budget rather than separate caps.
    audio.playSample('Mortar', FIRE, 'overflow:fire');

    expect(made.oscillators[0].stop.mock.calls.length).toBe(2);
  });

  it('plays a synthesized and a sampled sound with different keys in the same frame', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playRecipe(RECIPE, 'Sniper:fire');
    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
  });

  it('dedupes across call types when the same key is reused inside the window', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playRecipe(RECIPE, 'shared:key');
    // Same dedupe key, now via playSample: the shared lastPlayedAt map must
    // block this even though the call type differs.
    audio.playSample('Mortar', FIRE, 'shared:key');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });
});

/**
 * Amplitude modulation: a layer's GAIN oscillating a few times a second reads
 * as low-frequency rumble even when its spectral energy sits well above the
 * 200Hz laptop-speaker floor (see UnitVoices.js's header and the quake-impact
 * rebuild). AudioManager has no LFO node - every envelope before this was
 * exactly one setValueAtTime plus one exponentialRampToValueAtTime - so this
 * is the repeated ramp pattern that expresses modulation with the two
 * primitives already in use, rather than a new kind of node.
 */
describe('amplitude-modulated layers (rumble)', () => {
  const MODULATED = {
    wave: 'sawtooth', freqStart: 300, freqEnd: 260, duration: 0.4, gain: 0.5, noise: true,
    modulationHz: 5, modulationDepth: 0.6,
  };
  const STATIC = { wave: 'sawtooth', freqStart: 300, freqEnd: 260, duration: 0.4, gain: 0.5, noise: true };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('schedules more than one ramp for a modulated layer, not the single decay a static layer gets', () => {
    // Rejects: an implementation that ignores modulationHz and falls through
    // to the ordinary single-decay envelope - a static layer faking the
    // effect rather than actually varying its gain.
    const { made, audio } = readyAudio();
    audio.playRecipe(MODULATED, 'quake-impact:rumble');

    const envelope = made.gains[3];
    expect(envelope.gain.exponentialRampToValueAtTime.mock.calls.length).toBeGreaterThan(2);
  });

  it('alternates the ramp target between a peak and a quieter trough, not a monotonic decay', () => {
    // Rejects: an implementation that schedules several ramps but always
    // toward a lower value (i.e. a staircase decay), which would not read as
    // oscillation at all.
    const { made, audio } = readyAudio();
    audio.playRecipe(MODULATED, 'quake-impact:rumble');

    const envelope = made.gains[3];
    const values = envelope.gain.exponentialRampToValueAtTime.mock.calls.map(([value]) => value);
    const body = values.slice(0, -1); // exclude the final fade-to-floor call
    expect(body.length).toBeGreaterThan(1);
    for (let i = 1; i < body.length; i++) {
      expect(Math.abs(body[i] - body[i - 1])).toBeGreaterThan(0.05);
    }
  });

  it('spaces the ramps at half the modulation period, so the rate is the authored one', () => {
    // Rejects: modulation scheduled at an arbitrary or hard-coded rate rather
    // than the layer's own modulationHz.
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 2;
    audio.playRecipe(MODULATED, 'quake-impact:rumble');

    const envelope = made.gains[3];
    const times = envelope.gain.exponentialRampToValueAtTime.mock.calls.map(([, t]) => t);
    const halfPeriod = 1 / (2 * MODULATED.modulationHz);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeCloseTo(halfPeriod, 5);
    }
  });

  it('still ends faded to the floor exactly at the layer\'s scheduled end', () => {
    // Rejects: modulation that never closes out, leaving the source stopped
    // mid-cycle at a non-trivial gain (an audible click).
    const { ctx, made, audio } = readyAudio();
    ctx.currentTime = 0;
    audio.playRecipe(MODULATED, 'quake-impact:rumble');

    const envelope = made.gains[3];
    const last = envelope.gain.exponentialRampToValueAtTime.mock.calls.at(-1);
    expect(last[0]).toBeCloseTo(0.0001, 4);
    expect(last[1]).toBeCloseTo(MODULATED.duration, 5);
  });

  it('leaves a layer with no modulationHz decaying exactly once, unaffected by the new path', () => {
    // Guards the default: modulation must be opt-in per layer, or every
    // existing recipe's envelope shape would silently change.
    const { made, audio } = readyAudio();
    audio.playRecipe(STATIC, 'static-layer');

    const envelope = made.gains[3];
    expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(1);
    expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, STATIC.duration);
  });

  it('still sets the initial peak the same way a static layer does', () => {
    // The renderedLevel tolerance suite in the file above reads the FIRST
    // setValueAtTime call as the peak; modulation must not change that call.
    const { made, audio } = readyAudio();
    audio.playRecipe(MODULATED, 'quake-impact:rumble', 0.8);

    const envelope = made.gains[3];
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(MODULATED.gain * 0.8, expect.any(Number));
  });
});

describe('mix gain', () => {
  const RECIPE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  function stubFetchOk() {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })));
  }

  // Unstubbing here rather than at the end of the one test that stubs: an
  // assertion failing before the inline cleanup would leak the stub into every
  // later test in the run. Same pattern as the 'samples' and 'playRecipe and
  // playSample sharing state' blocks above.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to full level when no multiplier is given', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a');
    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
  });

  it('scales the envelope by the multiplier', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a', 0.4);
    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(0.2, expect.any(Number));
  });

  it('a quiet sound ends up quieter than a loud one', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'quiet', 0.4);
    const quiet = made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0];

    audio.playRecipe(RECIPE, 'loud', 1.0);
    const loud = made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0];

    expect(quiet).toBeLessThan(loud);
  });

  it('never produces a zero or negative gain, which would break the ramp', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a', 0);
    expect(made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('applies the same zero-gain floor to a sample', async () => {
    // playSample has its own Math.max(0.0001, ...) and had no test, while
    // playRecipe's identical clamp is covered above. Unreachable today - the
    // lowest MIX_TIERS value is 0.4 - but exponentialRampToValueAtTime throws
    // on a zero start value, so the day a tier or a variant reaches 0 the two
    // paths must fail the same way, not one silently.
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ mortar: '/a/mortar.ogg' });

    audio.playSample('mortar', { playbackRate: 1, gainScale: 1, durationScale: 1 }, 'a', 0);

    expect(made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  });

  // playRecipe's tests above don't exercise playSample, which Step 3 also
  // scales by mixGain. Without this, a playSample that dropped its `*
  // mixGain` factor would pass the whole suite undetected.
  it('scales a sample envelope by the multiplier the same way as a recipe', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', { playbackRate: 1, gainScale: 1, durationScale: 1 }, 'a', 0.4);

    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(0.7 * 0.4, expect.any(Number));
  });

  // The mix tiers reach the eight game-event sounds ONLY through playSfx, and
  // this is the single line that joins the two layers. FeedbackManager's tests
  // assert playSfx was called with the multiplier, against a mocked audio
  // manager; the tests above call playRecipe directly. Neither can see the
  // forward, so dropping `mixGain` from playSfx's call left the whole suite
  // green while base damage, win and lose - the loudest moments in the game -
  // silently flattened to one level, which is criterion 5.
  it('forwards its multiplier to the recipe it plays', () => {
    const { made, audio } = readyAudio();

    audio.playSfx('baseDamaged', 0.4);

    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(
      SFX.baseDamaged.gain * 0.4, expect.any(Number),
    );
  });

  it('plays a game-event sound at full level when no multiplier is given', () => {
    // Guards the default, so the forward above cannot be "fixed" by hardcoding.
    const { made, audio } = readyAudio();

    audio.playSfx('baseDamaged');

    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(
      SFX.baseDamaged.gain, expect.any(Number),
    );
  });
});
