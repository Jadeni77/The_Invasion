/*
 * The gate used to be a boolean, so there were only two states: logged in, or
 * looking at a login form. A guest is a third - playing, with a real save,
 * against no backend at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import {
  writeGuestSave,
  readGuestSave,
  newGuestPlayer,
  hasGuestSave,
} from '../guestSave.js';
import { apiUrl } from '../../../config/api.js';

/* The context as the last render left it, for the cases that have to drive the
   game rather than just look at it. */
let api;

function Probe() {
  api = useGame();
  const { mode, playerData } = api;
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="levels">{JSON.stringify(playerData?.completedLevels ?? null)}</span>
    </div>
  );
}

const renderGame = () => render(<GameProvider><Probe /></GameProvider>);

/*
 * @testing-library/user-event is not a dependency of this project and nothing
 * else in the suite uses one, so the click goes through fireEvent as
 * loginShape.test.jsx does. Wrapped in act because the handler it fires starts
 * a load.
 */
const clickPlayAsGuest = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /play as guest/i }));
  });
};

const ME_URL = apiUrl('/api/player/me');

/** An account that has finished level 7, served from the backend. */
const ACCOUNT_SAVE = {
  id: 'p1', sessionId: 's1', displayName: 'Commander', rank: 'Recruit',
  gold: 500, iron: 10, grain: 10, water: 10, gem: 5,
  lobbyEnergy: 100, maxLobbyEnergy: 100, lastEnergyRechargeTime: Date.now(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1, 2], completedLevels: [7], collectedTreasures: [],
  levelStars: Array(20).fill(0), endlessHighScore: 0,
};

/** Sign this browser in, and answer /api/player/me with an account. */
function signedInAccount() {
  localStorage.setItem('auth_token', 'a-token');
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(String(url) === ME_URL ? { ...ACCOUNT_SAVE } : {}),
  })));
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no backend in this test')));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  api = null;
});

describe('arriving with no account', () => {
  it('shows the login screen', () => {
    renderGame();
    expect(screen.getByRole('button', { name: /play as guest/i })).toBeInTheDocument();
  });

  it('starts playing on a fresh save when guest is chosen', async () => {
    renderGame();
    await clickPlayAsGuest();

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('guest'));
    expect(screen.getByTestId('levels')).toHaveTextContent('[]');
  });

  it('never calls the backend to do it', async () => {
    renderGame();
    await clickPlayAsGuest();

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('guest'));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('returning as a guest', () => {
  it('resumes the save already in the browser', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1, 2, 3] });

    renderGame();
    await clickPlayAsGuest();

    await waitFor(() => expect(screen.getByTestId('levels')).toHaveTextContent('[1,2,3]'));
  });

  it('writes progress back to the slot as it changes', async () => {
    renderGame();
    await clickPlayAsGuest();

    await waitFor(() => expect(hasGuestSave()).toBe(true));
  });

  /*
   * `gameAPI.persistence` is the one seam components save through, so it has to
   * follow the mode too. Handing a guest the account instance would leave
   * AchievementPage POSTing a claim, the 401 swallowed, the reward credited
   * locally, and nothing looking wrong - see achievementClaim.test.jsx, which
   * holds the other half of this from the page's side.
   */
  it('hands components the guest persistence, not the account one', async () => {
    renderGame();
    await clickPlayAsGuest();
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('guest'));

    await act(async () => { await api.persistence.claimAchievement('x', { gold: 1 }); });

    expect(fetch).not.toHaveBeenCalled();
  });
});

/*
 * The two loadPlayer implementations do not return the same shape, and both say
 * so in a comment: accountPersistence hands back the RAW backend entity, which
 * still needs toPlayerData; guestPersistence hands back a playerData that has
 * already been through it.
 *
 * Running a guest's save through the transform a second time reads `data.gold`
 * off a player whose gold lives at `data.resources.gold`, so every resource
 * comes out undefined - and because the slot is written FROM playerData, that
 * lands in the save rather than stopping at the screen. Finishing a level is
 * all it takes to trigger it: onWinCb ends with a refetch.
 */
describe('a guest finishing a level', () => {
  it('keeps real resource numbers, on screen and in the slot', async () => {
    renderGame();
    await clickPlayAsGuest();
    await waitFor(() => expect(api.playerData?.resources?.gold).toBe(100));

    await act(async () => { await api.onWinCb({ score: 500, level: 1 }); });

    /* winRewards(500, 3): 100 gold and 50 iron on top of what a new guest
       starts with, and a gem for the third star. */
    expect(api.playerData.resources.gold).toBe(200);
    expect(api.playerData.resources.iron).toBe(60);
    expect(readGuestSave().resources).toMatchObject({ gold: 200, iron: 60, gem: 6 });
  });
});

describe('leaving a session', () => {
  /* The guest slot is not an account's to write to, so logging out has to find
     it exactly as the guest left it. */
  it('an account never writes over the guest slot', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1, 2, 3] });
    signedInAccount();

    renderGame();
    await waitFor(() => expect(screen.getByTestId('levels')).toHaveTextContent('[7]'));

    expect(readGuestSave().completedLevels).toEqual([1, 2, 3]);
  });

  it('logging out of an account lands back on the guest save', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1, 2, 3] });
    signedInAccount();

    renderGame();
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('account'));

    await act(async () => { api.handleLogout(); });

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('guest'));
    await waitFor(() => expect(screen.getByTestId('levels')).toHaveTextContent('[1,2,3]'));
  });

  /*
   * The lobby's Logout button is on screen for a guest too, and a guest has no
   * account to leave - so it means "show me the login screen". Sending them
   * back to `guest` instead would clear playerData without changing the mode,
   * and nothing would reload it: the lobby would sit on "Loading Game Data..."
   * forever.
   */
  it('a guest pressing Logout gets the login screen, save intact', async () => {
    renderGame();
    await clickPlayAsGuest();
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('guest'));

    await act(async () => { api.handleLogout(); });

    expect(await screen.findByRole('button', { name: /play as guest/i })).toBeInTheDocument();
    expect(hasGuestSave()).toBe(true);
  });
});
