// src/components/GameRendering/GameBoard.jsx
import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext"; // Correct path
import Card from "../common/Card"; // Correct path

const GameBoard = () => {
  const canvasRef = useRef(null); // Ref to the canvas DOM element
  const {
    gameState, // Use gameState to determine if we should be active
    playerData, // To get ownedCards for deck
    selectedLevel, // The level number to start
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    startLevel, // Function to start the level (from GameContext)
    deployDefender, // Function to deploy a defender (from GameContext)
    endGame, // Function to end the game (from GameContext)
    getGameEngine, // Function to get the GameEngine instance
  } = useGame();

  const [selectedCard, setSelectedCard] = useState(null);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);

  // Initialize hand and deck from player's owned cards when playerData loads
  useEffect(() => {
    if (playerData && playerData.cards && playerData.cards.length > 0) {
      const initialDeck = [...playerData.cards].sort(() => Math.random() - 0.5);
      setDeck(initialDeck);
      // Draw initial hand after deck is set
      const initialHand = initialDeck.slice(0, 3); // Draw 3 cards
      setHand(initialHand);
      setDeck(initialDeck.slice(3)); // Remove drawn cards from deck
    }
  }, [playerData]);


  // Initialize GameEngine when gameState is 'inGame' and canvas is ready
  useEffect(() => {
    if (gameState === "inGame" && canvasRef.current && selectedLevel !== null) {
      console.log(`GameBoard: Initializing GameEngine for level ${selectedLevel}`);
      // Pass the canvas element to startLevel in GameContext
      startLevel(selectedLevel, canvasRef); // Pass canvasRef to GameContext's startLevel
    }
    // Cleanup function for when component unmounts or game state changes
    return () => {
      const gameEngine = getGameEngine();
      if (gameEngine) {
        gameEngine.stopLoop(); // Stop the game loop
        gameEngine.cleanup(); // Perform any engine-specific cleanup
      }
    };
  }, [gameState, selectedLevel, startLevel, getGameEngine]);


  const drawCards = () => {
    // Only draw if hand is not full and deck has cards
    if (hand.length < 3 && deck.length > 0) {
      const cardsToDraw = Math.min(3 - hand.length, deck.length);
      const newCards = deck.slice(0, cardsToDraw);
      setHand(prevHand => [...prevHand, ...newCards]);
      setDeck(prevDeck => prevDeck.slice(cardsToDraw));
    }
  };

  const handleCardSelection = (card) => {
    // Only allow selection if not already selected, and player has enough energy
    if (selectedCard?.id === card.id) {
        setSelectedCard(null); // Deselect if already selected
    } else if (inGameEnergy >= card.cost) {
        setSelectedCard(card);
    } else {
        console.log("Not enough energy to select this card!");
    }
  };

  const handleCardDeployment = () => {
    if (!selectedCard) return;

    // Remove card from hand and redraw
    setHand(prev => prev.filter(c => c.id !== selectedCard.id));
    setSelectedCard(null);

    // Redraw a new card after a short delay
    // This simulates a cooldown or draw animation
    setTimeout(drawCards, 1000); // Draw a new card after 1 second
  };

  // Handle canvas click for defender deployment
  const handleCanvasClick = (event) => {
    if (gameOver || !selectedCard) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // deployDefender returns true if successful, false otherwise
    const deployed = deployDefender(selectedCard, x, y);
    if (deployed) {
      handleCardDeployment(); // Only remove card if deployment was successful
    } else {
      console.log("Deployment failed (e.g., invalid position or not enough energy)");
    }
  };

  // Render Game Over / Victory screen
  if (gameOver) {
    return (
      <div className="game-over-screen">
        <h2>{gameWon ? "Victory!" : "Defeated!"}</h2>
        <p>Score: {inGameScore}</p>
        {/* Gold earned logic is now handled by GameContext's onWinCb/onLoseCb */}
        <p>Gold Earned: {gameWon ? inGameScore : Math.floor(inGameScore * 0.05)}</p>

        <div className="buttons">
          <button onClick={() => endGame(gameWon ? 'win' : 'loss')}>Return to Lobby</button>
          {/* Re-initialize the same level for "Play Again" */}
          <button onClick={() => {
            endGame('restart'); // Signal a restart, not a win/loss
            startLevel(selectedLevel, canvasRef); // Re-start the same level
          }}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // Render the in-game UI and canvas
  return (
    <div className="game-board-container">
      {/* Game UI Overlay */}
      <div className="game-ui-overlay">
        <div className="game-stats">
          <span>Energy: {inGameEnergy}</span>
          <span>Score: {inGameScore}</span>
        </div>

        {/* Card Hand */}
        <div className="card-hand">
          {hand.map(card => (
            <Card // Use the Card component you defined
              key={card.id}
              card={card}
              onClick={() => handleCardSelection(card)}
              className={selectedCard?.id === card.id ? 'selected' : ''}
            />
          ))}
        </div>
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800} // Set initial width
        height={600} // Set initial height
        onClick={handleCanvasClick} // Only call handleCanvasClick
        className="game-canvas" // Add a class for styling
      />

      {/* Deployment Indicator */}
      {selectedCard && (
        <div className="deployment-indicator">
          <div className="indicator-icon">+</div>
          <div className="indicator-text">Click to deploy {selectedCard.name}</div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;