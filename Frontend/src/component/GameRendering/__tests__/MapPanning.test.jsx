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

  /*
   * The vertical axis has the same reachability problem the horizontal one had,
   * just at short window heights rather than always. `.game-map` is a fixed
   * 600px (mapHeight, set inline) and this box gets what the column flex has
   * left: roughly `100vh - 220px` once the page padding and gaps (40px), the top
   * band (~128px) and the upgrade button in normal flow (~52px) are taken. So
   * the terrain fits at about 820px of window height and not below it - and
   * under `overflow-y: hidden` the shortfall was cut off and unreachable. At
   * 730px that is the bottom 90px: level 8's node and label, and part of
   * level 1's.
   *
   * jsdom lays out nothing, so the threshold itself is arithmetic in the rule's
   * comment, not something asserted here. What is assertable is the declaration
   * that decides whether the shortfall is reachable at all.
   */
  it("does not clip the bottom of the terrain at short window heights", () => {
    const body = ruleBody(".game-map-container");
    expect(body).toMatch(/overflow-y\s*:\s*auto/);
    expect(body).not.toMatch(/overflow-y\s*:\s*hidden/);
  });

  it("still lets the map yield height rather than pushing the page taller", () => {
    // The other half of the same trade. Without `min-height: 0` a flex item
    // refuses to shrink below its content, so a 600px map would push the
    // container past 100vh and take the top band off-screen with it - the same
    // clipping bug from the other end. The map yields; its content stays
    // reachable.
    expect(ruleBody(".game-map-container")).toMatch(/min-height\s*:\s*0/);
    // What matters is that the frame *yields* - flex-shrink is 1 - not that it
    // also grows. It must not grow: growing past the terrain left dead ground
    // inside the border. So this pins the shrink and leaves grow free.
    expect(ruleBody(".game-map-container")).toMatch(/flex\s*:\s*[01] 1 auto/);
  });

  it("keeps the vertical scrollbar hidden along with the horizontal one", () => {
    expect(ruleBody(".game-map-container")).toMatch(/scrollbar-width\s*:\s*none/);
    expect(ruleBody(".game-map-container::-webkit-scrollbar")).toMatch(/display\s*:\s*none/);
  });
});

/**
 * Drag is the primary way to pan; native scrolling stays underneath.
 *
 * The owner asked for dragging over scrolling "unless scrolling is good for all
 * users include phone and computer", and it is not: on a desktop with a mouse,
 * horizontal scrolling means shift+wheel or grabbing a scrollbar. Pointer
 * events cover mouse, touch and pen in one path. So drag leads, and scrolling
 * stays because it costs nothing and helps trackpad users - it just stops being
 * the visible affordance.
 *
 * The touch-action half of this is a source-text check and can only be one:
 * jsdom implements no native scrolling, so the double-speed pan it fixes cannot
 * be reproduced here. What jsdom *can* measure is the handler's own arithmetic,
 * which is the other contributor - see the 1:1 test below.
 */
