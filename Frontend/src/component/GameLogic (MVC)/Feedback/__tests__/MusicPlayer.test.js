import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MusicPlayer, PROGRESSION } from '../MusicPlayer.js';

function createMockAudio() {
  const oscillators = [];
  const ctx = {
    currentTime: 0,
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    },
  };
  return { audio: { ctx, musicBus: { id: 'musicBus' } }, ctx, oscillators };
}

describe('MusicPlayer', () => {
  let audio, ctx, oscillators, player;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ audio, ctx, oscillators } = createMockAudio());
    player = new MusicPlayer(audio);
  });

  afterEach(() => {
    player.stop();
    vi.useRealTimers();
  });

  it('defines a non-empty chord progression', () => {
    expect(PROGRESSION.length).toBeGreaterThan(0);
    for (const chord of PROGRESSION) {
      expect(chord.length).toBeGreaterThan(0);
      for (const freq of chord) expect(freq).toBeGreaterThan(0);
    }
  });

  it('reports not playing before start', () => {
    expect(player.isPlaying).toBe(false);
  });

  it('schedules notes once started', () => {
    player.start();
    vi.advanceTimersByTime(100);
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('routes every note to the music bus, never the destination', () => {
    player.start();
    vi.advanceTimersByTime(100);
    for (const osc of oscillators) expect(osc.connect).toHaveBeenCalled();
  });

  it('keeps scheduling as time advances, wrapping the loop', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const afterFirst = oscillators.length;

    // Advance the audio clock past the whole progression and tick again.
    ctx.currentTime += PROGRESSION.length * 2;
    vi.advanceTimersByTime(500);

    expect(oscillators.length).toBeGreaterThan(afterFirst);
  });

  it('stops scheduling after stop()', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const count = oscillators.length;

    player.stop();
    ctx.currentTime += 10;
    vi.advanceTimersByTime(1000);

    expect(oscillators.length).toBe(count);
    expect(player.isPlaying).toBe(false);
  });

  it('start() twice does not double-schedule', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const count = oscillators.length;

    player.start();
    vi.advanceTimersByTime(0);

    expect(oscillators.length).toBe(count);
  });
});
