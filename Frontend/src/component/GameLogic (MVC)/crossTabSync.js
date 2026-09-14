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
 *
 * A GUEST changes the first paragraph and neither rule. There is no server to
 * apply deltas, only a browser slot both tabs overwrite whole - so two guest
 * tabs really can lose progress rather than just display it wrongly, which is
 * what makes the freshness worth having for them at all. What they catch up
 * FROM is that slot; see GUEST_SAVE_CHANGED below for why it is a separate
 * message. It is still not a merge: whoever wrote last is the answer, and the
 * other tab now finds that out in the lobby rather than an hour later.
 */

/** The name both tabs have to agree on to hear each other. */
export const CHANNEL_NAME = "the-invasion-player";

export const PLAYER_CHANGED = "player-changed";

/*
 * The same fact for a guest, deliberately NOT the same message.
 *
 * The two modes answer an announcement in completely different ways: an
 * account tab refetches /api/player/me, and a guest tab re-reads the browser
 * slot. One shared event type puts each mode on the receiving end of the
 * other's traffic - and the direction that bit was a guest's once-a-minute
 * energy tick making a sibling ACCOUNT tab in the same browser refetch the
 * player every minute, an odd footnote under "a guest never calls the backend".
 *
 * Two names on one channel, so a tab can ignore what is not addressed to it.
 */
export const GUEST_SAVE_CHANGED = "guest-save-changed";

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
