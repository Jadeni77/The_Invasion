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
import { chestsData, chestDefenders, resourceRewardsOf, chestCardPieces, isEndlessUnlocked } from "../GameRendering/MapLayout.jsx";
import { SessionManager } from "./SessionManager.js";
import LoginPage from "../login/LoginPage.jsx";
import { FeedbackBus } from "./Feedback/FeedbackBus.js";
import { AudioManager } from "./Feedback/AudioManager.js";
import { JuiceManager } from "./Feedback/JuiceManager.js";
import { MusicPlayer } from "./Feedback/MusicPlayer.js";
import { FeedbackManager } from "./Feedback/FeedbackManager.js";
import { loadSettings, subscribe } from "./Feedback/SettingsStore.js";
import { SAMPLE_URLS, unknownSampleNames } from "./Feedback/UnitSamples.js";
import { starsFor } from "./LevelStars.js";
import { SOUND_KEYS } from "./Feedback/SoundGroups.js";
import { MAX_DEFENDER_LEVEL } from "./DefenderClassUtils.js";
import { defenderUnlockedBy, defendersEarnedBy } from "./LevelUnlocks.js";
import {
  openPlayerChannel,
  shouldRefreshOn,
  PLAYER_CHANGED,
  GUEST_SAVE_CHANGED,
} from "./crossTabSync.js";
import {
  getDefaultPlayerData,
  writeGuestSave,
  readGuestSave,
  clearGuestSave,
  hasGuestSave,
  rankForCompletedLevels,
} from "./guestSave.js";
import {
  createPersistence,
  MODE_ACCOUNT,
  MODE_GUEST,
  MODE_ANONYMOUS,
} from "./playerPersistence.js";

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
 *
 * The card is FINISHED here, not provisional. `cost` used to be left out on the
 * grounds that toPlayerData would fill it in - true for an account, whose
 * refetch at the end of onWinCb re-transforms the whole roster moments later,
 * and false for a guest, whose refetch returns early by design. So the
 * cost-less card was what the persist effect wrote to a guest's slot, and it
 * stayed there: `inGameEnergy < cardData.cost` is false against undefined, so
 * the deploy gate passed, the real cost was charged anyway, and in-game energy
 * went negative. Keep this object's keys matching toPlayerData's card - there
 * is a test on exactly that.
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
    cost: getCardCost(defenderName),
  }];
};

/**
 * The backend's player, in the shape the game reads.
 *
 * Two callers set playerData - a fresh login and a refetch - and they used to
 * build it separately: one stored the raw entity, the other this transform. So
 * the same player had two shapes depending on how they arrived, and the field
 * that gave it away was the name. The entity calls it `displayName`; the game
 * reads `name`; the transform copied `data.name`, which does not exist. Every
 * player's name came out undefined and the lobby showed only the rank beneath
 * it, which is why it looked fixed at "Novice Gardener".
 */
