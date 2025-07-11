import React from "react";
import "./App.css";
import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import GameBoard from "./component/GameRendering/GameBoard";

function App() {
  return (
    <GameProvider>
      <GameBoard />
    </GameProvider>
  );
}

export default App;
