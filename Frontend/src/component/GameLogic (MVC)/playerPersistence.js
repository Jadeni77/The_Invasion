/*
 * Where the game decides whether a save goes to the backend or to the browser.
 *
 * This used to be sixteen fetch calls spread through GameContext.jsx. The
 * argument for collecting them is the one crossTabSync.js already makes about
 * the broadcast: a decision bolted onto each call site is a decision
 * eventually forgotten on the next one.
 *
 * The guest branch is mostly empty on purpose. Every write path computes the
 * player's new state locally before persisting - so for a guest the work is
 * already done by the time we get here, and the effect watching playerData has
 * already written it to the slot. What is left is loading, and the import.
 *
 * This module may import from guestSave.js, but guestSave.js must never import
 * from here: it deliberately imports nothing, because GameContext.jsx depends
 * on it and a cycle between them fails only on the deployed site.
 */
import { apiUrl } from '../../config/api.js';
import { SessionManager } from './SessionManager.js';
import {
  readGuestSave,
  newGuestPlayer,
  applyEnergyRecharge,
  rankForCompletedLevels,
} from './guestSave.js';

export const MODE_GUEST = 'guest';
export const MODE_ACCOUNT = 'account';

/*
 * Looking at the login form. There is no session yet, so nothing is ever saved
 * in this mode - it falls through to the account persistence below because
 * that is what it is about to become, and because a mode with no persistence
 * at all would only give a missed guard somewhere to throw.
 */
export const MODE_ANONYMOUS = 'anonymous';

/**
 * POST a body to the backend, reporting failure without raising it.
 *
 * A failed save must not take down the run that produced it: the player has
 * already been shown and credited the result, and throwing here would lose
 * both. This is the behaviour the sixteen individual try/catch blocks had.
 */
async function post(path, body) {
  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: SessionManager.authHeaders(),
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch (e) {
    console.error(`Failed to persist ${path}:`, e);
    return false;
  }
}

/**
 * A playerData in the flat shape `/api/player/import` binds against.
 *
 * THE WIRE CONTRACT. GuestSaveRequest.java is a flat projection of the Player
 * entity, and playerData is not that shape. Posting playerData directly - which
 * this module did until the contract was written down - fails silently on both
 * sides: Jackson binds the fields it recognises, leaves the rest null, and
 * PlayerService.importGuestSave replaces each null with the new account's own
 * default. No exception anywhere, and the player only finds out by counting
 * their gold.
 *
 * Three differences, all of them silent:
 *
 * - gold, iron, grain, water, gem and lobbyEnergy are top-level fields on the
 *   DTO, because they are top-level fields on Player. Here they live under
 *   `playerData.resources`, so they are lifted out. Nested, every resource a
 *   guest earned is dropped while levels, stars and treasures - already
 *   top-level on both shapes - arrive fine, which is what makes the bug look
 *   like a partial success rather than a mapping error.
 * - a card's `id` is the entity's `cardId`.
 * - a card's `upgradeCost` and `cost` are derived here from lookup tables
 *   rather than stored, so the DTO has no field for either; Jackson ignores
 *   unknown properties rather than erroring, so sending them does nothing.
 *
 * `piecesNeeded` is deliberately not sent: the server recomputes it from the
 * card's name, so a forged save cannot claim a card upgrades for one piece.
 * `cardUnlockProgress` is the one DTO field with no counterpart here - the
 * frontend has never tracked it - so it is left out and the server keeps the
 * account's own value.
 *
 * Fields the save happens not to hold are left undefined and drop out of the
 * JSON, which the server reads as "not given" and answers with the account's
 * default. That is the right answer for a save written by an older build.
 */
function toGuestSaveRequest(playerData) {
  const resources = playerData?.resources ?? {};

  return {
    gold: resources.gold,
    iron: resources.iron,
    grain: resources.grain,
    water: resources.water,
    gem: resources.gem,
    lobbyEnergy: resources.lobbyEnergy,

    endlessHighScore: playerData?.endlessHighScore,
    totalEnemiesKilled: playerData?.totalEnemiesKilled,
    totalDefendersDeployed: playerData?.totalDefendersDeployed,
    totalEnergyCollected: playerData?.totalEnergyCollected,

    unlockedLevels: playerData?.unlockedLevels,
    completedLevels: playerData?.completedLevels,
    levelStars: playerData?.levelStars,
    collectedTreasures: playerData?.collectedTreasures,
    claimedAchievements: playerData?.claimedAchievements,
    specialAchievements: playerData?.specialAchievements,

    cards: playerData?.cards?.map((card) => ({
      cardId: card.id,
      name: card.name,
      level: card.level,
      pieces: card.pieces,
    })),
  };
}

