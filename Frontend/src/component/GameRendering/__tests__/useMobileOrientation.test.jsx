/*
 * The hook that made every iPhone show a blank screen.
 *
 * `screen.orientation.lock` is Chromium-only. WebKit ships screen.orientation
 * with `type` and `angle` and neither lock nor unlock, and the old guard -
 * `screen.orientation && screen.orientation.lock()` - called the function it was
 * testing for. So it threw from an effect on mount, React unwound the tree, and
 * the game rendered nothing at all.
 *
 * Nothing caught it because jsdom has NO screen.orientation, so the guard
 * short-circuited and the bug could not happen in a test. Every case below
 * defines the object the real browser has.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useMobileOrientation } from '../UseMobileOrientation.js';

function Probe({ gameState }) {
  useMobileOrientation(gameState);
  return <div>rendered</div>;
}

/** Replace screen.orientation with whatever a given browser exposes. */
function browserWith(orientation) {
  Object.defineProperty(window.screen, 'orientation', {
    value: orientation, configurable: true, writable: true,
  });
}

function phoneWidth(width = 500) {
  Object.defineProperty(window, 'innerWidth', {
    value: width, configurable: true, writable: true,
  });
}

/** WebKit: the object exists, the methods do not. */
const WEBKIT = { type: 'portrait-primary', angle: 0 };

afterEach(() => {
  delete window.screen.orientation;
  Object.defineProperty(window, 'innerWidth', {
    value: 1024, configurable: true, writable: true,
  });
  vi.restoreAllMocks();
});

describe('a browser with no orientation lock (every iPhone)', () => {
  it('still renders the game during a level', () => {
    browserWith(WEBKIT);
    phoneWidth();

    const { getByText } = render(<Probe gameState="inGame" />);

    expect(getByText('rendered')).toBeTruthy();
  });

  /*
   * The one that actually bit: the else branch runs at login, long before a
   * level, so the crash happened on the way in and no screen ever appeared.
   */
  it('still renders the lobby, which is where the crash happened', () => {
    browserWith(WEBKIT);

    const { getByText } = render(<Probe gameState="lobby" />);

    expect(getByText('rendered')).toBeTruthy();
  });

  it('survives unmounting, where the cleanup runs', () => {
    browserWith(WEBKIT);
    phoneWidth();
    const view = render(<Probe gameState="inGame" />);

    expect(() => view.unmount()).not.toThrow();
  });
});

describe('a browser that implements it', () => {
  it('asks for landscape once, by name', () => {
    const lock = vi.fn(() => Promise.resolve());
    browserWith({ type: 'portrait-primary', angle: 0, lock, unlock: vi.fn() });
    phoneWidth();

    render(<Probe gameState="inGame" />);

    // Once, with an argument. The old guard called lock() with none first,
    // which Chromium rejects outright.
    expect(lock.mock.calls).toEqual([['landscape']]);
  });

  it('releases the lock away from a level', () => {
    const unlock = vi.fn();
    browserWith({ type: 'landscape-primary', angle: 90, lock: vi.fn(), unlock });

    render(<Probe gameState="lobby" />);

    expect(unlock).toHaveBeenCalled();
  });

  /* Chromium rejects the lock unless the page is fullscreen. Expected, not fatal. */
  it('renders anyway when the request is refused', () => {
    browserWith({
      type: 'portrait-primary', angle: 0,
      lock: vi.fn(() => Promise.reject(new Error('NotSupportedError'))),
      unlock: vi.fn(),
    });
    phoneWidth();

    const { getByText } = render(<Probe gameState="inGame" />);

    expect(getByText('rendered')).toBeTruthy();
  });

  /* A desktop browser is left alone: no phone, no lock. */
  it('does not lock a wide window', () => {
    const lock = vi.fn();
    browserWith({ type: 'landscape-primary', angle: 0, lock, unlock: vi.fn() });

    render(<Probe gameState="inGame" />);

    expect(lock).not.toHaveBeenCalled();
  });
});
