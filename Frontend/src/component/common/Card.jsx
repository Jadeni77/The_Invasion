import React, {useEffect, useState} from "react";
import "../../style/Card.css";
import "../../style/GameBoard.css";
import { AssetManifest } from "../../assets/AssetManifest.js";

function Card({ card, onClick, selected, disabled }) {
  const [cardImage, setCardImage] = useState(null);

  useEffect(() => {
    const loadCardImage = async () => {
      try {
        // Check if this card has a corresponding defender asset
        const defenderAsset = AssetManifest.defenders[card.name];

        if (defenderAsset && defenderAsset.sprites.idle) {
          // Load the idle sprite
          const idleSprite = await defenderAsset.sprites.idle();
          const imagePath = idleSprite?.default || idleSprite;

          if (imagePath) {
            const img = new Image();
            img.src = imagePath;

            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });

            // Extract first frame
            const config = defenderAsset.config.idle;
            const canvas = document.createElement('canvas');

            // Check if cropping is needed
            if (config.cropConfig?.enabled) {
              canvas.width = config.cropConfig.cropWidth;
              canvas.height = config.cropConfig.cropHeight;
              const ctx = canvas.getContext('2d');

              ctx.drawImage(
                  img,
                  config.cropConfig.offsetX,
                  config.cropConfig.offsetY,
                  config.cropConfig.cropWidth,
                  config.cropConfig.cropHeight,
                  0, 0,
                  config.cropConfig.cropWidth,
                  config.cropConfig.cropHeight
              );
            } else {
              canvas.width = config.frameWidth;
              canvas.height = config.frameHeight;
              const ctx = canvas.getContext('2d');

              ctx.drawImage(
                  img,
                  0, 0, config.frameWidth, config.frameHeight,
                  0, 0, config.frameWidth, config.frameHeight
              );
            }

            setCardImage(canvas.toDataURL());
          }
        }
      } catch (error) {
        console.warn(`Failed to load image for card ${card.name}:`, error);
      }
    };

    loadCardImage();
  }, [card.name]);

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