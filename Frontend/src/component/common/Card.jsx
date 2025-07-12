import React from "react";

function Card({ card }) {
  return (
    <div className="card-container">
      <div className="card-header">
        <div className="card-name">{card.name}</div>
        <div className="card-level">Lvl {card.level}</div>
      </div>
      <div className="card-image">
        <div className="pixel-art-placeholder" />
      </div>
      <div className="card-cost">
        Cost: {card.cost} <span className="energy-icon">⚡</span>
      </div>
    </div>
  );
}

export default Card;
