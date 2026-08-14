/**
 * Minimal publish/subscribe bus decoupling GameEngine from feedback.
 * The engine emits semantic events; audio and juice subscribe to them.
 */
export class FeedbackBus {
  constructor() {
    this.handlers = new Map();
  }

  /** Subscribes to an event. Returns an unsubscribe function. */
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  }

  /**
   * Publishes an event. Iterates a copy so a handler may unsubscribe during
   * dispatch, and isolates throwing handlers so one bad subscriber cannot
   * stop feedback for the rest or break the game loop.
   */
  emit(event, payload) {
    const subscribers = this.handlers.get(event);
    if (!subscribers) return;
    for (const fn of [...subscribers]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`FeedbackBus handler for "${event}" threw:`, err);
      }
    }
  }
}