describe("the map is dragged, and the drag moves it 1:1", () => {
  it("gives BOTH axes to the drag handler, and nothing else", () => {
    // With `overflow` and no touch-action, a drag has two things moving the map:
    // native scroll applying a relative delta, and onPointerMove assigning an
    // absolute scroll offset from the pointerdown anchor. Each is 1:1 alone; in a
    // frame where the native delta lands on top of the assignment the map moves
    // twice the finger's travel.
    //
    // This used to require `pan-y`, because the handler moved only the horizontal
    // axis and the browser was left to handle vertical. The handler now moves both
    // (the terrain is taller than its frame on a phone), so `pan-y` would put the
    // doubling back on the vertical axis instead of curing it.
    //
    // `touch-action` is an allow-list, so what matters is that NO value permitting
    // a pan appears. Asserted term by term, because a test looking only for the
    // presence of `pinch-zoom` would pass for `pan-x pinch-zoom`.
    const value = ruleBody(".game-map-container").match(/touch-action:\s*([^;]+);/)?.[1];
    expect(value, "no touch-action declared").toBeTruthy();
    expect(value).not.toMatch(/\bpan-x\b|\bpan-y\b|\bpan-left\b|\bpan-right\b|\bpan-up\b|\bpan-down\b/);
    expect(value).not.toMatch(/\bmanipulation\b|\bauto\b/);
    // Zoom is not panning, and losing it on a map three screens wide was a bug in
    // its own right.
    expect(value).toMatch(/\bpinch-zoom\b/);
  });

  it("still lets a phone pinch to zoom out on a map three screens wide", () => {
    // Omitting pinch-zoom from the allow-list blocks it as surely as it blocks
    // horizontal panning. On a 4200px map that costs a phone user more than the
    // doubling did.
    expect(ruleBody(".game-map-container")).toMatch(/touch-action:[^;]*\bpinch-zoom\b/);
  });

  it("shows a grab cursor, and a grabbing one during the gesture", () => {
    expect(ruleBody(".game-map-container")).toMatch(/cursor\s*:\s*grab/);
    expect(ruleBody(".game-map-container:active")).toMatch(/cursor\s*:\s*grabbing/);
  });

  it("hides the scrollbar without making the element unscrollable", () => {
    expect(ruleBody(".game-map-container")).toMatch(/scrollbar-width\s*:\s*none/);
    expect(ruleBody(".game-map-container::-webkit-scrollbar")).toMatch(/display\s*:\s*none/);
    // The element must still scroll - the drag handler, the opening-scroll
    // effect and the trackpad all move it by writing scrollLeft.
    expect(ruleBody(".game-map-container")).toMatch(/overflow-x\s*:\s*auto/);
    expect(ruleBody(".game-map-container")).not.toMatch(/overflow-x\s*:\s*hidden/);
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

  /*
   * The pan distance itself, which is the half of the double-speed bug that is
   * measurable here. jsdom has no native scrolling, so what this exercises is
   * the handler in isolation: a pointer that travels N px must move the map
   * exactly N px, not some multiple of it. With `touch-action: pinch-zoom` the
   * handler is the only thing moving the map on EITHER axis, so this arithmetic
   * is the whole of the gesture rather than one of two contributors.
   */
  it("moves the map exactly as far as the pointer travelled", () => {
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    viewport.scrollLeft = 1000;
    const before = viewport.scrollLeft;

    fireEvent.pointerDown(viewport, { clientX: 800, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 500, pointerId: 1 });

    // Dragged 300px left, so the map comes 300px right. Not 600.
    expect(viewport.scrollLeft - before).toBe(300);

    fireEvent.pointerUp(viewport, { clientX: 500, pointerId: 1 });
  });


  /*
   * The vertical half, and diagonals.
   *
   * The handler moved only `scrollLeft`, which was enough while the terrain always
   * fitted its frame vertically. It does not: the terrain is 720px tall against a
   * frame of about 575px on a phone held upright and 250px held sideways, so there
   * is real vertical range and dragging could not reach it.
   */
  it("moves the map vertically by exactly what the pointer travelled", () => {
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    viewport.scrollTop = 300;
    const before = viewport.scrollTop;

    fireEvent.pointerDown(viewport, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 180, pointerId: 1 });

    // Dragged 120px up, so the map comes 120px down. Not 240.
    expect(viewport.scrollTop - before).toBe(120);

    fireEvent.pointerUp(viewport, { clientX: 400, clientY: 180, pointerId: 1 });
  });

  it("moves both axes at once on a diagonal drag", () => {
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    viewport.scrollLeft = 1000;
    viewport.scrollTop = 300;

    fireEvent.pointerDown(viewport, { clientX: 800, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 600, clientY: 220, pointerId: 1 });

    expect(viewport.scrollLeft).toBe(1200);
    expect(viewport.scrollTop).toBe(380);

    fireEvent.pointerUp(viewport, { clientX: 600, clientY: 220, pointerId: 1 });
  });

  it("counts a straight-down drag as a drag, so it cannot launch a level", () => {
    /*
     * The threshold measured only the horizontal component, so a purely vertical
     * gesture never set `moved` and the click it ended on fired - launching
     * whatever level the finger came to rest on. Guarding the axis that the same
     * change introduced.
     */
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    fireEvent.pointerDown(viewport, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 220, pointerId: 1 });
    fireEvent.pointerUp(viewport, { clientX: 400, clientY: 220, pointerId: 1 });

    const node = container.querySelector(".level-node.available");
    fireEvent.click(node);
    expect(mockStartLevel).not.toHaveBeenCalled();
  });

  it("tracks the pointer back and forth within one gesture, from the same anchor", () => {
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    viewport.scrollLeft = 1000;
    fireEvent.pointerDown(viewport, { clientX: 800, pointerId: 1 });

    fireEvent.pointerMove(viewport, { clientX: 700, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(1100);

    // Back past the start of the gesture: the offset is always measured from
    // the pointerdown anchor, so reversing returns to where it began rather
    // than accumulating.
    fireEvent.pointerMove(viewport, { clientX: 900, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(900);

    fireEvent.pointerMove(viewport, { clientX: 800, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(1000);

    fireEvent.pointerUp(viewport, { clientX: 800, pointerId: 1 });
  });

  it("does not move the map after the gesture ends", () => {
    const { container } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");

    fireEvent.pointerDown(viewport, { clientX: 800, pointerId: 1 });
    fireEvent.pointerUp(viewport, { clientX: 800, pointerId: 1 });

    viewport.scrollLeft = 1234;
    fireEvent.pointerMove(viewport, { clientX: 300, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(1234);
  });

  it("keeps the 5px threshold that stops a click becoming a drag", () => {
    // Pinned by value: the guard that stops a pan launching a level reads it,
    // and a threshold of 0 would make every click a drag.
    const jsx = readFileSync(join(HERE, "..", "Lobby.jsx"), "utf8");
    expect(jsx).toMatch(/DRAG_THRESHOLD_PX\s*=\s*5\b/);
  });
});

/**
 * The opening-scroll effect used to key on `[playerData, mapZoom]` directly.
 * `playerData` is a fresh object reference on most GameContext updates -
 * including energy regenerating on a timer, one of 14 setPlayerData call
 * sites - so keying on the object re-ran the effect, and re-centred the
 * viewport on the next playable level, on every one of those updates: a
 * player panning the map would get snapped back to wherever the map opened
 * for reasons unrelated to level progress. The effect now keys on
 * `nextPlayableLevelId(playerData)` (a level id, or null) computed at
 * render time, so it only re-runs when that id actually changes.
 */
describe("the opening-scroll effect keys on the next level, not the playerData reference", () => {
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

  it("does not re-centre when playerData gets a new reference but the next playable level is unchanged", () => {
    const { container, rerender } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");
    expect(viewport).not.toBeNull();

    // Simulate the player having panned away from wherever the map opened.
    viewport.scrollLeft = 555;

    // A new object, same unlock/completion state - exactly the shape an
    // unrelated update (e.g. an energy tick) produces: a new playerData
    // reference that does not change nextPlayableLevelId's answer.
    mockPlayerData = {
      ...mockPlayerData,
      resources: { ...mockPlayerData.resources, gold: mockPlayerData.resources.gold + 1 },
    };
    rerender(<Lobby />);

    expect(viewport.scrollLeft).toBe(555);
  });

  it("does re-centre once the next playable level actually changes", () => {
    const { container, rerender } = render(<Lobby />);
    const viewport = container.querySelector(".game-map-container");
    viewport.scrollLeft = 555;

    // Level 1 completed - nextPlayableLevelId now answers 2, not 1. The
    // effect must still fire for this, or a finished level would leave the
    // map pointed at a level the player has already cleared.
    mockPlayerData = {
      ...mockPlayerData,
      unlockedLevels: [1, 2],
      completedLevels: [1],
    };
    rerender(<Lobby />);

    expect(viewport.scrollLeft).not.toBe(555);
  });
});
