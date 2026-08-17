// Real render coverage for the lobby's settings button, in place of the
// source-shape test the task brief proposed (grepping Lobby.jsx's text for
// "SettingModal", which would still pass if the component imported the
// modal and never rendered it - the exact failure worth catching here).
//
// The lobby is only ever mounted through GameContext's GameProvider, which
// pulls in SessionManager, AudioManager, MusicPlayer and login state - far
// more than a unit test needs to stand up just to check a button opens a
// modal. Instead this mocks `useGame` directly, backing `gameState` with a
// single external store shared across every component that calls useGame()
// in this render tree (Lobby AND, once it mounts, SettingModal) - a plain
// per-component useState would give each of them its own independent copy,
// so closing the modal from inside SettingModal would never be visible to
// Lobby. useSyncExternalStore is what actually reproduces GameContext's
// real contract: one shared value, every consumer re-renders on change.
import React from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Lobby from "../Lobby.jsx";
import { zoneConfigs } from "../MapLayout.jsx";

let mockGameState = "lobby";
const listeners = new Set();

function setMockGameState(next) {
  mockGameState = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return mockGameState;
}

vi.mock("../../GameLogic (MVC)/GameContext", () => ({
  useGame: () => {
    const gameState = React.useSyncExternalStore(subscribe, getSnapshot);
    return {
      gameState,
      playerData: {
        name: "Commander",
        rank: "Recruit",
        resources: {
          gold: 100,
          iron: 10,
          grain: 10,
          water: 10,
          gem: 5,
          lobbyEnergy: 5,
          maxLobbyEnergy: 10,
          energyRechargeRate: 6,
          lastEnergyRechargeTime: Date.now(),
        },
        completedLevels: [],
        unlockedLevels: [1],
        levelStars: [],
        collectedTreasures: [],
        revealedSecrets: [],
      },
      startLevel: vi.fn(),
      openUpgradeModal: vi.fn(),
      openAchievements: vi.fn(),
      openCollection: vi.fn(),
      // The real GameContext pair: openSettings/closeSettings drive a
      // shared `gameState`, and SettingModal (rendered by Lobby once
      // gameState === "settings") closes itself by calling closeSettings
      // from this same context - so closing it here must be able to flip
      // gameState back, not just record that a mock fn was called.
      openSettings: () => setMockGameState("settings"),
      closeSettings: () => setMockGameState("lobby"),
      handleLogout: vi.fn(),
      collectTreasure: vi.fn(),
      unlockedDefender: null,
      setUnlockedDefender: vi.fn(),
    };
  },
}));

