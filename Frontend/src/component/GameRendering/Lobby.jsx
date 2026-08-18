// src/components/GameRendering/Lobby.jsx
import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import ResourceIcon from "./ResourceIcon"; // Correct path
import {
  RIDGE_HEIGHT,
  FOREGROUND_HEIGHT,
  ridgeFarPath,
  ridgeNearPath,
  foregroundPath,
} from "./terrainSilhouette.js";
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
  zoneConfigs,
  zoneSpans
} from "./MapLayout"; // New: Import map data from MapData.js
import { TerrainProp, propsForZone } from "./TerrainProps.jsx";
import "../../style/Lobby.css"; // Correct path
import "../../style/UpgradeModal.css"; // Correct path (if UpgradeModal.css is used by Lobby too)
import CardSelectionModal from "./CardSelectionModal";
import CloseChest from "../../Icons/CloseChest.png";
import OpenChest from "../../Icons/OpenChest.png";

/** Distant hills. Fills the upper third, which was dead space before. */



/**
 * A region's band, sized in MapLayout to cover exactly the levels assigned to
 * it (`zoneSpans`), so a level always stands on its own zone's ground.
 *
 * This used to divide `mapSettings.mapWidth` into equal bands in
 * `zoneConfigs` key order and left the route free to "weave" across them.
 * That is how the terrain came to escalate backwards: with the route folded,
 * levels 13-20 ran right to left back through regions the outbound leg had
 * already climbed, so the ground under a level had no particular relationship
 * to the level's own zone. Equal bands happen to be close to correct now that
 * the route is unfolded, which is exactly why the span is derived from the
 * levels instead - "close to correct by coincidence" is the state this map has
 * already shipped in twice.
 *
 * Returns `display: none` for anything with no span, which is the endless
 * portal: it is the far end of the route, not a region, and `.zone-endless`
 * has never had a rule to paint.
 */
