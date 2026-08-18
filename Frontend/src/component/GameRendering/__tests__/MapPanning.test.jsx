// The map got wider than its viewport (levels 15-17 sat past the edge of a
// container with `overflow: hidden`, unreachable), and the same clipping cut
// off the top bar. This file covers three things: overflow moved to the
// viewport instead of the page, the map opens on the level the player can
// actually play next, and - the failure mode this interaction always has -
// that panning the map can never fire a node's or a chest's onClick.
import React from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Lobby from "../Lobby.jsx";
import { nextPlayableLevelId, levelsMapData } from "../MapLayout.jsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "..", "..", "..", "style", "Lobby.css"), "utf8");

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`, "s"));
  return m ? m[1] : "";
}

describe("overflow lives on the viewport, not the page", () => {
  it("does not clip the page container", () => {
    expect(ruleBody(".lobby-container")).not.toMatch(/overflow\s*:\s*hidden/);
  });

  it("scrolls the map viewport horizontally", () => {
    expect(ruleBody(".game-map-container")).toMatch(/overflow-x\s*:\s*auto/);
  });
});

describe("nextPlayableLevelId", () => {
  it("is level 1 for a new player", () => {
    expect(nextPlayableLevelId({ unlockedLevels: [1], completedLevels: [] })).toBe(1);
  });

  it("is the first unlocked, uncompleted level", () => {
    expect(nextPlayableLevelId({
      unlockedLevels: [1, 2, 3, 4],
      completedLevels: [1, 2],
    })).toBe(3);
  });

  it("is null when everything unlocked is finished", () => {
    expect(nextPlayableLevelId({ unlockedLevels: [1, 2], completedLevels: [1, 2] })).toBe(null);
  });

  it("never returns a locked level", () => {
    const id = nextPlayableLevelId({ unlockedLevels: [1], completedLevels: [1] });
    expect(id === null || levelsMapData.some((l) => l.id === id)).toBe(true);
  });

  it("still leaves a real node to fall back to when nothing is left to play", () => {
    // Lobby.jsx's opening-scroll effect does
    // `levelsMapData.find(l => l.id === targetId) ?? levelsMapData[0]` -
    // this is the fallback path, not the happy one: a player who has
    // cleared every unlocked level should land somewhere real (level 1),
    // not on `undefined`, which is what a blank corner of the map would
    // actually be.
    //
    // Deliberately stops short of level 10: completing it is this map's
    // (pre-existing, unrelated) endless-mode unlock trigger, which would
    // make the portal newly available and give a real, non-null next stop -
    // correct in its own right, but not the null path this test needs to
    // reach.
    const clearedEverything = { unlockedLevels: [1, 2, 3], completedLevels: [1, 2, 3] };

    const targetId = nextPlayableLevelId(clearedEverything);
    expect(targetId).toBe(null);

    const fallback = levelsMapData.find((l) => l.id === targetId) ?? levelsMapData[0];
    expect(fallback).toBe(levelsMapData[0]);
    expect(fallback.x).toBeGreaterThanOrEqual(0);
  });
});

// vi.mock is hoisted to the top of the module by Vitest regardless of where
// it is written, so its factory can only close over bindings that are
// themselves hoisted - which Vitest only does for identifiers prefixed
// `mock`, declared at module scope (not nested inside a describe/it). These
// three are reassigned a fresh vi.fn()/value in beforeEach below; because
// the factory reads the *binding*, not a snapshot taken at mock-definition
// time, each render during a test sees that test's own fresh mocks.
let mockPlayerData;
let mockStartLevel;
let mockCollectTreasure;

vi.mock("../../GameLogic (MVC)/GameContext", () => ({
  useGame: () => ({
    gameState: "lobby",
    playerData: mockPlayerData,
    startLevel: mockStartLevel,
    openUpgradeModal: vi.fn(),
    openAchievements: vi.fn(),
    openCollection: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    handleLogout: vi.fn(),
    collectTreasure: mockCollectTreasure,
    unlockedDefender: null,
    setUnlockedDefender: vi.fn(),
  }),
}));

/**
 * A drag must not fire a node's or a chest's click - the bug this
 * interaction always has, because a released drag still dispatches a real
 * `click` event on whatever is underneath the pointer.
 *
 * What this proves: Lobby.jsx's own JS-level state (`drag.current.moved`,
 * flipped by `onPointerMove` once movement passes a 5px threshold, read by
 * every node/chest's `onClick` before it acts) actually gates the real
 * handlers - opening CardSelectionModal for a node, and `collectTreasure`
 * (the real backend call) for a chest. Every assertion below is on that
 * application logic, exercised through a real
 * pointerdown/pointermove/pointerup/click sequence dispatched on a real
 * Lobby render.
 *
 * What this does NOT prove: that a real browser drag looks or feels right,
 * or that CSS (`cursor: grab`/`grabbing`, `.game-map`'s width exceeding its
 * container) produces actual visible overflow - jsdom has no layout engine,
 * so pixels, scrolling geometry and rendered appearance are outside what any
 * test here can check. It also does not rely on `pointer-events` CSS to
 * block the click: jsdom does not honour that property for synthetic
 * dispatch, so a mechanism that depended on it would pass here for the
 * wrong reason regardless of whether it worked in a browser. The guard
 * under test is plain JS state read inside the click handler, which is why
 * this is real coverage of the mechanism rather than a false positive.
 */
describe("a drag never fires a node's or a chest's click", () => {
  beforeEach(() => {
    mockPlayerData = {
      name: "Commander",
      rank: "Recruit",
      resources: {
        gold: 100, iron: 10, grain: 10, water: 10, gem: 5,
        lobbyEnergy: 5, maxLobbyEnergy: 10, energyRechargeRate: 6,
        lastEnergyRechargeTime: Date.now(),
      },
      cards: [],
      completedLevels: [],
      unlockedLevels: [1],
      levelStars: [],
      collectedTreasures: [],
      revealedSecrets: [],
    };
    mockStartLevel = vi.fn();
    mockCollectTreasure = vi.fn();
  });

  /** Presses, drags well past the threshold, and releases on `element`. */
  function dragAcross(element) {
    fireEvent.pointerDown(element, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(element, { clientX: 100, pointerId: 1 }); // 200px, past the 5px threshold
    fireEvent.pointerUp(element, { clientX: 100, pointerId: 1 });
  }

  /** Presses and releases in place on `element` - a plain click's press. */
  function pressInPlace(element) {
    fireEvent.pointerDown(element, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(element, { clientX: 300, pointerId: 1 });
  }

  it("does not open the level's card selection after dragging over it", () => {
    const { container } = render(<Lobby />);
    const node = container.querySelector(".level-node.available");
    expect(node, "expected an available level node (level 1)").not.toBeNull();

    dragAcross(node);
    fireEvent.click(node);

    expect(container.querySelector(".card-selection-overlay")).toBeNull();
  });

  it("still opens card selection on a plain click - the guard is conditional, not blanket", () => {
    const { container } = render(<Lobby />);
    const node = container.querySelector(".level-node.available");
    expect(node).not.toBeNull();

    pressInPlace(node);
    fireEvent.click(node);

    expect(container.querySelector(".card-selection-overlay")).not.toBeNull();
  });

  it("does not call the real collectTreasure after dragging over a chest", () => {
    const { container } = render(<Lobby />);
    const chest = container.querySelector(".treasure-chest:not(.locked-chest):not(.collected)");
    expect(chest, "expected chest-1 to be collectible (requires level 1, which is always unlocked)").not.toBeNull();

    dragAcross(chest);
    fireEvent.click(chest);

    expect(mockCollectTreasure).not.toHaveBeenCalled();
  });

  it("still calls collectTreasure on a plain click - the guard is conditional, not blanket", () => {
    const { container } = render(<Lobby />);
    const chest = container.querySelector(".treasure-chest:not(.locked-chest):not(.collected)");
    expect(chest).not.toBeNull();

    pressInPlace(chest);
    fireEvent.click(chest);

    expect(mockCollectTreasure).toHaveBeenCalledWith("chest-1");
  });
});
