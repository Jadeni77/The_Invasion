import React from "react";
import "./App.css";
import "./component/GameRendering/Lobby.css";
import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import GameBoard from "./component/GameRendering/GameBoard";
import { useGame } from "./component/GameLogic (MVC)/GameContext";
import Lobby from "./component/GameRendering/Lobby";

function App() {
  return (
    <GameProvider>
      <MainGameRouter />
    </GameProvider>
  );
}

// This component uses GameContext to decide what to render
function MainGameRouter() {
  const { isGameInitialized, gameOver, returnToLobby } = useGame();

  //if game is initialize and not over, show gameboard
  if (isGameInitialized && !gameOver) {
    return <GameBoard selectedCard={null} />; // selectedCard will be handled by a CardSelection component later
  } else if (gameOver) {
    //GameBoard already handle that
    return <GameBoard selectedCard={null} /> 
  } else {
    return <Lobby />
  }
}

export default App;
