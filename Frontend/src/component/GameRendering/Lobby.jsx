import React, { useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";
import { levelsMapData, connectionsData } from "./MapLayout";

import "./Lobby.css";

const Lobby = () => {
  const { playerResources, startLevel } = useGame();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [timeToNextEnergy, setTimeToNextEnergy] = useState("Full");


  useEffect(() => {
     const updateTime = () => {
      const {
        lobbyEnergy,
        maxLobbyEnergy,
        energyRechargeRate,
        lastEnergyRechargeTime,
      } = playerResources;
      
      if (lobbyEnergy >= maxLobbyEnergy) {
        setTimeToNextEnergy("Full");
        return;
      }
      
      const now = Date.now();
      const timeSinceLast = now - lastEnergyRechargeTime;
      const timePerEnergy = (60 * 1000) / energyRechargeRate;
      const timeToNext = timePerEnergy - (timeSinceLast % timePerEnergy);
      
      const minutes = Math.floor(timeToNext / (1000 * 60));
      const seconds = Math.floor((timeToNext % (1000 * 60)) / 1000);
      
      setTimeToNextEnergy(`${minutes}m ${seconds}s`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [playerResources]);
  

  const handleLevelClick = (levelId) => {
    if (playerResources.unlockedLevels.includes(levelId)) {
      setSelectedLevel(levelId);
      startLevel(null, levelId);
    }
  };

  return (
    <div className="lobby-container">
      {/* Resource Bar with Energy Recharge Info */}
      <div className="player-resources-bar">
        <div className="resource">
          <span className="label">Gold:</span>
          <span className="value">{playerResources.gold}</span>
        </div>
        <div className="resource energy">
          <span className="label">Energy:</span>
          <span className="value">
            {playerResources.lobbyEnergy}/{playerResources.maxLobbyEnergy}
          </span>
          <div className="recharge-info">
            {playerResources.lobbyEnergy < playerResources.maxLobbyEnergy && (
              <span>Next in: {timeToNextEnergy}</span>
            )}
          </div>
        </div>
      </div>

      <div className="game-map">
        <svg viewBox="0 0 800 600" className="game-map-svg">
          {connectionsData.map((conn) => (
            <path
              key={`${conn.from}-${conn.to}`}
              d={conn.path}
              className="map-path"
              strokeDasharray="10 5"
            />
          ))}

          {levelsMapData.map((level) => (
            <g
              key={level.id}
              className={`level-node ${
                playerResources.unlockedLevels.includes(level.id)
                  ? "unlocked"
                  : "locked"
              }`}
              onClick={() => handleLevelClick(level.id)}
            >
              <circle cx={level.x} cy={level.y} r="25" />
              <text x={level.x} y={level.y} textAnchor="middle" dy=".3em">
                {level.id}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="upgrade-section">
        <h2>Upgrade Cards</h2>
        <div className="upgrade-grid">
          {playerResources.ownedCards.map((card) => (
            <div key={card.id} className="upgrade-card">
              <div className="card-name">{card.name}</div>
              <button>Upgrade</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
