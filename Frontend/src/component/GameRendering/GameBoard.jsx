import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";
import Card from "../common/Card";
import { GameEngine } from "../GameLogic (MVC)/GameEngine";
import { calculateCardStats } from "../GameLogic (MVC)/DefenderClassUtils";
import Gold from "../../Icons/Gold.png";
import Iron from "../../Icons/Iron.png";
import { useMobileOrientation } from "./UseMobileOrientation.js";

const GameBoard = () => {
  const canvasRef = useRef(null);
  const {
    gameState,
    playerData,
    selectedLevel,
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    deployDefender,
    removeDefender,
    endGame,
    updateEnergyCb,
    updateScoreCb,
    onWinCb,
    onLoseCb,
    startLevel,
    selectedCardsForGame,
    setGameEngine,
    updateEndlessWave,
  } = useGame();

  const gameEngineRef = useRef(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [shovelMode, setShovelMode] = useState(false);

  const [cardSlots, setCardSlots] = useState([]);
  const [cardCooldown, setCardCooldown] = useState({});

  const [baseHealth, setBaseHealth] = useState(100);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [collectedPieces, setCollectedPieces] = useState([]);

  useMobileOrientation(gameState);

  // canvas sizing
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight - 60 - 250; // Account for top bar (60px) AND bottom bar (120)

        // Update game engine if exists
        if (gameEngineRef.current) {
          gameEngineRef.current.canvasWidth = container.clientWidth;
          gameEngineRef.current.canvasHeight = container.clientHeight - 60 - 250; // Account for both bars
          gameEngineRef.current.defenseLineX = container.clientWidth * 0.9;
        }
      }
    };

    // Initial resize
    resizeCanvas();
    // Add resize listener
    window.addEventListener("resize", resizeCanvas);
    // Cleanup
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Initialize card slots
  useEffect(() => {
    if (selectedCardsForGame?.length > 0) {
      const cardsWithStats = selectedCardsForGame
        .map(calculateCardStats)
        .filter(Boolean);
      setCardSlots(cardsWithStats);

      //initialize cooldown (all the start will be start ready)
      const initialCooldown = {};
      cardsWithStats.forEach((card) => {
        initialCooldown[card.id] = 0;
      });
      setCardCooldown(initialCooldown);
    } else if (playerData?.cards?.length > 0) {
      const cardsWithStats = playerData.cards
        .map(calculateCardStats)
        .filter(Boolean);
      setCardSlots(cardsWithStats);

      const initialCooldown = {};
      cardsWithStats.forEach((card) => {
        initialCooldown[card.id] = 0;
      });
      setCardCooldown(initialCooldown);
    }
  }, [selectedCardsForGame, playerData]);

  //update cooldowns
  useEffect(() => {
    const cooldownInterval = setInterval(() => {
      setCardCooldown((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cardId) => {
          if (updated[cardId] > 0) {
            updated[cardId] = Math.max(0, updated[cardId] - 100); //deacrease by 100ms
          }
        });
        return updated;
      });
    }, 100);
    return () => clearInterval(cooldownInterval);
  }, []);

  // Initialize game engine
  useEffect(() => {
    if (gameState === "inGame" && canvasRef.current && selectedLevel !== null) {
      // Use a flag to prevent double initialization
      let isCancelled = false;

      // Small delay to let React's double-render complete
      const initTimeout = setTimeout(() => {
        if (isCancelled) return;

        // Clean up any existing engine
        if (gameEngineRef.current) {
          gameEngineRef.current.stopLoop();
          gameEngineRef.current.cleanup();
          gameEngineRef.current = null;
        }

        // Create new game engine
        const engine = new GameEngine(
            updateEnergyCb,
            updateScoreCb,
            onWinCb,
            onLoseCb,
            (health) => setBaseHealth(health),
            updateEndlessWave
        );

        //set card pieces collection callback
        engine.onCardPieceCollected = (cardName) => {
          setCollectedPieces(prev => [...prev, cardName]);
        }

        gameEngineRef.current = engine;
        setGameEngine(engine);

        // Initialize game
        gameEngineRef.current.initialize(
            canvasRef.current,
            canvasRef.current.width,
            canvasRef.current.height,
            selectedLevel
        );

        // Start game loop
        gameEngineRef.current.startLoop();

        setSelectedCard(null);
        setShovelMode(false); //reset shovel mode on new game
      }, 50); // 50ms delay

      // Cleanup
      return () => {
        isCancelled = true;
        clearTimeout(initTimeout);

        if (gameEngineRef.current) {
          gameEngineRef.current.stopLoop();
          gameEngineRef.current.cleanup();
          if (window.gameEngineInstance === gameEngineRef.current) {
            window.gameEngineInstance = null;
          }
          gameEngineRef.current = null;
        }
      };
    }
  }, [gameState, selectedLevel, resetTrigger, updateEnergyCb, updateScoreCb, onWinCb, onLoseCb, updateEndlessWave]);

  const handleCardSelection = (card) => {
    //check if a card is on cooldown
    if (cardCooldown[card.id] > 0 || inGameEnergy < card.cost) return;
    //disable shovel when seleting card
    setShovelMode(false);

    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleShovelToggle = () => {
    setShovelMode(!shovelMode);
    setSelectedCard(null);
  }

  const handleCanvasClick = (event) => {
    console.log("Canvas Click");
    if (gameOver || !gameEngineRef.current) {
      console.log(("Gme"))
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    //try to remove defender if shovelmode active
    if (shovelMode) {
      const removed = removeDefender(x, y);
      setShovelMode(false);
      if (removed) {
        console.log("Defender removed successfully");
        //Can add refund mechanism here
      }
      return;
    }

    //try to collect energy first when overlap
    if (gameEngineRef.current.collectEnergy(x, y)) {
      console.log("Energy collection successful");
      return;
    }

    if (gameEngineRef.current.collectCardPieces(x, y)) {
      console.log("CardPiece collection successful");
      return;
    }

    console.log(`Click at: (${x}, ${y})`);
    console.log(`Energy drops in game engine: ${gameEngineRef.current.energyDrops.length}`);


    gameEngineRef.current.energyDrops.forEach((drop, i) => {
      console.log(`Drop ${i}: position (${drop.x}, ${drop.y}), floatOffset: ${drop.floatOffset}`);
    });

    //if selected a card and no energy to collect, then deploy
    if (selectedCard) {
      if (gameEngineRef.current.deployDefenderUnit(selectedCard, x, y)) {
        //handleCardDeployment();
        const cooldownDuration = getCooldownDuration(selectedCard);
        setCardCooldown((prev) => ({
          ...prev,
          [selectedCard.id]: cooldownDuration,
        }));
        setSelectedCard(null);
      }
    }
  };

  //get the cooldown duration for a card type
  const getCooldownDuration = (card) => {
    const cooldowns = {
      "Basic Cop": 5000, //5 second
      "Healer Cop": 8000,
      "Grenadier": 10000,
      "Barricade": 1000,
      "Energy Generator": 5000,
      "Sniper": 1000,
      "Frost Archer": 1000,
      "Fire Blast": 1000,
    };
    return cooldowns[card.name] || 5000; //default at 5 seconds
  };

  const handleQuitClick = () => {
    //pause the game
    if (gameEngineRef.current) {
      gameEngineRef.current.pauseGame();
    }
    setShowQuitDialog(true);
  };

  const handleQuitConfirm = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.stopLoop(); // Stop the game loop first
      gameEngineRef.current.gameOver = true; // Mark as game over
      gameEngineRef.current.gameWon = false; // Mark as loss
    }
    setShowQuitDialog(false);
    endGame("quit"); // Use "quit" instead of "loss"
  };

  const handleQuitCancel = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.resumeGame();
    }
    setShowQuitDialog(false);
  };

  // Render game over screen
  if (gameOver) {
   // console.log("Rendering game over screen");

    const goldLoss = gameWon ? 0 : 50;
    const ironLoss = gameWon ? 0 : 10;
    const grainLoss = gameWon ? 0 : 10;
    const waterLoss = gameWon ? 0 : 50;
    const gemLoss = gameWon ? 0 : Math.ceil(Math.random());
    const goldEarned = Math.floor(inGameScore * 0.3);
    const ironEarned = Math.floor(inGameScore * 0.1);
    const grainEarned = Math.floor(inGameScore * 0.2);
    const waterEarned = Math.floor(inGameScore * 0.2);

    return (
      <div className="game-over-screen">
        <h2>{gameWon ? "MISSION ACCOMPLISHED!" : "MISSION FAILED!"}</h2>
        <div className="result-details">
          <div className="score-section">
            <p>
              Final Score: <span className="score-value">{inGameScore}</span>
            </p>
            <p>
              Level: <span className="level-value">{selectedLevel}</span>
            </p>
          </div>

          <div className="rewards-section">
            <h3>{gameWon ? "Rewards Earned:" : "Resources Lost:"}</h3>
            {gameWon ? (
              <>
                <div className="resource-line">
                  <span className="resource-icon">
                    <img src={Gold} alt="💰" className="resource-image" />
                  </span>
                  <span className="resource-text">Gold + {goldEarned}</span>
                </div>
                <div className="resource-line">
                  <span className="resource-icon">
                    <img src={Iron} alt="⛓️" className="resource-image" />
                  </span>
                  <span className="resource-text">Iron + {ironEarned}</span>
                </div>
                <div className="resource-line">
                  <span className="resource-icon">🌾</span>
                  <span className="resource-text">Grain + {grainEarned}</span>
                </div>
                <div className="resource-line">
                  <span className="resource-icon">💧</span>
                  <span className="resource-text">Water + {waterEarned}</span>
                </div>

                {/*   Added card pieces section */}
                {collectedPieces.length > 0 && (
                    <div className="card-pieces-section">
                      <h4>Card Pieces Collected:</h4>
                      {Object.entries(
                          collectedPieces.reduce((acc, piece) => {
                            acc[piece] = (acc[piece] || 0) + 1;
                            return acc;
                          }, {})
                      ).map(([cardName, count]) => (
                          <div key={cardName} className="resource-line">
                            <span className="pieces-icon">⬟</span>
                            <span className="resource-text">
                          {cardName} x{count}
                        </span>
                          </div>
                      ))}
                    </div>
                )}
              </>
            ) : (
              <>
                <div className="resource-line loss">
                  <span className="resource-icon">
                    <img src={Gold} alt="💰" className="resource-image" />
                  </span>
                  <span className="resource-text">Gold -{goldLoss}</span>
                </div>
                <div className="resource-line loss">
                  <span className="resource-icon">
                    <img src={Iron} alt="⛓️" className="resource-image" />
                  </span>
                  <span className="resource-text">Iron -{ironLoss}</span>
                </div>
                <div className="resource-line loss">
                  <span className="resource-icon">🌾</span>
                  <span className="resource-text">Grain -{grainLoss}</span>
                </div>
                <div className="resource-line loss">
                  <span className="resource-icon">💧</span>
                  <span className="resource-text">Water -{waterLoss}</span>
                </div>

                {gemLoss > 0 && (
                  <div className="resource-line loss">
                    <span className="resource-icon">💎</span>
                    <span className="resource-text">Gem -{gemLoss}</span>
                  </div>
                )}
              </>
            )}
          </div>
          {!gameWon && (
            <div className="defeat-message">
              <p>The evil creatures reached your garden!</p>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button
            className="lobby-button"
            onClick={() => {
              if (collectedPieces.length > 0 && gameEngineRef.current) {
                // This should be handled by GameContext
                playerData.cards.forEach(card => {
                  const piecesForThisCard = collectedPieces.filter(
                      pieceName => pieceName === card.name
                  ).length;
                  if (piecesForThisCard > 0) {
                    card.pieces += piecesForThisCard;
                  }
                });
              }
              endGame(gameWon ? "win" : "loss")}}
          >
            RETURN TO LOBBY
          </button>

          <button
            className="replay-button"
            onClick={() => {
              endGame("replay");
              // Reset local states
              setBaseHealth(100);
              setSelectedCard(null);
              setShovelMode(false);

              // Reset cooldowns
              const resetCooldowns = {};
              cardSlots.forEach((card) => {
                resetCooldowns[card.id] = 0;
              });
              setCardCooldown(resetCooldowns);
              setCollectedPieces([]);

              // Force game engine reset
              setResetTrigger((prev) => prev + 1);

              setTimeout(() => {
                if (selectedLevel) {
                  startLevel(selectedLevel);
                }
              }, 100);
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
      <div className="game-board-container">
        {/* Top UI Bar */}
        <div className="game-top-bar">
          <button
              className="settings-button"
              onClick={handleQuitClick}
              title="Return to Lobby"
          >
            ⚙️
          </button>
          <div className="energy-container">
            <div className="energy-icon">⚡</div>
            <div className="energy-value">{inGameEnergy}</div>
          </div>

          <div className="score-container">
            <div className="score-label">SCORE:</div>
            <div className="score-value">{inGameScore}</div>
          </div>

          <div className="base-health-container">
            <div className="base-icon">🏢</div>
            <div className="health-bar">
              <div className="health-fill" style={{ width: `${baseHealth}%` }} />
            </div>
            <div className="health-value">{baseHealth}%</div>
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
            ref={canvasRef}
            width={800}
            height={450}
            onClick={handleCanvasClick}
            className="game-canvas"
            style={{ cursor: shovelMode ? 'crosshair' : 'default' }}
        />

        {/* Card slots in bottom bar */}
        <div className="game-bottom-bar">
          <div className="card-slots-container">
            {/* Shovel Tool Button */}
            <div className="tool-slot">
              <button
                  className={`shovel-button ${shovelMode ? 'active' : ''}`}
                  onClick={handleShovelToggle}
                  title="Remove Defender">
                🔨
              </button>
            </div>
            {cardSlots.map((card) => {
              const cooldown = cardCooldown[card.id] || 0;
              const cooldownPercent =
                  cooldown > 0 ? (cooldown / getCooldownDuration(card)) * 100 : 0;
              const isDisabled = cooldown > 0 || inGameEnergy < card.cost;

              return (
                  <div key={card.id} className="card-slot-wrapper">
                    <Card
                        card={card}
                        onClick={() => handleCardSelection(card)}
                        selected={selectedCard?.id === card.id && !shovelMode}
                        disabled={isDisabled}
                    />

                    {cooldown > 0 && (
                        <div className="cooldown-overlay">
                          <div
                              className="cooldown-progress"
                              style={{ height: `${cooldownPercent}%` }}
                          />
                          <div className="cooldown-text">
                            {Math.ceil(cooldown / 1000)}s
                          </div>
                        </div>
                    )}
                  </div>
              );
            })}
          </div>
        </div>

        {/* Deployment/Removing Indicator */}
        {(selectedCard || shovelMode) && (
            <div className="deployment-indicator">
              <div className="indicator-icon">{shovelMode ? '🔨' : '+'}</div>
              <div className="indicator-text">
                {shovelMode ? "REMOVE DEFENDER" : `DEPLOY ${selectedCard.name.toUpperCase()}`}
              </div>
            </div>
        )}

        {/* Quit Confirmation Dialog */}
        {showQuitDialog && (
            <div className="quit-dialog-overlay">
              <div className="quit-dialog">
                <h3>Return to Lobby?</h3>
                <p>
                  Warning: Quitting now will count as a defeat!
                </p>
                <div className="quit-dialog-buttons">
                  <button
                      className="quit-confirm-button"
                      onClick={handleQuitConfirm}
                  >
                    QUIT GAME
                  </button>
                  <button className="quit-cancel-button" onClick={handleQuitCancel}>
                    CONTINUE PLAYING
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default GameBoard;
