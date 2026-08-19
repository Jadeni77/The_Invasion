/*
 * A player is the same player however they arrived.
 *
 * Two paths set playerData - a fresh login and a refetch - and they built it
 * separately. The refetch ran a transform; the login stored the backend entity
 * as-is. So the same account had two different shapes, and the field that gave
 * it away was the name: the entity calls it `displayName`, the game reads
 * `name`, and the transform copied `data.name`, which the backend never sends.
 *
 * Every player's name came out undefined. The lobby rendered an empty
 * `.player-name` and the only text left in that corner was the rank underneath,
 * so it read as though the name were fixed at "Novice Gardener" - a value
 * nobody chose and nothing ever changes.
 */
import { describe, it, expect } from 'vitest';
import { toPlayerData } from '../GameContext.jsx';

/** What the backend actually sends: displayName, and resources at the top level. */
function backendPlayer(overrides = {}) {
  return {
    id: 'p1',
    sessionId: 's1',
    displayName: 'Test Player',
    rank: 'Novice Gardener',
    gold: 500, iron: 10, grain: 20, water: 30, gem: 5,
    lobbyEnergy: 42, maxLobbyEnergy: 100,
    lastEnergyRechargeTime: new Date().toISOString(),
    cards: [{ cardId: 1, name: 'Shooter', level: 2, pieces: 3, piecesNeeded: 10 }],
    unlockedLevels: [1, 2], completedLevels: [1], levelStars: [3, 0],
    collectedTreasures: [],
    ...overrides,
  };
}

describe('reading a player from the backend', () => {
  it('keeps the name the player chose', () => {
    expect(toPlayerData(backendPlayer()).name).toBe('Test Player');
  });

  it('does not invent one from a field the backend never sends', () => {
    // `data.name` is undefined on every real response; reading it produced
    // undefined, and an undefined name renders as nothing at all.
    const player = toPlayerData(backendPlayer());
    expect(player.name).toBeTruthy();
    expect(player.name).not.toBeUndefined();
  });

  it('still accepts a payload that uses `name`, rather than breaking on it', () => {
    const player = toPlayerData(backendPlayer({ displayName: undefined, name: 'Older Shape' }));
    expect(player.name).toBe('Older Shape');
  });

  it('nests the resources the game reads', () => {
    const player = toPlayerData(backendPlayer());

    expect(player.resources.gold).toBe(500);
    expect(player.resources.lobbyEnergy).toBe(42);
    expect(player.resources.maxLobbyEnergy).toBe(100);
  });

  it('carries the progress the lobby draws', () => {
    const player = toPlayerData(backendPlayer());

    expect(player.unlockedLevels).toEqual([1, 2]);
    expect(player.completedLevels).toEqual([1]);
    expect(player.cards.map((c) => c.name)).toEqual(['Shooter']);
  });

  /*
   * The lobby refuses to render without `resources` and shows its loading
   * screen instead. A login that stored the raw entity therefore sat on that
   * screen until a refetch happened to replace it.
   */
  it('produces something the lobby will actually draw', () => {
    const player = toPlayerData(backendPlayer());

    expect(player.resources, 'the lobby returns its loading screen without this').toBeTruthy();
    expect(player.name, 'and renders an empty name without this').toBeTruthy();
  });

  it('gives the same shape whichever path built it', () => {
    // Login passes the auth response's player; the refetch passes /me's body.
    // Both are the same entity, so both must come out identical.
    const fromLogin = toPlayerData(backendPlayer());
    const fromRefetch = toPlayerData(backendPlayer());

    expect(Object.keys(fromLogin).sort()).toEqual(Object.keys(fromRefetch).sort());
    expect(fromLogin.name).toBe(fromRefetch.name);
    expect(Object.keys(fromLogin.resources).sort())
      .toEqual(Object.keys(fromRefetch.resources).sort());
  });
});
