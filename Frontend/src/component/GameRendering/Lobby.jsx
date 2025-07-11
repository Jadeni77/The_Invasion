import React, { useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";
import GameBoard from "./GameBoard";
import { chestsData, connectionsData, levelsMapData } from "./MapLayout";

//This function is responsible for:
// -Displaying Player Resounrces
// -Level Selection
// -Trigger game start
// -Return from Game: the destination when the game ended.

function Lobby() {
  const {
    playerResources,
    startLevel,
    isGameInitialized,
    currentLevelSession,
    returnToLobby, //maybe not needed here
  } = useGame();

  //state to manage which level is currently being selected (before game starting)
  const [selectedLevel, setSelectedLevel] = useState(null);

  useEffect(() => {
    if (selectedLevel != null && !isGameInitialized) {
      console.log(
        `Lobby: Selected level ${selectedLevelToPlay}. Router should now render GameBoard.`
      );
    }
  }, [selectedLevel, isGameInitialized]);

  const handleLevelNodeClick = (levelNumber) => {
    const levelCost = levelNumber === 1 ? 0 : 10;
    if (playerResources.lobbyEnergy < levelCost) {
      alert(
        `Not enough energy to play Level ${levelNumber}! Requires ${levelCost} energy.`
      );
      return;
    }
    setSelectedLevel(levelNumber);
  };

  //   //function to handle a click 'play level' button
  //   const handlePlayLevel = (levelNumber) => {
  //     //gameboard will handle the set selecting level
  //     setSelectedLevel(levelNumber);
  //     //gameboard handle everything
  //     console.log(`Preparing to play level: ${levelNumber}`);
  //   };

  // Calculate time until next energy point
  const timeToNextEnergy = () => {
    const {
      lobbyEnergy,
      maxLobbyEnergy,
      energyRechargeRate,
      lastEnergyRechargeTime,
    } = playerResources;
    if (lobbyEnergy >= maxLobbyEnergy) {
      return "Full";
    }

    const now = Date.now();
    const timeSinceLastRecharge = now - lastEnergyRechargeTime;
    // Time needed for one energy point in milliseconds
    const timePerEnergyMs = (1000 * 60) / energyRechargeRate;
    const remainingTimeMs =
      timePerEnergyMs - (timeSinceLastRecharge % timePerEnergyMs);

    if (remainingTimeMs <= 0) return "Rechargin..."; //shoudl be caught by useEffect in GaemContext

    const minutes = Math.floor(remainingTimeMs / (1000 * 60));
    const seconds = Math.floor((remainingTimeMs % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // If the game is initialized AND not game over, we are in a game session, so render GameBoard
  // Note: App.jsx or your router handles the primary routing.
  // This check here is if Lobby *itself* should render GameBoard (less ideal, better to use router)
  // For this example, we'll keep the logic in App.jsx as discussed.
  if (isGameInitialized && !gameOver) {
    // This part should ideally be handled by the parent App.jsx / MainGameRouter
    // but for demonstration if you want Lobby to directly control it:
    // return <GameBoard initialLevel={selectedLevelToPlay} />; // Pass initial level
    // Instead, Lobby just sets `selectedLevelToPlay` and the parent handles the switch.
  }

  //   //if a level is selected, render the gameboard
  //   if (selectedLevel != null) {
  //     //TODO
  //     return <GameBoard selectedCard={null} />;
  //   }

  //otherwise render the Lobby Ui
  return (
    <div className="lobby-container">
      <h1>Welcome to Lobby!</h1>

      {/* Player Resources */}
      <div className="player-resources-bar">
        <span>
          Gold: <strong>{playerResources.gold}</strong>
        </span>
        <span>
          Energy:{" "}
          <strong>
            {playerResources.lobbyEnergy} / {playerResources.maxLobbyEnergy}
          </strong>
          {playerResources.lobbyEnergy < playerResources.maxLobbyEnergy && (
            <span> (Next in: {timeToNextEnergy()})</span>
          )}
        </span>
      </div>

      <hr />

      {/* Game Map Area */}
      <div className="game-map-area">
        <svg viewBox="0 0 800 600" className="game-map-svg">
          {/* Dashed lines connecting levels */}
          {connectionsData.map((conn, index) => {
            const fromLevel = levelsMapData.find(
              (level) => (level.id = conn.from)
            );
            const toLevel = levelsMapData.find((level) => (level.id = conn.to));
            if (!fromLevel || !toLevel) return null; //safety check here

            //determine if the connection is active (uncloock)
            const isConnectionActive =
              playerResources.unlockedLevels.includes(fromLevel.id) &&
              playerResources.unlockedLevels.includes(toLevel.id);

            return (
              <path
                key={`conn-${conn.from}-${conn.to}`}
                d={conn.path}
                className={`map-path ${
                  isConnectionActive ? "active-path" : "locked-path"
                }`}
                strokeDasharray="10 10" // Creates the dashed effect
                fill="none"
              />
            );
          })}

          {/* Treasure Chests */}
          {chestsData.map((chest) => {
            <image
              key={chest.id}
              href={chest.imageUrl}
              x={chest.x - 25} //adjust x y to center image assume (50x50 image)
              y={chest.y - 25}
              width="50"
              height="50"
              className="treasure-chest"
              // Add onClick or styling for when chest is collectible
            />;
          })}

          {/* Level Nodes */}
          {levelsMapData.map((level) => {
            const isUnlocked = playerResources.unlockedLevels.includes(
              level.id
            );
            const isCurrentLevel = selectedLevel === level.id; //for visual feedback if select

            return (
              <g
                key={`level-${level.id}`}
                className={`level-node-group ${
                  isUnlocked ? "unlocked" : "locked"
                } ${isCurrentLevel ? "selected" : ""}`}
                transform={`translate(${level.x}, ${level.y})`}
                onClick={() => isUnlocked && handleLevelNodeClick(level.id)} //clickable if unlock
                style={{ cursor: isUnlocked ? "pointer" : "not-allowed" }}
              >
                {/* Outer ellipse/circle for the level node */}
                <ellipse
                  cx="0"
                  cy="0"
                  rx="40"
                  ry="25"
                  className="level-shape-bg"
                />
                {/* Inner circle/shape for the level number */}
                <circle cx="0" cy="0" r="20" className="level-shape-inner" />
                {/* Level number text */}
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="level-number-text"
                >
                  {level.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default Lobby;
