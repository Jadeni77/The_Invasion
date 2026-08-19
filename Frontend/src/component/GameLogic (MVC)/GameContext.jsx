/* eslint-disable react-refresh/only-export-components */
// src/component/GameLogic (MVC)/GameContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { chestsData, chestDefenders, resourceRewardsOf, chestCardPieces } from "../GameRendering/MapLayout.jsx";
import { SessionManager } from "./SessionManager.js";
import LoginPage from "../login/LoginPage.jsx";
import { FeedbackBus } from "./Feedback/FeedbackBus.js";
import { AudioManager } from "./Feedback/AudioManager.js";
import { JuiceManager } from "./Feedback/JuiceManager.js";
import { MusicPlayer } from "./Feedback/MusicPlayer.js";
import { FeedbackManager } from "./Feedback/FeedbackManager.js";
import { loadSettings, subscribe } from "./Feedback/SettingsStore.js";
import { SAMPLE_URLS, unknownSampleNames } from "./Feedback/UnitSamples.js";
import { SOUND_KEYS } from "./Feedback/SoundGroups.js";
import { apiUrl } from "../../config/api.js";
import { MAX_DEFENDER_LEVEL } from "./DefenderClassUtils.js";
import { defenderUnlockedBy, defendersEarnedBy } from "./LevelUnlocks.js";

export const GameContext = createContext();

export const useGame = () => {
  return useContext(GameContext);
};

/* What one energy purchase costs and grants. */
export const ENERGY_PACK = { amount: 10, gold: 150 };

/* What starting a level costs. Level 1 and endless are free. */
export const LEVEL_ENERGY_COST = 8;

/** The energy `levelId` costs to start. */
export function energyCostOf(levelId) {
  return levelId === 1 || levelId === 999 ? 0 : LEVEL_ENERGY_COST;
}

const getUpgradeCost = (cardName, level) => {
  const baseCosts = {
    Shooter: { gold: 100, iron: 5, water: 3 },
    Healer: { gold: 150, grain: 10, water: 5, gem: 1 },
    Grenadier: { gold: 200, iron: 15, gem: 2 },
    Barricade: { gold: 120, iron: 20, grain: 5 },
    "E-Gen": { gold: 80, water: 10, grain: 20 },
    Sniper: { gold: 400, water: 60, grain: 35, gem: 3 },
    Mortar: { gold: 350, iron: 30, water: 20, gem: 1 },
    "Frost Archer": { gold: 300, iron: 30, water: 20, gem: 2 },
    "Fire Blast": { gold: 300, iron: 50, water: 30, gem: 2 },
    "Ice Bomb": { gold: 300, iron: 30, water: 80, gem: 2 },
  };
  const base = baseCosts[cardName] || { gold: 100 };
  const multiplier = Math.pow(1.5, level - 1);
  const cost = {};
  Object.entries(base).forEach(([resource, amount]) => {
    cost[resource] = Math.floor(amount * multiplier);
  });
  return cost;
};

const getCardCost = (cardName) => {
  const cost = {
    Shooter: 20,
    Healer: 30,
    Grenadier: 60,
    Barricade: 30,
    "E-Gen": 25,
    Sniper: 100,
    Mortar: 120,
    "Frost Archer": 35,
    "Fire Blast": 50,
    "Ice Bomb": 40,
  };
  return cost[cardName] || 15;
};

const getPiecesNeeded = (defenderName) => {
  const piecesMap = {
    Shooter: 10,
    "E-Gen": 10,
    Barricade: 10,
    Grenadier: 10,
    Healer: 10,
    Mortar: 15,
    "Frost Archer": 25,
    "Ice Bomb": 25,
    Sniper: 25,
    "Fire Blast": 25,
  };
  return piecesMap[defenderName] || 10;
};

