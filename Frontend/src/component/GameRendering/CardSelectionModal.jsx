import { useState } from "react";
import { calculateCardStats } from "../GameLogic (MVC)/DefenderClassUtils";
import Card from "../common/Card";
import "../../style/CardSelectionModal.css";

function CardSelectionModal({ playerData, levelId, onConfirm, onCancel }) {
  const [selectedCards, setSelectedCards] = useState([]);
  const maxCards = 8;

  const cardsWithStats = playerData.cards
    .map(calculateCardStats)
    .filter(Boolean);

  const handleCardToggle = (card) => {
    const isSelected = selectedCards.some((c) => c.id === card.id);

    if (isSelected) {
      //remove card from selection
      setSelectedCards(selectedCards.filter((c) => c.id !== card.id));
    } else if (selectedCards.length < maxCards) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleConfirm = () => {
    if (selectedCards.length > 0) {
      onConfirm(selectedCards);
    }
  };

  const energyCost = levelId === 1 ? 0 : 5;

  return (
    <div className="card-selection-overlay">
      <div className="card-selection-modal">
        <div className="modal-header">
          <h2>Select Your Deck</h2>
          <p>
            Choose up to {maxCards} cards for level {levelId}
          </p>
        </div>

        <div className="level-info">
          <div className="energy-cost">
            <span className="energy-icon">⚡</span>
            <span>Energy Cost: {energyCost}</span>
          </div>
          <div className="selected-count">
            Selected: {selectedCards.length} / {maxCards}
          </div>
        </div>

        <div className="cards-grid">
          {cardsWithStats.map((card) => {
            const isSelected = selectedCards.some((c) => c.id === card.id);

            return (
              <div
                key={card.id}
                className={`card-wrapper ${isSelected ? "selected" : ""}`}
                onClick={() => handleCardToggle(card)}
              >
                <Card
                  card={card}
                  selected={isSelected}
                  disabled={!isSelected && selectedCards.length >= maxCards}
                />
                {isSelected && (
                  <div className="selection-indicator">
                    <span className="checkmark">✓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={selectedCards.length === 0}
          >
            Start Level ({selectedCards.length} cards)
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardSelectionModal;
