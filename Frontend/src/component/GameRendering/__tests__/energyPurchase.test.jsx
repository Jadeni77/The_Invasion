/* Buying energy from the gate, and getting the level you were setting up. */
import React, { useCallback, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import GateNotice from '../GateNotice.jsx';
import { GameContext, ENERGY_PACK } from '../../GameLogic (MVC)/GameContext';

/*
 * The real provider, minus the network. It reproduces the one property that
 * decides this feature: startLevel is built from a render's snapshot of
 * playerData, so a caller that runs it before a purchase has landed re-reads
 * the OLD balance and gates the player again - charged, and still standing in
 * the lobby. Swap this for a plain spy and the test sails past that bug.
 */
function Harness({ needed, startingGold = 400, onStart }) {
  const [playerData, setPlayerData] = useState(() => ({
    resources: { gold: startingGold, lobbyEnergy: 0, maxLobbyEnergy: 100 },
  }));
  const [gateNotice, setGateNotice] = useState({
    kind: 'energy', levelId: 2, needed, have: 0, selectedCards: ['Shooter'],
  });

  const startLevel = useCallback((levelId, selectedCards) => {
    if (playerData.resources.lobbyEnergy < needed) {
      setGateNotice({
        kind: 'energy', levelId, needed, have: playerData.resources.lobbyEnergy, selectedCards,
      });
      return;
    }
    onStart(levelId, selectedCards);
  }, [playerData, needed, onStart]);

  const buyEnergy = useCallback(async () => {
    setPlayerData((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        gold: prev.resources.gold - ENERGY_PACK.gold,
        lobbyEnergy: prev.resources.lobbyEnergy + ENERGY_PACK.amount,
      },
    }));
    return true;
  }, []);

  return (
    <GameContext.Provider value={{ gateNotice, setGateNotice, playerData, buyEnergy, startLevel }}>
      <GateNotice />
    </GameContext.Provider>
  );
}

const buy = async () => act(async () => {
  fireEvent.click(screen.getByRole('button', { name: /buy and play/i }));
});

describe('buying energy at the gate', () => {
  /* Derived from the pack, never restated: the owner tunes both numbers, and a
     test that hardcodes them fails on a correct change. */
  const COVERED = ENERGY_PACK.amount;          // One pack is exactly enough.
  const NOT_COVERED = ENERGY_PACK.amount + 5;  // One pack still leaves them short.

  it('starts the level with the cards chosen before the gate appeared', async () => {
    const onStart = vi.fn();
    render(<Harness needed={COVERED} onStart={onStart} />);

    await buy();

    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart).toHaveBeenCalledWith(2, ['Shooter']);
  });

  it('closes rather than re-gating the player it just charged', async () => {
    render(<Harness needed={COVERED} onStart={vi.fn()} />);

    await buy();

    await waitFor(() => expect(document.querySelector('.gate-notice')).toBeNull());
  });

  it('keeps the panel up, and honest, when one pack does not cover the level', async () => {
    const onStart = vi.fn();
    render(<Harness needed={NOT_COVERED} onStart={onStart} />);

    await buy();

    await waitFor(() => {
      expect(document.querySelector('.gate-notice-message').textContent)
        .toContain(`you have ${ENERGY_PACK.amount}`);
    });
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /buy and play/i }).disabled).toBe(false);
  });

  it('offers no purchase the player cannot pay for', () => {
    render(<Harness needed={COVERED} startingGold={ENERGY_PACK.gold - 1} onStart={vi.fn()} />);

    expect(screen.getByRole('button', { name: /buy and play/i }).disabled).toBe(true);
  });

  it('leaves waiting on the table', () => {
    render(<Harness needed={COVERED} onStart={vi.fn()} />);

    expect(screen.getByText(/refills on its own/i)).toBeTruthy();
  });
});
