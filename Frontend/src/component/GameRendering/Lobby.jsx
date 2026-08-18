// src/components/GameRendering/Lobby.jsx
import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import ResourceIcon from "./ResourceIcon"; // Correct path
import EnergyBar from "./EnergyBar"; // Correct path
import UpgradeModal from "./LobbyButton/UpgradeModal.jsx"; // Correct path
import SettingModal from "./LobbyButton/SettingModal.jsx";
import {
  levelsMapData,
  connectionsData,
  chestsData,
  mapSettings,
  getLevelStatus,
  nextPlayableLevelId,
  zoneConfigs
} from "./MapLayout"; // New: Import map data from MapData.js
import "../../style/Lobby.css"; // Correct path
import "../../style/UpgradeModal.css"; // Correct path (if UpgradeModal.css is used by Lobby too)
import CardSelectionModal from "./CardSelectionModal";
import CloseChest from "../../Icons/CloseChest.png";
import OpenChest from "../../Icons/OpenChest.png";

/** Distant hills. Fills the upper third, which was dead space before. */
const RIDGE_FAR = 'M0,150 L60,110 L120,135 L190,80 L260,120 L330,70 L400,115 L470,85 L540,125 L600,100 L600,200 L0,200Z';
/** Nearer hills, drawn over RIDGE_FAR so the two read as depth. */
const RIDGE_NEAR = 'M0,175 L80,145 L160,168 L240,130 L320,160 L410,125 L500,158 L600,138 L600,200 L0,200Z';
/** Foreground lip. Frames the bottom; nearest, so darkest. */
const FOREGROUND = 'M0,55 Q70,28 150,48 T310,40 T470,52 T600,35 L600,100 L0,100Z';

/**
 * Zones that actually carry ground, in the order the campaign progresses.
 * `endless` is the portal at the far end, not a region - it renders no band,
 * matching its historical absence (see the comment at the zone-backdrop map
 * below).
 */
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((zone) => zone !== "endless");

/**
 * Equal-width vertical bands across the map's full width, one per terrain
 * zone, left to right. Node positions (`levelsMapData`) weave a serpentine
 * path across these bands rather than sitting neatly inside them - the bands
 * give the ground its progression, the path is free to swing through it, the
 * same relationship the approved mockup uses between its flex regions and its
 * route line.
 */
function zoneBounds(zone) {
  const index = TERRAIN_ZONES.indexOf(zone);
  if (index === -1) return { display: "none" };
  const bandWidth = mapSettings.mapWidth / TERRAIN_ZONES.length;
  return {
    left: `${index * bandWidth}px`,
    width: `${bandWidth}px`,
  };
}

