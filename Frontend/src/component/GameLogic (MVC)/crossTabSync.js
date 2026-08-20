/*
 * Keeping two tabs of the same account from disagreeing.
 *
 * Each tab holds its own copy of playerData, so acting in one leaves the other
 * showing yesterday's numbers until it is reloaded by hand.
 *
 * Nothing is actually LOST when that happens - every write is a delta the
 * server applies to its own current value (`player.getGold() + change`), and no
 * request ever sends a whole player - so the database stays right. What goes
 * wrong is the display: the stale tab shows the wrong total, and its next
 * optimistic update is drawn from that wrong total until it refetches.
 *
 * So this is a freshness mechanism, not a locking one. Two rules:
 *
 *   Announce from ONE place. There are fourteen calls that write to the
 *   backend; a notification bolted onto each is a notification eventually
 *   forgotten on the fifteenth. playerData changing is the single fact they
 *   all produce.
 *
 *   Never refetch during a level. Replacing playerData mid-game would move the
 *   ground under a run in progress, for a number nobody is looking at.
 */

/** The name both tabs have to agree on to hear each other. */
export const CHANNEL_NAME = "the-invasion-player";

export const PLAYER_CHANGED = "player-changed";

/**
 * A channel to the other tabs, or null where the browser has none.
 *
 * BroadcastChannel is absent in older Safari and in jsdom unless polyfilled, and
 * this is a convenience - the game has to work without it, just less promptly.
 */
export function openPlayerChannel() {
  if (typeof BroadcastChannel !== "function") return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/**
 * Whether a tab in `gameState` should refetch when something changes elsewhere.
 *
 * Only in the lobby. A level in progress owns the screen, and the lobby is the
 * only place the numbers this refreshes are even shown.
 */
export function shouldRefreshOn(gameState) {
  return gameState === "lobby";
}
