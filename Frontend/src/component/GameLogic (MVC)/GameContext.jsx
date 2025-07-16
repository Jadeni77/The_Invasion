// src/component/GameLogic (MVC)/GameContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { GameEngine } from "./GameEngine"; // Correct path

export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

export const GameProvider = ({ children }) => {
  const gameEngineRef = useRef(null); // Ref to hold the GameEngine instance

  const [gameState, setGameState] = useState("lobby"); // lobby, inGame, upgrade
  const [selectedLevel, setSelectedLevel] = useState(null); // The level selected to play
  const [playerData, setPlayerData] = useState(null);
  const [upgradeQueue, setUpgradeQueue] = useState([]);

  // In-game session specific states (managed by GameEngine, exposed via callbacks)
  const [inGameEnergy, setInGameEnergy] = useState(0);
  const [inGameScore, setInGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  // Callbacks for GameEngine to update React state
  const updateEnergyCb = useCallback((energy) => {
    setInGameEnergy(energy);
  }, []);

  const updateScoreCb = useCallback((score) => {
    setInGameScore(score);
  }, []);

  const onWinCb = useCallback(
    ({ score, level }) => {
      setGameOver(true);
      setGameWon(true);
      console.log(`Game won! Level: ${level}, Score: ${score}`);

      // Update player data based on win
      setPlayerData((prev) => {
        if (!prev) return prev;
        const newGold = prev.resources.gold + score;
        const newUnlockedLevels = [...prev.unlockedLevels];
        if (!newUnlockedLevels.includes(level + 1)) {
          newUnlockedLevels.push(level + 1); // Unlock next level
          newUnlockedLevels.sort((a, b) => a - b);
        }
        return {
          ...prev,
          resources: { ...prev.resources, gold: newGold },
          unlockedLevels: newUnlockedLevels,
        };
      });
      // GameEngine will stop its loop; UI will show victory screen.
      // User clicks "Return to Lobby" which calls endGame.
    },
    [] // Dependencies are handled by the state setters
  );

  const onLoseCb = useCallback(
    ({ score, level, reason }) => {
      setGameOver(true);
      setGameWon(false);
      console.log(
        `Game lost! Level: ${level}, Reason: ${reason}, Score: ${score}`
      );

      // Deduct resources on loss (as per your logic)
      setPlayerData((prev) => {
        if (!prev) return prev;
        const newGold = Math.max(0, prev.resources.gold - 50); // Placeholder amounts
        const newGrain = Math.max(0, prev.resources.grain - 10);
        const newWater = Math.max(0, prev.resources.water - 50);
        const newGem = Math.max(
          0,
          prev.resources.gem - Math.ceil(Math.random())
        ); // Deduct 0 or 1 gem
        return {
          ...prev,
          resources: {
            ...prev.resources,
            gold: newGold,
            grain: newGrain,
            water: newWater,
            gem: newGem,
          },
        };
      });
      // Injure a worker on loss (as per your logic)
      injureWorker();
      // GameEngine will stop its loop; UI will show game over screen.
      // User clicks "Return to Lobby" which calls endGame.
    },
    [] // Dependencies are handled by the state setters
  );

  // Backend API integration points
  const fetchPlayerData = useCallback(async () => {
    try {
      // Mock data until backend is implemented
      const mockData = {
        id: "player-123",
        name: "Garden Defender",
        rank: "Novice Gardener",
        resources: {
          gold: 500,
          lobbyEnergy: 50, // Current energy
          maxLobbyEnergy: 100, // Maximum energy capacity
          energyRechargeRate: 1, // Energy per minute
          lastEnergyRechargeTime: Date.now(), // Last recharge timestamp
          workers: 4,
          iron: 20,
          grain: 30,
          water: 40,
          gem: 5,
        },
        workers: [
          { id: 1, name: "Worker 1", injured: false },
          { id: 2, name: "Worker 2", injured: false },
          { id: 3, name: "Worker 3", injured: false },
          { id: 4, name: "Worker 4", injured: false },
        ],
        cards: [
          {
            id: 1,
            name: "Basic Cop",
            level: 1,
            upgradeCost: { gold: 100, iron: 5, water: 3 },
            upgradeTime: 60,
          },
          {
            id: 2,
            name: "Healer Cop",
            level: 1,
            upgradeCost: { gold: 150, grain: 10, water: 5, gem: 1 },
            upgradeTime: 120,
          },
          {
            id: 3,
            name: "Grenadier",
            level: 1,
            upgradeCost: { gold: 200, iron: 15, gem: 2 },
            upgradeTime: 180,
          },
          {
            id: 4,
            name: "Barricade",
            level: 1,
            cost: 30,
            upgradeCost: { gold: 120, iron: 20, grain: 5 },
            upgradeTime: 90,
          },
        ],
        unlockedLevels: [1],
        collectedTreasures: [],
      };

      setPlayerData(mockData);
    } catch (error) {
      console.error("Failed to fetch player data:", error);
      // Fallback to empty state
      setPlayerData({
        resources: {
          gold: 0,
          lobbyEnergy: 0,
          maxLobbyEnergy: 0,
          energyRechargeRate: 0,
          lastEnergyRechargeTime: 0,
          workers: 0,
          iron: 0,
          grain: 0,
          water: 0,
          gem: 0,
        },
        cards: [],
        workers: [],
        unlockedLevels: [],
        collectedTreasures: [],
      });
    }
  }, []);

  // Energy recharge system
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayerData((prev) => {
        if (!prev || !prev.resources) return prev; // Safety check
        const now = Date.now();
        const timeElapsedMs = now - prev.resources.lastEnergyRechargeTime;
        const minutesElapsed = timeElapsedMs / (1000 * 60);
        const energyToAdd = minutesElapsed * prev.resources.energyRechargeRate;

        if (energyToAdd >= 1) {
          const wholeEnergy = Math.floor(energyToAdd);
          return {
            ...prev,
            resources: {
              ...prev.resources,
              lobbyEnergy: Math.min(
                prev.resources.maxLobbyEnergy,
                prev.resources.lobbyEnergy + wholeEnergy
              ),
              lastEnergyRechargeTime:
                prev.resources.lastEnergyRechargeTime +
                (wholeEnergy * (1000 * 60)) / prev.resources.energyRechargeRate, // Corrected calculation
            },
          };
        }
        return prev;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const savePlayerData = useCallback(async (data) => {
    try {
      // Backend API call to save player data
      // await fetch('/api/save-player-data', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      console.log("Player data saved (simulated)");
    } catch (error) {
      console.error("Failed to save player data:", error);
    }
  }, []);

  useEffect(() => {
    fetchPlayerData();

    // Cleanup: save data when component unmounts or playerData changes
    return () => {
      if (playerData) {
        savePlayerData(playerData);
      }
    };
  }, [fetchPlayerData, savePlayerData]); // Added savePlayerData to dependencies

  // Resources management
  const updateResource = useCallback((resource, amount) => {
    setPlayerData((prev) => {
      if (!prev || !prev.resources) return prev; // Safety check
      const newResources = { ...prev.resources };
      newResources[resource] = Math.max(0, newResources[resource] + amount);
      return {
        ...prev,
        resources: newResources,
      };
    });
  }, []);

  // Worker injury system
  const injureWorker = useCallback(() => {
    setPlayerData((prev) => {
      if (!prev || !prev.workers) return prev; // Safety check
      // 30% chance to injure a worker on a loss
      if (Math.random() < 0.3) {
        const healthyWorkers = prev.workers.filter((w) => !w.injured);
        if (healthyWorkers.length > 0) {
          const randomWorker =
            healthyWorkers[Math.floor(Math.random() * healthyWorkers.length)];
          return {
            ...prev,
            workers: prev.workers.map((w) =>
              w.id === randomWorker.id ? { ...w, injured: true } : w
            ),
          };
        }
      }
      return prev;
    });
  }, []);

  // Start card upgrade
  const startCardUpgrade = useCallback(
    (cardId) => {
      if (!playerData) return;

      const card = cardsWithStats.find((c) => c.id === cardId);
      if (!card) return;

      // Check if player has enough resources
      const canAfford = Object.entries(card.upgradeCost).every(
        ([resource, amount]) => playerData.resources[resource] >= amount
      );

      // Check if available worker
      const availableWorker = playerData.workers.find(
        (w) => !w.injured && !upgradeQueue.some((u) => u.workerId === w.id)
      );

      if (canAfford && availableWorker) {
        Object.entries(card.upgradeCost).forEach(([resource, amount]) => {
          updateResource(resource, -amount);
        });

        // Add to upgrade queue
        const upgradeEndTime = Date.now() + card.upgradeTime * 1000;
        setUpgradeQueue((prev) => [
          ...prev,
          {
            cardId,
            workerId: availableWorker.id,
            startTime: Date.now(),
            endTime: upgradeEndTime,
          },
        ]);
      } else {
        console.warn(
          "Cannot start upgrade: requirements not met (resources or worker)"
        );
      }
    },
    [playerData, upgradeQueue, updateResource]
  );

  // Check completed upgrades
  useEffect(() => {
    const checkUpgrades = () => {
      const now = Date.now();
      const completed = upgradeQueue.filter((u) => u.endTime <= now);

      if (completed.length > 0) {
        // Apply upgrades
        setPlayerData((prev) => ({
          ...prev,
          cards: prev.cards.map((card) => {
            const upgrade = completed.find((u) => u.cardId === card.id);
            if (upgrade) {
              return { ...card, level: card.level + 1 };
            }
            return card;
          }),
          // Mark worker as healthy after upgrade (assuming 1 worker per upgrade)
          workers: prev.workers.map((worker) => {
            const completedUpgrade = completed.find(
              (u) => u.workerId === worker.id
            );
            if (completedUpgrade) {
              return { ...worker, injured: false }; // Worker is now healthy
            }
            return worker;
          }),
        }));

        // Remove completed upgrades from queue
        setUpgradeQueue((prev) => prev.filter((u) => u.endTime > now));
      }
    };

    const interval = setInterval(checkUpgrades, 5000);
    return () => clearInterval(interval);
  }, [upgradeQueue]); // Dependency on upgradeQueue is correct

  // Game State management
  const startLevel = useCallback(
    (levelId) => {
      if (!playerData) {
        console.error("Cannot start level: Player data or canvas not ready.");
        return;
      }

      const levelCost = levelId === 1 ? 0 : 5; // Level 1 is free
      const currentEnergy = playerData.resources.lobbyEnergy;

      if (currentEnergy < levelCost) {
        alert(
          `Not enough energy! You need ${levelCost} energy to start this level.`
        );
        return;
      }

      //deduct resources
      updateResource('lobbyEnergy', -levelCost);

      // Set game state
      setSelectedLevel(levelId);
      setGameState("inGame");
      setGameOver(false);
      setGameWon(false);
      setInGameEnergy(100); // Reset in-game energy
      setInGameScore(0); // Reset score

      console.log(
        `Starting level ${levelId}. Lobby energy now: ${newPlayerData.resources.lobbyEnergy}`
      );
    },
    [playerData, updateResource]
  );

  const endGame = useCallback(
    (result) => {
      // Result can be 'win' or 'loss'
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop(); // Ensure engine loop stops
        gameEngineRef.current.resetGame(); // Reset engine's internal state
      }

      if (result === "quit") {
        // Return to lobby with penalty (with cauze injury worker)
        injureWorker();
        setGameState("lobby");
        setGameOver(false);
        setGameWon(false);
        setSelectedLevel(null);
        return;
      }

      if (result === "loss") {
        injureWorker();
        // Resource deduction on loss is now handled by onLoseCb
      }
      // Resource gain on win is now handled by onWinCb

      setGameState("lobby");
      setGameOver(false); // Reset UI state
      setGameWon(false); // Reset UI state
      setSelectedLevel(null); // Clear selected level
      savePlayerData(playerData); // Save updated player data
    },
    [injureWorker, playerData, savePlayerData]
  );

  const deployDefender = useCallback(
    (cardData, x, y) => {
      if (gameEngineRef.current && gameState === "inGame") {
        gameEngineRef.current.deployDefenderUnit(cardData, x, y);
      }
    },
    [gameState]
  );

  const getGameEngine = useCallback(() => gameEngineRef.current, []); // Expose engine instance

  const openUpgradeModal = useCallback(() => {
    setGameState("upgrade");
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setGameState("lobby");
  }, []);

  // Public API and context values
  const gameAPI = {
    gameState,
    playerData,
    upgradeQueue,
    selectedLevel, // The level currently being played (or selected in lobby)
    inGameEnergy, // Exposed in-game energy
    inGameScore, // Exposed in-game score
    gameOver, // Exposed game over status
    gameWon, // Exposed game won status
    startLevel, // Function to start a level
    endGame, // Function to end the current game session
    deployDefender, // Function to deploy a defender
    getGameEngine, // Function to get the GameEngine instance
    openUpgradeModal,
    closeUpgradeModal,
    startCardUpgrade,
    updateEnergyCb, // Add this
    updateScoreCb, // Add this
    onWinCb, // Add this
    onLoseCb, // Add this
  };

  return (
    <GameContext.Provider value={gameAPI}>{children}</GameContext.Provider>
  );
};
