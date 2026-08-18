import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpgradeModal from '../UpgradeModal.jsx';

vi.mock('../../../GameLogic (MVC)/GameContext.jsx', () => ({
  useGame: () => ({
    playerData: {
      cards: [
        {
          id: 'shooter',
          name: 'Shooter',
          level: 1,
          pieces: 2,
          piecesNeeded: 5,
          upgradeCost: { gold: 100 },
        },
      ],
      resources: { gold: 50 },
    },
    startCardUpgrade: vi.fn(),
    closeUpgradeModal: vi.fn(),
  }),
}));

// getUpgradePreview looks up a real defender class by name to compute
// before/after stats; stubbing it out keeps this test about the modal's own
// markup rather than defender balance data, and matches the shape the
// component actually checks (`upgradePreview &&` before rendering the stat
// block at all).
/*
 * Partial mock via importOriginal, not a two-line replacement object.
 *
 * A mock that enumerates its exports silently removes every export it does not
 * name, so the moment the real module gained MAX_DEFENDER_LEVEL this file broke
 * with "No export is defined on the mock" - thrown mid-render, which surfaced as
 * a stray ")" in the output and looked like a JSX bug rather than a mock gap.
 * Only `getUpgradePreview` needs stubbing here; everything else should be real.
 */
vi.mock('../../../GameLogic (MVC)/DefenderClassUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getUpgradePreview: () => null,
}));

describe('UpgradeModal', () => {
  // Rejects a JSX tree that still carries the stray `)` left behind at
  // UpgradeModal.jsx:143 by a half-removed ternary (see git history:
  // 4d76ff4 deleted the `isUpgrading ? (<div className="upgrade-in-progress">
  // ...</div>) : (` branch and its opening paren, but kept the ternary's
  // trailing `)`, which JSX renders as a literal text node). A correct
  // implementation renders the card panel with no bare `)` anywhere in it.
  it('renders each upgrade card without a stray trailing ")" text node', () => {
    const { container } = render(<UpgradeModal />);

    expect(screen.getByText('Card Pieces: 2 / 5')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\)/);
  });
});
