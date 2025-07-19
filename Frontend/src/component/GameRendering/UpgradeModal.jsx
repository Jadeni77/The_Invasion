// src/components/GameRendering/UpgradeModal.jsx
import React, { useState, useEffect } from "react"; // Added useState, useEffect
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import ResourceIcon from "./ResourceIcon"; // Correct path
import Card from "../common/Card"; // Correct path
import "../../style/Lobby.css"; // Assuming some styles are shared
import "../../style/UpgradeModal.css"; // Correct path
import { getUpgradePreview } from "../GameLogic (MVC)/DefenderClassUtils";

function UpgradeModal() {
  const { playerData, upgradeQueue, startCardUpgrade, closeUpgradeModal } =
    useGame();
  const [selectedCard, setSelectedCard] = useState(null);
  const [timer, setTimer] = useState(0); // Force re-renders

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1); // Update every second
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!playerData) return <div>Loading....</div>;

  //check if this card is still upgrading
  const getUpgradeStatus = (cardId) => {
    const upgrade = upgradeQueue.find((u) => u.cardId === cardId);
    if (!upgrade) return null;

    const now = Date.now(); // Get current time
    const duration = upgrade.endTime - upgrade.startTime;
    const elapsed = now - upgrade.startTime;

    const progress = Math.min(100, (elapsed / duration) * 100);
    const timeLeft = Math.ceil((upgrade.endTime - now) / 1000);

    return {
      progress,
      timeLeft: Math.max(0, timeLeft), // Ensure time left is not negative
    };
  };

  //check if this car can be upgrded, by resources, and by worker
  const canUpgradeCard = (card) => {
    if (!playerData) return false;

    // Check if card is already in upgrade queue
    if (upgradeQueue.some((u) => u.cardId === card.id)) {
      return false;
    }

    // Check resources
    const hasResources = Object.entries(card.upgradeCost).every(
      ([resource, amount]) => playerData.resources[resource] >= amount
    );

    // Check available workers
    const availableWorker = playerData.workers.find(
      (w) => !w.injured && !upgradeQueue.some((u) => u.workerId === w.id)
    );

    return hasResources && !!availableWorker; // Ensure availableWorker is not null/undefined
  };

  return (
    <div className="upgrade-modal">
      <div className="modal-content">
        <button className="close-button" onClick={closeUpgradeModal}>
          &times;
        </button>

        <h2>Card Upgrades</h2>

        <div className="upgrade-grid">
          {playerData.cards.map((card) => {
            const upgradeStatus = getUpgradeStatus(card.id);
            const isUpgrading = !!upgradeStatus;
            const canUpgrade = canUpgradeCard(card);
            const upgradePreview = getUpgradePreview(card);

            return (
              <div
                key={card.id}
                className={`upgrade-card ${
                  selectedCard?.id === card.id ? "selected" : ""
                } ${isUpgrading ? "upgrading" : ""}`}
                onClick={() => !isUpgrading && setSelectedCard(card)} // Only allow selection if not upgrading
              >
                <Card card={card} />

                {isUpgrading ? (
                  <div className="upgrade-in-progress">
                    <div className="progress-text">
                      Upgrading... {upgradeStatus.timeLeft}s
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${upgradeStatus.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
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

                    <div className="worker-requirement">
                      <span className="worker-icon">👷</span>
                      <span>1 Worker Required</span>
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
