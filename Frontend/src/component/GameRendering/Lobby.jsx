// src/components/GameRendering/Lobby.jsx
import React, { useRef, useEffect, useState, use } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import ResourceIcon from "./ResourceIcon"; // Correct path
import EnergyBar from "./EnergyBar"; // Correct path
import UpgradeModal from "./UpgradeModal"; // Correct path
import { levelsMapData, connectionsData, chestsData } from "./MapLayout"; // New: Import map data from MapData.js
import "../../style/Lobby.css"; // Correct path
import "../../style/UpgradeModal.css"; // Correct path (if UpgradeModal.css is used by Lobby too)
import WorkerStatus from "../common/WorkerStatus";
import CardSelectionModal from "./CardSelectionModal";
import CloseChest from "../../Icons/CloseChest.png";
import OpenChest from "../../Icons/OpenChest.png";


const Lobby = () => {
  const {
    gameState,
    playerData,
    startLevel,
    openUpgradeModal,
    openAchievements,
    openCollection,
    openSettings
  } = useGame();
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [showCardSelection, setShowCardSelection] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);

  const [mapBoundaries, setMapBoundaries] = useState({
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  });
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null); // Ref for the inner game-map div

  // Calculate map boundaries based on container and map size
  useEffect(() => {
    const calculateBoundaries = () => {
      if (!mapContainerRef.current || !mapRef.current) return;

      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const mapRect = mapRef.current.getBoundingClientRect();

      setMapBoundaries({
        minX: -(mapRect.width - containerRect.width),
        minY: -(mapRect.height - containerRect.height),
        maxX: 0,
        maxY: 0,
      });
    };

    calculateBoundaries();
    window.addEventListener("resize", calculateBoundaries);

    return () => window.removeEventListener("resize", calculateBoundaries);
  }, []);

  // Handle Map dragging (mouse events)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - mapPosition.x,
      y: e.clientY - mapPosition.y,
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      setMapPosition({
        x: Math.max(mapBoundaries.minX, Math.min(mapBoundaries.maxX, newX)),
        y: Math.max(mapBoundaries.minY, Math.min(mapBoundaries.maxY, newY)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch screen for mobile user
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - mapPosition.x,
        y: e.touches[0].clientY - mapPosition.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;

      setMapPosition({
        x: Math.max(mapBoundaries.minX, Math.min(mapBoundaries.maxX, newX)),
        y: Math.max(mapBoundaries.minY, Math.min(mapBoundaries.maxY, newY)),
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Handle treasure click
  const handleTreasureClick = (chestId) => {
    console.log(`Treasure chest ${chestId} clicked!`);
    // Backend API: await fetch(`/api/collect-treasure/${chestId}`)
    // Update player data with new resources
    // This would involve calling a function from GameContext to update player data
    // Example: updateResource('gold', 100); or a dedicated collectTreasure function
  };

  // Handle level node click
  const handleLevelNodeClick = (levelId) => {
    // startLevel will handle energy check and state transition
    //startLevel(levelId); // GameBoard will be rendered by App.jsx\
    console.log("Level clicked:", levelId);
    console.log("Setting selectedLevelId to:", levelId);
    console.log("Setting showCardSelection to true");

    setSelectedLevelId(levelId);
    setShowCardSelection(true);
  };

  const handleCardSelectionConfirm = (selectedCards) => {
    setShowCardSelection(false);
    startLevel(selectedLevelId, selectedCards);
  };

  const handleCardSelectionCancel = () => {
    setShowCardSelection(false);
    setSelectedLevelId(null);
  };

  if (!playerData) return <div>Loading...</div>;

  // Render UpgradeModal if gameState is "upgrade"
  if (gameState === "upgrade") return <UpgradeModal />;

  console.log("Current showCardSelection state:", showCardSelection);
  console.log("Current selectedLevelId:", selectedLevelId);

  // Render Lobby UI
  return (
    <div className="lobby-container">
      {/* Top menu bar */}
      <div className="top-menu-bar">
        <div className="player-info">
          <div className="player-name">{playerData.name}</div>
          <div className="player-rank">{playerData.rank}</div>{" "}
        </div>

        <div className="menu-buttons">
          <button className="menu-button collection" onClick={openCollection}>
            <i className="icon-collection" />
            <span>Collection</span>
          </button>
          <button className="menu-button achievement" onClick={openAchievements}>
            <i className="icon-achievement" />
            <span>Achievement</span>
          </button>
          <button className="menu-button settings" onClick={openSettings}>
            <i className="icon-setting" />
            <span>Setting</span>
          </button>
        </div>
      </div>

      {/* Energy Bar */}
      {playerData.resources && (
        <EnergyBar
          current={playerData.resources.lobbyEnergy}
          max={playerData.resources.maxLobbyEnergy}
          rechargeRate={playerData.resources.energyRechargeRate}
          lastRechargeTime={playerData.resources.lastEnergyRechargeTime}
        />
      )}

      {/* Resources Bar */}
      <div className="resource-bar">
        <ResourceIcon type="gold" value={playerData.resources.gold} />
        <ResourceIcon type="workers" value={playerData.resources.workers} />
        <ResourceIcon type="iron" value={playerData.resources.iron} />
        <ResourceIcon type="grain" value={playerData.resources.grain} />
        <ResourceIcon type="water" value={playerData.resources.water} />
        <ResourceIcon type="gem" value={playerData.resources.gem} />
      </div>

      {/* Worker status */}
      <div className="worker-status-container">
        {playerData.workers.map((worker) => (
          <WorkerStatus key={worker.id} worker={worker} />
        ))}
      </div>

      {/* Game Map */}
      <div
        className="game-map-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Important for dragging out of container
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd} // Corrected: handleMouseUp -> handleTouchEnd
        ref={mapContainerRef}
      >
        <div
          className="game-map"
          ref={mapRef}
          style={{
            transform: `translate(${mapPosition.x}px, ${mapPosition.y}px)`,
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          {/* connection line */}
          {connectionsData.map((conn) => (
            <div
              key={`conn-${conn.from}-${conn.to}`}
              className="map-connection"
              style={{
                top: `${conn.y}px`,
                left: `${conn.x}px`,
                width: `${conn.length}px`,
                transform: `rotate(${conn.rotation}deg)`,
              }}
            />
          ))}

          {/* Treasure chests */}
          {chestsData.map((chest) => {
            const isCollected = playerData.collectedTreasures.includes(
              chest.id
            );
            // Check if chest is unlockable (e.g., previous level is unlocked)
            const canCollect = playerData.unlockedLevels.includes(
              chest.requiresLevel
            );

            return (
              <div
                key={`chest-${chest.id}`}
                className={`treasure-chest ${isCollected ? "collected" : ""} ${
                  !canCollect ? "locked-chest" : ""
                }`}
                style={{ top: `${chest.y}px`, left: `${chest.x}px` }}
                onClick={() =>
                  !isCollected && canCollect && handleTreasureClick(chest.id)
                }
              >
                {isCollected ? (
                  <img src={OpenChest} alt="Open Chest" className="open-chest"/>
                ) : (
                  <img src={CloseChest} alt="Close Chest" className="close-chest"/>
                )}
                {!isCollected && canCollect && <div className="chest-glow" />}
              </div>
            );
          })}

          {/* Level nodes */}
          {levelsMapData.map((level) => {
            const isUnlocked = playerData.unlockedLevels.includes(level.id);
            return (
              <div
                key={`level-${level.id}`}
                className={`level-node ${isUnlocked ? "unlocked" : "locked"}`}
                style={{ top: `${level.y}px`, left: `${level.x}px` }}
                onClick={() => isUnlocked && handleLevelNodeClick(level.id)}
              >
                <div className="level-number">{level.id} </div>
                {isUnlocked && <div className="level-pulse" />}
              </div>
            );
          })}

          {/* Boundary indicators for opposite sides (these are for visual feedback for dragging) */}
          {/* These are defined in CSS for .game-map-container::before/after and .boundary-right/.boundary-bottom */}
        </div>
      </div>

      {/* Upgrade button */}
      <button className="upgrade-button" onClick={openUpgradeModal}>
        <i className="icon-upgrade"></i> {/* Icon placeholder */}
        <span>Upgrade Cards</span>
      </button>

      {/* Showing the selection of cards before game start */}
      {showCardSelection && (
        <CardSelectionModal
          playerData={playerData}
          levelId={selectedLevelId}
          onConfirm={handleCardSelectionConfirm}
          onCancel={handleCardSelectionCancel}
        />
      )}
    </div>
  );
};

export default Lobby;
