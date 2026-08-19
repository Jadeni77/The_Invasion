/* The route as it is actually PAINTED, not as it is computed. */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Lobby from '../Lobby.jsx';
import { levelsMapData, connectionsData } from '../MapLayout.jsx';
import { stripComments } from '../../../test/sourceFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = stripComments(readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8'));

let mockPlayerData;

/* Partial mock via importOriginal, not a replacement object. */
vi.mock('../../GameLogic (MVC)/GameContext', async (importOriginal) => ({
  ...(await importOriginal()),

  useGame: () => ({
    gameState: 'lobby',
    playerData: mockPlayerData,
    startLevel: vi.fn(),
    openUpgradeModal: vi.fn(),
    openAchievements: vi.fn(),
    openCollection: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    handleLogout: vi.fn(),
    collectTreasure: vi.fn(),
    unlockedDefender: null,
    setUnlockedDefender: vi.fn(),
  }),
}));

beforeEach(() => {
  // `resources` is required: Lobby returns a placeholder before the map exists
  // without it, which renders zero connectors and would make every assertion
  // below vacuously pass on an empty NodeList.
  mockPlayerData = {
    name: 'Commander',
    rank: 'Recruit',
    resources: {
      gold: 100, iron: 10, grain: 10, water: 10, gem: 5,
      lobbyEnergy: 5, maxLobbyEnergy: 10, energyRechargeRate: 6,
      lastEnergyRechargeTime: Date.now(),
    },
    cards: [],
    completedLevels: [1, 2, 3],
    unlockedLevels: [1, 2, 3, 4],
    levelStars: Array(20).fill(0),
    collectedTreasures: [],
    revealedSecrets: [],
  };
});

const nodeById = (id) => levelsMapData.find((level) => level.id === id);

/**
 * Reconstruct the two endpoints of a rendered bar from the inline style the
 * component emitted, applying the same transform the browser would.
 */
function renderedEndpoints(el) {
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);
  const width = parseFloat(el.style.width);
  const transform = el.style.transform;

  const deg = parseFloat(/rotate\(([-\d.]+)deg\)/.exec(transform)[1]);
  const rad = (deg * Math.PI) / 180;

  // `translate(-50%, -50%)` centres the box on (left, top); anything else
  // anchors it somewhere the caller has to account for, so require it here
  // rather than silently mis-modelling the browser.
  expect(transform, `transform on ${el.className}`).toMatch(/translate\(-50%,\s*-50%\)/);

  const cx = left;
  const cy = top;
  const half = width / 2;
  return [
    { x: cx - half * Math.cos(rad), y: cy - half * Math.sin(rad) },
    { x: cx + half * Math.cos(rad), y: cy + half * Math.sin(rad) },
  ];
}

describe('the route as rendered', () => {
  it('rotates each connector about its own centre', () => {
    // `left center` is what put the bar's left edge on the midpoint. The bar is
    // centred on the midpoint, so it must pivot on its centre.
    const m = css.match(/(?:^|[},])\s*\.map-connection\s*\{([^}]*)\}/s);
    expect(m, '.map-connection rule').not.toBeNull();
    expect(m[1]).toMatch(/transform-origin\s*:\s*center/);
    expect(m[1]).not.toMatch(/transform-origin\s*:\s*left/);
  });

  it('lands every connector on the centres of the two nodes it joins', () => {
    const { container } = render(<Lobby />);
    const bars = container.querySelectorAll('.map-connection');
    expect(bars.length).toBe(connectionsData.length);
    expect(bars.length).toBeGreaterThan(15);

    bars.forEach((bar, i) => {
      const conn = connectionsData[i];
      const from = nodeById(conn.from);
      const to = nodeById(conn.to);
      const [a, b] = renderedEndpoints(bar);

      // Either ordering is fine; what matters is that the drawn bar spans
      // exactly node-to-node rather than overshooting one of them.
      const forward =
        Math.hypot(a.x - from.x, a.y - from.y) + Math.hypot(b.x - to.x, b.y - to.y);
      const backward =
        Math.hypot(a.x - to.x, a.y - to.y) + Math.hypot(b.x - from.x, b.y - from.y);

      expect(
        Math.min(forward, backward),
        `connector ${conn.from}->${conn.to} endpoints missed the node centres`,
      ).toBeLessThan(1.5);
    });
  });

  it('never paints a connector past the node it ends at', () => {
    // The specific symptom of the shipped bug: bars extended a full segment
    // beyond their target. Guard the overshoot directly, so a future anchoring
    // mistake fails as itself rather than as a vague offset.
    const { container } = render(<Lobby />);
    const bars = container.querySelectorAll('.map-connection');

    bars.forEach((bar, i) => {
      const conn = connectionsData[i];
      const from = nodeById(conn.from);
      const to = nodeById(conn.to);
      const span = Math.hypot(to.x - from.x, to.y - from.y);
      const [a, b] = renderedEndpoints(bar);
      const drawn = Math.hypot(b.x - a.x, b.y - a.y);

      expect(
        drawn,
        `connector ${conn.from}->${conn.to} drew ${drawn.toFixed(1)}px for a ${span.toFixed(1)}px gap`,
      ).toBeLessThan(span + 1.5);
    });
  });
});
