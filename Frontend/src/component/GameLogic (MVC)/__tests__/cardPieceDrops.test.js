/*
 * A card piece drops for a defender that can still use it.
 *
 * The drop picked any card in the deck, maxed or not. A maxed defender's pieces
 * are dead on arrival - the upgrade screen has nothing to spend them on - so a
 * player who had finished upgrading a Shooter still watched Shooter pieces fall
 * and still had to walk over them to find out they were worthless.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { MAX_DEFENDER_LEVEL } from '../DefenderClassUtils.js';

/** Enough of an engine to drop into. */
function engineWithDeck(cards) {
  const engine = Object.create(GameEngine.prototype);
  engine.gameOver = false;
  engine.cardPieceDrops = [];
  engine.playerSelectedCards = cards;
  return engine;
}

/** The card names dropped across `times` attempts. */
function dropNames(engine, times = 200) {
  for (let i = 0; i < times; i += 1) engine.dropCardPieces(100, 100);
  return engine.cardPieceDrops.map((drop) => drop.cardName);
}

const card = (name, level) => ({ name, level });

beforeEach(() => { vi.restoreAllMocks(); });

describe('choosing which defender a piece is for', () => {
  it('drops for a defender that can still be upgraded', () => {
    const engine = engineWithDeck([card('Shooter', 1)]);

    const names = dropNames(engine, 20);

    expect(names.length).toBe(20);
    expect(new Set(names)).toEqual(new Set(['Shooter']));
  });

  it('never drops for one that is already maxed', () => {
    const engine = engineWithDeck([
      card('Shooter', MAX_DEFENDER_LEVEL),
      card('Grenadier', 2),
    ]);

    const names = dropNames(engine);

    expect(names.length, 'the upgradable card should still drop').toBeGreaterThan(0);
    expect(names, 'a maxed defender has nothing to spend pieces on').not.toContain('Shooter');
  });

  it('still spreads across the defenders that are not maxed', () => {
    const engine = engineWithDeck([
      card('Shooter', MAX_DEFENDER_LEVEL),
      card('Grenadier', 1),
      card('Sniper', 3),
    ]);

    const names = new Set(dropNames(engine));

    expect(names).toEqual(new Set(['Grenadier', 'Sniper']));
  });

  /* Litter, otherwise: a pickup that means nothing wherever it lands. */
  it('drops nothing when every defender in the deck is finished', () => {
    const engine = engineWithDeck([
      card('Shooter', MAX_DEFENDER_LEVEL),
      card('Grenadier', MAX_DEFENDER_LEVEL),
    ]);

    expect(dropNames(engine)).toEqual([]);
  });

  it('treats a card with no level as upgradable rather than dropping nothing', () => {
    // Saved cards have always carried a level, but a missing one must not
    // silently switch the drop off for that defender.
    const engine = engineWithDeck([{ name: 'Shooter' }]);

    expect(dropNames(engine, 5).length).toBe(5);
  });

  it('ignores an entry with no name at all', () => {
    const engine = engineWithDeck([{ level: 1 }, card('Sniper', 1)]);

    const names = new Set(dropNames(engine, 50));

    expect(names).toEqual(new Set(['Sniper']));
  });

  it('drops nothing once the level is over', () => {
    const engine = engineWithDeck([card('Shooter', 1)]);
    engine.gameOver = true;

    expect(dropNames(engine, 10)).toEqual([]);
  });
});
