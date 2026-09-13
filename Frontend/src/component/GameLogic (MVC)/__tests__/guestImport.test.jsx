/*
 * Signing up MOVES the guest save into the new account.
 *
 * Moves, not copies. A slot that survived signup would be imported again by
 * the next signup on the same browser, handing a second new account the same
 * progress - so the slot is emptied once the server has it. The cost is that
 * logging out immediately after signing up lands on a fresh guest game, which
 * is the documented exception to "logging out returns to your guest save".
 *
 * The slot is cleared only on success. A failed import keeps it, so the next
 * login tries again rather than losing the save to a cold start.
 *
 * The import runs on login rather than on registration because
 * /api/auth/register issues no token: there is nothing to authenticate an
 * upload with until the address is verified and a login has happened.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { GameProvider, useGame } from '../GameContext.jsx';
import { writeGuestSave, newGuestPlayer, hasGuestSave } from '../guestSave.js';
import { apiUrl } from '../../../config/api.js';

const IMPORT_URL = apiUrl('/api/player/import');

/** The entity the auth response carries: an account nobody has played yet. */
const ACCOUNT = {
  id: 'a1', sessionId: 's1', displayName: 'New Player', rank: 'Novice',
  gold: 100, iron: 10, grain: 30, water: 40, gem: 5,
  lobbyEnergy: 50, maxLobbyEnergy: 100,
  lastEnergyRechargeTime: new Date().toISOString(),
  cards: [{ cardId: 1, name: 'Shooter', level: 1, pieces: 0, piecesNeeded: 10 }],
  unlockedLevels: [1], completedLevels: [], levelStars: Array(20).fill(0),
  collectedTreasures: [],
};

function Probe() {
  const { mode } = useGame();
  return <span data-testid="mode">{mode}</span>;
}

/**
 * A backend that signs the player in, answering `/import` however a test asks.
 *
 * Everything else - /api/player/me, and the back-grant POSTs a load can make -
 * comes back as the account, so nothing but the import can fail.
 */
function backend(importReply = () => Promise.resolve({ ok: true, json: async () => ACCOUNT })) {
  const fetchMock = vi.fn((url) => {
    const href = String(url);
    if (href === IMPORT_URL) return importReply();
    if (href.includes('/api/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ token: 'a-token', player: ACCOUNT }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ACCOUNT });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/*
 * The real door, as loginShape.test.jsx uses it. GameProvider renders LoginPage
 * instead of its children until someone is signed in, and `handleLogin` is
 * handed to that page rather than published on the context - so the login has
 * to actually happen. It is also the only way to see what LoginPage does to the
 * import: it calls onLogin without awaiting it and is unmounted moments later.
 *
 * @testing-library/user-event is not a dependency of this project, so the
 * clicks go through fireEvent.
 */
async function signIn() {
  render(<GameProvider><Probe /></GameProvider>);

  fireEvent.change(screen.getByPlaceholderText(/email/i), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/password/i), {
    target: { value: 'a-password' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
  });
}

/** The body posted to /api/player/import, parsed, or undefined if none was. */
function importBody(fetchMock) {
  const call = fetchMock.mock.calls.find(([url]) => String(url) === IMPORT_URL);
  return call ? JSON.parse(call[1].body) : undefined;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('signing up while holding guest progress', () => {
  it('sends the save to the new account', async () => {
    const played = { ...newGuestPlayer(), completedLevels: [1, 2, 3] };
    played.resources = { ...played.resources, gold: 640 };
    writeGuestSave(played);
    const fetchMock = backend();

    await signIn();

    await waitFor(() => expect(importBody(fetchMock)).toBeTruthy());
    const body = importBody(fetchMock);
    expect(body.completedLevels).toEqual([1, 2, 3]);
    /* Flat, because that is the only shape the endpoint binds - see
       toGuestSaveRequest, and GuestSaveRequest's class comment behind it. A
       nested `resources` arrives as null and is replaced by the new account's
       defaults, losing every resource the guest earned without an error. */
    expect(body.gold).toBe(640);
  });

  it('empties the slot once the server has it', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1] });
    backend();

    await signIn();

    await waitFor(() => expect(hasGuestSave()).toBe(false));
  });

  it('keeps the slot when the import is refused, so nothing is lost', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1] });
    backend(() => Promise.resolve({ ok: false, status: 409 }));

    await signIn();

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('account'));
    expect(hasGuestSave()).toBe(true);
  });

  it('keeps the slot when the import never arrives', async () => {
    writeGuestSave({ ...newGuestPlayer(), completedLevels: [1] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend(() => Promise.reject(new Error('offline')));

    await signIn();

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('account'));
    expect(hasGuestSave()).toBe(true);
  });
});

describe('logging in with no guest progress', () => {
  it('does not call import at all', async () => {
    const fetchMock = backend();

    await signIn();

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('account'));
    expect(fetchMock.mock.calls.some(([url]) => String(url) === IMPORT_URL)).toBe(false);
  });
});
