// src/components/GameRendering/Lobby.jsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import ResourceIcon from "./ResourceIcon"; // Correct path
import EnergyBar from "./EnergyBar"; // Correct path
import UpgradeModal from "./LobbyButton/UpgradeModal.jsx"; // Correct path
import {
  levelsMapData,
  connectionsData,
  chestsData,
  mapSettings,
  getLevelStatus,
  zoneConfigs, endlessPortalConfig
} from "./MapLayout"; // New: Import map data from MapData.js
import "../../style/Lobby.css"; // Correct path
import "../../style/UpgradeModal.css"; // Correct path (if UpgradeModal.css is used by Lobby too)
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
    openSettings,
    setPlayerData,
  } = useGame();
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [mapZoom, setMapZoom] = useState(mapSettings.defaultZoom);
  const [showEndlessOptions, setShowEndlessOptions] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false); // Track if map is ready for interaction

  const [mapBoundaries, setMapBoundaries] = useState({
                                                       minX: 0,
                                                       minY: 0,
                                                       maxX: 0,
                                                       maxY: 0,
                                                     });
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null); // Ref for the inner game-map div

  // Calculate map boundaries with proper initialization check
  const calculateBoundaries = useCallback(() => {
    if (!mapContainerRef.current || !mapRef.current) {
      // Try again in a moment if refs aren't ready
      setTimeout(() => {
        if (mapContainerRef.current && mapRef.current) {
          calculateBoundaries();
        }
      }, 100);
      return;
    }

    const containerRect = mapContainerRef.current.getBoundingClientRect();
    const mapWidth = mapSettings.mapWidth * mapZoom;
    const mapHeight = mapSettings.mapHeight * mapZoom;

    // Calculate boundaries that allow dragging
    const newBoundaries = {
      minX: Math.min(0, -(mapWidth - containerRect.width)),
      minY: Math.min(0, -(mapHeight - containerRect.height)),
      maxX: 0,
      maxY: 0,
    };

    setMapBoundaries(newBoundaries);
    setIsMapReady(true); // Map is ready for interaction
  }, [mapZoom]);

  // Initial setup and recalculation on zoom change
  useEffect(() => {
    // Use a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      calculateBoundaries();
    }, 50);

    window.addEventListener("resize", calculateBoundaries);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculateBoundaries);
    };
  }, [calculateBoundaries, mapZoom]);

  // Force recalculation when component mounts
  useEffect(() => {
    // This ensures boundaries are calculated after the component is fully mounted
    requestAnimationFrame(() => {
      calculateBoundaries();
    });
  }, [calculateBoundaries]);

  //auto scroll to current progress
  useEffect(() => {
    if (mapSettings.autoCameraEnabled && playerData?.unlockedLevels && mapContainerRef.current && isMapReady) {
      const highestUnlockedLevel = Math.max(...playerData.unlockedLevels);
      const levelNode = levelsMapData.find(l => l.id === highestUnlockedLevel);

      if (levelNode) {
        const containerRect = mapContainerRef.current.getBoundingClientRect();
        const targetX = -(levelNode.x * mapZoom - containerRect.width / 2);
        const targetY = -(levelNode.y * mapZoom - containerRect.height / 2);

        // Clamp to boundaries
        const clampedX = Math.max(mapBoundaries.minX, Math.min(mapBoundaries.maxX, targetX));
        const clampedY = Math.max(mapBoundaries.minY, Math.min(mapBoundaries.maxY, targetY));

        //smooth scroll animation
        let animationFrame;
        const animationScroll = () => {
          setMapPosition(prev => {
            const newX = prev.x + (clampedX - prev.x) * 0.1;
            const newY = prev.y + (clampedY - prev.y) * 0.1;

            // Stop animation when close enough
            if (Math.abs(clampedX - newX) < 1 && Math.abs(clampedY - newY) < 1) {
              cancelAnimationFrame(animationFrame);
              return { x: clampedX, y: clampedY };
            }

            animationFrame = requestAnimationFrame(animationScroll);
            return { x: newX, y: newY };
          });
        };
        animationFrame = requestAnimationFrame(animationScroll);

        return () => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
        };
      }
    }
  }, [playerData?.unlockedLevels, mapZoom, mapBoundaries, isMapReady]);

  // Handle Map dragging (mouse events)
  const handleMouseDown = (e) => {
    if (!isMapReady) return; // Don't allow dragging if map isn't ready

    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    setDragStart({
                   x: e.clientX - mapPosition.x,
                   y: e.clientY - mapPosition.y,
                 });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isMapReady) return;

    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    setMapPosition({
                     x: Math.max(mapBoundaries.minX, Math.min(mapBoundaries.maxX, newX)),
                     y: Math.max(mapBoundaries.minY, Math.min(mapBoundaries.maxY, newY)),
                   });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch screen for mobile user
  const handleTouchStart = (e) => {
    if (!isMapReady) return; // Don't allow dragging if map isn't ready

    if (e.touches.length === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
                     x: e.touches[0].clientX - mapPosition.x,
                     y: e.touches[0].clientY - mapPosition.y,
                   });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isMapReady || e.touches.length !== 1) return;

    e.preventDefault();
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;

    setMapPosition({
                     x: Math.max(mapBoundaries.minX, Math.min(mapBoundaries.maxX, newX)),
                     y: Math.max(mapBoundaries.minY, Math.min(mapBoundaries.maxY, newY)),
                   });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta) => {
    const zoomIndex = mapSettings.zoomLevels.indexOf(mapZoom);
    const newIndex = Math.max(0, Math.min(mapSettings.zoomLevels.length - 1, zoomIndex + delta));
    setMapZoom(mapSettings.zoomLevels[newIndex]);
  }

  // Handle treasure click
  const handleTreasureClick = (chestId) => {
    console.log(`Treasure chest ${chestId} clicked!`);
    // Backend API: await fetch(`/api/collect-treasure/${chestId}`)
    // Update player data with new resources
    // This would involve calling a function from GameContext to update player data
    // Example: updateResource('gold', 100); or a dedicated collectTreasure function
    const chest = chestsData.find(c => c.id === chestId);
    if (!chest || !playerData ||!playerData.resources) {
      console.error("Cannot collect treasure: player data or resources not loaded");
      return;
    }
    //update resources safely
    setPlayerData(prev => {
      if (!prev || !prev.resources) return prev;

      const updateResources = {...prev.resources};
      const updateTreasures = [...(prev.collectedTreasures || [])];

      Object.entries(chest.rewards).forEach(([resource, amount]) => {
        if (resource === 'all') { // Fixed: = to ===
          // Add to all resources
          ['gold', 'iron', 'grain', 'water'].forEach(res => {
            if (updateResources[res] !== undefined) {
              updateResources[res] += amount;
            }
          });
        } else if (updateResources[resource] !== undefined) {
          updateResources[resource] += amount;
        }
      });

      if (!updateTreasures.includes(chestId)) {
        updateTreasures.push(chestId);
      }
      return {
        ...prev,
        resources: updateResources,
        collectedTreasures: updateTreasures
      }
    });
  }

  // Handle level node click
  const handleLevelNodeClick = (levelId) => {
    if (levelId === 999) {
      //handle endless mode
      setShowEndlessOptions(true);
    } else {
      setSelectedLevelId(levelId);
      setShowCardSelection(true);
    }
  };

  const handleEndlessStart = (difficulty) => {
    setSelectedDifficulty(difficulty);
    setShowEndlessOptions(false);
    setSelectedLevelId(999);
    setShowCardSelection(true);
  }

  const handleCardSelectionConfirm = (selectedCards) => {
    setShowCardSelection(false);

    // Pass difficulty modifier for endless mode
    const options = selectedLevelId === 999 && selectedDifficulty ?
        { difficultyModifier: selectedDifficulty } : {};

    startLevel(selectedLevelId, selectedCards, options);
    setSelectedDifficulty(null);
  };

  const handleCardSelectionCancel = () => {
    setShowCardSelection(false);
    setSelectedLevelId(null);
    setSelectedDifficulty(null);
  };

  const renderEndlessPortal = (level) => {
    const status = getLevelStatus(level.id, playerData);

    return (
        <div
            key={`level-${level.id}`}
            className={`endless-portal ${status.locked ? 'locked' : 'unlocked'}`}
            style={{ top: `${level.y}px`, left: `${level.x}px` }}
            onClick={() => !status.locked && handleLevelNodeClick(level.id)}
        >
          <div className="portal-animation">
            <div className="portal-ring ring-1"></div>
            <div className="portal-ring ring-2"></div>
            <div className="portal-ring ring-3"></div>
            <div className="portal-center">
              <span className="portal-label">ENDLESS</span>
              {status.highestWave > 0 && (
                  <span className="highest-wave">Best: Wave {status.highestWave}</span>
              )}
            </div>
          </div>
          {!status.locked && <div className="portal-glow" />}
          {status.locked && (
              <div className="lock-message">Complete Level 20 to Unlock</div>
          )}
        </div>
    );
  };

  const renderLevelNode = (level) => {
    const status = getLevelStatus(level.id, playerData);
    const zone = zoneConfigs[level.zone];

    return (
        <div
            key={`level-${level.id}`}
            className={`level-node ${zone.nodeClass} ${status.locked ? 'locked' : ''} ${
                status.completed ? 'completed' : ''
            } ${level.isBoss ? 'boss-level' : ''} ${level.isFinal ? 'final-level' : ''}`}
            style={{
              top: `${level.y}px`,
              left: `${level.x}px`,
              backgroundColor: status.locked ? '#444' : zone.backgroundColor,
              borderColor: zone.borderColor
            }}
            onClick={() => !status.locked && handleLevelNodeClick(level.id)}
            title={level.name}
        >
          <div className="level-number">{level.id}</div>
          {level.isBoss && <div className="boss-indicator">BOSS</div>}
          {status.completed && (
              <div className="stars">
                {[1, 2, 3].map(star => (
                    <span key={star} className={`star ${star <= status.stars ? 'earned' : ''}`}>★</span>
                ))}
              </div>
          )}
          {!status.locked && !status.completed && <div className="level-pulse" />}
          <div className="level-name">{level.name}</div>
        </div>
    );
  };

  if (!playerData || !playerData.resources) {
    return (
        <div className="lobby-container">
          <div className="loading-screen">
            <h2>Loading Game Data...</h2>
            <div className="loading-spinner"></div>
          </div>
        </div>
    );
  }
  if (gameState === "upgrade") return <UpgradeModal />;

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
          <ResourceIcon type="iron" value={playerData.resources.iron} />
          <ResourceIcon type="grain" value={playerData.resources.grain} />
          <ResourceIcon type="water" value={playerData.resources.water} />
          <ResourceIcon type="gem" value={playerData.resources.gem} />
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button onClick={() => handleZoom(-1)}>−</button>
          <span>{Math.round(mapZoom * 100)}%</span>
          <button onClick={() => handleZoom(1)}>+</button>
        </div>

        {/* Game Map */}
        <div
            className="game-map-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={mapContainerRef}
            style={{
              cursor: isDragging ? "grabbing" : (isMapReady ? "grab" : "default"),
              userSelect: "none" // Prevent text selection during drag
            }}
        >
          <div
              className="game-map"
              ref={mapRef}
              style={{
                transform: `translate(${mapPosition.x}px, ${mapPosition.y}px)`,
                transition: isDragging ? 'none' : undefined, // Smooth transitions when not dragging
              }}
          >
            {/* Zone backgrounds */}
            {Object.entries(zoneConfigs).map(([zone, config]) => (
                <div
                    key={`zone-${zone}`}
                    className={`zone-background zone-${zone}`}
                    style={{
                      background: config.backgroundColor === '#rainbow-gradient' ?
                                  'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)' :
                                  config.backgroundColor
                    }}
                />
            ))}

            {/* Connection lines */}
            {connectionsData.map((conn) => {
              const isUnlocked = playerData.completedLevels?.includes(conn.from);
              return (
                  <div
                      key={`conn-${conn.from}-${conn.to}`}
                      className={`map-connection ${isUnlocked ? 'unlocked' : ''} ${
                          conn.special === 'rainbow' ? 'rainbow-connection' : ''
                      }`}
                      style={{
                        top: `${conn.y}px`,
                        left: `${conn.x}px`,
                        width: `${conn.length}px`,
                        transform: `rotate(${conn.rotation}deg)`,
                      }}
                  />
              );
            })}

            {/* Treasure chests */}
            {chestsData.map((chest) => {
              const isCollected = playerData.collectedTreasures?.includes(chest.id);
              const canCollect = playerData.unlockedLevels?.includes(chest.requiresLevel);
              const isHidden = chest.hidden && !playerData.revealedSecrets?.includes(chest.id);

              if (isHidden) return null;

              return (
                  <div
                      key={`chest-${chest.id}`}
                      className={`treasure-chest ${isCollected ? "collected" : ""} ${
                          !canCollect ? "locked-chest" : ""
                      } ${chest.hidden ? "secret-chest" : ""}`}
                      style={{ top: `${chest.y}px`, left: `${chest.x}px` }}
                      onClick={() => !isCollected && canCollect && handleTreasureClick(chest.id)}
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
              if (level.isEndless) {
                return renderEndlessPortal(level);
              }
              return renderLevelNode(level);
            })}
          </div>
        </div>

        {/* Upgrade button */}
        <button className="upgrade-button" onClick={openUpgradeModal}>
          <i className="icon-upgrade"></i> {/* Icon placeholder */}
          <span>Upgrade Cards</span>
        </button>

        {/* Endless Mode Options Modal */}
        {showEndlessOptions && (
            <div className="modal-overlay">
              <div className="endless-options-modal">
                <h2>Select Endless Mode Difficulty</h2>
                <div className="difficulty-options">
                  <button
                      className="difficulty-option normal"
                      onClick={() => handleEndlessStart(null)}
                  >
                    <h3>Normal</h3>
                    <p>Standard endless experience</p>
                    <span className="multiplier">1.0x rewards</span>
                  </button>
                  {endlessPortalConfig.features.difficultyModifiers.map(mod => (
                      <button
                          key={mod.name}
                          className="difficulty-option challenge"
                          onClick={() => handleEndlessStart(mod)}
                      >
                        <h3>{mod.name}</h3>
                        <p>{mod.description}</p>
                        <span className="multiplier">{mod.multiplier}x rewards</span>
                      </button>
                  ))}
                </div>
                <button className="cancel-button" onClick={() => setShowEndlessOptions(false)}>
                  Cancel
                </button>
              </div>
            </div>
        )}

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