/*
 * Telling a player the game has been redeployed, without taking their run.
 *
 * Merging to main publishes immediately and an open tab keeps its old bundle -
 * nothing breaks, but a player can sit on a build from days ago and never know.
 * The awkward part is the timing: reloading mid-level destroys the run AND
 * keeps the energy that paid for it, which is the loss the quit dialog exists
 * to warn about. So the notice waits for the lobby.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import UpdateNotice from '../UpdateNotice.jsx';
import { GameContext } from '../../GameLogic (MVC)/GameContext';
import {
  updateAvailable, fetchDeployedBuildId, BUILD_ID, UPDATE_POLL_MS,
} from '../../../config/version.js';

/* The interval the component actually uses. It calls the hook with no
   argument, so a test that invents its own number advances past nothing. */
const POLL_MS = UPDATE_POLL_MS;

/** Serve `buildId` from version.json, or fail the request when null. */
function servingBuild(buildId) {
  globalThis.fetch = vi.fn(() => (buildId === null
    ? Promise.reject(new TypeError('Failed to fetch'))
    : Promise.resolve({ ok: true, json: () => Promise.resolve({ buildId }) })));
}

function inState(gameState) {
  return ({ children }) => (
    <GameContext.Provider value={{ gameState }}>{children}</GameContext.Provider>
  );
}

/** Let the poll fire `times` over. */
async function poll(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS + 50); });
  }
}

/** Replaces window.location.reload, which jsdom will not let you spy on. */
let reload;
let realLocation;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  reload = vi.fn();
  realLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, reload },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
  });
});

describe('deciding whether there is an update', () => {
  it('says no when the served build matches the running one', () => {
    expect(updateAvailable('build-a', 'build-a')).toBe(false);
  });

  it('says yes when it differs', () => {
    expect(updateAvailable('build-b', 'build-a')).toBe(true);
  });

  /* The dev server emits no version.json, and a failed poll returns null.
     Neither is news, and neither may nag. */
  it('says no to anything it could not determine', () => {
    expect(updateAvailable(null, 'build-a')).toBe(false);
    expect(updateAvailable(undefined, 'build-a')).toBe(false);
    expect(updateAvailable('', 'build-a')).toBe(false);
    expect(updateAvailable({ buildId: 'b' }, 'build-a')).toBe(false);
  });

  it('says no when the running build is not a real build', () => {
    expect(updateAvailable('build-b', 'development')).toBe(false);
  });

  it('busts the cache, or it would ask a cached answer forever', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true, json: () => Promise.resolve({ buildId: 'x' }),
    }));

    await fetchDeployedBuildId(fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/version\.json\?/);
    expect(init.cache).toBe('no-store');
  });

  it('survives a version.json that is missing or malformed', async () => {
    expect(await fetchDeployedBuildId(() => Promise.resolve({ ok: false }))).toBeNull();
    expect(await fetchDeployedBuildId(() => Promise.reject(new Error('x')))).toBeNull();
    expect(await fetchDeployedBuildId(() => Promise.resolve({
      ok: true, json: () => Promise.resolve({}),
    }))).toBeNull();
  });
});

describe('when the notice appears', () => {
  it('stays quiet while the served build is the running one', async () => {
    servingBuild(BUILD_ID);
    render(<UpdateNotice />, { wrapper: inState('lobby') });

    await poll(2);

    expect(screen.queryByText(/new version/i)).toBeNull();
  });

  it('appears in the lobby once the site has been redeployed', async () => {
    servingBuild('a-newer-build');
    render(<UpdateNotice />, { wrapper: inState('lobby') });

    await poll();

    await waitFor(() => expect(screen.getByText(/new version/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy();
  });

  /* The point of the whole thing: an update during a level waits for it to end. */
  it('says nothing during a level, however long it has known', async () => {
    servingBuild('a-newer-build');
    render(<UpdateNotice />, { wrapper: inState('inGame') });

    await poll(3);

    expect(screen.queryByText(/new version/i), 'never mid-level').toBeNull();
  });

  it('appears the moment that level ends', async () => {
    servingBuild('a-newer-build');
    /* No `wrapper` option here: RTL keeps the original wrapper across a
       rerender, so a second provider passed as the element is ignored and the
       state never actually changes. */
    const withState = (gameState) => (
      <GameContext.Provider value={{ gameState }}>
        <UpdateNotice />
      </GameContext.Provider>
    );
    const { rerender } = render(withState('inGame'));

    await poll(2);
    expect(screen.queryByText(/new version/i), 'still playing').toBeNull();

    rerender(withState('lobby'));

    await waitFor(() => expect(screen.getByText(/new version/i)).toBeTruthy());
  });

  it('asks rather than reloading on its own', async () => {
    servingBuild('a-newer-build');
    render(<UpdateNotice />, { wrapper: inState('lobby') });

    await poll(3);
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy());

    // The claim. A page that reloads itself while someone is reading it is
    // indistinguishable from a crash - and in the lobby it would throw away
    // whatever they were in the middle of choosing.
    expect(reload, 'reloaded without being asked').not.toHaveBeenCalled();
  });

  it('reloads when the player presses Refresh, and not before', async () => {
    servingBuild('a-newer-build');
    render(<UpdateNotice />, { wrapper: inState('lobby') });

    await poll();
    const button = await waitFor(() => screen.getByRole('button', { name: /refresh/i }));
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops asking once it has an answer', async () => {
    servingBuild('a-newer-build');
    render(<UpdateNotice />, { wrapper: inState('lobby') });

    await poll();
    await waitFor(() => expect(screen.getByText(/new version/i)).toBeTruthy());
    const callsWhenFound = globalThis.fetch.mock.calls.length;

    await poll(3);

    expect(globalThis.fetch.mock.calls.length, 'nothing left to learn').toBe(callsWhenFound);
  });
});