/**
 * `cards` with `defenderName` added, or the same list if it is already owned.
 *
 * The one place a card is built. Winning a level and opening a chest both go
 * through here, so the two cannot drift - and because it returns the list
 * unchanged for a defender already held, replaying level 3 cannot hand out a
 * second Grenadier.
 *
 * The id is computed from the list being built rather than from the player's
 * saved cards, so two defenders granted in the same update cannot collide.
 */
export const withDefender = (cards, defenderName) => {
  if (!defenderName) return cards;
  if (cards.some((card) => card.name === defenderName)) return cards;

  return [...cards, {
    id: Math.max(...cards.map((c) => c.id), 0) + 1,
    name: defenderName,
    level: 1,
    pieces: 0,
    piecesNeeded: getPiecesNeeded(defenderName),
    upgradeCost: getUpgradeCost(defenderName, 1),
  }];
};

export const GameProvider = ({ children }) => {
  const gameEngineRef = useRef(null); // Ref to hold the GameEngine instance

  const feedbackRef = useRef(null);
  if (feedbackRef.current === null) {
    const bus = new FeedbackBus();
    const audio = new AudioManager();
    const juice = new JuiceManager();
    const music = new MusicPlayer(audio);
    const manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
    manager.applySettings(loadSettings());
    feedbackRef.current = { bus, audio, juice, music, manager };
  }

  // Keep audio and juice in step with the settings panel.
  useEffect(() => subscribe((settings) => {
    feedbackRef.current.manager.applySettings(settings);
  }), []);

  // Browsers block AudioContext until a user gesture, so start on first click.
  useEffect(() => {
    let cancelled = false;
    const startAudio = () => {
      feedbackRef.current.audio
        .resume()
        .then(() => {
          if (cancelled) return;
          feedbackRef.current.audio.setVolumes(loadSettings().audio);
          const misnamed = unknownSampleNames(Object.keys(SAMPLE_URLS));
          if (misnamed.length > 0) {
            console.warn(
              `Audio sample files match no sound key and will never play: ${misnamed.join(", ")}. ` +
              `Name each file after a sound key, not after a unit class - the keys are ` +
              `${SOUND_KEYS.join(", ")}. See src/assets/audio/units/README.md for the checklist.`,
            );
          }
          feedbackRef.current.audio.loadSamples(SAMPLE_URLS);
          feedbackRef.current.music.start();
          // Only remove the listener once resume actually succeeds, so a
          // rejected resume() (e.g. blocked by browser policy) can retry on
          // the next gesture instead of being silently stuck forever.
          window.removeEventListener("pointerdown", startAudio);
        })
        .catch((err) => {
          console.error("Failed to resume AudioContext on user gesture; will retry on next interaction.", err);
        });
    };
    window.addEventListener("pointerdown", startAudio);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", startAudio);
    };
  }, []);

  const [gameState, setGameState] = useState("lobby"); // lobby, inGame, upgrade
  const [selectedLevel, setSelectedLevel] = useState(null); // The level selected to play
  const [playerData, setPlayerData] = useState(null);
  const playerDataRef = useRef(null);

  /* Defenders already back-granted this session. fetchPlayerData runs on mount
     and again after every win, so without this the same catch-up POST goes out
     on each one until the server's copy catches up. */
  const backGrantedRef = useRef(new Set());

  // In-game session specific states (managed by GameEngine, exposed via callbacks)
  const [inGameEnergy, setInGameEnergy] = useState(0);
  const [inGameScore, setInGameScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const [selectedCardsForGame, setSelectedCardsForGame] = useState(null);
  const [collectedCardPieces, setCollectedCardPieces] = useState([]);

  //endless mode tracking
  const [currentEndlessWave, setCurrentEndlessWave] = useState(0);
  /* The reward the player just collected, or null. */
  const [chestReward, setChestReward] = useState(null);

  /**
   * Something the player needs to be told, shown in-game rather than by the
   * browser. `kind` is 'energy' when the shortfall is buyable, 'locked' otherwise.
   */
  const [gateNotice, setGateNotice] = useState(null);

  //authentication
  const [isAuthenticated, setIsAuthenticated] = useState(
    SessionManager.isLoggedIn(),
  );

  const handleLogin = (token, player) => {
    SessionManager.setToken(token);
    SessionManager.setUser(player);
    setPlayerData(player);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    backGrantedRef.current.clear();
    SessionManager.clearSession();
    setPlayerData(null);
    setIsAuthenticated(false);
  };

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
  const onWinCb = useCallback(async ({ score, level, enemiesKilled = 0, defendersDeployed = 0, energyCollected = 0, defendersLost = 0, baseDamageTaken = 0, timeElapsed = 0 }) => {
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

      const newCompleteLevels = [...(prev.completedLevels || [])];
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
        newLevelStars[level - 1] = Math.max(
          newLevelStars[level - 1] || 0,
          stars,
        );
      }

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
        // Credited here, before any request goes out, so a dead backend cannot
        // swallow a defender the player has already been told they won.
        cards: withDefender(prev.cards, defenderUnlockedBy(level)),
        unlockedLevels: newUnlockedLevels,
        completedLevels: newCompleteLevels,
        levelStars: newLevelStars,
        totalStars: newLevelStars.reduce((sum, s) => sum + s, 0),
      };
    });

    /*
     * Tell the player, on the same notice a chest uses. `playerDataRef` still
     * holds the save as it was before this win, which is what makes "did they
     * already have it" answerable - a replay of level 3 wins nothing and says
     * nothing.
     */
    const wonDefender = defenderUnlockedBy(level);
    const isNewDefender = Boolean(wonDefender)
      && !(playerDataRef.current?.cards ?? []).some((card) => card.name === wonDefender);

    if (isNewDefender) {
      setChestReward({ source: "level", levelId: level, resources: {}, defenders: [wonDefender] });
      feedbackRef.current?.bus?.emit("defender:unlocked", { defenderName: wonDefender });
    }

    //Save the result to backend
    try {
      await fetch(apiUrl(`/api/player/complete-level`), {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({ levelId: level, score: score, stars: stars }),
      });

      await fetch(apiUrl(`/api/player/update-stats`), {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({ enemiesKilled, defendersDeployed, energyCollected }),
      });

      // The same helper the chest path uses; no backend change needed.
      if (isNewDefender) await saveUnlockedDefender(wonDefender);

      const specialUnlocks = [];
      if (defendersLost === 0) specialUnlocks.push('perfect_defense');
      if (baseDamageTaken === 0) specialUnlocks.push('untouchable');
      if (timeElapsed < 120000 && level !== 999) specialUnlocks.push('speed_demon');
      for (const id of specialUnlocks) {
        await fetch(apiUrl(`/api/player/unlock-special-achievement`), {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({ achievementId: id }),
        });
      }

      await fetchPlayerData();
    } catch (error) {
      console.error("Failed to save to backend:", error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Pay out an endless run and record how far it got.
   *
   * Shared by dying and by quitting. It used to live only in onLoseCb, so a
   * player who stopped a run voluntarily banked nothing while one who let the
   * base fall banked everything - the game paid you to lose on purpose, and
   * endless has no other ending.
   */
  const bankEndlessRun = useCallback(
    async ({ endlessWave, enemiesKilled = 0, defendersDeployed = 0, energyCollected = 0 }) => {
      const goldEarned = Math.floor(endlessWave * 25);
      const ironEarned = Math.floor(endlessWave * 10);
      const grainEarned = Math.floor(endlessWave * 10);
      const waterEarned = Math.floor(endlessWave * 8);
      const gemEarned = Math.floor(endlessWave / 10);

      setPlayerData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          resources: {
            ...prev.resources,
            gold: prev.resources.gold + goldEarned,
            iron: prev.resources.iron + ironEarned,
            grain: prev.resources.grain + grainEarned,
            water: prev.resources.water + waterEarned,
            gem: prev.resources.gem + gemEarned,
          },
          endlessHighScore: Math.max(prev.endlessHighScore || 0, endlessWave),
          endlessStats: {
            ...prev.endlessStats,
            totalWaves: (prev.endlessStats?.totalWaves || 0) + endlessWave,
            totalRuns: (prev.endlessStats?.totalRuns || 0) + 1,
          },
        };
      });

      try {
        await fetch(apiUrl(`/api/player/update-resources`), {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({
            resourcesChange: {
              gold: goldEarned, iron: ironEarned, grain: grainEarned,
              water: waterEarned, gem: gemEarned,
            },
          }),
        });

        await fetch(apiUrl(`/api/player/endless-score`), {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({ waveReached: endlessWave }),
        });

        await fetch(apiUrl(`/api/player/update-stats`), {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({ enemiesKilled, defendersDeployed, energyCollected }),
        });
      } catch (e) {
        console.error("Failed to bank an endless run:", e);
      }
    },
    [],
  );

  //handle game loss logic
  const onLoseCb = useCallback(
    async ({ score, level, reason, endlessWave, enemiesKilled = 0, defendersDeployed = 0, energyCollected = 0 }) => {
      setGameOver(true);
      setGameWon(false);
      console.log(
        `Game lost! Level: ${level}, Reason: ${reason}, Score: ${score}`,
      );

      if (level === 999) {
        await bankEndlessRun({ endlessWave, enemiesKilled, defendersDeployed, energyCollected });
      } else {
        // Deduct resources on loss
        const goldPenalty = 50;
        const ironPenalty = 10;
        const grainPenalty = 10;
        const waterPenalty = 50;
        const gemPenalty = 1;

        setPlayerData((prev) => {
          console.log(
            "Set Player Data Resources Logic Being called in onLoseCb",
          );
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
          await fetch(apiUrl(`/api/player/update-resources`), {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
              resourcesChange: {
                gold: -goldPenalty,
                iron: -ironPenalty,
                grain: -grainPenalty,
                water: -waterPenalty,
                gem: -gemPenalty,
              },
            }),
          });
          await fetch(apiUrl(`/api/player/update-stats`), {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({ enemiesKilled, defendersDeployed, energyCollected }),
          });
        } catch (e) {
          console.error("Failed to save loss penalties:", e);
        }
      }
    },
    [bankEndlessRun], // Everything else is handled by the state setters
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
      const response = await fetch(apiUrl(`/api/player/me`), {
        method: "GET",
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
          lastEnergyRechargeTime: new Date(
            data.lastEnergyRechargeTime,
          ).getTime(),
          iron: data.iron,
          grain: data.grain,
          water: data.water,
          gem: data.gem,
        },
        cards: data.cards
          ? data.cards.map((card) => ({
              id: card.cardId,
              name: card.name,
              level: card.level,
              pieces: card.pieces,
              piecesNeeded: card.piecesNeeded,
              upgradeCost: getUpgradeCost(card.name, card.level),
              cost: getCardCost(card.name),
            }))
          : [
              {
                id: 1,
                name: "Shooter",
                level: 1,
                pieces: 0,
                piecesNeeded: 10,
                cost: 20,
                upgradeCost: { gold: 100, iron: 5, water: 3 },
              },
              {
                id: 2,
                name: "Grenadier",
                level: 1,
                pieces: 0,
                piecesNeeded: 10,
                cost: 20,
                upgradeCost: { gold: 100, iron: 5, water: 3 },
              },
            ],
        unlockedLevels: data.unlockedLevels || [1],
        completedLevels: data.completedLevels || [],
        levelStars: data.levelStars || Array(20).fill(0),
        collectedTreasures: data.collectedTreasures || [],
        revealedSecrets: [],
        endlessHighScore: data.endlessHighScore || 0,
        endlessStats: { totalWaves: 0, totalRuns: 0 },
        totalStars: data.levelStars
          ? data.levelStars.reduce((a, b) => a + b, 0)
          : 0,
        totalEnemiesKilled: data.totalEnemiesKilled || 0,
        totalDefendersDeployed: data.totalDefendersDeployed || 0,
        totalEnergyCollected: data.totalEnergyCollected || 0,
        claimedAchievements: data.claimedAchievements || [],
        specialAchievements: data.specialAchievements || [],
      };

      /*
       * Hand over anything the player's cleared levels earned but never gave
       * them. Defenders used to come from optional chests, so a save can hold
       * levels 1-8 finished and none of the defenders those wins now grant -
       * and the win handler only ever fires on a NEW win, so nothing else would
       * ever settle it. Owned defenders are left alone, which makes this safe
       * to run on every load rather than needing a one-time flag.
       */
      const earned = defendersEarnedBy(playerData.completedLevels);
      const owed = earned.filter(
        (name) => !playerData.cards.some((card) => card.name === name),
      );
      const toPersist = owed.filter((name) => !backGrantedRef.current.has(name));
      for (const name of toPersist) backGrantedRef.current.add(name);
      for (const name of owed) {
        playerData.cards = withDefender(playerData.cards, name);
      }

      setPlayerData(playerData);

      // The player already has these on screen; a failed save retries next load.
      for (const name of toPersist) await saveUnlockedDefender(name);
    } catch (e) {
      console.error("Fail to fetch data:", e);
      // Only fall back to defaults if there's no existing player data in memory
      setPlayerData((prev) => prev ?? getDefaultPlayerData());
    }
  }, []);

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
          name: "Shooter",
          level: 1,
          pieces: 0,
          piecesNeeded: 10,
          upgradeCost: { gold: 100, iron: 5, water: 3 },
          cost: 20,
        },
      ],
      unlockedLevels: [1],
      completedLevels: [],
      levelStars: Array(20).fill(0),
      collectedTreasures: [],
      revealedSecrets: [],
      endlessHighScore: 0,
      endlessStats: { totalWaves: 0, totalRuns: 0 },
      totalStars: 0,
      totalEnemiesKilled: 0,
      totalDefendersDeployed: 0,
      totalEnergyCollected: 0,
      claimedAchievements: [],
      specialAchievements: [],
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
                prev.resources.lobbyEnergy + wholeEnergy,
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
        ([resource, amount]) => playerData.resources[resource] >= amount,
      );

      const hasEnoughPieces = card.pieces >= card.piecesNeeded * card.level;

      /*
       * The ceiling. There was none: this function checked resources and
       * pieces and nothing else, so a defender could be upgraded without limit
       * - a level 100 Sniper that one-shots the campaign, with stats
       * extrapolated far past the ability table that is supposed to define
       * them.
       */
      if (card.level >= MAX_DEFENDER_LEVEL) return;

      if (canAfford && hasEnoughPieces) {
        Object.entries(card.upgradeCost).forEach(([resource, amount]) => {
          updateResource(resource, -amount);
        });

        //deduct card pieces
        setPlayerData((prev) => ({
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === cardId
              ? {
                  ...c,
                  pieces: c.pieces - c.piecesNeeded * c.level,
                  level: c.level + 1,
                }
              : c,
          ),
        }));
        console.log(`Card ${card.name} upgraded to level ${card.level + 1}`);
      } else {
        console.warn(
          "Cannot start upgrade: requirements not met (resources or worker or cardpieces)",
        );
      }
    },
    [playerData, updateResource],
  );

  // Game State management
  /* Buying energy instead of waiting for it. */


  const canBuyEnergy = () => {
    if (!playerData?.resources) return false;
    const { lobbyEnergy, maxLobbyEnergy, gold } = playerData.resources;
    return gold >= ENERGY_PACK.gold && lobbyEnergy < maxLobbyEnergy;
  };

  const buyEnergy = useCallback(async () => {
    if (!playerData?.resources) return false;
    const { lobbyEnergy, maxLobbyEnergy, gold } = playerData.resources;

    if (gold < ENERGY_PACK.gold) return false;
    if (lobbyEnergy >= maxLobbyEnergy) return false;

    // Capped, not overfilled - a player near the cap pays full price for what fits.
    const granted = Math.min(ENERGY_PACK.amount, maxLobbyEnergy - lobbyEnergy);

    setPlayerData((prev) => (!prev ? prev : {
      ...prev,
      resources: {
        ...prev.resources,
        gold: prev.resources.gold - ENERGY_PACK.gold,
        lobbyEnergy: prev.resources.lobbyEnergy + granted,
      },
    }));

    // Persisted after the local change: a failed request must not silently undo
    // what the player already saw.
    try {
      await fetch(apiUrl(`/api/player/update-resources`), {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({
          resourcesChange: { gold: -ENERGY_PACK.gold, lobbyEnergy: granted },
        }),
      });
    } catch (error) {
      console.error("Failed to persist an energy purchase:", error);
    }
    return true;
  }, [playerData]);

  const startLevel = useCallback(
    async (levelId, selectedCards = null, _options = {}) => {
      if (!playerData) {
        console.error("Cannot start level: Player data or canvas not ready.");
        return;
      }

      if (levelId === 999) {
        const isUnlocked =
          playerData.completedLevels?.includes(10) ||
          playerData.totalStars >= 50;
        if (!isUnlocked) {
          setGateNotice({
            kind: "locked",
            title: "Endless Mode is locked",
            message: "Complete Level 20 or collect 50 stars to unlock it.",
          });
          return;
        }
        setCurrentEndlessWave(0);
      }

      const levelCost = energyCostOf(levelId);
      const currentEnergy = playerData.resources.lobbyEnergy;

      if (currentEnergy < levelCost) {
        // The chosen cards ride along so buying energy can start the level the
        // player set up, rather than sending them back to pick a deck again.
        setGateNotice({
          kind: "energy",
          levelId,
          needed: levelCost,
          have: currentEnergy,
          selectedCards,
        });
        return;
      }

      //deduct resources
      updateResource("lobbyEnergy", -levelCost);

      if (levelCost > 0) {
        try {
          await fetch(apiUrl(`/api/player/update-resources`), {
            method: "POST",
            headers: SessionManager.authHeaders(),
            body: JSON.stringify({
              resourcesChange: { lobbyEnergy: -levelCost },
            }),
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
    [playerData, updateResource],
  );

  const endGame = useCallback(
    async (result) => {
      // Result can be 'win' or 'loss'
      if (gameEngineRef.current) {
        gameEngineRef.current.stopLoop(); // Ensure engine loop stops
        // false: this is end-of-level cleanup, not a new level starting, so
        // don't let the wave-1 horn stack on top of the win/loss sting.
        gameEngineRef.current.resetGame(false); // Reset engine's internal state
      }

      if (result === "quit") {
        /* Endless has no ending but stopping, so quitting banks the run. The
           campaign keeps its forfeit: the energy is spent and the level pays
           nothing. */
        if (selectedLevel === 999 && currentEndlessWave > 0) {
          await bankEndlessRun({ endlessWave: currentEndlessWave });
        }

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
        setPlayerData((prev) => {
          const updatedCards = prev.cards.map((card) => {
            const piecesForThisCard = collectedCardPieces.filter(
              (pieceName) => pieceName === card.name,
            ).length;
            return {
              ...card,
              pieces: card.pieces + piecesForThisCard,
            };
          });
          return {
            ...prev,
            cards: updatedCards,
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
            await fetch(apiUrl(`/api/player/add-card-pieces`), {
              method: "POST",
              headers: SessionManager.authHeaders(),
              body: JSON.stringify({
                cardName: cardName,
                pieces: count,
              }),
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
    [playerData, savePlayerData, collectedCardPieces, fetchPlayerData,
     selectedLevel, currentEndlessWave, bankEndlessRun],
  );

  const deployDefender = useCallback(
    (cardData, x, y) => {
      if (gameEngineRef.current && gameState === "inGame") {
        gameEngineRef.current.deployDefenderUnit(cardData, x, y);
      }
    },
    [gameState],
  );

  const getGameEngine = useCallback(() => gameEngineRef.current, []); // Expose engine instance

  const setGameEngine = useCallback((engine) => {
    gameEngineRef.current = engine;
  }, []);

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
    [gameState],
  );

  const updateEndlessWave = useCallback((wave) => {
    setCurrentEndlessWave(wave);
  }, []);

  const addCollectedPieces = useCallback((cardName) => {
    setCollectedCardPieces((prev) => [...prev, cardName]);
  }, []);

  // : Collect treasure chest
  const collectTreasure = useCallback(async (chestId) => {
    const chest = chestsData.find((c) => c.id === chestId);
    if (!chest) return;

    console.log("Chest in Comtext");
    setPlayerData((prev) => {
      if (!prev) return prev;

      // Apply rewards. `all` expansion and the defender exclusion both live in
      // resourceRewardsOf (MapLayout) rather than being resolved here, because
      // the backend payload below needs the same answer and used to compute its
      // own - see that helper's comment for the 1000-gold disagreement that
      // caused.
      const newResources = { ...prev.resources };
      for (const [resource, amount] of Object.entries(resourceRewardsOf(chest))) {
        newResources[resource] = (newResources[resource] || 0) + amount;
      }

      // Defenders come from winning levels now; a chest that still names one
      // is honoured rather than dropped on the floor.
      let newCards = prev.cards;
      for (const defenderName of chestDefenders(chest)) {
        newCards = withDefender(newCards, defenderName);
      }

      /* Pieces toward a defender the player already holds. Each chest names one
         it is certain they own by the level that reveals it, so nothing is
         credited to a card that is not there to receive it. */
      const pieceGrants = chestCardPieces(chest);
      if (Object.keys(pieceGrants).length > 0) {
        newCards = newCards.map((card) => (
          pieceGrants[card.name]
            ? { ...card, pieces: (card.pieces || 0) + pieceGrants[card.name] }
            : card
        ));
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
        collectedTreasures: newCollectedTreasures,
      };
    });

    /* Tell the player what they got, and play it, BEFORE any network call. */
    const unlocked = chestDefenders(chest);
    setChestReward({
      chestId,
      resources: resourceRewardsOf(chest),
      defenders: unlocked,
      cardPieces: chestCardPieces(chest),
    });
    feedbackRef.current?.bus?.emit('treasure:collected', { chestId, unlockedDefenders: unlocked });

    try {
      // The same expansion the player was credited with above, not a second
      // one computed here. The second copy assigned where the first
      // accumulated, so a chest carrying both `gold` and `all` credited the
      // player and told the server different numbers.
      await fetch(apiUrl(`/api/player/collect-treasure`), {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({
          chestId: chestId,
          rewards: resourceRewardsOf(chest),
        }),
      });

      // One POST per defender, so the backend contract stays one name per call.
      for (const defenderName of unlocked) saveUnlockedDefender(defenderName);

      for (const [cardName, pieces] of Object.entries(chestCardPieces(chest))) {
        await fetch(apiUrl(`/api/player/add-card-pieces`), {
          method: "POST",
          headers: SessionManager.authHeaders(),
          body: JSON.stringify({ cardName, pieces }),
        });
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
      await fetch(apiUrl(`/api/player/unlock-defender`), {
        method: "POST",
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({ defenderName }),
      });
    } catch (error) {
      console.error("Failed to save unlocked defender:", error);
    }
  };

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
    energyCostOf,
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
    chestReward,
    setChestReward,
    gateNotice,
    setGateNotice,
    buyEnergy,
    canBuyEnergy,
    energyPack: ENERGY_PACK,
    handleLogout,
    fetchPlayerData,
    feedback: feedbackRef.current,
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <GameContext.Provider value={gameAPI}>{children}</GameContext.Provider>
  );
};
