import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import Lobby from "./component/GameRendering/Lobby";
import GameBoard from "./component/GameRendering/GameBoard";
import UpgradeModal from "./component/GameRendering/UpgradeModal"; // Correct path
import { useGame } from "./component/GameLogic (MVC)/GameContext";

const App = () => {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
};

const GameRouter = () => {
  const { gameState } = useGame();

  switch (gameState) {
    case "inGame":
      return <GameBoard />;
    case "upgrade":
      return <UpgradeModal />;
    default:
      return <Lobby />;
  }
};

export default App;
