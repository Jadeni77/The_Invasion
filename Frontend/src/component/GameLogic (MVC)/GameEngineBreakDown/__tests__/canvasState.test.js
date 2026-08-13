import { describe, it, expect } from 'vitest';
import { CardPieceDrop } from '../Drops/CardPieceDrop.js';
import { EnergyDrop } from '../Drops/EnergyDrop.js';

/**
 * A minimal fake 2D context that records the canvas state properties we care
 * about. Real canvas state is restored by save/restore; this fake mimics that
 * with a stack so we can assert a draw call is state-neutral.
 */
function createRecordingContext() {
  const state = {
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px sans-serif',
  };
  const stack = [];
  return {
    ...state,
    save() { stack.push({ ...this._snapshot() }); },
    restore() {
      const prev = stack.pop();
      if (prev) Object.assign(this, prev);
    },
    _snapshot() {
      return {
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        font: this.font,
      };
    },
    beginPath() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
    fillText() {}, strokeText() {}, moveTo() {}, lineTo() {},
    translate() {}, clearRect() {}, drawImage() {},
    createRadialGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 10 }; },
  };
}

describe('canvas state hygiene', () => {
  it('CardPieceDrop.draw does not leak textAlign', () => {
    const ctx = createRecordingContext();
    const before = ctx._snapshot();

    new CardPieceDrop(100, 100, 1).draw(ctx);

    expect(ctx._snapshot()).toEqual(before);
  });

  it('EnergyDrop.draw does not leak textAlign', () => {
    const ctx = createRecordingContext();
    const before = ctx._snapshot();

    new EnergyDrop(100, 100, 25).draw(ctx);

    expect(ctx._snapshot()).toEqual(before);
  });
});
