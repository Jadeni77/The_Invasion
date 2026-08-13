/** Hit-stop is capped so it can never noticeably desynchronise the game clock. */
export const MAX_HIT_STOP_MS = 80;
export const MAX_SHAKE_PIXELS = 12;

const TRAUMA_DECAY_PER_SECOND = 1.5;
const DAMAGE_NUMBER_LIFETIME_MS = 700;
const DAMAGE_NUMBER_RISE_PIXELS = 40;

/**
 * Owns all non-audio feedback: screen shake, hit-stop, damage numbers, flash.
 *
 * Shake uses a trauma model - displacement is proportional to trauma squared.
 * Squaring keeps small hits subtle and makes large ones violent; linear shake
 * reads as uniform mush.
 */
export class JuiceManager {
  constructor() {
    this.trauma = 0;
    this.hitStopRemainingMs = 0;
    this._damageNumbers = [];
    this.flash = null;
    this.shakeEnabled = true;
    this.damageNumbersEnabled = true;
  }

  setEnabled({ screenShake, showDamageNumbers } = {}) {
    if (screenShake !== undefined) this.shakeEnabled = screenShake;
    if (showDamageNumbers !== undefined) this.damageNumbersEnabled = showDamageNumbers;
  }

  /**
   * Clears all transient feedback state. Without this, state persists across
   * levels: a loss always lands a frame after base:damaged, so trauma and the
   * red flash are frozen mid-decay when the loop stops, then replay over the
   * first ~700ms of the next level along with stale damage numbers positioned
   * at the previous level's coordinates.
   */
  reset() {
    this.trauma = 0;
    this.hitStopRemainingMs = 0;
    this._damageNumbers = [];
    this.flash = null;
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  getShakeOffset() {
    if (!this.shakeEnabled || this.trauma <= 0) return { x: 0, y: 0 };
    const magnitude = this.trauma ** 2 * MAX_SHAKE_PIXELS;
    return {
      x: (Math.random() * 2 - 1) * magnitude,
      y: (Math.random() * 2 - 1) * magnitude,
    };
  }

  triggerHitStop(ms) {
    this.hitStopRemainingMs = Math.min(MAX_HIT_STOP_MS, ms);
  }

  isFrozen() {
    return this.hitStopRemainingMs > 0;
  }

  addDamageNumber(x, y, damage) {
    if (!this.damageNumbersEnabled) return;
    this._damageNumbers.push({
      x, y, damage, alpha: 1, ageMs: 0, originY: y,
    });
  }

  get damageNumbers() {
    return this._damageNumbers;
  }

  triggerFlash(color, durationMs) {
    this.flash = { color, alpha: 1, ageMs: 0, durationMs };
  }

  getFlash() {
    return this.flash;
  }

  update(deltaMs) {
    const deltaSeconds = deltaMs / 1000;

    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY_PER_SECOND * deltaSeconds);
    this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - deltaMs);

    for (const number of this._damageNumbers) {
      number.ageMs += deltaMs;
      const progress = Math.min(1, number.ageMs / DAMAGE_NUMBER_LIFETIME_MS);
      number.y = number.originY - DAMAGE_NUMBER_RISE_PIXELS * progress;
      number.alpha = 1 - progress;
    }
    this._damageNumbers = this._damageNumbers.filter(
      (n) => n.ageMs < DAMAGE_NUMBER_LIFETIME_MS
    );

    if (this.flash) {
      this.flash.ageMs += deltaMs;
      const progress = Math.min(1, this.flash.ageMs / this.flash.durationMs);
      this.flash.alpha = 1 - progress;
      if (progress >= 1) this.flash = null;
    }
  }
}
