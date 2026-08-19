/**
 * "There is a newer version" - said in the lobby, never during a level.
 *
 * Reloading mid-level would destroy the run and keep the energy that paid for
 * it, which is the exact loss the quit dialog exists to warn about. So the
 * notice waits: the hook latches the moment an update appears, and this only
 * draws it once the player is back in the lobby with nothing to lose.
 *
 * It asks rather than reloading on its own. A page that reloads itself while
 * someone is reading it is indistinguishable from a crash.
 */
import React from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";
import { useUpdateAvailable } from "./useUpdateAvailable.js";
import "../../style/UpdateNotice.css";

export default function UpdateNotice() {
  const { gameState } = useGame();
  const available = useUpdateAvailable();

  if (!available) return null;
  // Anything that is not the lobby is either a level or a screen over one.
  if (gameState !== "lobby") return null;

  return (
    <div className="update-notice" role="status">
      <span className="update-notice-text">A new version of the game is ready.</span>
      <button
        type="button"
        className="update-notice-button"
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}
