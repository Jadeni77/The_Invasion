import { describe, it, expect, vi } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';

describe('FeedbackBus', () => {
  it('delivers an emitted event to a subscriber with its payload', () => {
    const bus = new FeedbackBus();
    const heard = vi.fn();
    bus.on('enemy:died', heard);

    bus.emit('enemy:died', { x: 5, isBoss: true });

    expect(heard).toHaveBeenCalledWith({ x: 5, isBoss: true });
  });

  it('delivers to every subscriber of the same event', () => {
    const bus = new FeedbackBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('base:damaged', a);
    bus.on('base:damaged', b);

    bus.emit('base:damaged', { damage: 10 });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('does not deliver to subscribers of other events', () => {
    const bus = new FeedbackBus();
    const other = vi.fn();
    bus.on('wave:started', other);

    bus.emit('enemy:died', {});

    expect(other).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new FeedbackBus();
    const heard = vi.fn();
    bus.on('enemy:hit', heard)();

    bus.emit('enemy:hit', {});

    expect(heard).not.toHaveBeenCalled();
  });

  it('tolerates a subscriber unsubscribing during emit', () => {
    const bus = new FeedbackBus();
    const second = vi.fn();
    let unsubFirst;
    unsubFirst = bus.on('wave:started', () => unsubFirst());
    bus.on('wave:started', second);

    expect(() => bus.emit('wave:started', {})).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
  });

  it('emitting an event with no subscribers is a no-op', () => {
    const bus = new FeedbackBus();
    expect(() => bus.emit('nobody:listening', {})).not.toThrow();
  });

  it('isolates a throwing subscriber from the others', () => {
    const bus = new FeedbackBus();
    const good = vi.fn();
    bus.on('enemy:died', () => { throw new Error('boom'); });
    bus.on('enemy:died', good);

    expect(() => bus.emit('enemy:died', {})).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });
});
