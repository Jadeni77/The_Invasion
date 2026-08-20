/*
 * What a crash looks like to a player.
 *
 * React unmounts the whole tree when a render throws, so the game became a
 * blank screen - and an iPhone showed exactly that for
 * `screen.orientation.lock is not a function`. Learning what it said took a USB
 * cable and Safari's Web Inspector.
 *
 * These check the thing that matters: the message survives to the screen. A
 * boundary that swallows the error and shows "something went wrong" would leave
 * the player with nothing to report, which is the state this replaces.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary.jsx';

function Boom({ message = 'screen.orientation.lock is not a function' }) {
  throw new TypeError(message);
}

beforeEach(() => {
  // React logs every caught error; silenced so a passing run reads clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a component that throws', () => {
  it('leaves a readable screen instead of nothing', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/hit a problem/i)).toBeTruthy();
  });

  /* The whole point: the player can report the actual bug. */
  it('shows the error text the player can send on', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByText('screen.orientation.lock is not a function')).toBeTruthy();
  });

  it('offers a way out', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
  });

  it('reloads when that is clicked', () => {
    const reload = vi.fn();
    const original = window.location;
    // jsdom's location is not writable; replace the object for this test.
    delete window.location;
    window.location = { ...original, reload };

    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    screen.getByRole('button', { name: /reload/i }).click();

    expect(reload).toHaveBeenCalled();
    window.location = original;
  });

  it('still logs the error, so a console keeps the stack', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(console.error).toHaveBeenCalled();
  });
});

describe('a component that does not throw', () => {
  it('is rendered untouched', () => {
    render(<ErrorBoundary><p>the game</p></ErrorBoundary>);

    expect(screen.getByText('the game')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