describe("lobby settings button", () => {
  beforeEach(() => {
    mockGameState = "lobby";
    listeners.clear();
  });

  it("renders a settings control in the top bar", () => {
    render(<Lobby />);
    const button = screen.getByRole("button", { name: /settings/i });
    // Structural check only: it lives in the top-right button cluster
    // alongside Collection/Achievement, not floating disconnected in the
    // document. jsdom has no layout engine, so this cannot confirm it is
    // visually in the top-right corner - only that it is in the right
    // container.
    expect(button.closest(".top-menu-bar")).not.toBeNull();
  });

  it("opens the settings modal on click, replacing the lobby view", () => {
    render(<Lobby />);
    expect(screen.getByText("Upgrade Cards")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    // Real modal content appears...
    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
    // ...and the lobby underneath it is gone, not just overlaid - proving
    // the click actually swapped state rather than, say, toggling an
    // unrelated flag while the lobby kept rendering behind it.
    expect(screen.queryByText("Upgrade Cards")).not.toBeInTheDocument();
  });

  it("does not give Settings the same icon as the button that logs you out", () => {
    // The logout button carried `icon-setting`, and Task 8 put an
    // identically-iconed Settings button immediately beside it: a destructive
    // action one indistinguishable gear away from a benign one, in a bar where
    // the icon is the only thing a player scanning it reads. Rejects any
    // future state where the two share a glyph class, in either direction -
    // including "fixing" it by moving Settings off the gear and leaving logout
    // on it, which would swap the confusion rather than remove it.
    //
    // Queried through the rendered tree by accessible name, so this follows
    // the buttons if the markup is reordered or restructured. jsdom draws
    // nothing, so this cannot confirm the two glyphs *look* different - and in
    // fact no stylesheet defines `icon-*` yet, so today neither draws at all.
    render(<Lobby />);
    const settings = screen.getByRole("button", { name: /settings/i });
    const logout = screen.getByRole("button", { name: /logout/i });

    const iconClass = (button) => button.querySelector("i")?.className;
    expect(iconClass(settings), "settings button has no icon element").toBeTruthy();
    expect(iconClass(logout), "logout button has no icon element").toBeTruthy();
    expect(iconClass(settings)).not.toBe(iconClass(logout));

    // And the destructive one must not be the one wearing the gear.
    expect(iconClass(logout)).not.toMatch(/setting|gear|cog/i);
  });

  it("can close the settings modal and return to the lobby", () => {
    render(<Lobby />);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "×" }));

    expect(
      screen.queryByRole("heading", { name: /settings/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Upgrade Cards")).toBeInTheDocument();
  });
});

/**
 * One source for what a zone looks like.
 *
 * `Lobby.css` has carried five reviewed, tokenized zone rules since Task 3
 * (`.mid-node { background: var(--colors-surface-raised) }` among them). The
 * first fix for the lobby's raw colour literals moved them onto tokens but
 * left them where they were - as inline styles in MapLayout's `zoneConfigs` -
 * and an inline style beats a stylesheet. Four zones coincidentally agreed;
 * `.mid-node` did not, so the reviewed earth tone was silently overridden by a
 * bright orange on the first screen a player sees. Two sources that must
 * agree, which is what the token module exists to remove.
 *
 * These tests live in this file because it is the one place that already
 * stands up a real Lobby render (see the mock at the top). They assert the
 * absence of the override *mechanism*, not just today's values: no inline
 * colour on any map element, and a stylesheet rule behind every zone. jsdom
 * has no layout engine, so what colour anything ends up is not checkable here
 * - only where that colour is allowed to come from.
 */
describe("zone colour has exactly one source", () => {
  const lobbyCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "style", "Lobby.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  /** Inline style properties that would override a stylesheet's colour. */
  const COLOUR_PROPERTIES = [
    "background", "backgroundColor", "backgroundImage",
    "borderColor", "border", "color", "boxShadow",
  ];

  function inlineColoursOn(element) {
    return COLOUR_PROPERTIES.filter((property) => element.style[property] !== "");
  }

  it("puts no inline colour on any level node", () => {
    // Rejects reintroducing `backgroundColor`/`borderColor` in the inline
    // style - including with a correct token, which is how this broke: an
    // inline token still wins over the stylesheet, so a future edit to
    // Lobby.css would silently do nothing for whichever zones disagreed.
    render(<Lobby />);
    const nodes = [...document.querySelectorAll(".level-node")];
    expect(nodes.length, "no level nodes rendered").toBeGreaterThan(10);

    for (const node of nodes) {
      const offenders = inlineColoursOn(node);
      expect(
        offenders,
        `a level node carries inline ${offenders.join(", ")}, which beats Lobby.css`,
      ).toEqual([]);
    }
  });

  it("puts no inline colour on any zone backdrop", () => {
    // Same rule for the six `.zone-background` washes, whose hue used to be
    // supplied inline from the same config - and whose endless variant wrote
    // out a seven-hex rainbow gradient inline.
    render(<Lobby />);
    const backdrops = [...document.querySelectorAll(".zone-background")];
    expect(backdrops.length, "no zone backdrops rendered").toBeGreaterThan(4);

    for (const backdrop of backdrops) {
      expect(inlineColoursOn(backdrop)).toEqual([]);
    }
  });

  it("carries no colour-valued field in zoneConfigs at all", () => {
    // The mechanism, at its source: as long as the config holds a colour,
    // something can wire it back into an inline style. Rejects re-adding
    // `backgroundColor`, `borderColor` or `glowColor` to any zone.
    for (const [zone, config] of Object.entries(zoneConfigs)) {
      const colourFields = Object.keys(config).filter((key) => /colour|color|gradient/i.test(key));
      expect(colourFields, `zoneConfigs.${zone} carries ${colourFields.join(", ")}`).toEqual([]);
    }
  });

  it("has a stylesheet rule for every zone's node class", () => {
    // The other half: having removed the inline colour, every zone must
    // actually be styled somewhere, or a zone silently renders with no hue
    // and the map loses a distinction the config still claims to make.
    // `.endless-portal` is exempt - the endless node is rendered by
    // renderEndlessPortal with its own portal artwork, not as a level node.
    for (const [zone, config] of Object.entries(zoneConfigs)) {
      if (config.nodeClass === "endless-portal") continue;
      const rule = new RegExp(`\\.${config.nodeClass}\\s*\\{[^}]*background`);
      expect(
        rule.test(lobbyCss),
        `Lobby.css has no background for .${config.nodeClass} (zone "${zone}")`,
      ).toBe(true);
    }
  });
});
