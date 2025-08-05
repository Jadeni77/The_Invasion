// src/component/GameRendering/SettingsModal.jsx
import React, { useState } from 'react';
import { useGame } from '../GameLogic (MVC)/GameContext';
import '../../style/SettingModal.css';

const SettingModal = () => {
    const { closeSettings } = useGame();

    // Mock settings state - will be saved to localStorage/backend later
    const [settings, setSettings] = useState({
                                                 audio: {
                                                     musicVolume: 50,
                                                     soundEffects: 70,
                                                     masterVolume: 80
                                                 },
                                                 display: {
                                                     graphicsQuality: 'medium',
                                                     showDamageNumbers: true,
                                                     showHealthBars: true,
                                                     screenShake: true
                                                 },
                                                 gameplay: {
                                                     autoCollectEnergy: false,
                                                     autoDeployDefenders: false,
                                                     showTutorialHints: true,
                                                     confirmDeployment: false
                                                 }
                                             });

    const handleVolumeChange = (category, value) => {
        setSettings(prev => ({
            ...prev,
            audio: {
                ...prev.audio,
                [category]: parseInt(value)
            }
        }));
    };

    const handleDisplayChange = (setting, value) => {
        setSettings(prev => ({
            ...prev,
            display: {
                ...prev.display,
                [setting]: value
            }
        }));
    };

    const handleGameplayChange = (setting) => {
        setSettings(prev => ({
            ...prev,
            gameplay: {
                ...prev.gameplay,
                [setting]: !prev.gameplay[setting]
            }
        }));
    };

    const handleApply = () => {
        // Save settings to localStorage for now
        localStorage.setItem('gameSettings', JSON.stringify(settings));
        console.log('Settings saved:', settings);
        closeSettings();
    };

    const handleReset = () => {
        const defaultSettings = {
            audio: {
                musicVolume: 50,
                soundEffects: 70,
                masterVolume: 80
            },
            display: {
                graphicsQuality: 'medium',
                showDamageNumbers: true,
                showHealthBars: true,
                screenShake: true
            },
            gameplay: {
                autoCollectEnergy: false,
                autoDeployDefenders: false,
                showTutorialHints: true,
                confirmDeployment: false
            }
        };
        setSettings(defaultSettings);
    };

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal">
                <div className="settings-header">
                    <h2>SETTINGS</h2>
                    <button className="close-button" onClick={closeSettings}>×</button>
                </div>

                <div className="settings-content">
                    {/* Audio Settings */}
                    <div className="settings-section">
                        <h3 className="section-header">AUDIO</h3>

                        <div className="setting-item">
                            <label>Master Volume</label>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={settings.audio.masterVolume}
                                    onChange={(e) => handleVolumeChange('masterVolume', e.target.value)}
                                    className="volume-slider"
                                />
                                <span className="volume-value">{settings.audio.masterVolume}%</span>
                            </div>
                        </div>

                        <div className="setting-item">
                            <label>Music Volume</label>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={settings.audio.musicVolume}
                                    onChange={(e) => handleVolumeChange('musicVolume', e.target.value)}
                                    className="volume-slider"
                                />
                                <span className="volume-value">{settings.audio.musicVolume}%</span>
                            </div>
                        </div>

                        <div className="setting-item">
                            <label>Sound Effects</label>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={settings.audio.soundEffects}
                                    onChange={(e) => handleVolumeChange('soundEffects', e.target.value)}
                                    className="volume-slider"
                                />
                                <span className="volume-value">{settings.audio.soundEffects}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="settings-section">
                        <h3 className="section-header">DISPLAY</h3>

                        <div className="setting-item">
                            <label>Graphics Quality</label>
                            <div className="quality-buttons">
                                {['low', 'medium', 'high'].map(quality => (
                                    <button
                                        key={quality}
                                        className={`quality-button ${settings.display.graphicsQuality === quality ? 'active' : ''}`}
                                        onClick={() => handleDisplayChange('graphicsQuality', quality)}
                                    >
                                        {quality.charAt(0).toUpperCase() + quality.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="setting-item">
                            <label>Show Damage Numbers</label>
                            <button
                                className={`toggle-button ${settings.display.showDamageNumbers ? 'active' : ''}`}
                                onClick={() => handleDisplayChange('showDamageNumbers', !settings.display.showDamageNumbers)}
                            >
                                {settings.display.showDamageNumbers ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label>Show Health Bars</label>
                            <button
                                className={`toggle-button ${settings.display.showHealthBars ? 'active' : ''}`}
                                onClick={() => handleDisplayChange('showHealthBars', !settings.display.showHealthBars)}
                            >
                                {settings.display.showHealthBars ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label>Screen Shake</label>
                            <button
                                className={`toggle-button ${settings.display.screenShake ? 'active' : ''}`}
                                onClick={() => handleDisplayChange('screenShake', !settings.display.screenShake)}
                            >
                                {settings.display.screenShake ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>
                    </div>

                    {/* Gameplay Settings */}
                    <div className="settings-section">
                        <h3 className="section-header">GAMEPLAY</h3>

                        <div className="setting-item">
                            <label>Auto-collect Energy</label>
                            <button
                                className={`toggle-button ${settings.gameplay.autoCollectEnergy ? 'active' : ''}`}
                                onClick={() => handleGameplayChange('autoCollectEnergy')}
                            >
                                {settings.gameplay.autoCollectEnergy ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label>Auto-deploy Defenders (Coming Soon)</label>
                            <button
                                className={`toggle-button disabled`}
                                disabled
                            >
                                Disabled
                            </button>
                        </div>

                        <div className="setting-item">
                            <label>Show Tutorial Hints</label>
                            <button
                                className={`toggle-button ${settings.gameplay.showTutorialHints ? 'active' : ''}`}
                                onClick={() => handleGameplayChange('showTutorialHints')}
                            >
                                {settings.gameplay.showTutorialHints ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="setting-item">
                            <label>Confirm Deployment</label>
                            <button
                                className={`toggle-button ${settings.gameplay.confirmDeployment ? 'active' : ''}`}
                                onClick={() => handleGameplayChange('confirmDeployment')}
                            >
                                {settings.gameplay.confirmDeployment ? '✓ Enabled' : 'Disabled'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="reset-button" onClick={handleReset}>
                        Reset to Default
                    </button>
                    <div className="action-buttons">
                        <button className="cancel-button" onClick={closeSettings}>
                            Cancel
                        </button>
                        <button className="apply-button" onClick={handleApply}>
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingModal;