import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingModal from '../SettingModal.jsx';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../../GameLogic (MVC)/Feedback/SettingsStore.js';

vi.mock('../../../GameLogic (MVC)/GameContext.jsx', () => ({
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
    render(<SettingModal />);
    fireEvent.click(screen.getByRole('button', { name: /Screen Shake toggle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(loadSettings().display.screenShake).toBe(true);
  });

  it('disables the tutorial hints control, which has nothing to control', () => {
    render(<SettingModal />);
    expect(screen.getByRole('button', { name: /Tutorial Hints toggle/i })).toBeDisabled();
  });
});
