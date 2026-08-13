import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { FireBlast, IceBomb, BasicDefender } from '../DefenderUnits.js';

const CARD = { level: 1, image: null };

/**
 * markDefenderDead only touches defendersLost and emitFeedback, so it can be
 * exercised against a minimal stand-in rather than a constructed GameEngine.
 */
function createEngineStub() {
  return { defendersLost: 0, emitFeedback: vi.fn() };
}

function callMarkDefenderDead(engine, defender) {
  return GameEngine.prototype.markDefenderDead.call(engine, defender);
}

describe('markDefenderDead', () => {
  it('counts an ordinary defender as a casualty', () => {
    const engine = createEngineStub();
    const defender = new BasicDefender(0, 0, CARD);

    callMarkDefenderDead(engine, defender);

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'defender:died',
      expect.objectContaining({ x: defender.x, y: defender.y }),
    );
  });

  it('does not count a spent Fire Blast', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new FireBlast(0, 0, CARD));

    expect(engine.defendersLost).toBe(0);
    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('does not count a spent Ice Bomb', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new IceBomb(0, 0, CARD));

    expect(engine.defendersLost).toBe(0);
    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('still marks a spell as handled so it is not reprocessed each frame', () => {
    const engine = createEngineStub();
    const spell = new FireBlast(0, 0, CARD);

    callMarkDefenderDead(engine, spell);

    expect(spell.deathHandled).toBe(true);
  });

  it('counts an ordinary defender only once', () => {
    const engine = createEngineStub();
    const defender = new BasicDefender(0, 0, CARD);

    callMarkDefenderDead(engine, defender);
    callMarkDefenderDead(engine, defender);
    callMarkDefenderDead(engine, defender);

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledTimes(1);
  });

  it('counts each of several defenders separately', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new BasicDefender(0, 0, CARD));
    callMarkDefenderDead(engine, new BasicDefender(10, 10, CARD));

    expect(engine.defendersLost).toBe(2);
  });

  it('a mixed wave counts only the ordinary defenders', () => {
    const engine = createEngineStub();

    callMarkDefenderDead(engine, new FireBlast(0, 0, CARD));
    callMarkDefenderDead(engine, new BasicDefender(10, 10, CARD));
    callMarkDefenderDead(engine, new IceBomb(20, 20, CARD));

    expect(engine.defendersLost).toBe(1);
    expect(engine.emitFeedback).toHaveBeenCalledTimes(1);
  });
});