export function toPlayerData(data) {
  return {
    id: data.id,
    sessionId: data.sessionId,
    name: data.displayName ?? data.name,
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
}

/**
 * What a win pays.
 *
 * Module-level and exported so the numbers can be tested directly, and so the
 * guest path and the account path cannot drift: this is now the only place the
 * frontend decides what a level is worth.
 *
 * The gem bonus is a flat 1, matching PlayerService.completeLevel. It used to
 * be Math.ceil(multiplier) here and 1 there, so a 3-star win on level 18-20
 * showed 4 gems and settled back to 1 when the refetch landed.
 */
export function winRewards(score, stars) {
  return {
    gold: Math.floor(score * 0.2),
    iron: Math.floor(score * 0.1),
    grain: Math.floor(score * 0.2),
    water: Math.floor(score * 0.2),
    gem: stars === 3 ? 1 : 0,
  };
}

/**
 * Accumulate the lifetime counters a run produced.
 *
 * These used to live only on the server: the frontend posted a delta and read
 * the totals back on the next refetch, so nothing here ever held them. A guest
 * has no server to read back from, and the achievements that watch these
 * counters would have sat at zero forever.
 */
export function applyStats(playerData, { enemiesKilled = 0, defendersDeployed = 0, energyCollected = 0 }) {
  return {
    ...playerData,
    totalEnemiesKilled: (playerData.totalEnemiesKilled || 0) + enemiesKilled,
    totalDefendersDeployed: (playerData.totalDefendersDeployed || 0) + defendersDeployed,
    totalEnergyCollected: (playerData.totalEnergyCollected || 0) + energyCollected,
  };
}

/** Record a special achievement, once. */
export function applySpecialAchievement(playerData, achievementId) {
  const held = playerData.specialAchievements || [];
  if (held.includes(achievementId)) return playerData;
  return { ...playerData, specialAchievements: [...held, achievementId] };
}

/**
 * Pay out a claimed achievement from local state.
 *
 * The claim handler used to read `updated.gold` and friends out of the HTTP
 * response, which is the one path in the game that could not work offline at
 * all - a guest would have had every resource replaced with undefined.
 */
export function applyClaimedAchievement(playerData, achievementId, rewards = {}) {
  const claimed = playerData.claimedAchievements || [];
  if (claimed.includes(achievementId)) return playerData;

  const resources = { ...playerData.resources };
  for (const [name, amount] of Object.entries(rewards)) {
    resources[name] = (resources[name] || 0) + amount;
  }

  return { ...playerData, resources, claimedAchievements: [...claimed, achievementId] };
}

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

  /* Opened once. A channel per render would leak a listener per render. */
  const playerChannelRef = useRef(null);
  if (playerChannelRef.current === null) {
    playerChannelRef.current = openPlayerChannel() ?? false;
  }

  /* Set just before a refetch lands, so applying the server's answer is not
     mistaken for a local change and echoed back to the tab that sent it. */
  const appliedFromServerRef = useRef(false);

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

  /*
   * Three states, not two. `anonymous` is looking at the login form; `guest` is
   * playing against the browser; `account` is playing against the backend. The
   * boolean this replaced could not express the middle one.
   *
   * A save in the browser counts as a session. Without that middle branch a
   * guest has no auth token, so every reload sent them back to the login form -
   * the wall guest mode exists to remove, put in front of the returning player
   * rather than the new one. Nothing was lost, but "Play as guest" had to be
   * pressed again to see it. The order matters: a token wins over a stale slot,
   * so an account that once played as a guest on this browser is unaffected.
   *
   * Reaching the login form from here is the lobby's "Save your progress"
   * button, which is handleLogout - it sends a guest to `anonymous` and leaves
   * the slot alone, so signing up still carries the save over.
   */
  const [mode, setMode] = useState(() =>
    SessionManager.isLoggedIn() ? MODE_ACCOUNT
      : hasGuestSave() ? MODE_GUEST
        : MODE_ANONYMOUS,
  );

  /*
   * The session's persistence, and the mode the long-lived callbacks read.
   *
   * THE ONLY PLACE THE MODE IS CHOSEN. It reaches components through
   * `gameAPI.persistence` rather than each one calling createPersistence
   * itself, because a second call site is a second thing to remember to flip -
   * and the one that was forgotten would leave a guest quietly POSTing to a
   * backend they are supposed to never touch, swallowing the 401 and looking
   * fine.
   *
   * Refs, because onWinCb, fetchPlayerData and their neighbours are memoised
   * with [] deps: a `mode` read straight from state is frozen at the render
   * that first built them, which for a visitor who arrives anonymous and then
   * chooses guest would be 'anonymous' for the rest of the session.
   *
   * Derived during render rather than in an effect, because `gameAPI` is built
   * on this render and a ref written in an effect is one render behind - for
   * that one render a guest would be handed the account persistence.
   * createPersistence returns one of two module singletons, so repeating it for
   * an unchanged mode costs nothing and cannot produce a different answer.
   */
  const modeRef = useRef(mode);
  const persistenceRef = useRef(null);
  if (persistenceRef.current === null || modeRef.current !== mode) {
    modeRef.current = mode;
    persistenceRef.current = createPersistence(mode);
  }

  /*
   * A guest's save, written where the broadcast is announced and for the same
   * reason: playerData changing is the one fact every write path produces, and
   * a save bolted onto each is a save eventually forgotten on the next one.
   *
   * Gated on the mode so an account session never writes to the guest slot -
   * logging out has to find that slot exactly as the guest left it.
   *
   * THE ONLY WRITER OF THE SLOT. The catch-up below reads it and hands what it
   * finds to setPlayerData, which comes back here to be written - so there is
   * still one line in the codebase that puts a guest's progress in storage, and
   * one place to look when it holds the wrong thing.
   *
   * Declared ABOVE the broadcast rather than below it, which it used to be:
   * React flushes a commit's effects in declaration order, so this way the slot
   * already holds what the announcement is about by the time the announcement
   * goes out. The old order got away with it because postMessage delivers on a
   * later task, which is a race the ordering no longer depends on.
   */
  useEffect(() => {
    if (mode !== MODE_GUEST || !playerData) return;
    writeGuestSave(playerData);
  }, [mode, playerData]);

  /*
   * Tell the other tabs that this player moved.
   *
   * Announced here rather than at each of the fourteen calls that write to the
   * backend: playerData changing is the one fact they all produce, and a
   * notification bolted onto each is one eventually forgotten on the fifteenth.
   */
  useEffect(() => {
    if (!playerData) return;
    if (appliedFromServerRef.current) {
      appliedFromServerRef.current = false;
      return;
    }
    /*
     * One channel, one message per mode, because the two modes answer an
     * announcement in incompatible ways: an account tab refetches
     * /api/player/me, and a guest tab re-reads the browser slot. Sharing
     * PLAYER_CHANGED made a guest's once-a-minute energy tick drive a sibling
     * ACCOUNT tab's refetch once a minute - an odd footnote under "a guest
     * never calls the backend" - so each mode speaks only its own name and
     * hears only its own name. See crossTabSync.js.
     *
     * Anonymous announces nothing: there is no session yet to have moved.
     *
     * Below the appliedFromServerRef check rather than above it, so a load does
     * not leave that flag set for a later session in another mode to mistake
     * for a refetch of its own and swallow a real broadcast.
     */
    if (mode === MODE_ACCOUNT) {
      playerChannelRef.current?.postMessage?.({ type: PLAYER_CHANGED });
    } else if (mode === MODE_GUEST) {
      playerChannelRef.current?.postMessage?.({ type: GUEST_SAVE_CHANGED });
    }
  }, [mode, playerData]);

  /**
   * Take an account session, carrying any guest progress into it.
   *
   * The import is attempted on every login rather than only on registration,
   * because registration cannot carry it: /api/auth/register issues no token,
   * so there is nothing to authenticate an upload with until the address has
   * been verified and a login has happened. The server decides whether to
   * accept it - only a pristine account does - which is also what makes
   * logging into an account you have played leave that account alone.
   */
  const handleLogin = async (token, player) => {
    SessionManager.setToken(token);
    SessionManager.setUser(player);
    setMode(MODE_ACCOUNT);

    const pending = readGuestSave();
    if (pending) {
      /* The account persistence, named rather than read off persistenceRef:
         that ref is derived from the `mode` state, and the setMode above does
         not apply until the next render - so here it still reflects the mode
         being left. Today that is `anonymous`, which falls through to this same
         instance, but a `guest` one imports nothing at all and the difference
         between working and working by coincidence is one render. */
      const accepted = await createPersistence(MODE_ACCOUNT).importGuestSave(pending);
      /* Only on success. A refusal or a dead backend keeps the save on the
         device, so the next login tries again rather than losing it. */
      if (accepted) clearGuestSave();
    }

    // Through the same transform as a refetch. Storing the raw entity here gave
    // a freshly logged-in player a different shape from a returning one - no
    // `resources`, no `name` - and the lobby sat on its loading screen until a
    // refetch happened to fix it.
    setPlayerData(toPlayerData(player));

    /* The import changed the server's copy, so the entity we were handed at
       login is already stale. Refetching is how the player sees what moved. */
    if (pending) await fetchPlayerData();
  };

  /*
   * Play without an account. The load itself is left to the effect that watches
   * the mode, so there is one place a session's player is fetched from rather
   * than two that have to keep agreeing.
   */
  const startGuestSession = useCallback(() => {
    /* Only from the login form. This is on gameAPI, so anything holding the
       context can call it - and from an account session it would flip the mode
       to guest while playerData still held the account's player. The persist
       effect watches the mode as well as the player, so it would fire and
       write that account straight over the guest slot, and fetchPlayerData's
       guest guard means the real save is never read back to notice. */
    if (modeRef.current !== MODE_ANONYMOUS) return;
    setMode(MODE_GUEST);
  }, []);

  const handleLogout = () => {
    backGrantedRef.current.clear();
    SessionManager.clearSession();
    setPlayerData(null);

    /*
     * A guest pressing the same button has no account to leave, so it means
     * "show me the login screen". Sending them back to `guest` would clear
     * playerData without changing the mode, and nothing would reload it - the
     * lobby would sit on its loading screen forever. Their save is untouched,
     * and "Play as guest" resumes it.
     */
    if (mode === MODE_GUEST) {
      setMode(MODE_ANONYMOUS);
      return;
    }

    /* Back to the guest save if this browser still holds one. Logging out of an
       account never touched it, so it is exactly as it was left. */
    setMode(hasGuestSave() ? MODE_GUEST : MODE_ANONYMOUS);
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

    /* From what reached the base, not from the score - see LevelStars. The
       score-based version could not award level 1 more than two stars however
       well it was played. */
    const stars = starsFor({ baseDamageTaken });

    // Built once, here, so the try block below can reuse it rather than
    // recomputing - and so the local special-achievement update below and the
    // POST loop that follows can never disagree about which ids were earned.
    const specialUnlocks = [];
    if (defendersLost === 0) specialUnlocks.push('perfect_defense');
    if (baseDamageTaken === 0) specialUnlocks.push('untouchable');
    if (timeElapsed < 120000 && level !== 999) specialUnlocks.push('speed_demon');

    // Update player data based on win
    setPlayerData((prev) => {
      if (!prev) return prev;
      const earned = winRewards(score, stars);

      const newGold = prev.resources.gold + earned.gold;
      const newIron = prev.resources.iron + earned.iron;
      const newGrain = prev.resources.grain + earned.grain;
      const newWater = prev.resources.water + earned.water;
      const newGem = prev.resources.gem + earned.gem;

      const newCompleteLevels = [...(prev.completedLevels || [])];
      if (!newCompleteLevels.includes(level)) {
        newCompleteLevels.push(level);
      }

      const newUnlockedLevels = [...prev.unlockedLevels];
      if (level < 20 && !newUnlockedLevels.includes(level + 1)) {
        newUnlockedLevels.push(level + 1); // Unlock next level
        newUnlockedLevels.sort((a, b) => a - b);
      }

      //unlock endless at ten completed levels - the same rule isEndlessUnlocked applies
      if (level === 10 && !newUnlockedLevels.includes(999)) {
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

    // These used to be server-only: read back on the next refetch rather than
    // held here. A guest has no refetch to read them back from.
    setPlayerData((prev) => {
      if (!prev) return prev;
      let next = applyStats(prev, { enemiesKilled, defendersDeployed, energyCollected });
      for (const id of specialUnlocks) next = applySpecialAchievement(next, id);

      /*
       * The rank, for the same reason. The backend re-derives it on every read
       * of /api/player/me (applyEarnedRank), but guestPersistence.loadPlayer
       * derives it once at load and a guest's fetchPlayerData short-circuits
       * after that - so a guest's title was frozen for the whole session and a
       * win on level 1, 5, 10, 15 or 20 showed the old one until they reloaded.
       *
       * Not branched on the mode: rankForCompletedLevels is the port of
       * PlayerRank.forCompletedLevels and guestSave.test.js pins the two to the
       * same thresholds, so for an account this is the answer the refetch a few
       * lines below is about to bring back anyway, just sooner. `prev` here is
       * the result of the updater above, so the level just won is counted.
       */
      return { ...next, rank: rankForCompletedLevels(next.completedLevels) };
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
      await persistenceRef.current.completeLevel({ levelId: level, score, stars });
      await persistenceRef.current.updateStats({ enemiesKilled, defendersDeployed, energyCollected });

      // The same operation the chest path uses; no backend change needed.
      if (isNewDefender) await persistenceRef.current.unlockDefender(wonDefender);

      // Built once, above, so this loop and the local update cannot disagree.
      for (const id of specialUnlocks) {
        await persistenceRef.current.unlockSpecialAchievement(id);
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
        // Stat counters were server-only before this task; folded in here so
        // an endless run banks them the same way a level win does.
        const next = applyStats(prev, { enemiesKilled, defendersDeployed, energyCollected });
        return {
          ...next,
          resources: {
            ...next.resources,
            gold: next.resources.gold + goldEarned,
            iron: next.resources.iron + ironEarned,
            grain: next.resources.grain + grainEarned,
            water: next.resources.water + waterEarned,
            gem: next.resources.gem + gemEarned,
          },
          endlessHighScore: Math.max(next.endlessHighScore || 0, endlessWave),
          endlessStats: {
            ...next.endlessStats,
            totalWaves: (next.endlessStats?.totalWaves || 0) + endlessWave,
            totalRuns: (next.endlessStats?.totalRuns || 0) + 1,
          },
        };
      });

      try {
        await persistenceRef.current.updateResources({
          gold: goldEarned, iron: ironEarned, grain: grainEarned,
          water: waterEarned, gem: gemEarned,
        });

        await persistenceRef.current.endlessScore(endlessWave);

        await persistenceRef.current.updateStats({ enemiesKilled, defendersDeployed, energyCollected });
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

          // Stat counters were server-only before this task; a loss still
          // reports kills/deploys/energy for the run, so it still needs them.
          const next = applyStats(prev, { enemiesKilled, defendersDeployed, energyCollected });

          return {
            ...next,
            resources: {
              ...next.resources,
              gold: newGold,
              iron: newIron,
              grain: newGrain,
              water: newWater,
              gem: newGem,
            },
          };
        });

        try {
          await persistenceRef.current.updateResources({
            gold: -goldPenalty,
            iron: -ironPenalty,
            grain: -grainPenalty,
            water: -waterPenalty,
            gem: -gemPenalty,
          });
          await persistenceRef.current.updateStats({ enemiesKilled, defendersDeployed, energyCollected });
        } catch (e) {
          console.error("Failed to save loss penalties:", e);
        }
      }
    },
    [bankEndlessRun], // Everything else is handled by the state setters
  );

  // Backend API integration points
  const fetchPlayerData = useCallback(async () => {
    /*
     * For a guest this is only ever the load that starts a session.
     *
     * Their slot is written FROM playerData by the effect above, so reading it
     * back is never news to this tab - and after a write it is actively wrong.
     * onWinCb ends with a refetch, to pick up the server's version of what it
     * just saved; for a guest that refetch runs before React has committed the
     * win, so it would read the PRE-win save and quietly roll the win back,
     * into the slot as well as onto the screen. An account's server copy really
     * is a second opinion, so it still replaces.
     *
     * The mode comes from a ref because this callback is memoised with [] deps:
     * `mode` read from state would be frozen at the render that built it, which
     * for a visitor who arrives anonymous and then chooses guest is 'anonymous'
     * for the rest of the session.
     */
    if (modeRef.current === MODE_GUEST && playerDataRef.current) return;

    const data = await persistenceRef.current.loadPlayer();
    // Nothing came back - offline, or a reply that was not a player. The copy
    // already in memory is better than defaults, so it is only the very first
    // load that falls back.
    if (!data) {
      setPlayerData((prev) => prev ?? getDefaultPlayerData());
      return;
    }

    /*
     * A reply that parsed but is not shaped like a player still has to land
     * somewhere. toPlayerData guards `cards` and `levelStars` with bare
     * truthiness, so a truthy non-array - `cards: {}` from a future backend, a
     * proxy's error envelope - reaches .map/.reduce and throws. Unhandled,
     * that leaves first load sitting at playerData === null forever, because
     * both callers of this function ignore the promise it returns.
     */
    try {
      /*
       * The two loadPlayer implementations do not return the same shape, and
       * both say so where they are written: accountPersistence hands back the
       * RAW backend entity, which still needs this transform; guestPersistence
       * hands back a playerData that has already been through it. They are not
       * unified there because toPlayerData lives in this file, and importing it
       * into playerPersistence.js would re-create the cycle guestSave.js exists
       * to avoid - a cycle that fails only on the deployed site.
       *
       * Transforming a guest's save a second time reads `data.gold` off a
       * player whose gold is at `data.resources.gold`, so every resource comes
       * out undefined - and the slot is written FROM playerData, so it would
       * not stop at the screen.
       */
      const playerData = modeRef.current === MODE_GUEST ? data : toPlayerData(data);

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

      appliedFromServerRef.current = true;
      setPlayerData(playerData);

      // The player already has these on screen; a failed save retries next load.
      for (const name of toPersist) await persistenceRef.current.unlockDefender(name);
    } catch (e) {
      console.error("Fail to fetch data:", e);
      // Only fall back to defaults if there's no existing player data in memory
      setPlayerData((prev) => prev ?? getDefaultPlayerData());
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

  /*
   * Catch up when another tab moved, or when this one is looked at again.
   *
   * Only in the lobby. Replacing playerData mid-level would move the ground
   * under a run in progress for a number nobody is looking at, and the lobby is
   * the only place these totals are shown anyway.
   *
   * Accounts only. What a guest reads instead is the slot, in the effect below,
   * because a guest has no server copy to be the second opinion - and
   * fetchPlayerData is a deliberate no-op for them.
   */
  useEffect(() => {
    if (mode !== MODE_ACCOUNT || !shouldRefreshOn(gameState)) return undefined;

    const catchUp = () => { fetchPlayerData(); };
    const onMessage = (event) => {
      if (event?.data?.type === PLAYER_CHANGED) catchUp();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") catchUp();
    };

    const channel = playerChannelRef.current || null;
    channel?.addEventListener?.("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      channel?.removeEventListener?.("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode, gameState, fetchPlayerData]);

  /**
   * The guest's version of that catch-up: re-read the slot the other tab wrote.
   *
   * NOT routed through fetchPlayerData. That function returns early for a guest
   * who already has a player, and the early return is load-bearing - it is what
   * stopped the refetch at the end of onWinCb reading the pre-win save back
   * over a win the player had already been shown. Reading the slot here instead
   * keeps that guard exactly as it is.
   *
   * Not through guestPersistence.loadPlayer either, which answers an empty slot
   * with a brand new guest: signing up in the other tab MOVES the save into the
   * new account and empties the slot, and the honest answer to that is to leave
   * this tab playing what it already holds rather than to replace a session
   * with an empty one.
   */
  const catchUpFromGuestSlot = useCallback(() => {
    const saved = readGuestSave();
    if (!saved) return;

    /*
     * The loop-breaker, set the way fetchPlayerData sets it. The broadcast
     * effect checks and clears this, so adopting the other tab's save is not
     * announced back to it - without that, the other tab re-reads, re-announces
     * and the two trade messages for as long as both are open.
     */
    appliedFromServerRef.current = true;
    setPlayerData(saved);
  }, []);

  /*
   * Two guest tabs, kept from diverging.
   *
   * They share one slot and each held its own playerData, so a level won in one
   * was overwritten by the other's next save - last writer wins, and the win
   * was gone. This does not make them transactional: whoever writes last is
   * still the answer. It makes the other tab find out in the lobby, instead of
   * writing an hour-old copy over the top later.
   *
   * The lobby guard is the same one the account path uses, and matters more
   * here: re-reading the slot mid-level is precisely the mistake that rolled a
   * guest's win back out of their save.
   *
   * No visibilitychange twin. A hidden tab still receives BroadcastChannel
   * messages, so focus catches nothing the message did not; and a re-read
   * nobody asked for can only replace this tab's copy with an older one - if a
   * write failed on a full quota, for instance, that is exactly what it would
   * find. This reads the slot when another tab says it wrote, and otherwise
   * leaves it alone.
   */
  useEffect(() => {
    if (mode !== MODE_GUEST || !shouldRefreshOn(gameState)) return undefined;

    const onMessage = (event) => {
      if (event?.data?.type === GUEST_SAVE_CHANGED) catchUpFromGuestSlot();
    };

    /* Null where the browser has no BroadcastChannel - older Safari, jsdom
       without a polyfill. A guest plays on there, just without hearing the
       other tab, which is the behaviour that shipped before this. */
    const channel = playerChannelRef.current || null;
    channel?.addEventListener?.("message", onMessage);

    return () => channel?.removeEventListener?.("message", onMessage);
  }, [mode, gameState, catchUpFromGuestSlot]);

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

  /*
   * Where a session's player comes from - the backend for an account, the
   * browser slot for a guest, and the same call for both because
   * fetchPlayerData follows the mode. Anonymous has nothing to load and never
   * gets past the login form.
   *
   * This is also what makes the mode changing enough to start a session: both
   * choosing guest and logging out of an account into one leave playerData null
   * and rely on this to fill it.
   */
  useEffect(() => {
    if (mode !== MODE_ANONYMOUS) {
      fetchPlayerData();
    }

    return () => {
      if (playerDataRef.current) {
        savePlayerData(playerDataRef.current);
      }
    };
  }, [fetchPlayerData, savePlayerData, mode]);

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
      await persistenceRef.current.updateResources({ gold: -ENERGY_PACK.gold, lobbyEnergy: granted });
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
        /*
         * The same function the map node asks, not a restatement of the rule.
         * This used to read the STORED totalStars while getLevelStatus(999)
         * delegates to isEndlessUnlocked, which recomputes the sum from
         * levelStars - and nothing keeps the stored copy in step, since
         * applyStats and applyClaimedAchievement both return a new player
         * without touching it. Two numbers, one rule: when they disagreed the
         * portal lit up on the map and then refused entry when it was pressed.
         */
        if (!isEndlessUnlocked(playerData)) {
          setGateNotice({
            kind: "locked",
            title: "Endless Mode is locked",
            message: "Complete Level 10 or collect 50 stars to unlock it.",
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
          await persistenceRef.current.updateResources({ lobbyEnergy: -levelCost });
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
        gameEngineRef.current.resetGame(); // Reset engine's internal state
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
            await persistenceRef.current.addCardPieces(cardName, count);
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
      const recorded = await persistenceRef.current.collectTreasure(chestId, resourceRewardsOf(chest));

      /*
       * The grants below are downstream of the chest being recorded, so they
       * only go out if it was. Marking the chest collected is the thing that
       * stops it being opened again - bank the pieces without it and the
       * player reloads to find the chest waiting, collects it again, and is
       * paid again, repeatably.
       *
       * Gating on the result rather than on a thrown error, because a backend
       * that answers 500 never threw: before persistence moved here, only a
       * dropped connection skipped these loops and a rejected save did not.
       */
      if (recorded) {
        // One POST per defender, so the backend contract stays one name per call.
        for (const defenderName of unlocked) persistenceRef.current.unlockDefender(defenderName);

        for (const [cardName, pieces] of Object.entries(chestCardPieces(chest))) {
          await persistenceRef.current.addCardPieces(cardName, pieces);
        }
      }
    } catch (error) {
      console.error("Failed to save collected treasure:", error);
    }
  }, []);

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
    mode,
    startGuestSession,
    /* So a component that saves does not have to pick a mode of its own. */
    persistence: persistenceRef.current,
    feedback: feedbackRef.current,
  };

  if (mode === MODE_ANONYMOUS) {
    return <LoginPage onLogin={handleLogin} onPlayAsGuest={startGuestSession} />;
  }

  return (
    <GameContext.Provider value={gameAPI}>{children}</GameContext.Provider>
  );
};
