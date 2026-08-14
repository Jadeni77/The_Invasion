import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, loadSettings, saveSettings, subscribe, getSettings,
} from '../SettingsStore.js';

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it('returns defaults when nothing is stored', () => {
    localStorage.clear();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', () => {
    const next = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, masterVolume: 20 },
    };
    saveSettings(next);
    expect(loadSettings().audio.masterVolume).toBe(20);
  });

  it('fills in missing keys from defaults', () => {
    localStorage.setItem('gameSettings', JSON.stringify({ audio: { masterVolume: 10 } }));
    const loaded = loadSettings();
    expect(loaded.audio.masterVolume).toBe(10);
    expect(loaded.audio.musicVolume).toBe(DEFAULT_SETTINGS.audio.musicVolume);
    expect(loaded.display.screenShake).toBe(DEFAULT_SETTINGS.display.screenShake);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('gameSettings', 'not json{{');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies subscribers on save', () => {
    const seen = vi.fn();
    const unsub = subscribe(seen);
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, screenShake: false } });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0][0].display.screenShake).toBe(false);
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    const seen = vi.fn();
    subscribe(seen)();
    saveSettings(DEFAULT_SETTINGS);
    expect(seen).not.toHaveBeenCalled();
  });

  it('exposes the current value synchronously', () => {
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, showHealthBars: false } });
    expect(getSettings().display.showHealthBars).toBe(false);
  });
});