const Lobby = () => {
  const {
    gameState,
    playerData,
    startLevel,
    openUpgradeModal,
    openAchievements,
    openCollection,
    openSettings,
    handleLogout,
    collectTreasure,
      unlockedDefender,
      setUnlockedDefender,
  } = useGame();
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [mapZoom, _setMapZoom] = useState(mapSettings.defaultZoom);
 // const [showEndlessOptions, setShowEndlessOptions] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [defenderNotification, setDefenderNotification] = useState(null)
  const [notificationFading, setNotificationFading] = useState(false)

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null); // Ref for the inner game-map div

  // Drag-to-pan state. A plain ref, not useState: every pointer move during a
  // drag would otherwise trigger a re-render, and nothing here needs to be
  // read back through render - onPointerMove writes scrollLeft on the DOM
  // node directly. `moved` is the trap this interaction always has: without
  // it, releasing a drag over a level node or chest fires that element's
  // onClick (launching a level, or calling the real collectTreasure backend
  // call) as if the player had clicked it standing still. Once a drag moves
  // the pointer past DRAG_THRESHOLD_PX, `moved` stays true for the rest of
  // that gesture, and every onClick below checks it first and bails instead
  // of acting - a pan can never launch a level or collect a chest.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const DRAG_THRESHOLD_PX = 5;

  const onMapPointerDown = (e) => {
    const viewport = mapContainerRef.current;
    if (!viewport) return;
    drag.current = { active: true, startX: e.clientX, startScroll: viewport.scrollLeft, moved: false };
    viewport.setPointerCapture?.(e.pointerId);
  };

  const onMapPointerMove = (e) => {
    const viewport = mapContainerRef.current;
    if (!viewport || !drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) drag.current.moved = true;
    viewport.scrollLeft = drag.current.startScroll - delta;
  };

  const onMapPointerUp = (e) => {
    const viewport = mapContainerRef.current;
    if (viewport?.hasPointerCapture?.(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
    drag.current.active = false;
  };

  // A drag must never fire the click it ends on top of. Wraps a click
  // handler so it is a no-op for the one click that follows a drag past
  // DRAG_THRESHOLD_PX - used on both level/portal nodes (which launch a
  // level) and chests (which call the real collectTreasure backend call).
  const guardClick = (fn) => () => {
    if (drag.current.moved) return;
    fn();
  };

  // The level the map should open (and re-open) on. Computed every render -
  // it's a cheap scan over ~21 nodes - but deliberately NOT what the effect
  // below keys on: playerData is a fresh object reference on most context
  // updates (14 setPlayerData call sites, including energy regenerating on a
  // timer), and keying on the object would re-centre the viewport on every
  // one of those, snapping the map back mid-pan for reasons that have
  // nothing to do with level progress. Keying on the id itself means the
  // effect only re-runs when the next playable level genuinely changes
  // (finishing one) or zoom changes.
  // Guarded: this now runs on every render (not deferred inside an effect
  // like before), and playerData is undefined/incomplete during the initial
  // load - the same case the early loading-screen return below already
  // handles. getLevelStatus reads playerData.unlockedLevels directly (no
  // top-level optional chaining on playerData itself), so an unguarded call
  // here would throw during render on that first pass, before the loading
  // check ever gets a chance to short-circuit anything.
  const nextLevelId = playerData ? nextPlayableLevelId(playerData) : null;

  // Open the map centred on the level the player can actually play next.
  // nextLevelId is null once everything unlocked is finished; levelsMapData[0]
  // (level 1) is the fallback so the player still sees a sensible view
  // instead of a blank corner of the map.
  useEffect(() => {
    const viewport = mapContainerRef.current;
    if (!viewport) return;
    const target = levelsMapData.find((level) => level.id === nextLevelId) ?? levelsMapData[0];
    if (!target) return;
    viewport.scrollLeft = target.x * mapZoom - viewport.clientWidth / 2;
  }, [nextLevelId, mapZoom]);

  useEffect(() => {
    if (unlockedDefender) {
      setDefenderNotification(unlockedDefender);
      setNotificationFading(false)

      //message fading out after 4 seconds
      const fadeTimer = setTimeout(() => {
        setNotificationFading(true)
      }, 4000);

      //remove message completely after 5 second
      const removeTimer = setTimeout(() => {
        setDefenderNotification(null);
        setUnlockedDefender(null);
      }, 5000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      }
    }
  }, [unlockedDefender, setUnlockedDefender]);

  // Handle treasure click
  const handleTreasureClick = (chestId) => {
    console.log(`Treasure chest ${chestId} clicked!`);
    collectTreasure(chestId); //backend call
  }

  // Handle level node click
  const handleLevelNodeClick = (levelId) => {
    // if (levelId === 999) {
    //   //handle endless mode
    //   setShowEndlessOptions(true);
    // } else {
      setSelectedLevelId(levelId);
      setShowCardSelection(true);
 //   }
  };

  const _handleEndlessStart = (difficulty) => {
    setSelectedDifficulty(difficulty);
   // setShowEndlessOptions(false);
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
            onClick={guardClick(() => !status.locked && handleLevelNodeClick(level.id))}
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
              <div className="lock-message">Complete Level 10 to Unlock</div>
          )}
        </div>
    );
  };

  const renderLevelNode = (level) => {
    const status = getLevelStatus(level.id, playerData);
    // Exactly one of these three - never zero, never two - so the node's
    // appearance always resolves to a single, unambiguous state.
    const stateClass = status.locked ? 'locked' : status.completed ? 'completed' : 'available';

    return (
        <div
            key={`level-${level.id}`}
            // No zone class here any more. A node used to also carry
            // `.{zone}-node` for a zone hue, but every node also carries a
            // state class (`.completed`/`.available`/`.locked`, specificity
            // 0-2-0), which structurally outranks a single-class zone rule
            // (0-1-0) for the same property regardless of source order - so
            // the zone hue could never actually paint. Rather than raise the
            // zone rule's specificity to compete with state (which would
            // put zone tint back in the running against the colour this
            // board depends on), the dead zone-node rules were removed:
            // zone identity now lives in the terrain the node sits on, not
            // in the node itself.
            className={`level-node ${stateClass} ${level.isBoss ? 'boss' : ''} ${level.isFinal ? 'final-level' : ''}`}
            // Position only. Colour comes from Lobby.css - `.level-node`
            // for the shared outline and `.level-node.locked`/`.completed`/
            // `.available` for state. An inline colour here would beat the
            // stylesheet, which is how a reviewed choice got silently
            // overridden before (see the state rules' history in
            // Lobby.css).
            style={{
              top: `${level.y}px`,
              left: `${level.x}px`,
            }}
            onClick={guardClick(() => !status.locked && handleLevelNodeClick(level.id))}
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
  if (gameState === "settings") return <SettingModal />;

  // Render Lobby UI
  return (
      <div className="lobby-container">

        {/* Defender unlock notification */}
        {defenderNotification && (
            <div className={`defender-notification ${notificationFading ? 'fade-out': ""}`}>
              <div className='notification-icon'>🎉</div>
              <div className="notification-content">
                <h3>New Defender Unlocked!</h3>
                <p className="defender-name">{defenderNotification}</p>
              </div>
            </div>
        )}

        {/* Top chrome: player identity, menu buttons, energy and resources
            used to be three stacked blocks eating roughly a third of the
            screen before the map began. They share one row now, in one
            band, so the map - the screen's actual subject - gets that
            height back. Wrapper only: none of the three blocks below have
            had their markup or class names changed. */}
        <div className="lobby-topband">
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
              {/*
                These two buttons carried the same `icon-setting` glyph, with
                the destructive one (log out, ending the session) sitting
                immediately left of the benign one. Icons are the only thing a
                player scanning this bar reads; two identical ones made ending
                the session a coin flip. The button *classes* are left alone -
                `settings` on the logout button is a pre-existing mislabel, and
                renaming it would touch Lobby.css for no visual gain - but the
                icons are now distinct in both directions: the gear belongs to
                Settings, and logout says logout.

                Note for whoever adds the artwork: no stylesheet in this repo
                defines `icon-*` yet, so every one of these <i> elements is
                currently empty and nothing is drawn. The duplication was
                therefore latent rather than on screen - but it is the markup a
                real icon set will be hung on, and it had the wrong name on it.
              */}
              <button className="menu-button settings" onClick={handleLogout}>
                <i className="icon-logout" />
                <span>Logout</span>
              </button>
              <button className="menu-button open-settings" onClick={openSettings}>
                <i className="icon-gear" />
                <span>Settings</span>
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
        </div>

        {/* Game Map. Panning is native scrolling (scrollLeft), driven either
            by the browser directly or by the pointer handlers below - there
            is no JS-computed boundary to keep in sync with it any more. */}
        <div
            className="game-map-container"
            onPointerDown={onMapPointerDown}
            onPointerMove={onMapPointerMove}
            onPointerUp={onMapPointerUp}
            onPointerCancel={onMapPointerUp}
            ref={mapContainerRef}
        >
          <div
              className="game-map"
              ref={mapRef}
              style={{
                width: `${mapSettings.mapWidth * mapZoom}px`,
                height: `${mapSettings.mapHeight * mapZoom}px`,
              }}
          >
            {/* Zone backgrounds */}
            {/*
              No inline colour at all - `zoneBounds` only ever returns
              position (left/width, or `display: none` for the endless
              portal), never a colour property, so it can't reintroduce the
              override mechanism the comment below describes. Each backdrop's
              wash is `.zone-<key>` in Lobby.css. This previously compared
              `config.backgroundColor` against the sentinel string
              '#rainbow-gradient' and, on a match, wrote a seven-hex gradient
              inline - a second copy of the rainbow that no guard read and
              that could not be retuned from the token layer. `.zone-endless`
              deliberately has no rule and no bounds: it never had a box, so
              that div has always rendered nothing.

              Each region also carries a ridgeline (two SVG passes, far and
              near) filling the upper third, and a foreground band framing
              the bottom - the exact top-and-bottom dead space the owner
              flagged on the first mockup. Both are inline SVG, not raster
              images, so their fills take token colours via `var()`.
            */}
            {Object.keys(zoneConfigs).map((zone) => (
                <div
                    key={`zone-${zone}`}
                    className={`zone-background zone-${zone}`}
                    style={zoneBounds(zone)}
                >
                  <svg className="zone-ridge" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
                    <path d={RIDGE_FAR} fill="var(--terrain-ridge-far)" />
                    <path d={RIDGE_NEAR} fill="var(--terrain-ridge-near)" />
                  </svg>
                  <svg className="zone-fore" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d={FOREGROUND} fill="var(--terrain-foreground)" />
                  </svg>
                </div>
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
                      className={`treasure-chest map-chest ${isCollected ? "collected" : ""} ${
                          !canCollect ? "locked-chest" : ""
                      } ${chest.hidden ? "secret-chest" : ""}`}
                      style={{ top: `${chest.y}px`, left: `${chest.x}px` }}
                      onClick={guardClick(() => !isCollected && canCollect && handleTreasureClick(chest.id))}
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