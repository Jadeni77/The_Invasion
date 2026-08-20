/*
 * The confirm-your-email screen is not a room you get locked in.
 *
 * Two ways it became one. The screen itself had no way back, unlike every other
 * mode in this form. And leaving it is worse than it sounds: the account
 * already exists and is unconfirmed, so signing in is refused - which told the
 * player to confirm their email while giving them nowhere to do it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import LoginPage from '../LoginPage.jsx';

/** Answer the next request with this status and body. */
function backendAnswers(status, body) {
  globalThis.fetch = vi.fn(() => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(typeof body === 'string' ? {} : body),
  }));
}

async function submit(name) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

function fill(placeholder, value) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('after registering, on the confirm screen', () => {
  async function registerAndLandOnConfirm() {
    backendAnswers(200, {
      verificationRequired: true,
      email: 'someone@example.com',
      message: 'Check your email for a confirmation code.',
    });
    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.click(screen.getByText(/no account\? register/i));
    fill(/email/i, 'someone@example.com');
    fill(/password/i, 'longenough1');
    await submit(/register/i);

    await waitFor(() => expect(screen.getByText(/confirm your email/i)).toBeTruthy());
  }

  it('gets there at all', async () => {
    await registerAndLandOnConfirm();

    expect(screen.getByPlaceholderText(/6-digit code/i)).toBeTruthy();
  });

  it('offers a way back', async () => {
    await registerAndLandOnConfirm();

    const back = screen.getByText(/back to login/i);
    fireEvent.click(back);

    await waitFor(() => expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy());
  });

  it('offers another code, for one that never arrived', async () => {
    await registerAndLandOnConfirm();

    expect(screen.getByText(/send another/i)).toBeTruthy();
  });
});

describe('signing in with an account that was never confirmed', () => {
  it('leads to the box that takes the code, not to a dead end', async () => {
    backendAnswers(403, 'Confirm your email first - check your inbox for the code.');
    render(<LoginPage onLogin={vi.fn()} />);

    fill(/email/i, 'unconfirmed@example.com');
    fill(/password/i, 'longenough1');
    await submit(/^login$/i);

    // The old behaviour: told to confirm, with no way to.
    await waitFor(() => expect(screen.getByPlaceholderText(/6-digit code/i)).toBeTruthy());
    expect(screen.getByText(/still needs confirming/i)).toBeTruthy();
  });

  it('still shows an ordinary error for a wrong password', async () => {
    backendAnswers(401, 'Invalid email or password');
    render(<LoginPage onLogin={vi.fn()} />);

    fill(/email/i, 'someone@example.com');
    fill(/password/i, 'wrongpassword');
    await submit(/^login$/i);

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeTruthy());
    expect(
      screen.queryByPlaceholderText(/6-digit code/i),
      'a wrong password is not a confirmation problem',
    ).toBeNull();
  });
});
