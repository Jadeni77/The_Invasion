/*
 * A sleeping server explains itself.
 *
 * The backend runs on a free host that spins it down when nobody is playing, so
 * the first request after a quiet spell waits tens of seconds - against an
 * application that itself starts in about two. Left alone, the login button sat
 * on "..." for that whole time, which reads as a broken game rather than a cold
 * one.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import LoginPage from '../LoginPage.jsx';

/** A request that never answers, which is what a waking server looks like. */
function hangingBackend() {
  globalThis.fetch = vi.fn(() => new Promise(() => {}));
}

function submitLogin() {
  fireEvent.change(screen.getByPlaceholderText(/email/i), {
    target: { value: 'commander@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/password/i), {
    target: { value: 'testpass123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('waiting on a cold backend', () => {
  it('says nothing about waking while the request is still young', async () => {
    hangingBackend();
    render(<LoginPage onLogin={vi.fn()} />);

    submitLogin();
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(screen.queryByText(/waking the server/i), 'a fast reply needs no excuse').toBeNull();
  });

  it('explains itself once the wait is long enough to look broken', async () => {
    hangingBackend();
    render(<LoginPage onLogin={vi.fn()} />);

    submitLogin();
    await act(async () => { vi.advanceTimersByTime(6000); });

    await waitFor(() => {
      expect(screen.getAllByText(/waking the server/i).length).toBeGreaterThan(0);
    });
  });

  it('says how long, so the wait has an end', async () => {
    hangingBackend();
    render(<LoginPage onLogin={vi.fn()} />);

    submitLogin();
    await act(async () => { vi.advanceTimersByTime(6000); });

    await waitFor(() => {
      expect(screen.getByText(/up to a minute/i)).toBeTruthy();
    });
  });

  it('drops the message when the server answers', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      text: () => Promise.resolve('Bad credentials'),
    }));
    render(<LoginPage onLogin={vi.fn()} />);

    submitLogin();
    await act(async () => { vi.advanceTimersByTime(6000); });

    await waitFor(() => expect(screen.getByText(/bad credentials/i)).toBeTruthy());
    expect(screen.queryByText(/waking the server/i), 'the wait is over').toBeNull();
  });

  it('drops the message when the request fails outright', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<LoginPage onLogin={vi.fn()} />);

    submitLogin();
    await act(async () => { vi.advanceTimersByTime(6000); });

    await waitFor(() => expect(screen.getByText(/cannot connect/i)).toBeTruthy());
    expect(screen.queryByText(/waking the server/i)).toBeNull();
  });
});