function zoneBounds(zone) {
  const span = zoneSpans[zone];
  if (!span) return { display: "none" };
  return {
    left: `${span.left}px`,
    width: `${span.width}px`,
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
    chestReward,
    setChestReward,
  } = useGame();
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [mapZoom, _setMapZoom] = useState(mapSettings.defaultZoom);
 // const [showEndlessOptions, setShowEndlessOptions] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [rewardNotice, setRewardNotice] = useState(null)
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
    // Deliberately NOT capturing the pointer here. Capturing on pointerdown
    // retargets every later pointer event - including pointerup - to the
    // viewport, and the browser then dispatches `click` against the capture
    // target rather than the element under the cursor. The effect was that no
    // level node and no chest could ever be clicked: their onClick never ran,
    // because from the DOM's point of view the click happened on the map. See
    // the capture in onMapPointerMove, which only fires once this is a drag.
    drag.current = { active: true, startX: e.clientX, startScroll: viewport.scrollLeft, moved: false };
  };

  const onMapPointerMove = (e) => {
    const viewport = mapContainerRef.current;
    if (!viewport || !drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX && !drag.current.moved) {
      drag.current.moved = true;
      // Now that this is unambiguously a drag rather than a click, take the
      // pointer so panning survives the cursor leaving the map. A click never
      // reaches this branch, so a click is never retargeted.
      viewport.setPointerCapture?.(e.pointerId);
    }
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

    /*
     * Vertically too, when the frame is shorter than the terrain.
     *
     * On a phone the frame is around 590px and the terrain is 720, so `scrollTop`
     * staying at 0 opened the map on the empty upper third: the route runs from
     * y 168 to y 612 and level 1 sits at y 600, entirely below the fold. The
     * player's first sight of the campaign was sky. Harmless on a desktop, where
     * the frame already fits the terrain and this clamps to 0.
     */
    const overflowY = viewport.scrollHeight - viewport.clientHeight;
    if (overflowY > 0) {
      const wanted = target.y * mapZoom - viewport.clientHeight / 2;
      viewport.scrollTop = Math.max(0, Math.min(overflowY, wanted));
    }
  }, [nextLevelId, mapZoom]);

  /**
   * What the reward panel shows, derived from the chest the player just opened.
   *
   * `defenders` is always a list: three of the six landmark chests unlock more
   * than one, and rendering an array straight into JSX printed "SniperIce Bomb"
   * with no separator. A bare string is still accepted, because nothing stops a
   * future caller sending one.
   *
   * `resources` is the part that was missing entirely - the old notification
   * mentioned defenders only, so opening a chest carrying 2000 gold announced
   * nothing whatsoever.
   */
  const noticeResources = Object.entries(rewardNotice?.resources ?? {})
      .filter(([, amount]) => amount > 0);
  const noticeDefenders = (() => {
    const raw = rewardNotice?.defenders;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  })();
  const hasNotice = noticeResources.length > 0 || noticeDefenders.length > 0;

  useEffect(() => {
    if (!chestReward) return;
    setRewardNotice(chestReward);
    setNotificationFading(false);

    // Fades at 4s, gone at 5s. A defender unlock gets longer than a handful of
    // gold, because there is more to read and it is the rarer event.
    const holdMs = (chestReward.defenders?.length ?? 0) > 0 ? 5200 : 3600;
    const fadeTimer = setTimeout(() => setNotificationFading(true), holdMs);
    const removeTimer = setTimeout(() => {
      setRewardNotice(null);
      setChestReward(null);
    }, holdMs + 1000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [chestReward, setChestReward]);

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

        {/* What the chest actually gave you. Resources and defenders together:
            listing only defenders meant most chests opened in silence. */}
        {hasNotice && (
            <div className={`reward-notification ${notificationFading ? 'fade-out' : ''}`} role="status">
              <div className="notification-icon">🎉</div>
              <div className="notification-content">
                <h3>Chest opened</h3>
                {noticeResources.length > 0 && (
                    <ul className="reward-resources">
                      {noticeResources.map(([type, amount]) => (
                          <li key={type} className="reward-resource">
                            <ResourceIcon type={type} value={`+${amount}`} />
                          </li>
                      ))}
                    </ul>
                )}
                {noticeDefenders.length > 0 && (
                    <p className="reward-defenders">
                      <span className="reward-defenders-label">
                        New defender{noticeDefenders.length > 1 ? 's' : ''}
                      </span>
                      <span className="defender-name">{noticeDefenders.join(', ')}</span>
                    </p>
                )}
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
                  {zoneConfigs[zone]?.label && (
                      <span className="zone-label">{zoneConfigs[zone].label}</span>
                  )}
                  <svg
                      className="zone-ridge"
                      viewBox={`0 0 ${zoneSpans[zone]?.width ?? 600} ${RIDGE_HEIGHT}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                  >
                    <path
                        d={ridgeFarPath(zoneSpans[zone]?.left ?? 0, zoneSpans[zone]?.width ?? 600)}
                        fill="var(--terrain-ridge-far)"
                    />
                    <path
                        d={ridgeNearPath(zoneSpans[zone]?.left ?? 0, zoneSpans[zone]?.width ?? 600)}
                        fill="var(--terrain-ridge-near)"
                    />
                  </svg>
                  <svg
                      className="zone-fore"
                      viewBox={`0 0 ${zoneSpans[zone]?.width ?? 600} ${FOREGROUND_HEIGHT}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                  >
                    <path
                        d={foregroundPath(zoneSpans[zone]?.left ?? 0, zoneSpans[zone]?.width ?? 600)}
                        fill="var(--terrain-foreground)"
                    />
                  </svg>
                  {/* Mid-ground scenery. Count, kind, row and offsets all
                      come from `propsForZone` (TerrainProps.jsx), which is
                      given this region's own width so a wide region gets
                      proportionally more scenery instead of the same two or
                      three props stretched further apart. Deterministic, not
                      random - a prop that moves on every render is
                      distracting, and a test cannot pin a random position.
                      Every row sits above `.zone-fore`'s bottom-22% band
                      (FOREGROUND_BAND_TOP, asserted per emitted prop in
                      TerrainProps.test.jsx), so nothing is painted over. */}
                  {propsForZone(zone, zoneSpans[zone]?.width).map((prop) => (
                      <TerrainProp
                          key={prop.key}
                          kind={prop.kind}
                          className={prop.row === 'near' ? 'prop-near' : 'prop-far'}
                          style={{
                            left: `${prop.left}%`,
                            bottom: `${prop.bottom}%`,
                          }}
                      />
                  ))}
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
                        /* `conn.x`/`conn.y` are the segment's MIDPOINT, so the
                           bar has to be centred on that point - hence
                           translate(-50%, -50%) and a centre transform-origin.
                           Anchoring the bar's left edge there instead (which is
                           what `transform-origin: left center` and a bare
                           rotate did) started every segment half-way along its
                           own route and ran it a full length past the target
                           node. It was invisible only because the bar was 3px
                           tall at opacity 0.3. */
                        transform: `translate(-50%, -50%) rotate(${conn.rotation}deg)`,
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
                        <img src={OpenChest} alt="Open Chest" className="open-chest" draggable={false} />
                    ) : (
                         <img src={CloseChest} alt="Close Chest" className="close-chest" draggable={false} />
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