/* Being told in-game that a level will not start, on the screen you are on. */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Lobby from '../Lobby.jsx';
import { sourceFiles, relativeToSrc, read, stripComments } from '../../../test/sourceFiles.js';

let mockPlayerData;
let mockGateNotice;

vi.mock('../../GameLogic (MVC)/GameContext', async (importOriginal) => ({
  ...(await importOriginal()),

  useGame: () => ({
    gameState: 'lobby',
    playerData: mockPlayerData,
    gateNotice: mockGateNotice,
    setGateNotice: vi.fn(),
    buyEnergy: vi.fn(),
    startLevel: vi.fn(),
    openUpgradeModal: vi.fn(),
    openAchievements: vi.fn(),
    openCollection: vi.fn(),
    openSettings: vi.fn(),
    handleLogout: vi.fn(),
    collectTreasure: vi.fn(),
    chestReward: null,
    setChestReward: vi.fn(),
  }),
}));

/** A save far enough along to stand in the lobby and press a level. */
function playerAtLevelTwo() {
  return {
    id: 1,
    name: 'Commander',
    rank: 'Recruit',
    resources: {
      gold: 400, iron: 50, grain: 50, water: 50, gem: 5,
      lobbyEnergy: 2, maxLobbyEnergy: 100,
      energyRechargeRate: 1, lastEnergyRechargeTime: Date.now(),
    },
    cards: [{ id: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
    unlockedLevels: [1, 2],
    completedLevels: [1],
    levelStars: Array(20).fill(0),
    collectedTreasures: [],
    revealedSecrets: [],
  };
}

beforeEach(() => {
  mockPlayerData = playerAtLevelTwo();
  mockGateNotice = null;
});

describe('the notice reaches the screen the player is on', () => {
  /*
   * A gate is only ever raised from startLevel, which returns early without
   * player data - so the ONE state it has to render in is the lobby with a
   * loaded save. It first shipped mounted in the loading branch instead, where
   * it was unreachable: state set, nothing drawn, and the whole suite still
   * green because nothing rendered the lobby with a gate up.
   */
  it('shows an energy gate in the loaded lobby', () => {
    mockGateNotice = { kind: 'energy', levelId: 2, needed: 8, have: 2, selectedCards: [] };
    render(<Lobby />);

    expect(screen.getByText(/not enough energy/i)).toBeTruthy();
  });

  it('shows a locked gate in the loaded lobby', () => {
    mockGateNotice = { kind: 'locked', title: 'Endless Mode is locked', message: 'Finish Level 20.' };
    render(<Lobby />);

    expect(screen.getByText('Endless Mode is locked')).toBeTruthy();
  });

  it('draws nothing when no gate is up', () => {
    render(<Lobby />);

    expect(document.querySelector('.gate-notice')).toBeNull();
  });
});

describe('the game speaks in-game', () => {
  /* The complaint this replaced: "backend had a page popup". A browser dialog
     stops the page, is styled by the browser rather than the game, and offers
     nothing but OK - so no screen may raise one. */
  it('calls no browser dialog anywhere in the app', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
      if (/[^.\w]alert\s*\(|[^.\w](?:confirm|prompt)\s*\(/.test(stripComments(read(file)))) {
        offenders.push(relativeToSrc(file));
      }
    }

    expect(
      offenders.sort(),
      'show it in-game instead - see GateNotice.jsx',
    ).toEqual([]);
  });
});
