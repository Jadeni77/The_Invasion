/*
 * Two tabs of the same account, agreeing.
 *
 * Each tab holds its own copy of playerData, so spending gold in one left the
 * other showing the old total until it was reloaded by hand.
 *
 * Nothing was ever lost: every write is a delta the server applies to its own
 * current value, and no request sends a whole player. It is the DISPLAY that
 * went stale, and the stale tab's next optimistic update was drawn from the
 * wrong total until it refetched.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import {
  shouldRefreshOn,
  PLAYER_CHANGED,
  GUEST_SAVE_CHANGED,
  CHANNEL_NAME,
} from '../crossTabSync.js';
import { writeGuestSave, readGuestSave, newGuestPlayer } from '../guestSave.js';
import { apiUrl } from '../../../config/api.js';

const ME_URL = apiUrl('/api/player/me');

const SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Test Player', rank: 'Novice',
  gold: 500, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1, 2], completedLevels: [1], levelStars: [3],
  collectedTreasures: [],
};

let api;

function Probe() {
  api = useGame();
  return <div />;
}

/** How many times this tab has asked the server for the player. */
function refetchCount() {
  return globalThis.fetch.mock.calls.filter(([url]) => String(url) === ME_URL).length;
}

async function mount() {
  globalThis.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? { ...SAVE } : {}),
  }));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api?.playerData?.resources).toBeTruthy());
}

