/*
 * What the Card Upgrades screen says a defender is.
 *
 * A saved card carries id, name, level, pieces and costs - and nothing about
 * what the unit DOES. Damage, health and range come from the defender class,
 * which is what calculateCardStats exists to look up. This screen handed the
 * saved card straight to Card, and Card falls back to `card.damage || 0`, so
 * every defender's icon read 0 attack and 0 health while the panel underneath
 * it - which does go through the class - showed the real numbers.
 *
 * The second half is the ceiling: a level-5 card is maxed, and the screen was
 * still previewing a level 6 that cannot exist, complete with a price.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import UpgradeModal from '../UpgradeModal.jsx';
import { MAX_DEFENDER_LEVEL } from '../../../GameLogic (MVC)/DefenderClassUtils.js';

let mockCards;

/* Exactly the shape fetchPlayerData builds: no damage, no health, no range. */
function savedCard(level) {
  return {
    id: 'shooter',
    name: 'Shooter',
    level,
    pieces: 3,
    piecesNeeded: 10,
    cost: 20,
    upgradeCost: { gold: 100 },
  };
}

vi.mock('../../../GameLogic (MVC)/GameContext.jsx', () => ({
  useGame: () => ({
    playerData: { cards: mockCards, resources: { gold: 9999 } },
    startCardUpgrade: vi.fn(),
    closeUpgradeModal: vi.fn(),
  }),
}));

/** The stat row inside the card icon, which is where the zeros appeared. */
function iconStats() {
  const icon = document.querySelector('.card-container');
  return [...icon.querySelectorAll('.stat-value')].map((n) => n.textContent);
}

beforeEach(() => {
  mockCards = [savedCard(1)];
});

describe('the card icon on the upgrade screen', () => {
  it('shows the defender\'s real attack and health, not zeros', () => {
    render(<UpgradeModal />);

    const stats = iconStats();
    expect(stats.length, 'no stat values rendered at all').toBeGreaterThan(0);
    expect(stats, 'a saved card carries no damage or health of its own').not.toContain('0');
  });

  it('shows numbers that grow with the level', () => {
    mockCards = [savedCard(1)];
    const { unmount } = render(<UpgradeModal />);
    const atOne = iconStats().map(Number);
    unmount();

    mockCards = [savedCard(MAX_DEFENDER_LEVEL)];
    render(<UpgradeModal />);
    const atMax = iconStats().map(Number);

    expect(Math.max(...atMax), `level 1 ${atOne}, level ${MAX_DEFENDER_LEVEL} ${atMax}`)
      .toBeGreaterThan(Math.max(...atOne));
  });
});

describe('a defender that is already at the ceiling', () => {
  beforeEach(() => {
    mockCards = [savedCard(MAX_DEFENDER_LEVEL)];
  });

  it('says so', () => {
    render(<UpgradeModal />);

    expect(screen.getByText(new RegExp(`Level ${MAX_DEFENDER_LEVEL} - maxed`))).toBeTruthy();
  });

  it('previews no upgrade, because there is none to have', () => {
    const { container } = render(<UpgradeModal />);

    expect(
      container.querySelector('.stat-improvements'),
      `a level ${MAX_DEFENDER_LEVEL + 1} does not exist`,
    ).toBeNull();
  });

  it('asks for no resources, because nothing is for sale', () => {
    const { container } = render(<UpgradeModal />);

    expect(container.querySelector('.resource-requirements')).toBeNull();
    expect(container.querySelector('.card-pieces-requirement')).toBeNull();
  });
});

describe('a defender below the ceiling', () => {
  it('still previews its next level and its price', () => {
    mockCards = [savedCard(1)];

    const { container } = render(<UpgradeModal />);

    expect(screen.getByText(/Upgrade to Level 2/)).toBeTruthy();
    expect(container.querySelector('.stat-improvements'), 'the preview is the point').toBeTruthy();
    expect(container.querySelector('.resource-requirements')).toBeTruthy();
    expect(within(container).getByText(/Card Pieces:/)).toBeTruthy();
  });
});
