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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Lobby from "../Lobby.jsx";

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
