import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MusicPlayer, PROGRESSION } from '../MusicPlayer.js';

function createMockAudio() {
  const oscillators = [];
  const envelopeConnections = [];
  const musicBus = { id: 'musicBus' };
  const ctx = {
    currentTime: 0,
    createGain: () => {
      const connectFn = vi.fn((destination) => {
        envelopeConnections.push(destination);
      });
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: connectFn,
      };
    },
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
  return { audio: { ctx, musicBus }, ctx, oscillators, envelopeConnections, musicBus };
}

describe('MusicPlayer', () => {
  let audio, ctx, oscillators, envelopeConnections, musicBus, player;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ audio, ctx, oscillators, envelopeConnections, musicBus } = createMockAudio());
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
    expect(envelopeConnections.length).toBeGreaterThan(0);
    for (const destination of envelopeConnections) {
      expect(destination).toBe(musicBus);
    }
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

  it('does not burst-schedule missed chords when woken from suspension', () => {
    player.start();
    vi.advanceTimersByTime(100);

    // Jump the audio clock forward 30 seconds without advancing the timer.
    // This simulates a tab being backgrounded or the machine sleeping.
    ctx.currentTime += 30;

    const beforeJump = oscillators.length;

    // A single tick should not schedule the entire backlog but instead skip
    // to current time and only schedule what fits in the lookahead window.
    player.tick();

    const createdInTick = oscillators.length - beforeJump;

    // One chord = 3 frequencies; allow up to 2 chords as margin (6 oscillators).
    // Without the fix, this would be ~15 chords = 45 oscillators.
    expect(createdInTick).toBeLessThanOrEqual(6);
  });
});
