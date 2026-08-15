import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { AudioManager, volumeToGain, DEDUPE_WINDOW_SECONDS, MAX_VOICES } from '../AudioManager.js';
import { MAX_DURATION } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';

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
    // The buffer source feeds the filter, and the filter (not the raw
    // source) is what ultimately reaches the envelope -> sfx bus.
    expect(source.connect).toHaveBeenCalledWith(filter);
    expect(filter.connect).toHaveBeenCalledWith(envelope);
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
