import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";
import Card from "../common/Card";
import { GameEngine } from "../GameLogic (MVC)/GameEngine";
import { calculateCardStats } from "../GameLogic (MVC)/DefenderClassUtils";
import Gold from "../../Icons/Gold.png";
import Iron from "../../Icons/Iron.png";

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
    endGame,
    updateEnergyCb,
    updateScoreCb,
    onWinCb,
    onLoseCb,
    startLevel,
    selectedCardsForGame,
  } = useGame();

  const gameEngineRef = useRef(null);
  const [selectedCard, setSelectedCard] = useState(null);
  // const [hand, setHand] = useState([]);
  // const [deck, setDeck] = useState([]);

  const [cardSlots, setCardSlots] = useState([]);
  const [cardCooldown, setCardCooldown] = useState({});

  const [baseHealth, setBaseHealth] = useState(100);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  // canvas sizing
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight - 60; // Account for top bar

        // Update game engine if exists
        if (gameEngineRef.current) {
          gameEngineRef.current.canvasWidth = container.clientWidth;
          gameEngineRef.current.canvasHeight = container.clientHeight - 60;
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
      // Clean up previous game engine
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop();
        gameEngineRef.current.cleanup();
        gameEngineRef.current = null;
      }

      // Create new game engine
      gameEngineRef.current = new GameEngine(
        updateEnergyCb,
        updateScoreCb,
        onWinCb,
        onLoseCb,
        (health) => setBaseHealth(health)
      );

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

      // // Reset hand and deck
      // if (selectedCardsForGame?.length > 0) {
      //   const cardsWithStats = selectedCardsForGame
      //     .map(calculateCardStats)
      //     .filter(Boolean);
      //   const initialDeck = [...cardsWithStats].sort(() => Math.random() - 0.5);
      //   setHand(initialDeck.slice(0, 3));
      //   setDeck(initialDeck.slice(3));
      // } else if (playerData?.cards?.length > 0) {
      //   // Fallback to all cards if no selection
      //   const cardsWithStats = playerData.cards
      //     .map(calculateCardStats)
      //     .filter(Boolean);
      //   const initialDeck = [...cardsWithStats].sort(() => Math.random() - 0.5);
      //   setHand(initialDeck.slice(0, 3));
      //   setDeck(initialDeck.slice(3));
      // }

      // // Reset selection
      // setSelectedCard(null);
    }

    // Cleanup
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop();
        gameEngineRef.current.cleanup();
        gameEngineRef.current = null;
      }
    };
  }, [gameState, selectedLevel, resetTrigger]);

  // const drawCards = () => {
  //   if (hand.length < 3 && deck.length > 0) {
  //     const cardsToDraw = Math.min(3 - hand.length, deck.length);
  //     const newCards = deck.slice(0, cardsToDraw);
  //     setHand((prev) => [...prev, ...newCards]);
  //     setDeck((prev) => prev.slice(cardsToDraw));
  //   }
  // };

  const handleCardSelection = (card) => {
    //check if a card is on cooldown
    if (cardCooldown[card.id] > 0 || inGameEnergy < card.cost) return;

    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  // const handleCardDeployment = () => {
  //   if (!selectedCard) return;
  //   setHand((prev) => prev.filter((c) => c.id !== selectedCard.id));
  //   setSelectedCard(null);
  //   setTimeout(drawCards, 300);
  // };

  const handleCanvasClick = (event) => {
    if (gameOver || !selectedCard || !gameEngineRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (gameEngineRef.current.deployDefenderUnit(selectedCard, x, y)) {
      //handleCardDeployment();
      const cooldownDuration = this.getCooldownDuration(selectedCard);
      setCardCooldown((prev) => ({
        ...prev,
        [selectedCard.id]: cooldownDuration,
      }));
      setSelectedCard(null);
    }
  };

  //get the cooldown duration for a card type
  const getCooldownDuration = (card) => {
    const cooldowns = {
      "Basic Cop": 5000, //5 second
      "Healer Cop": 8000,
      "Grenadier ": 10000,
      "Barricade ": 7000,
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

  // const handleQuitConfirm = () => {
  //   //mark game over and lost
  //   if (gameEngineRef.current) {
  //     gameEngineRef.current.forceGameOver();
  //   }
  //   setShowQuitDialog(false);
  //   endGame("loss");
  // };

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
    console.log("Rendering game over screen");

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
            onClick={() => endGame(gameWon ? "win" : "loss")}
          >
            RETURN TO LOBBY
          </button>

          <button
            className="replay-button"
            onClick={() => {
              endGame("restart");
              // Reset local states
              setBaseHealth(100);
              setSelectedCard(null);

              // // Reset hand and deck
              // if (playerData?.cards?.length > 0) {
              //   const cardsWithStats = playerData.cards
              //     .map(calculateCardStats)
              //     .filter(Boolean);
              //   const initialDeck = [...cardsWithStats].sort(
              //     () => Math.random() - 0.5
              //   );
              //   setHand(initialDeck.slice(0, 3));
              //   setDeck(initialDeck.slice(3));
              // }

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
      />

      {/* Card slots at a fix position in game */}
      <div className="card-slots-container">
        {cardSlots.map((card) => {
          const cooldown = cardCooldown[card.id] || 0;
          const cooldownPercent =
            cooldown > 0 ? (cooldown / this.getCooldownDuration(card)) * 100 : 0;
          const isDisabled = cooldown > 0 || inGameEnergy < card.cost;

          return (
            <div key={card.id} className="card-slot-wrapper">
              <Card
                card={card}
                onClick={() => handleCardSelection(card)}
                selected={selectedCard?.id === card.id}
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

      {/* {/* Card Hand }
      <div className="card-hand-container">
        {hand.map((card) => (
          <Card
            key={card.id}
            card={card}
            onClick={() => handleCardSelection(card)}
            selected={selectedCard?.id === card.id}
            disabled={inGameEnergy < card.cost}
          />
        ))}
      </div> */}

      {/* Deployment Indicator */}
      {selectedCard && (
        <div className="deployment-indicator">
          <div className="indicator-icon">+</div>
          <div className="indicator-text">
            DEPLOY {selectedCard.name.toUpperCase()}
          </div>
        </div>
      )}

      {/* QUit Confirmation Dialog */}
      {showQuitDialog && (
        <div className="quit-dialog-overlay">
          <div className="quit-dialog">
            <h3>Return to Lobby?</h3>
            <p>
              Warning: Quitting now will count as a defeat!
              <br />
              You will lose resources and may injure a worker.
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
