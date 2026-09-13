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
   */
  async importGuestSave(playerData) {
    try {
      const response = await fetch(apiUrl('/api/player/import'), {
        method: 'POST',
        headers: SessionManager.authHeaders(),
        body: JSON.stringify(playerData),
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
