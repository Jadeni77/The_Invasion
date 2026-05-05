/* eslint-disable react-refresh/only-export-components */
// src/component/GameLogic (MVC)/GameContext.jsx
import React, {createContext, useContext, useState, useEffect, useRef, useCallback,} from "react";
import {chestsData} from "../GameRendering/MapLayout.jsx";
import {SessionManager} from "./SessionManager.js";
import LoginPage from "../login/LoginPage.jsx";

export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

export const GameProvider = ({ children }) => {
  const gameEngineRef = useRef(null); // Ref to hold the GameEngine instance

  const [gameState, setGameState] = useState("lobby"); // lobby, inGame, upgrade
  const [selectedLevel, setSelectedLevel] = useState(null); // The level selected to play
  const [playerData, setPlayerData] = useState(null);
  const playerDataRef = useRef(null);

  // In-game session specific states (managed by GameEngine, exposed via callbacks)
  const [inGameEnergy, setInGameEnergy] = useState(0);
  const [inGameScore, setInGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const [selectedCardsForGame, setSelectedCardsForGame] = useState(null);
  const [collectedCardPieces, setCollectedCardPieces] = useState([]);

  //endless mode tracking
  const [currentEndlessWave, setCurrentEndlessWave] = useState(0);
  const [unlockedDefender, setUnlockedDefender] = useState(false);

  //authentication
  const [isAuthenticated, setIsAuthenticated] = useState(SessionManager.isLoggedIn());

  const handleLogin = (token, player) => {
    SessionManager.setToken(token);
    SessionManager.setUser(player);
    setPlayerData(player);
    setIsAuthenticated(true);
  }

  const handleLogout = () => {
    SessionManager.clearSession();
    setPlayerData(null);
    setIsAuthenticated(false);
  }

  // Callbacks for GameEngine to update React state
  //updating in game energy
  const updateEnergyCb = useCallback((energy) => {
    setInGameEnergy(energy);
  }, []);

  //updating in game score
  const updateScoreCb = useCallback((score) => {
    setInGameScore(score);
  }, []);

  //handle game win logiv
  const onWinCb = useCallback(async ({ score, level }) => {
      setGameOver(true);
      setGameWon(true);
      console.log(`Game won! Level: ${level}, Score: ${score}`);

      const stars = calculateStars(score, level);

      // Update player data based on win
      setPlayerData((prev) => {
        if (!prev) return prev;
        const levelConfig = getLevelRewardMultiplier(level);
        const goldEarned = Math.floor(score * 0.2);
        const ironEarned = Math.floor(score * 0.1);
        const grainEarned = Math.floor(score * 0.2);
        const waterEarned = Math.floor(score * 0.2);
        const gemBonus = stars === 3 ? Math.ceil(levelConfig) : 0;

        const newGold = prev.resources.gold + goldEarned;
        const newIron = prev.resources.iron + ironEarned;
        const newGrain = prev.resources.grain + grainEarned;
        const newWater = prev.resources.water + waterEarned;
        const newGem = prev.resources.gem + gemBonus;

        const newCompleteLevels = [ ...(prev.completedLevels || [])];
        if (!newCompleteLevels.includes(level)) {
          newCompleteLevels.push(level);
        }

        const newUnlockedLevels = [...prev.unlockedLevels];
        if (level < 20 && !newUnlockedLevels.includes(level + 1)) {
          newUnlockedLevels.push(level + 1); // Unlock next level
          newUnlockedLevels.sort((a, b) => a - b);
        }

        //unlock endless after level 20
        if (level === 20 && !newUnlockedLevels.includes(999)) {
          newUnlockedLevels.push(999);
        }

        const newLevelStars = [...(prev.levelStars || Array(20).fill(0))];
        if (level <= 20) {
          newLevelStars[level - 1] = Math.max(newLevelStars[level - 1] || 0, stars);
        }

        return {
          ...prev,
          resources: {
            ...prev.resources,
            gold: newGold,
            iron: newIron,
            grain: newGrain,
            water: newWater,
            gem: newGem
          },
          unlockedLevels: newUnlockedLevels,
          completedLevels: newCompleteLevels,
          levelStars: newLevelStars,
          totalStars: newLevelStars.reduce((sum, s) => sum + s, 0)
        };
      });

      //Save the result to backend
      try {
        await fetch(`http://localhost:8080/api/player/complete-level`, {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({
            levelId: level,
            score: score,
            stars: stars
          })
        });
      } catch (error) {
        console.error("Failed to save to backend:", error);
      }
    }, []);

  //handle game loss logic
  const onLoseCb = useCallback( async ({ score, level, reason, endlessWave }) => {
      setGameOver(true);
      setGameWon(false);
      console.log(`Game lost! Level: ${level}, Reason: ${reason}, Score: ${score}`);

      if (level === 999) {
        const goldEarned = Math.floor(endlessWave * 25 );
        const ironEarned = Math.floor(endlessWave * 10 );
        const grainEarned = Math.floor(endlessWave * 10 );
        const waterEarned = Math.floor(endlessWave * 8 );
        const gemEarned = Math.floor(endlessWave / 10);

        setPlayerData((prev) => {
          if (!prev) return prev;

          // Update endless high score
          const newHighScore = Math.max(prev.endlessHighScore || 0, endlessWave);

          // Calculate endless rewards based on waves survived
          return {
            ...prev,
            resources: {
              ...prev.resources,
              gold: prev.resources.gold + goldEarned,
              iron: prev.resources.iron + ironEarned,
              grain: prev.resources.grain + grainEarned,
              water: prev.resources.water + waterEarned,
              gem: prev.resources.gem + gemEarned
            },
            endlessHighScore: newHighScore,
            endlessStats: {
              ...prev.endlessStats,
              totalWaves: (prev.endlessStats?.totalWaves || 0) + endlessWave,
              totalRuns: (prev.endlessStats?.totalRuns || 0) + 1
            }
          };
        });

        try {
          await fetch(`http://localhost:8080/api/player/update-resources`, {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
              resourcesChange: {
                gold: goldEarned,
                iron: ironEarned,
                grain: grainEarned,
                water: waterEarned,
                gem: gemEarned
              }
            })
          });

          await fetch(`http://localhost:8080/api/player/endless-score`, {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
              waveReached: endlessWave
                                 })
          })

          console.log(`Endless rewards saved: ${goldEarned} gold, ${ironEarned} iron,
          ${grainEarned}, ${waterEarned}, ${gemEarned} gems for ${endlessWave} waves`);
          console.log(`Endless high score saved: ${endlessWave} waves`);
        } catch (e) {
          console.error("Failed to save endless rewards:", e);
          console.error("Failed to save endless data:", e);
        }

      } else {
        // Deduct resources on loss
        const goldPenalty = 50;
        const ironPenalty = 10;
        const grainPenalty = 10;
        const waterPenalty = 50;
        const gemPenalty = 1;

        setPlayerData((prev) => {
          console.log("Set Player Data Resources Logic Being called in onLoseCb")
          if (!prev) return prev;
          const newGold = Math.max(0, prev.resources.gold - goldPenalty);
          const newIron = Math.max(0, prev.resources.iron - ironPenalty);
          const newGrain = Math.max(0, prev.resources.grain - grainPenalty);
          const newWater = Math.max(0, prev.resources.water - waterPenalty);
          const newGem = Math.max(0, prev.resources.gem - gemPenalty);

          return {
            ...prev,
            resources: {
              ...prev.resources,
              gold: newGold,
              iron: newIron,
              grain: newGrain,
              water: newWater,
              gem: newGem,
            },
          };
        });

        try {
          await fetch(`http://localhost:8080/api/player/update-resources`, {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
              resourcesChange: {
              gold: -goldPenalty,
              iron: -ironPenalty,
              grain: -grainPenalty,
              water: -waterPenalty,
              gem: -gemPenalty
            }
            })
          });
          console.log(`Loss penalties saved: -${goldPenalty} gold, -${ironPenalty} iron,
          -${grainPenalty} grain, -${waterPenalty} water, -${gemPenalty} gem`);
        } catch (e) {
          console.error("Failed to save loss penalties:", e);
        }
      }
    },
    [] // Dependencies are handled by the state setters
  );

  //calculate star base on performance
  const calculateStars = (score, level) => {
    const baseThreshold = 100 * level;
    if (score >= baseThreshold * 1.5) return 3;
    if (score >= baseThreshold) return 2;
    if (score >= baseThreshold * 0.5) return 1;
    return 0;
  };

  const getLevelRewardMultiplier = (level) => {
    if (level === 999) return 1.0; // Endless has its own reward system
    if (level <= 3) return 1.0;
    if (level <= 7) return 1.5;
    if (level <= 12) return 2.0;
    if (level <= 17) return 3.0;
    if (level <= 20) return 4.0;
    return 1.0;
  };

  // Backend API integration points
  const fetchPlayerData = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/player/me`, {
        method: 'GET',
        headers: SessionManager.authHeaders(),
      });
      const data = await response.json();

      //transform backend to mathc frontend
      const playerData = {
        id: data.id,
        sessionId: data.sessionId,
        name: data.name,
        rank: data.rank,
        resources: {
          gold: data.gold,
          lobbyEnergy: data.lobbyEnergy,
          maxLobbyEnergy: data.maxLobbyEnergy,
          energyRechargeRate: 1,
          lastEnergyRechargeTime: new Date(data.lastEnergyRechargeTime).getTime(),
          iron: data.iron,
          grain: data.grain,
          water: data.water,
          gem: data.gem,
        },
        cards: data.cards ? data.cards.map(card => ({
          id: card.cardId,
          name: card.name,
          level: card.level,
          pieces: card.pieces,
          piecesNeeded: card.piecesNeeded,
          upgradeCost: getUpgradeCost(card.name, card.level),
          cost: getCardCost(card.name)
        })) : [{
          id: 1,
          name: "Basic Cop",
          level: 1,
          pieces: 0,
          piecesNeeded: 10,
          cost: 20,
          upgradeCost: {gold: 100, iron: 5, water: 3},
        },
          {
            id: 2,
            name: "Grenadier",
            level: 1,
            pieces: 0,
            piecesNeeded: 10,
            cost: 20,
            upgradeCost: { gold: 100, iron: 5, water: 3 },

        }],
        unlockedLevels: data.unlockedLevels || [1],
        completedLevels: data.completedLevels || [],
        levelStars: data.levelStars || Array(20).fill(0),
        collectedTreasures: data.collectedTreasures || [],
        revealedSecrets: [],
        endlessHighScore: data.endlessHighScore || 0,
        endlessStats: {totalWaves: 0, totalRuns: 0},
        achievements: [],
        totalStars: data.levelStars ? data.levelStars.reduce((a, b) => a + b, 0) : 0
      };
      setPlayerData(playerData);
    } catch (e) {
      console.error("Fail to fetch data:", e);
      //fallback to default data
      setPlayerData(getDefaultPlayerData());
    }
  }, []);

  const getUpgradeCost = (cardName, level) => {
    const baseCosts = {
      "Basic Cop": { gold: 100, iron: 5, water: 3 },
      "Healer Cop": { gold: 150, grain: 10, water: 5, gem: 1 },
      "Grenadier": { gold: 200, iron: 15, gem: 2 },
      "Barricade": { gold: 120, iron: 20, grain: 5 },
      "Energy Generator": { gold: 80, water: 10, grain: 20 },
      "Sniper": { gold: 400, water: 60, grain: 35, gem: 3},
      "Mortar": { gold: 350, iron: 30, water: 20, gem: 1 },
      "Frost Archer": { gold: 300, iron: 30, water: 20, gem: 2 },
      "Fire Blast": { gold: 300, iron: 50, water: 30, gem: 2 },
      "Ice Bomb": { gold: 300, iron: 30, water: 80, gem: 2 }
    };
    const base = baseCosts[cardName] || {gold : 100};
    const multiplier = Math.pow(1.5, level - 1);
    const cost = {};
    Object.entries(base).forEach(([resource, amount]) => {
      cost[resource] = Math.floor(amount * multiplier);
    });
    return cost;
  };

  const getCardCost = (cardName) => {
    const cost = {
      "Basic Cop": 20,
      "Healer Cop": 30,
      "Grenadier": 60,
      "Barricade": 30,
      "Energy Generator": 25,
      "Sniper": 100,
      "Mortar": 120,
      "Frost Archer": 35,
      "Fire Blast": 50,
      "Ice Bomb": 40
    };
    return cost[cardName] || 15;
  }

  const getPiecesNeeded = (defenderName) => {
    const piecesMap = {
      "Basic Cop": 10,
      "Energy Generator": 10,
      "Barricade": 10,
      "Grenadier": 10,
      "Healer Cop": 10,
      "Mortar": 15,
      "Frost Archer": 25,
      "Ice Bomb": 25,
      "Sniper": 25,
      "Fire Blast": 25
    };
    return piecesMap[defenderName] || 10;
  }

  const getDefaultPlayerData = () => {
    return {
      id: "default-player",
      sessionId: "default",
      name: "Garden Defender",
      rank: "Novice Gardener",
      resources: {
        gold: 100,
        lobbyEnergy: 50, // Current energy
        maxLobbyEnergy: 100, // Maximum energy capacity
        energyRechargeRate: 1, // Energy per minute
        lastEnergyRechargeTime: Date.now(), // Last recharge timestamp
        workers: 4,
        iron: 10,
        grain: 30,
        water: 40,
        gem: 5,
      },
      cards: [
        {
          id: 1,
          name: "Basic Cop",
          level: 1,
          pieces: 0,
          piecesNeeded: 10,
          upgradeCost: {gold: 100, iron: 5, water: 3},
          cost: 20
        },
      ],
      unlockedLevels: [1],
      completedLevels: [],
      levelStars: Array(20).fill(0),
      collectedTreasures: [],
      revealedSecrets: [],
      endlessHighScore: 0,
      endlessStats: {totalWaves: 0, totalRuns: 0},
      achievements: [],
      totalStars: 0
    };
  };

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
    }, 1000); // Check every second so the UI updates as soon as the minute rolls over

    return () => clearInterval(interval);
  }, []);

  const savePlayerData = useCallback(async (_data) => {
    try {
     // console.log("Player data saved (simulated)");
    } catch (error) {
      console.error("Failed to save player data:", error);
    }
  }, []);

  useEffect(() => {
    playerDataRef.current = playerData;
  }, [playerData]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlayerData();
    }

    return () => {
      if (playerDataRef.current) {
        savePlayerData(playerDataRef.current);
      }
    };
  }, [fetchPlayerData, savePlayerData, isAuthenticated]);

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

  // Start card upgrade
  const startCardUpgrade = useCallback(
    (cardId) => {
      if (!playerData) return;

      const card = playerData.cards.find((c) => c.id === cardId);
      if (!card) return;

      // Check if player has enough resources
      const canAfford = Object.entries(card.upgradeCost).every(
        ([resource, amount]) => playerData.resources[resource] >= amount);

      const hasEnoughPieces = card.pieces >= (card.piecesNeeded * card.level);

      if (canAfford && hasEnoughPieces) {
        Object.entries(card.upgradeCost).forEach(([resource, amount]) => {
          updateResource(resource, -amount);
        });

        //deduct card pieces
        setPlayerData(prev => ({
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === cardId ? {...c,
                  pieces: c.pieces - (c.piecesNeeded * c.level),
                level: c.level + 1}
          : c),
        }));
        console.log(`Card ${card.name} upgraded to level ${card.level + 1}`);
      } else {
        console.warn("Cannot start upgrade: requirements not met (resources or worker or cardpieces)");
      }
    },
    [playerData, updateResource]
  );

  // Game State management
  const startLevel = useCallback(async (levelId, selectedCards = null, _options = {}) => {
      if (!playerData) {
        console.error("Cannot start level: Player data or canvas not ready.");
        return;
      }

      if (levelId === 999) {
        const isUnlocked = playerData.completedLevels?.includes(10) ||
                           playerData.totalStars >= 50
        if (!isUnlocked) {
          alert("Complete Level 20 or collect 50 stars to unlock Endless Mode!");
          return;
        }
        setCurrentEndlessWave(0);
      }

      const levelCost = (levelId === 1 || levelId === 999) ? 0 : 8; // Level 1 is free
      const currentEnergy = playerData.resources.lobbyEnergy;

      if (currentEnergy < levelCost) {
        alert(`Not enough energy! You need ${levelCost} energy to start this level.`);
        return;
      }

      //deduct resources
      updateResource("lobbyEnergy", -levelCost);

      if (levelCost > 0) {
        try {
          await fetch(`http://localhost:8080/api/player/update-resources`, {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
                   resourcesChange: {lobbyEnergy: -levelCost}
                                 })
          });
        } catch (error) {
          console.error("Failed to sync energy with backend:", error);
        }
      }


      if (selectedCards) {
        setSelectedCardsForGame(selectedCards);
      }

      // Set game state
      setSelectedLevel(levelId);
      setGameState("inGame");
      setGameOver(false);
      setGameWon(false);
      setInGameEnergy(100); // Reset in-game energy
      setInGameScore(0); // Reset score
    },
    [playerData, updateResource]
  );

  const endGame = useCallback(async (result) => {
      // Result can be 'win' or 'loss'
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop(); // Ensure engine loop stops
        gameEngineRef.current.resetGame(); // Reset engine's internal state
      }

      if (result === "quit") {
        // Return to lobby with penalty (with cauze injury worker)
        setGameState("lobby");
        setGameOver(false);
        setGameWon(false);
        setSelectedLevel(null);
        setCurrentEndlessWave(0);
        return;
      }

      if (result === "replay") {
        // For replay, don't go back to lobby, just reset the game states
        setGameOver(false);
        setGameWon(false);
        setGameState("inGame");
        setCurrentEndlessWave(0);
        return;
      }
      //add collected card pieces to player data at game end
      if (collectedCardPieces.length > 0) {
        setPlayerData(prev => {
          const updatedCards = prev.cards.map(card => {
            const piecesForThisCard = collectedCardPieces.filter(
                pieceName => pieceName === card.name
            ).length;
            return {
              ...card,
              pieces: card.pieces + piecesForThisCard
            };
          });
          return  {
            ...prev,
            cards: updatedCards
          };
        });

        //send the cardpiece collected to backend
        try {
          //group the pieces by cardName
          const piecesMap = collectedCardPieces.reduce((acc, pieceName) => {
            acc[pieceName] = (acc[pieceName] || 0) + 1;
            return acc;
          }, {});
          //call backend for each card type
          for (const [cardName, count] of Object.entries(piecesMap)) {
            await fetch(`http://localhost:8080/api/player/add-card-pieces`, {
              method: "POST",
              headers: SessionManager.authHeaders(),
              body: JSON.stringify({
                cardName: cardName,
                pieces: count
                                   })
            });
          }
          await fetchPlayerData();
        } catch (error) {
          console.error("Failed to save card pieces:", error);
        }

        //clear collection after adding to player data
        setCollectedCardPieces([]);
      }
      setGameState("lobby");
      setGameOver(false); // Reset UI state
      setGameWon(false); // Reset UI state
      setSelectedLevel(null); // Clear selected level
      setCurrentEndlessWave(0);
      await savePlayerData(playerData);
      },
    [playerData, savePlayerData, collectedCardPieces, fetchPlayerData]
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

  const setGameEngine = useCallback((engine) => {
    gameEngineRef.current = engine;
  }, [])

  const openUpgradeModal = useCallback(() => {
    setGameState("upgrade");
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setGameState("lobby");
  }, []);

  // Achievement page handlers
  const openAchievements = useCallback(() => {
    setGameState("achievements");
  }, []);

  const closeAchievements = useCallback(() => {
    setGameState("lobby");
  }, []);

  // Collection page handlers
  const openCollection = useCallback(() => {
    setGameState("collection");
  }, []);

  const closeCollection = useCallback(() => {
    setGameState("lobby");
  }, []);

  // Settings modal handlers
  const openSettings = useCallback(() => {
    setGameState("settings");
  }, []);

  const closeSettings = useCallback(() => {
    setGameState("lobby");
  }, []);

  // Remove defender from game
  const removeDefender = useCallback(
      (x, y) => {
        if (gameEngineRef.current && gameState === "inGame") {
          return gameEngineRef.current.removeDefenderAt(x, y);
        }
        return false;
      },
      [gameState]
  );

  const updateEndlessWave = useCallback((wave) => {
    setCurrentEndlessWave(wave);
  }, []);

  const addCollectedPieces = useCallback((cardName) => {
    setCollectedCardPieces(prev => [...prev, cardName]);
  }, []);

  // : Collect treasure chest
  const collectTreasure = useCallback(async (chestId) => {
    const chest = chestsData.find(c => c.id === chestId);
    if (!chest) return;

    console.log("Chest in Comtext")
    setPlayerData(prev => {
      if (!prev) return prev;

      // Apply rewards
      const newResources = {...prev.resources};
      Object.entries(chest.rewards).forEach(([resource, amount]) => {
        if (resource === "defender") {
          //handle separately
          console.log("Chest With Defender");
          return;
        }
        if (resource === 'all') {
          ['gold', 'iron', 'grain', 'water'].forEach(res => {
            newResources[res] = (newResources[res] || 0) + amount;
          });
        } else {
          newResources[resource] = (newResources[resource] || 0) + amount;
        }
      });

      let newCards = [...prev.cards];
      if (chest.rewards.defender) {
        const defenderName = chest.rewards.defender;
        const hasDefender = newCards.some(card => card.name === defenderName);

        if (!hasDefender) {
          const newCardId = Math.max(...newCards.map(c => c.id), 0) + 1;
          newCards.push({
                          id: newCardId,
                          name: defenderName,
                          level: 1,
                          pieces: 0,
                          piecesNeeded: getPiecesNeeded(defenderName),
                          upgradeCost: getUpgradeCost(defenderName, 1)
                        });
        }
      }

      // Mark chest as collected
      const newCollectedTreasures = [...(prev.collectedTreasures || [])];
      if (!newCollectedTreasures.includes(chestId)) {
        newCollectedTreasures.push(chestId);
      }
      return {
        ...prev,
        resources: newResources,
        cards: newCards,
        collectedTreasures: newCollectedTreasures
      };
    });

    try {
      const backendRewards = {};
      Object.entries(chest.rewards).forEach(([resource, amount]) => {
        if (resource !== "defender" && resource !== "all") {
          backendRewards[resource] = amount;
        } else if (resource === "all") {
          ['gold', 'iron', 'grain', 'water'].forEach(res => {
            backendRewards[res] = amount;
          });
        }
      });

      await fetch(`http://localhost:8080/api/player/collect-treasure`, {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({
                               chestId: chestId,
                               rewards: backendRewards
                             })
      });

      if (chest.rewards.defender) {
        saveUnlockedDefender(chest.rewards.defender);
        setUnlockedDefender(chest.rewards.defender)
      }
    } catch (error) {
      console.error("Failed to save collected treasure:", error);
    }
  }, []);

  /**
   * Helper method to connect backend with the new card
   * @param defenderName
   * @returns {Promise<void>}
   */
  const saveUnlockedDefender = async (defenderName) => {
    if (!defenderName) return;

    try {
      await fetch(`http://localhost:8080/api/player/unlock-defender`, {
        method: 'POST',
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({ defenderName })
      });
    } catch (error) {
      console.error("Failed to save unlocked defender:", error);
    }
  }

  // Public API and context values
  const gameAPI = {
    gameState,
    playerData,
    setPlayerData,
    selectedLevel,
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    selectedCardsForGame,
    currentEndlessWave,
    startLevel,
    endGame,
    deployDefender,
    removeDefender,
    getGameEngine,
    setGameEngine,
    openUpgradeModal,
    closeUpgradeModal,
    startCardUpgrade,
    updateEnergyCb,
    updateScoreCb,
    onWinCb,
    onLoseCb,
    openAchievements,
    closeAchievements,
    openCollection,
    closeCollection,
    openSettings,
    closeSettings,
    collectTreasure,
    updateEndlessWave,
    updateResource,
    addCollectedPieces,
    collectedCardPieces,
    unlockedDefender,
    setUnlockedDefender,
    handleLogout,
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <GameContext.Provider value={gameAPI}>{children}</GameContext.Provider>
  );
};
