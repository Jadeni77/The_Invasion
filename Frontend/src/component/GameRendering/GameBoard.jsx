import React, { useRef, useEffect } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";

const GameBoard = () => {
  const canvasRef = useRef(null);
  const {
    startLevel,
    isGameInitialized,
    currentLevelSession,
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    deployDefender,
    returnToLobby,
    playerResources
  } = useGame();
  const [selectedCard, setSelectedCard] = useState(null);
   const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);

  // Initialize game
   useEffect(() => {
    if (playerResources.ownedCards && playerResources.ownedCards.length > 0) {
      // Shuffle cards
      const shuffled = [...playerResources.ownedCards].sort(() => Math.random() - 0.5);
      setDeck(shuffled);
      // Draw initial 3 cards
      drawCards();
    }
  }, [playerResources.ownedCards]);

   const drawCards = () => {
    if (deck.length === 0) return;
    
    const cardsToDraw = Math.min(3 - hand.length, deck.length);
    const newHand = [...hand, ...deck.slice(0, cardsToDraw)];
    setHand(newHand);
    setDeck(prev => prev.slice(cardsToDraw));
  };

   const handleCardSelection = (card) => {
    setSelectedCard(card);
  };

  const handleCardDeployment = () => {
    if (!selectedCard) return;
    
    // Remove card from hand
    setHand(prev => prev.filter(c => c.id !== selectedCard.id));
    setSelectedCard(null);
    
    // Redraw card if deck has cards
    setTimeout(drawCards, 500);
  };

  // Handle canvas click
  const handleCanvasClick = (event) => {
    if (gameOver || !selectedCard) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    deployDefender(selectedCard, x, y);
  };

  if (gameOver) {
    return (
      <div className="game-over-screen">
        <h2>{gameWon ? "Victory!" : "Defeated!"}</h2>
        <p>Score: {inGameScore}</p>
        <p>Gold Earned: {gameWon ? inGameScore : Math.floor(inGameScore * 0.05)}</p>
        
        <div className="buttons">
          <button onClick={returnToLobby}>Return to Lobby</button>
          <button onClick={() => startLevel(canvasRef.current, currentLevelSession)}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

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
            <div 
              key={card.id}
              className={`card ${selectedCard?.id === card.id ? 'selected' : ''}`}
              onClick={() => handleCardSelection(card)}
            >
              <div className="card-name">{card.name}</div>
              <div className="card-cost">{card.cost} ⚡</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={(e) => {
          handleCanvasClick(e);
          if (selectedCard) handleCardDeployment();
        }}
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