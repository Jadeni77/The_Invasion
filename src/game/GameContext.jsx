//This file handles Game interaction with the GameEngine.js

import React from "react";
import { GameEngine } from "./GameEngine";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

//create game context (React built-in CreateContect())
export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

//Game provider Component
export const GameProvider = ({ children }) => {
  const gameEngineRef = useRef(null); // useRef to hold the mutable GameEngine instance

  //-----In Game states -------
  const [inGameEnergy, setInGameEnergy] = useState(0);
  const [inGameScore, setInGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const [currentLevelSession, setCurrentLevelSession] = useState(1); //the level being play

  //----Backend placeholder for persistent Player Data ----
  //Note that this will be loaded from backend database
  const [playerResources, setPlayerResources] = useState({
    gold: 500,
    lobbyEnergy: 50, //energy to start a game
    maxLobbyEnergy: 100,
    energyRechargeRate: 1,
    lastEnergyRechargeTime: Date.now(),
    ownedCard: [
      {
        name: "Basic Cop",
        cost: 20,
        width: 30,
        height: 40,
        type: "defender",
      },
      {
        name: "Healer Cop",
        cost: 40,
        width: 35,
        height: 45,
        type: "defender",
      },
      {
        name: "Grenadier",
        cost: 60,
        width: 40,
        height: 50,
        type: "defender",
      },
      {
        name: "Barricade",
        cost: 30,
        width: 80,
        height: 30,
        type: "defender",
      },
    ],
    unlockedLevels: [1], //track the level player had
    //other resources like materials, special ability.....
  });

  //--Lobby Energy Recharge Logic ---
  useEffect(() => {
    const rechargeableInterval = setInterval(() => {
      setPlayerResources((prevResources) => {
        const now = Date.now();
        const timeElapsedMinutes =
          (now - prevResources.lastEnergyRechargeTime) / (1000 * 60);
        const energyGained = Math.floor(
          timeElapsedMinutes * prevResources.energyRechargeRate
        );

        if (energyGained > 0) {
          const newLobbyEnergy = Math.min(
            prevResources.maxLobbyEnergy,
            prevResources.lobbyEnergy + energyGained
          );
          // Only update last recharge time if energy was actually gained
          const newLastRechargeTime =
            prevResources.lastEnergyRechargeTime +
            (energyGained / prevResources.energyRechargeRate) * (1000 * 60);

          return {
            ...prevResources,
            lobbyEnergy: newLobbyEnergy,
            lastEnergyRechargeTime: newLastRechargeTime,
          };
        }
        return prevResources;
      });
    }, 60000); //check every min (can be adjusted as needed)
    return () => clearInterval(rechargeableInterval);
  }, []);

  //callbacks for GameEngine to update React state
  const updateEnergyCb = useCallback((energy) => {
    setInGameEnergy(energy);
  }, []);

  const updateScoreCb = useCallback((score) => {
    setInGameScore(score);
  }, []);

  const onWinCb = useCallback(() => {
    setGameOver(true);
    setGameWon(true);
    console.log("Game won! Updating player resources...");

    //Backend Placeholder: update player persistent resouces upon winning
    // The backend would handle XP, gold, unlocking levels, etc.
    setPlayerResources((prev) => {
      const newGold = prev.gold + inGameScore; //placeholder to add score to gold
      const newUnlockedLevels = [...prev.unlockedLevels];
      //unlock the next level if not already unlock when win
      if (!newUnlockedLevels.includes(this.currentLevelSession + 1)) {
        newUnlockedLevels.push(this.currentLevelSession + 1);
        newUnlockedLevels.sort((a, b) => a - b); // Keep them sorted
      }
      return {
        ...prev,
        gold: newGold,
        unlockedLevels: newUnlockedLevels,
      };
    });
    //popuo component listen to 'gameover' and 'gamewon' states to display award
    //and prompt to back to the lobby
  }, [inGameScore, currentLevelSession]); // Depend on inGameScore and currentLevelSessio

  const onLoseCb = useCallback(({ score, level, reason }) => {
    setGameOver(true);
    setGameWon(false);
    console.log(`Game lost! Reason: ${reason}. Score: ${score}`);

    //backeend placeholder: update player persistent resounces upon losing
    setPlayerResources((prev) => ({
      ...prev,
      gold: Math.max(0, prev.gold - Math.floor(score * 0.05)), // Example: lose 5% of score as gold, minimum 0
    }));
    //No lobby energy deduction bc already deduct when start the game
    // The popup component would listen to `gameOver` and `gameWon` to display relevant message.
  }, []); //no need to depend on score or level here if only deducting flat rate

  //Function to start a specific level (that is unlock)
  const startLevel = useCallback(
    (canvas, levelNumber) => {
      if (!canvas) {
        console.error("Canvas element not provided for game initialization.");
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Could not get 2D context from canvas.");
        return;
      }

      //check lobby energy before starting the level
      //backend placeholder: energy deduction should be handle here
      if (playerResources.lobbyEnergy < 10 && levelNumber > 1) {
        //ex to cost 10 per level
        console.warn("Not enough lobby energy to start this level!");
        //TODO: trigger a UI notification here,
        return;
      }

      //Deduct lobby energy if it is not level 1 (level 1 free to play)
      if (levelNumber > 1) {
        setPlayerResources((prev) => ({
          ...prev,
          lobbyEnergy: Math.max(0, prev.lobbyEnergy - 10),
        }));
      }

      // Initialize GameEngine if it doesn't exist or re-initialize for new level
      if (!gameEngineRef.current) {
        gameEngineRef.current = new GameEngine(
          updateEnergyCb,
          updateScoreCb,
          onWinCb,
          onLoseCb
        );
      }
      gameEngineRef.current.initialize(
        ctx,
        canvas.width,
        canvas.height,
        levelNumber
      );
      setCurrentLevelSession(levelNumber);
      setIsGameInitialized(true);
      setGameOver(false);
      setGameWon(false);
    },
    [
      playerResources.lobbyEnergy,
      updateEnergyCb,
      updateScoreCb,
      onWinCb,
      onLoseCb,
    ]
  );

  //public api for all other components
  const gameAPI = {
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    isGameInitialized,
    playerResources,
    currentLevelSession,
    // Method to initiate a level from the lobby/game board
    startLevel,
    // Method to allow GameBoard to deploy a defender at specific coords
    deployDefender: (cardData, x, y) => {
      if (gameEngineRef.current) {
        gameEngineRef.current.deployDefenderUnit(cardData, x, y);
      }
    },
    // Method to get a reference to the GameEngine for direct canvas operations
    getGameEngine: () => gameEngineRef.current,
    returnToLobby: () => {
      //reset game state and manye redirect react UI
      setGameOver(false);
      setGameWon(false);
      setIsGameInitialized(false);
      // Logic to navigate to a 'Lobby' route/component would go here in App.js
      console.log("Returning to lobby.");
    },

    //player can select a level to play in their lobby
    selectLevelInLobby: (levelNumber) => {
      //placeholder: it will need other parent components here
      console.log(`Level ${levelNumber} selected in lobby.`);
    },
  };

  //cleanup on componennts
  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop();
      }
    };
  }, []);

  return (
    <GameContext.Provider value={gameAPI}>{children}</GameContext.Provider>
  );
};
