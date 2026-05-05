import "../../style/Card.css";
import "../../style/GameBoard.css";
import { useSpriteFrame } from "./useSpriteFrame.js";

function Card({ card, onClick, selected, disabled }) {
  const cardImage = useSpriteFrame("defenders", card.name);

  return (
      <div
          className={`card-container ${selected ? "selected" : ""} ${
              disabled ? "disabled" : ""
          }`}
          onClick={!disabled ? onClick : undefined}
          style={{ width: "100px", height: "130px" }} // Fixed size
      >
        <div className="card-header">
          <div className="card-name">{card.name}</div>
          <div className="card-level">Lvl {card.level}</div>
        </div>

        <div className="card-image">
          {cardImage ? (
              <img
                  src={cardImage}
                  alt={card.name}
                  className="card-character-image"
                  style={{
                    width: "60px",
                    height: "60px",
                    imageRendering: "pixelated", // Preserve pixel art style
                    objectFit: "contain"
                  }}
              />
          ) : (
               <div className="pixel-art-placeholder" />
           )}
        </div>

        <div className="card-cost">
          <span className="cost-value">{card.cost}</span>
          <span className="energy-icon">⚡</span>
        </div>

        <div className="card-stats">
          <div className="stat">
            <span className="stat-icon">⚔️</span>
            <span className="stat-value">{card.damage || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-icon">❤️</span>
            <span className="stat-value">{card.health || 0}</span>
          </div>
        </div>

        {/* Show some special abilities */}
        {card.specialAbilities && card.specialAbilities.length > 0 && (
            <div className="card-abilities">
              {card.specialAbilities.map((abilities, index) => (
                  <div key={index} className="ability-indicator">
                    ✨
                  </div>
              ))}
            </div>
        )}
      </div>
  );
}

export default Card;
