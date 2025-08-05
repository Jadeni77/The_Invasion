import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import Lobby from "./component/GameRendering/Lobby";
import GameBoard from "./component/GameRendering/GameBoard";
import UpgradeModal from "./component/GameRendering/UpgradeModal"; // Correct path
import { useGame } from "./component/GameLogic (MVC)/GameContext";
import AchievementPage from "./component/GameRendering/AchievementPage";
import CollectionPage from "./component/GameRendering/CollectionPage";
import SettingModal from "./component/GameRendering/SettingModal";

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
    case "achievements":
      return <AchievementPage />;
    case "collection":
      return <CollectionPage />;
    case "settings":
      return <SettingModal />;
    default:
      return <Lobby />;
  }
};

export default App;
