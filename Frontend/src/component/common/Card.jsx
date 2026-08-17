import "../../style/Card.css";
import "../../style/GameBoard.css";
import { useSpriteFrame } from "./useSpriteFrame.js";

function Card({ card, onClick, selected, disabled, cooldownFraction }) {
  const cardImage = useSpriteFrame("defenders", card.name);

  // cooldownFraction is "how much of the recharge is still left", 1 right
  // after deployment down to 0 once ready. Guarded with Number.isFinite (not
  // a truthiness/`|| 0` check) so a missing prop, an explicit `undefined`, or
  // a stray NaN from upstream all land on the same safe default - only a
  // real finite number moves the needle. Clamped to [0, 1] so bad upstream
  // data (e.g. a fraction > 1) can't sweep past a full circle or invert
  // negative. The result renders as --sweep-angle on .cooldown-sweep below;
  // at 0 that's 0deg, matching the CSS default, so an unwired or
  // data-less card still reads as fully ready.
  const clampedCooldownFraction = Number.isFinite(cooldownFraction)
      ? Math.min(1, Math.max(0, cooldownFraction))
      : 0;
  const sweepAngle = `${clampedCooldownFraction * 360}deg`;

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

        {/* Recharge shown on the card itself. Painted last so it sits above
            the static in-flow content above (absolute-positioned elements
            paint after non-positioned siblings regardless of DOM order, but
            keeping it last here keeps that intent readable). At the default/
            ready angle (0deg) the conic-gradient is fully transparent, so
            this is safe to always render, not just while on cooldown. */}
        <div className="cooldown-sweep" style={{ "--sweep-angle": sweepAngle }} />
      </div>
  );
}

export default Card;
