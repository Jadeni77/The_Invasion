import React from "react";
import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import Lobby from "./component/GameRendering/Lobby";
import GameBoard from "./component/GameRendering/GameBoard";
import { useGame } from "./component/GameLogic (MVC)/GameContext";

const App = () => {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
};

const GameRouter = () => {
  const { isGameInitialized, gameOver } = useGame();
  
  if (isGameInitialized && !gameOver) {
    return <GameBoard />;
  }
  return <Lobby />;
};

export default App;