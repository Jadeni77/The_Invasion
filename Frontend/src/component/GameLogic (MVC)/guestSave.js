/*
 * A guest's entire account, in one localStorage key.
 *
 * Guest mode exists so a visitor can play before deciding whether an account
 * is worth the email address - and because a guest never calls the backend,
 * the free host's cold start does not exist for a first-time player at all.
 *
 * Two pieces of server logic have to live here. upgradeEnergyRecharge and
 * PlayerRank.forCompletedLevels both run inside getOrCreatePlayer, which a
 * guest never reaches. Ported rather than shared, because the backend is Java
 * - so the tests in guestSave.test.js pin them to the same thresholds, and
 * changing one side without the other fails there.
 *
 * This module imports nothing from `GameContext.jsx`, and must not start to:
 * `GameContext.jsx` imports from here, and a cycle between the two resolves
 * differently under the dev server than in a production build, failing on
 * the deployed site only.
 */

export const GUEST_SAVE_KEY = 'invasion.guestSave.v1';

/**
 * Bumped when the stored shape changes in a way an older save cannot satisfy.
 *
 * An unrecognised version is discarded rather than migrated or trusted: a save
 * written by a newer build may hold fields this one would drop on the next
 * write, and silently truncating somebody's progress is worse than restarting
 * it honestly.
 */
const SCHEMA_VERSION = 1;

/** Milliseconds of elapsed time that earn one energy. Matches upgradeEnergyRecharge. */
const MS_PER_ENERGY = 60_000;

export function readGuestSave() {
  let raw;
  try {
    raw = localStorage.getItem(GUEST_SAVE_KEY);
  } catch {
    return null; // Private browsing, or storage disabled entirely.
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return null;
    return parsed.player ?? null;
  } catch {
    return null;
  }
}

export function writeGuestSave(playerData) {
  if (!playerData) return;
  try {
    localStorage.setItem(
      GUEST_SAVE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, player: playerData }),
    );
  } catch (e) {
    // A full quota must not take the run down with it; the player keeps
    // playing on the copy in memory and loses it when the tab closes.
    console.error('Could not save guest progress:', e);
  }
}

export function clearGuestSave() {
  try {
    localStorage.removeItem(GUEST_SAVE_KEY);
  } catch { /* nothing to do, and nothing worth saying */ }
}

export function hasGuestSave() {
  return readGuestSave() !== null;
}

/**
 * The shape a player starts with, moved here from inside GameProvider.
 *
 * It lives in this module rather than in `GameContext.jsx` because a new
 * guest is built from it, and `GameContext.jsx` already depends on this
 * file - the other arrangement is a cycle.
 */
export function getDefaultPlayerData() {
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
}

/** A guest who has just started. */
export function newGuestPlayer() {
  return {
    ...getDefaultPlayerData(),
    id: 'guest',
    sessionId: 'guest',
  };
}

/**
 * Energy earned while the game was closed.
 *
 * The port of PlayerService.upgradeEnergyRecharge: one per whole minute,
 * capped, and the clock only moves when something was actually granted - so
 * repeated loads inside the same minute do not quietly discard the remainder.
 */
export function applyEnergyRecharge(playerData, nowMs = Date.now()) {
  const resources = playerData?.resources;
  if (!resources) return playerData;

  const since = nowMs - (resources.lastEnergyRechargeTime ?? nowMs);
  const earned = Math.floor(since / MS_PER_ENERGY);
  if (earned <= 0) return playerData;

  return {
    ...playerData,
    resources: {
      ...resources,
      lobbyEnergy: Math.min(resources.maxLobbyEnergy, resources.lobbyEnergy + earned),
      lastEnergyRechargeTime: nowMs,
    },
  };
}

/** Levels finished, and the title that many earns. Highest first. Mirrors PlayerRank. */
const RANKS = [
  [20, 'Commander'],
  [15, 'Veteran'],
  [10, 'Defender'],
  [5, 'Recruit'],
  [1, 'Volunteer'],
];

const STARTING_RANK = 'Novice';

/** The port of PlayerRank.forCompletedLevels. Endless (999) is not a campaign level. */
export function rankForCompletedLevels(completedLevels) {
  const finished = new Set(
    (completedLevels ?? []).filter((level) => level >= 1 && level <= 20),
  ).size;

  for (const [threshold, title] of RANKS) {
    if (finished >= threshold) return title;
  }
  return STARTING_RANK;
}
