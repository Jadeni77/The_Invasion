import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager, volumeToGain } from '../AudioManager.js';

function createMockContext() {
  const made = { gains: [], oscillators: [], buffers: [] };
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
      const src = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      made.buffers.push(src);
      return src;
    }),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(256) })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(),
    })),
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