const accountPersistence = {
  /*
   * NOTE: this returns the RAW backend entity, while guestPersistence.loadPlayer
   * returns an already-transformed playerData. The caller has to branch on mode
   * and run this one through toPlayerData; Task 6 adds that check.
   *
   * They are not unified here because toPlayerData lives in GameContext.jsx,
   * and importing it would re-create the cycle guestSave.js exists to avoid.
   */
  async loadPlayer() {
    try {
      const response = await fetch(apiUrl('/api/player/me'), {
        method: 'GET',
        headers: SessionManager.authHeaders(),
      });
      return await response.json();
    } catch (e) {
      console.error('Fail to fetch data:', e);
      return null;
    }
  },

  completeLevel: ({ levelId, score, stars }) =>
    post('/api/player/complete-level', { levelId, score, stars }),

  updateStats: ({ enemiesKilled = 0, defendersDeployed = 0, energyCollected = 0 }) =>
    post('/api/player/update-stats', { enemiesKilled, defendersDeployed, energyCollected }),

  updateResources: (resourcesChange) =>
    post('/api/player/update-resources', { resourcesChange }),

  unlockDefender: (defenderName) =>
    defenderName ? post('/api/player/unlock-defender', { defenderName }) : Promise.resolve(true),

  unlockSpecialAchievement: (achievementId) =>
    post('/api/player/unlock-special-achievement', { achievementId }),

  addCardPieces: (cardName, pieces) =>
    post('/api/player/add-card-pieces', { cardName, pieces }),

  collectTreasure: (chestId, rewards) =>
    post('/api/player/collect-treasure', { chestId, rewards }),

  claimAchievement: (achievementId, rewards) =>
    post('/api/player/claim-achievement', { achievementId, rewards }),

  endlessScore: (waveReached) =>
    post('/api/player/endless-score', { waveReached }),

  /**
   * Hand a guest save to the account that just signed up.
   *
   * The server applies it only to a pristine account, so logging into an
   * account that has been played rejects this and keeps its own progress.
   *
   * The body is built by toGuestSaveRequest rather than from playerData
   * directly - see that function for why the two shapes are not the same one.
   * Building it inside the try means a save malformed enough to break the
   * mapper is reported as a failed import, which keeps the slot, rather than
   * throwing into a caller that is mid-login.
   */
  async importGuestSave(playerData) {
    try {
      const response = await fetch(apiUrl('/api/player/import'), {
        method: 'POST',
        headers: SessionManager.authHeaders(),
        body: JSON.stringify(toGuestSaveRequest(playerData)),
      });
      return response.ok;
    } catch (e) {
      console.error('Failed to import guest progress:', e);
      return false;
    }
  },
};

/* Every write is already in playerData by the time it reaches here, and the
   persist effect has already stored it. Named rather than inlined so the
   reason is attached to the behaviour. */
const alreadySaved = () => Promise.resolve(true);

const guestPersistence = {
  /*
   * NOTE: this returns an already-transformed playerData, while
   * accountPersistence.loadPlayer returns the raw backend entity that still
   * needs toPlayerData. The shapes differ on purpose - see the note there -
   * and the caller has to branch on mode. Task 6 adds that check.
   */
  async loadPlayer() {
    const saved = readGuestSave() ?? newGuestPlayer();
    const recharged = applyEnergyRecharge(saved);
    return { ...recharged, rank: rankForCompletedLevels(recharged.completedLevels) };
  },

  completeLevel: alreadySaved,
  updateStats: alreadySaved,
  updateResources: alreadySaved,
  unlockDefender: alreadySaved,
  unlockSpecialAchievement: alreadySaved,
  addCardPieces: alreadySaved,
  collectTreasure: alreadySaved,
  claimAchievement: alreadySaved,
  endlessScore: alreadySaved,

  /* A guest has no account to import into; the caller checks the mode, and
     this is here so a missed check fails quietly rather than crashing. */
  importGuestSave: () => Promise.resolve(false),
};

export function createPersistence(mode) {
  return mode === MODE_GUEST ? guestPersistence : accountPersistence;
}
