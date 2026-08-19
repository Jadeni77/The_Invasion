/**
 * Told in-game, not by the browser.
 *
 * Starting a level without energy used to call `alert()`, which stops the page,
 * looks like the site rather than the game, and offers nothing but "OK". When the
 * shortfall is energy this offers the purchase instead, since a player told they
 * cannot play wants a way to play.
 */
import React, { useEffect, useState } from "react";
import { useGame, ENERGY_PACK } from "../GameLogic (MVC)/GameContext";
import "../../style/GateNotice.css";

export default function GateNotice() {
  const { gateNotice, setGateNotice, playerData, buyEnergy, startLevel } = useGame();
  const [busy, setBusy] = useState(false);
  const [pendingStart, setPendingStart] = useState(null);

  /* A purchase reaches playerData a render later, and startLevel closes over the
     snapshot it was built with - starting the level straight after buying re-runs
     the same energy check against the balance the player just topped up, which
     reopens this panel. Waiting for the new balance to arrive is what makes the
     purchase take effect. */
  useEffect(() => {
    if (!pendingStart) return;
    const energy = playerData?.resources?.lobbyEnergy ?? 0;
    if (energy === pendingStart.had) return;

    setPendingStart(null);
    setBusy(false);
    if (energy < pendingStart.needed) return; // Still short: leave the panel up.
    setGateNotice(null);
    startLevel(pendingStart.levelId, pendingStart.selectedCards);
  }, [pendingStart, playerData, setGateNotice, startLevel]);

  if (!gateNotice) return null;

  const dismiss = () => setGateNotice(null);

  if (gateNotice.kind !== "energy") {
    return (
      <div className="gate-notice-overlay" role="dialog" aria-modal="true">
        <div className="gate-notice">
          <h3>{gateNotice.title}</h3>
          <p className="gate-notice-message">{gateNotice.message}</p>
          <div className="gate-notice-actions">
            <button type="button" className="gate-notice-confirm" onClick={dismiss}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  const gold = playerData?.resources?.gold ?? 0;
  // Live, so the panel stays truthful if a purchase lands without clearing it.
  const have = playerData?.resources?.lobbyEnergy ?? gateNotice.have;
  const short = gateNotice.needed - have;
  const affordable = gold >= ENERGY_PACK.gold;

  /* Buy, then start the level the player was trying to start. Making them find
     the node again would be a second obstacle after the one they just paid to
     clear. */
  const buyAndPlay = async () => {
    if (busy || !affordable) return;
    setBusy(true);
    const bought = await buyEnergy();
    if (!bought) {
      setBusy(false);
      return;
    }
    setPendingStart({
      levelId: gateNotice.levelId,
      needed: gateNotice.needed,
      selectedCards: gateNotice.selectedCards,
      had: have,
    });
  };

  return (
    <div className="gate-notice-overlay" role="dialog" aria-modal="true">
      <div className="gate-notice">
        <h3>Not enough energy</h3>

        <p className="gate-notice-message">
          This level costs <b>{gateNotice.needed}</b> energy and you have{" "}
          <b>{have}</b>.
        </p>

        <div className="gate-notice-offer">
          <div className="gate-notice-pack">
            +{ENERGY_PACK.amount} <span>⚡</span>
          </div>
          <div className="gate-notice-price">
            {ENERGY_PACK.gold} <span>gold</span>
          </div>
        </div>

        <p className={`gate-notice-balance ${affordable ? "" : "short"}`}>
          {affordable
            ? `You have ${gold} gold`
            : `You have ${gold} gold — ${ENERGY_PACK.gold - gold} short`}
        </p>

        <div className="gate-notice-actions">
          <button type="button" className="gate-notice-cancel" onClick={dismiss}>
            Not now
          </button>
          <button
            type="button"
            className="gate-notice-confirm"
            onClick={buyAndPlay}
            disabled={!affordable || busy}
            title={affordable ? "" : `Needs ${ENERGY_PACK.gold} gold`}
          >
            {busy ? "Buying…" : "Buy and play"}
          </button>
        </div>

        {/* Waiting is always an option, and saying so keeps the purchase from
            reading as the only way forward. */}
        <p className="gate-notice-wait">
          Or wait — energy refills on its own ({short} more needed).
        </p>
      </div>
    </div>
  );
}
