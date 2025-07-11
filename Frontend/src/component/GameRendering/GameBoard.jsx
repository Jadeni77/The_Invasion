import React from "react";
import { useRef, useEffect, useState, useCallback } from "react";
import { useGame } from "../GameLogic (MVC)/GameContext";

//import card data files later
//now use the dummy ownedCard field from GameContext.js

//This function is responsible for
// -Creating the HTML element <canvas> that GameEngine will draw on
// -Initialize the GameEngine: call game.startLevel() from GameContext
// -Handling User inputs: Forward mouse clicks/touches to GameEngine to handle deployment
// -Displaying Game States: Using GameContext to show real-time energy, score,
//                          and potentially game over/win states.
function GameBoard({ selectedCard, onCardDeployed }) {
  const canvasRef = useState(false); //ref to get direct access from DOM
  const {
    currentLevelSession,
    startLevel,
    isGameInitialized,
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    playerResources, // To access player's ownedCards
    deployDefender,
    returnToLobby, // Function to call when user wants to go back to lobby
  } = useGame();

  const [canvasReady, setCanvasReady] = useState(false);

  //----Initialize Game Engine when level changes ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas element not found!");
      return;
    }

    //auto start level 1 if not already initialized
    //placeholder
    if (!isGameInitialized) {
      console.log(`Initializing game for level ${currentLevelSession}...`);
      startLevel(canvas, currentLevelSession);
      setCanvasReady(true);
    }

    //cleanup functions when game end
    return () => {
      //GameEngine handles stopLoop
      //GameContext handles removing event listener
      //no further logic requires
    };
  }, [currentLevelSession, startLevel, isGameInitialized]);

  //---handle canvas clicks for defender deployment ---
  const handleCanvasClick = useCallback(
    (event) => {
      if (gameOver) return; //no further deploment if gameover

      const canvas = canvasRef.current;
      if (!canvas || !selectedCard) {
        // console.log("No card selected or canvas not ready for deployment.");
        return;
      }

      //get click coordinate(x,y) related to canvas clickes
      const rect = canvas.getBoundingClientRect();
      const x = event.x - rect.left;
      const y = event.y - rect.top;

      //Call deployDefender from GameContext
      // GameContext/GameEngine will handle energy cost and actual placement
      deployDefender(selectedCard, x, y);

      //optional: inform parent component that a card is clicked
      if (onCardDeployed) {
        onCardDeployed(selectedCard);
      }
    },
    [selectedCard, deployDefender, gameOver, onCardDeployed]
  );

  //---Display GameOver/Win Popup --
  if (gameOver) {
    return (
      <div className="game-over-screen">
        <h2>{gameWon ? "Victory!" : "Game Over!"}</h2>
        <p>Your Score: {inGameScore}</p>
        {gameWon && (
          <div>
            <h3>Award: </h3>
            <p>You earned {inGameScore * (1 + Math.random(1))}</p>
            {/* Display other awards based on gameWon, currentLevelSession, etc. */}
            <p>Next Level Unlocked!</p>{" "}
            {/* This message would be conditional */}
          </div>
        )}
        {!gameWon && <p>Better luck next time!</p>}
        <button onClick={returnToLobby}>Return to Lobby</button>
        {/*  Optional: Play Again Button, check for lobby energy bar deduction*/}
        <button
          onClick={() => startLevel(canvasRef.current, currentLevelSession)}
        >
          Play Level {currentLevelSession} Again
        </button>
      </div>
    );
  }

  //---Main Game Board Render ---
  return (
    <div className="game-board-container">
      {/* Game UI Overlay (Energy, Score, etc.) */}
      <div className="game-ui-overlay">
        <div className="game-stats">
          <span>Energy: {inGameEnergy}</span>
          <span>Score: {inGameScore}</span>
          {/* Could also display current level, wave number etc. Later Issue */}
        </div>
        {/*
          <div className="card-selection-area">
            // This is where to integrate CardSelection component
            // For now, assume selectedCard is passed via props or a global state
            <p>Selected Card: {selectedCard ? selectedCard.name : "None"}</p>
          </div>
        */}
      </div>

      {/* The Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800} //example width
        height={600} //exaomple height
        style={{ border: "2px solid black", backgroundColor: "lightgray" }}
        onClick={handleCanvasClick}
      >
        Your browser does not support the HTML canvas tag.
      </canvas>
    </div>
  );
}

export default GameBoard;
