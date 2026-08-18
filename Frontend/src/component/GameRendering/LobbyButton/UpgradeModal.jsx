// src/components/GameRendering/UpgradeModal.jsx
import React, { useState } from "react"; // Added useState
import { useGame } from "../../GameLogic (MVC)/GameContext.jsx"; // Correct path
import ResourceIcon from "../ResourceIcon.jsx"; // Correct path
import Card from "../../common/Card.jsx"; // Correct path
import "../../../style/Lobby.css"; // Assuming some styles are shared
import "../../../style/UpgradeModal.css"; // Correct path
import { getUpgradePreview } from "../../GameLogic (MVC)/DefenderClassUtils.js";
import Bow from "../../../Icons/Bow.png";
import GameBackdrop from "../TerrainBackdrop.jsx";

function UpgradeModal() {
  const { playerData, startCardUpgrade, closeUpgradeModal } =
    useGame();
  const [selectedCard, setSelectedCard] = useState(null);

  if (!playerData) return <div>Loading....</div>;

  //check if this car can be upgraded, by resources, and by worker
  //add cardpieces requirement in order to upgrade
  const canUpgradeCard = (card) => {
    if (!playerData) return false;

    // Check resources
    const hasResources = Object.entries(card.upgradeCost).every(
      ([resource, amount]) => playerData.resources[resource] >= amount
    );

    //check cardpieces
    const piecesNeeded = card.piecesNeeded * card.level;
    const hasEnoughPieces = card.pieces >= piecesNeeded;

    return hasResources && hasEnoughPieces; // Ensure availableWorker is not null/undefined
  };

  return (
    <div className="upgrade-modal">
            <GameBackdrop />
      <div className="modal-content">
        <button className="close-button" onClick={closeUpgradeModal}>
          &times;
        </button>

        <h2>Card Upgrades</h2>

        <div className="upgrade-grid">
          {playerData.cards.map((card) => {
            const canUpgrade = canUpgradeCard(card);
            const upgradePreview = getUpgradePreview(card);

            return (
              <div
                key={card.id}
                className={`upgrade-card ${
                  selectedCard?.id === card.id ? "selected" : ""
                }`}
                onClick={() => setSelectedCard(card)} // Only allow selection if not upgrading
              >
                <Card card={card} />

                  <div className="upgrade-info">
                    <h4>Upgrade to Level {card.level + 1}</h4>

                    {/* Show Stats Improvement */}
                    {upgradePreview && (
                      <div className="stat-improvements">
                        <div className="stat-change">
                          ⚔️ {upgradePreview.current.damage} →{" "}
                          {upgradePreview.next.damage}
                        </div>
                        <div className="stat-change">
                          ❤️ {upgradePreview.current.health} →{" "}
                          {upgradePreview.next.health}
                        </div>
                        <div className="stat-change">
                          ⚡ {upgradePreview.current.cost} →{" "}
                          {upgradePreview.next.cost}
                        </div>
                        <div className="stat-change">
                          <img className="resource-image" src={Bow} alt="attack-range"/>
                          {upgradePreview.current.range} →{" "}
                          {upgradePreview.next.range}
                        </div>
                      </div>
                    )}

                    {/* new ability */}
                    {upgradePreview &&
                      upgradePreview.upgradeInfo.newAbilities.length > 0 && (
                        <div className="new-abilities">
                          <span>🎯 New Abilities:</span>
                          {upgradePreview.upgradeInfo.newAbilities.map(
                            (ability, index) => (
                              <div key={index} className="ability-preview">
                                {ability}
                              </div>
                            )
                          )}
                        </div>
                      )}

                    <div className="resource-requirements">
                      {Object.entries(card.upgradeCost).map(
                        ([resource, amount]) => (
                          <div
                            key={resource}
                            className={`resource-requirement ${
                              playerData.resources[resource] >= amount
                                ? "met"
                                : "unmet"
                            }`}
                          >
                            <ResourceIcon type={resource} value={amount} />
                            <span>
                              {playerData.resources[resource]}/{amount}
                            </span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Card Pieces Requirement Display */}
                    <div className="card-pieces-requirement">
                      <span className="pieces-icon">⬟</span>
                      <span className={`pieces-text ${
                          card.pieces >= card.piecesNeeded * card.level ? "met" : "unmet"
                      }`}>
                        Card Pieces: {card.pieces} / {card.piecesNeeded * card.level}
                      </span>
                    </div>

                    {/* Only show button if card is selected or if it's the one we're looking at */}
                    {selectedCard?.id === card.id && (
                      <button
                        className={`upgrade-button ${
                          canUpgrade ? "" : "disabled"
                        }`}
                        onClick={() => startCardUpgrade(card.id)}
                        disabled={!canUpgrade}
                      >
                        {canUpgrade ? "Start Upgrade" : "Requirements Not Met"}
                      </button>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