/** Another tab announcing that it moved. */
async function anotherTabChangedSomething(type = PLAYER_CHANGED) {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  await act(async () => {
    channel.postMessage({ type });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  channel.close();
}

/**
 * This tab, playing as a guest on the save already in the browser.
 *
 * No click: a browser holding a guest save opens straight into that session.
 * The fetch mock rejects because a guest reaching the backend at all is a bug,
 * and a rejection is louder than a stub that answers.
 */
async function mountGuest(save = newGuestPlayer()) {
  localStorage.removeItem('auth_token');
  writeGuestSave(save);
  globalThis.fetch = vi.fn(() => Promise.reject(new Error('no backend for a guest')));
  render(<GameProvider><Probe /></GameProvider>);
  await waitFor(() => expect(api?.playerData?.resources).toBeTruthy());
}

/** The other guest tab: it writes the slot, then says that it did. */
async function anotherGuestTabSaved(save) {
  writeGuestSave(save);
  await anotherTabChangedSomething(GUEST_SAVE_CHANGED);
}

/** A guest who has just won three levels in the other tab. */
function wonThreeLevels() {
  const save = { ...newGuestPlayer(), completedLevels: [1, 2, 3] };
  save.resources = { ...save.resources, gold: 940 };
  return save;
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'test-token');
  api = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('deciding when it is safe to catch up', () => {
  it('refreshes in the lobby, where the numbers are shown', () => {
    expect(shouldRefreshOn('lobby')).toBe(true);
  });

  /* Replacing playerData mid-level moves the ground under a run in progress. */
  it('refuses during a level, and on the screens over one', () => {
    expect(shouldRefreshOn('inGame')).toBe(false);
    expect(shouldRefreshOn('upgrade')).toBe(false);
    expect(shouldRefreshOn('settings')).toBe(false);
    expect(shouldRefreshOn('collection')).toBe(false);
  });
});

describe('a tab sitting in the lobby', () => {
  it('catches up when another tab changes the player', async () => {
    await mount();
    const before = refetchCount();

    await anotherTabChangedSomething();

    await waitFor(() => expect(refetchCount()).toBeGreaterThan(before));
  });

  it('catches up when it is looked at again', async () => {
    await mount();
    const before = refetchCount();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await waitFor(() => expect(refetchCount()).toBeGreaterThan(before));
  });
});

describe('a tab that has left the lobby', () => {
  it('ignores the other tab entirely', async () => {
    await mount();
    // Any screen over the lobby will do; the rule is the same for all of them,
    // and openUpgradeModal is the one the context exposes.
    await act(async () => { api.openUpgradeModal(); });
    const before = refetchCount();

    await anotherTabChangedSomething();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(refetchCount(), 'a run in progress owns the screen').toBe(before);
  });
});

describe('announcing a change', () => {
  /*
   * The half the first version of this file missed: it proved a tab REACTS to a
   * message, and posted that message by hand. Nothing checked that playing the
   * game produces one - so the announcing side could have been broken and every
   * test here would still have passed.
   */
  it('announces when the player actually does something', async () => {
    await mount();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await act(async () => {
      await api.collectTreasure('chest-1');
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    listener.close();

    expect(heard.map((m) => m.type)).toContain(PLAYER_CHANGED);
  });

  /*
   * The loop this has to avoid: tab A announces, tab B refetches, B announces
   * the result, A refetches, and so on forever.
   */
  it('does not announce the answer it just got from the server', async () => {
    await mount();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await act(async () => {
      await api.fetchPlayerData();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    listener.close();

    expect(heard, 'a refetch is not a change worth broadcasting').toEqual([]);
  });
});

/*
 * Two guest tabs, which used to diverge and then lose one side's progress.
 *
 * A guest has no server, so the account mechanism - announce, and the other tab
 * refetches - has nothing to refetch FROM. What a guest does have is the slot
 * both tabs write, so the announcement means "re-read the slot" instead. It
 * stays a freshness mechanism rather than a merge: whoever wrote last is still
 * the answer, but the other tab now finds that out in the lobby instead of
 * writing its stale copy over the top an hour later.
 */
describe('two guest tabs', () => {
  it('takes up what the other tab just saved', async () => {
    await mountGuest();
    expect(api.playerData.completedLevels).toEqual([]);

    await anotherGuestTabSaved(wonThreeLevels());

    await waitFor(() => expect(api.playerData.completedLevels).toEqual([1, 2, 3]));
    expect(api.playerData.resources.gold).toBe(940);
    /* And did not hand the other tab its own older copy back on the way. */
    expect(readGuestSave().completedLevels).toEqual([1, 2, 3]);
  });

  /*
   * The fear this fix had to answer before it could be written at all: a guest
   * re-reading the slot around the win that produced it, which is how a win got
   * rolled back out of a save once already and is why a guest's refetch is a
   * no-op.
   *
   * The reason it cannot happen here is an ORDER, not a listener check. The
   * slot is written by an effect declared before the one that announces, and
   * both run before a posted message is delivered - so any catch-up an
   * announcement causes reads a slot that already holds the win. Belt and
   * braces: a BroadcastChannel does not deliver to the object that posted, and
   * a tab shares one channel between both effects; and the lobby guard would
   * stop a tab in a level from acting on the message at all.
   *
   * Driven from the lobby on purpose, with the listener live - a win scored the
   * ordinary way happens in `inGame`, where the guard alone would answer this,
   * and the guard is not what is being tested.
   */
  it('does not roll its own win back out of the save', async () => {
    await mountGuest();

    await act(async () => {
      await api.onWinCb({ score: 500, level: 1 });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(api.playerData.completedLevels).toEqual([1]);
    expect(readGuestSave().completedLevels).toEqual([1]);
  });

  /*
   * Trap 2, and the bug it is named after: re-reading the slot mid-level is
   * what rolled a guest's win back out of their own save. shouldRefreshOn is
   * the same guard the account path uses, for the same reason.
   */
  it('leaves a tab that is not in the lobby alone', async () => {
    await mountGuest();
    // Any screen over the lobby will do; openUpgradeModal is the one the
    // context exposes, as in the account case above.
    await act(async () => { api.openUpgradeModal(); });

    await anotherGuestTabSaved(wonThreeLevels());

    expect(api.playerData.completedLevels, 'a run in progress owns the screen').toEqual([]);
  });

  /*
   * Trap 3. The catch-up calls setPlayerData, which is a playerData change like
   * any other - so without the loop-breaker this tab announces its adoption,
   * the other tab re-reads and announces back, and the two trade messages for
   * as long as both are open.
   */
  it('does not answer the announcement it just acted on', async () => {
    await mountGuest();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await anotherGuestTabSaved(wonThreeLevels());
    await waitFor(() => expect(api.playerData.completedLevels).toEqual([1, 2, 3]));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    listener.close();

    expect(
      heard.map((message) => message.type),
      'only the other tab spoke; adopting a save is not news to announce',
    ).toEqual([GUEST_SAVE_CHANGED]);
  });

  /*
   * BroadcastChannel is absent in older Safari and in jsdom without a
   * polyfill. openPlayerChannel answers null there, and a guest session has to
   * go on working - just without hearing the other tab, which is exactly the
   * behaviour that shipped before this.
   */
  it('plays on in a browser that has no BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    await mountGuest();
    await act(async () => { await api.collectTreasure('chest-1'); });

    expect(api.playerData.collectedTreasures).toContain('chest-1');
    expect(readGuestSave().collectedTreasures).toContain('chest-1');
  });
});

/*
 * Trap 1, in both directions.
 *
 * The broadcast is one channel with two vocabularies on it, because the two
 * modes answer it in incompatible ways. Sharing PLAYER_CHANGED was a real
 * finding: a guest's once-a-minute energy tick is a playerData change like any
 * other, so it announced itself, and a sibling ACCOUNT tab in the same browser
 * refetched /api/player/me once a minute because a guest tab happened to be
 * open. An odd footnote under "a guest never calls the backend".
 */
describe('a guest tab and an account tab in the same browser', () => {
  it('announces on its own name, which no account tab answers', async () => {
    await mountGuest();

    const heard = [];
    const listener = new BroadcastChannel(CHANNEL_NAME);
    listener.onmessage = (event) => heard.push(event.data);

    await act(async () => {
      await api.collectTreasure('chest-1');
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    listener.close();

    const types = heard.map((message) => message.type);
    expect(types).toContain(GUEST_SAVE_CHANGED);
    expect(types, 'that is the message an account tab refetches on').not.toContain(PLAYER_CHANGED);
  });

  it('leaves an account tab where it was', async () => {
    await mount();
    const before = refetchCount();

    await anotherTabChangedSomething(GUEST_SAVE_CHANGED);

    expect(refetchCount(), 'a guest save is nothing an account can fetch').toBe(before);
  });

  it('leaves a guest tab where it was', async () => {
    await mountGuest();
    /* The slot as a third party might leave it. The point is the SIGNAL: a
       PLAYER_CHANGED is an account's business, so nothing here reads it. */
    writeGuestSave(wonThreeLevels());

    await anotherTabChangedSomething(PLAYER_CHANGED);

    expect(api.playerData.completedLevels).toEqual([]);
    expect(fetch, 'and it certainly does not go to the backend').not.toHaveBeenCalled();
  });
});
