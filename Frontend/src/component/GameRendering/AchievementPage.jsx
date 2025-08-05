// src/component/GameRendering/AchievementPage.jsx
import React, { useState } from 'react';
import { useGame } from '../GameLogic (MVC)/GameContext';
import '../../style/AchievementPage.css';

const AchievementPage = () => {
    const { closeAchievements } = useGame();
    const [selectedCategory, setSelectedCategory] = useState('combat');

    // Mock achievement data - will be replaced with real data later
    const achievements = {
        combat: [
            {
                id: 'first_blood',
                title: 'First Blood',
                description: 'Kill your first enemy',
                icon: '🏆',
                progress: 1,
                total: 1,
                completed: true,
                rewards: { gold: 50 },
                claimedReward: true
            },
            {
                id: 'enemy_slayer',
                title: 'Enemy Slayer',
                description: 'Kill 100 enemies',
                icon: '💀',
                progress: 67,
                total: 100,
                completed: false,
                rewards: { gold: 200, gem: 5 },
                claimedReward: false
            },
            {
                id: 'killing_spree',
                title: 'Killing Spree',
                description: 'Kill 1000 enemies',
                icon: '⚔️',
                progress: 67,
                total: 1000,
                completed: false,
                rewards: { gold: 1000, gem: 20, cardPack: 1 },
                claimedReward: false
            },
            {
                id: 'tank_buster',
                title: 'Tank Buster',
                description: 'Defeat 50 Tank Zombies',
                icon: '🛡️',
                progress: 12,
                total: 50,
                completed: false,
                rewards: { gold: 300, iron: 50 },
                claimedReward: false
            }
        ],
        defense: [
            {
                id: 'first_defender',
                title: 'First Line of Defense',
                description: 'Deploy your first defender',
                icon: '🛡️',
                progress: 1,
                total: 1,
                completed: true,
                rewards: { gold: 30 },
                claimedReward: true
            },
            {
                id: 'defender_master',
                title: 'Defender Master',
                description: 'Deploy 50 defenders',
                icon: '🏰',
                progress: 23,
                total: 50,
                completed: false,
                rewards: { gold: 250, cardPieces: 10 },
                claimedReward: false
            },
            {
                id: 'perfect_defense',
                title: 'Perfect Defense',
                description: 'Complete a level without losing any defender',
                icon: '✨',
                progress: 0,
                total: 1,
                completed: false,
                rewards: { gem: 10, cardPack: 1 },
                claimedReward: false
            }
        ],
        resource: [
            {
                id: 'energy_collector',
                title: 'Energy Collector',
                description: 'Collect 100 energy drops',
                icon: '⚡',
                progress: 45,
                total: 100,
                completed: false,
                rewards: { gold: 150, water: 50 },
                claimedReward: false
            },
            {
                id: 'resource_hoarder',
                title: 'Resource Hoarder',
                description: 'Accumulate 10,000 total resources',
                icon: '💰',
                progress: 3542,
                total: 10000,
                completed: false,
                rewards: { gold: 500, iron: 100, grain: 100, water: 100 },
                claimedReward: false
            }
        ],
        progression: [
            {
                id: 'level_1_complete',
                title: 'Welcome to the Garden',
                description: 'Complete Level 1',
                icon: '🌱',
                progress: 1,
                total: 1,
                completed: true,
                rewards: { gold: 100, cardPieces: 5 },
                claimedReward: true
            },
            {
                id: 'card_upgrader',
                title: 'Card Enhancer',
                description: 'Upgrade 5 cards',
                icon: '⬆️',
                progress: 2,
                total: 5,
                completed: false,
                rewards: { gem: 5, grain: 50 },
                claimedReward: false
            }
        ],
        special: [
            {
                id: 'speedrun',
                title: 'Speed Demon',
                description: 'Complete any level in under 2 minutes',
                icon: '🏃',
                progress: 0,
                total: 1,
                completed: false,
                rewards: { gem: 15, gold: 1000 },
                claimedReward: false
            },
            {
                id: 'no_damage_run',
                title: 'Untouchable',
                description: 'Complete a level without base taking damage',
                icon: '🌟',
                progress: 0,
                total: 1,
                completed: false,
                rewards: { cardPack: 2, gem: 25 },
                claimedReward: false
            }
        ]
    };

    const categories = [
        { id: 'combat', name: 'Combat', icon: '⚔️' },
        { id: 'defense', name: 'Defense', icon: '🛡️' },
        { id: 'resource', name: 'Resource', icon: '💰' },
        { id: 'progression', name: 'Progress', icon: '📈' },
        { id: 'special', name: 'Special', icon: '⭐' }
    ];

    const formatRewards = (rewards) => {
        const rewardTexts = [];
        if (rewards.gold) rewardTexts.push(`${rewards.gold} Gold`);
        if (rewards.gem) rewardTexts.push(`${rewards.gem} Gems`);
        if (rewards.iron) rewardTexts.push(`${rewards.iron} Iron`);
        if (rewards.grain) rewardTexts.push(`${rewards.grain} Grain`);
        if (rewards.water) rewardTexts.push(`${rewards.water} Water`);
        if (rewards.cardPieces) rewardTexts.push(`${rewards.cardPieces} Card Pieces`);
        if (rewards.cardPack) rewardTexts.push(`${rewards.cardPack} Card Pack${rewards.cardPack > 1 ? 's' : ''}`);
        return rewardTexts.join(', ');
    };

    const calculateProgress = (achievement) => {
        return Math.min((achievement.progress / achievement.total) * 100, 100);
    };

    return (
        <div className="achievement-page">
            <div className="achievement-header">
                <h1>ACHIEVEMENTS</h1>
                <button className="close-button" onClick={closeAchievements}>×</button>
            </div>

            <div className="category-tabs">
                {categories.map(category => (
                    <button
                        key={category.id}
                        className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        <span className="category-icon">{category.icon}</span>
                        <span className="category-name">{category.name}</span>
                    </button>
                ))}
            </div>

            <div className="achievements-container">
                <h2 className="category-title">
                    {categories.find(c => c.id === selectedCategory)?.name.toUpperCase()}
                </h2>

                <div className="achievements-list">
                    {achievements[selectedCategory]?.map(achievement => (
                        <div
                            key={achievement.id}
                            className={`achievement-card ${achievement.completed ? 'completed' : ''}`}
                        >
                            <div className="achievement-icon">{achievement.icon}</div>

                            <div className="achievement-content">
                                <h3 className="achievement-title">{achievement.title}</h3>
                                <p className="achievement-description">{achievement.description}</p>

                                <div className="progress-container">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${calculateProgress(achievement)}%` }}
                                        />
                                    </div>
                                    <span className="progress-text">
                    {achievement.completed ? '✓' : `${achievement.progress}/${achievement.total}`}
                  </span>
                                </div>

                                <div className="reward-section">
                                    {achievement.completed && achievement.claimedReward ? (
                                        <span className="claimed-text">Claimed: {formatRewards(achievement.rewards)}</span>
                                    ) : (
                                         <span className="reward-text">🎁 Reward: {formatRewards(achievement.rewards)}</span>
                                     )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button className="back-button" onClick={closeAchievements}>
                Back to Lobby
            </button>
        </div>
    );
};

export default AchievementPage;