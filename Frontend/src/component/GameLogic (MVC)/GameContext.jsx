import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { GameEngine } from "./GameEngine";

export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

export const GameProvider = ({ children }) => {
  const gameEngineRef = useRef(null);
  const [inGameEnergy, setInGameEnergy] = useState(0);
  const [inGameScore, setInGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const [currentLevelSession, setCurrentLevelSession] = useState(1);

  // Player data (would normally come from backend)
  const [playerResources, setPlayerResources] = useState({
    gold: 500,
    lobbyEnergy: 50,
    maxLobbyEnergy: 100,
    energyRechargeRate: 1,
    lastEnergyRechargeTime: Date.now(),
    ownedCards: [
      { id: 1, name: "Basic Cop", cost: 20, width: 30, height: 40, type: "defender" },
      { id: 2, name: "Healer Cop", cost: 40, width: 35, height: 45, type: "defender" },
      { id: 3, name: "Grenadier", cost: 60, width: 40, height: 50, type: "defender" },
      { id: 4, name: "Barricade", cost: 30, width: 80, height: 30, type: "defender" }
    ],
    unlockedLevels: [1],
  });

  // Lobby energy recharge
 useEffect(() => {
    let rechargeInterval;
    
    const updateEnergy = () => {
      setPlayerResources(prev => {
        const now = Date.now();
        const timeElapsedMs = now - prev.lastEnergyRechargeTime;
        const minutesElapsed = timeElapsedMs / (1000 * 60);
        const energyToAdd = minutesElapsed * prev.energyRechargeRate;
        
        if (energyToAdd >= 1) {
          const wholeEnergy = Math.floor(energyToAdd);
          return {
            ...prev,
            lobbyEnergy: Math.min(prev.maxLobbyEnergy, prev.lobbyEnergy + wholeEnergy),
            lastEnergyRechargeTime: prev.lastEnergyRechargeTime + wholeEnergy * (1000 * 60) / prev.energyRechargeRate
          };
        }
        return prev;
      });
    };

    // Run immediately to update energy
    updateEnergy();
    
    // Set up interval to check every minute
    rechargeInterval = setInterval(updateEnergy, 60000);
    
    return () => clearInterval(rechargeInterval);
  }, []);

  // Game callbacks
  const updateEnergyCb = useCallback((energy) => setInGameEnergy(energy), []);
  const updateScoreCb = useCallback((score) => setInGameScore(score), []);
  
  const onWinCb = useCallback(() => {
    setGameOver(true);
    setGameWon(true);
    setPlayerResources(prev => ({
      ...prev,
      gold: prev.gold + inGameScore,
      unlockedLevels: prev.unlockedLevels.includes(currentLevelSession + 1) 
        ? prev.unlockedLevels 
        : [...prev.unlockedLevels, currentLevelSession + 1].sort((a, b) => a - b)
    }));
  }, [inGameScore, currentLevelSession]);

  const onLoseCb = useCallback(() => {
    setGameOver(true);
    setGameWon(false);
    setPlayerResources(prev => ({
      ...prev,
      gold: Math.max(0, prev.gold - Math.floor(inGameScore * 0.05))
    }));
  }, [inGameScore]);

  // Start a level
  const startLevel = useCallback((canvas, levelNumber) => {
    if (!canvas) return;
    
    const levelCost = levelNumber === 1 ? 0 : 10;
    if (playerResources.lobbyEnergy < levelCost && levelNumber > 1) {
      console.warn("Not enough energy!");
      return;
    }
    
    // Deduct energy
    if (levelNumber > 1) {
      setPlayerResources(prev => ({
        ...prev,
        lobbyEnergy: Math.max(0, prev.lobbyEnergy - levelCost)
      }));
    }
    
    // Initialize game engine
    if (!gameEngineRef.current) {
      gameEngineRef.current = new GameEngine(
        updateEnergyCb,
        updateScoreCb,
        onWinCb,
        onLoseCb
      );
    }
    
    const ctx = canvas.getContext("2d");
    gameEngineRef.current.initialize(ctx, canvas.width, canvas.height, levelNumber);
    setCurrentLevelSession(levelNumber);
    setIsGameInitialized(true);
    setGameOver(false);
    setGameWon(false);
  }, [playerResources.lobbyEnergy, updateEnergyCb, updateScoreCb, onWinCb, onLoseCb]);

  // Deploy defender
  const deployDefender = useCallback((cardData, x, y) => {
    if (gameEngineRef.current && !gameOver) {
      gameEngineRef.current.deployDefenderUnit(cardData, x, y);
    }
  }, [gameOver]);

  // Game API
  const gameAPI = {
    inGameEnergy,
    inGameScore,
    gameOver,
    gameWon,
    isGameInitialized,
    playerResources,
    currentLevelSession,
    startLevel,
    deployDefender,
    returnToLobby: () => {
      setGameOver(false);
      setGameWon(false);
      setIsGameInitialized(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop();
      }
    };
  }, []);

  return (
    <GameContext.Provider value={gameAPI}>
      {children}
    </GameContext.Provider>
  );
};