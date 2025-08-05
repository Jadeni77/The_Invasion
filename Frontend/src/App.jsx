import { GameProvider } from "./component/GameLogic (MVC)/GameContext";
import Lobby from "./component/GameRendering/Lobby";
import GameBoard from "./component/GameRendering/GameBoard";
import UpgradeModal from "./component/GameRendering/LobbyButton/UpgradeModal.jsx"; // Correct path
import { useGame } from "./component/GameLogic (MVC)/GameContext";
import AchievementPage from "./component/GameRendering/LobbyButton/AchievementPage.jsx";
import CollectionPage from "./component/GameRendering/LobbyButton/CollectionPage.jsx";
import SettingModal from "./component/GameRendering/LobbyButton/SettingModal.jsx";

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
