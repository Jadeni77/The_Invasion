import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingModal from '../SettingModal.jsx';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../../GameLogic (MVC)/Feedback/SettingsStore.js';

/*
 * Partial mock via importOriginal, not a replacement object.
 *
 * A mock that lists its exports silently drops every export it does not name, so
 * the module gaining one breaks this file with "No export is defined on the mock"
 * - thrown at import, nowhere near the cause. That has now happened twice: once
 * when DefenderClassUtils gained MAX_DEFENDER_LEVEL, and again when GameContext
 * gained ENERGY_PACK. Only `useGame` needs stubbing here; everything else should
 * be whatever the real module exports.
 */
vi.mock('../../../GameLogic (MVC)/GameContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),

  useGame: () => ({ closeSettings: vi.fn() }),
}));

describe('SettingModal', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it('loads persisted settings rather than hardcoded defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, audio: { ...DEFAULT_SETTINGS.audio, masterVolume: 33 } });
    render(<SettingModal />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('persists a changed toggle when Apply is pressed', () => {
    render(<SettingModal />);
    fireEvent.click(screen.getByRole('button', { name: /Screen Shake toggle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));
    expect(loadSettings().display.screenShake).toBe(false);
  });

  it('discards changes when Cancel is pressed', () => {
    // Seed a state that differs from the defaults in two ways, so the
    // assertion can tell "Cancel saved nothing" apart from "Cancel happened
    // to save the defaults" (screenShake: true is both the default and the
    // pre-fix seed value, which made the old version of this test pass for
    // the wrong reason).
    saveSettings({
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, masterVolume: 17 },
      display: { ...DEFAULT_SETTINGS.display, screenShake: false },
    });
    render(<SettingModal />);
    fireEvent.click(screen.getByRole('button', { name: /Screen Shake toggle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(loadSettings().display.screenShake).toBe(false);
    expect(loadSettings().audio.masterVolume).toBe(17);
  });

  it('disables the tutorial hints control, which has nothing to control', () => {
    render(<SettingModal />);
    expect(screen.getByRole('button', { name: /Tutorial Hints toggle/i })).toBeDisabled();
  });

  it('disables the confirm deployment control, which has nothing to control', () => {
    render(<SettingModal />);
    expect(screen.getByRole('button', { name: /Confirm Deployment toggle/i })).toBeDisabled();
  });
});
