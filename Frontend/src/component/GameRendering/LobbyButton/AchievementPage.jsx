import { useState } from 'react';
import { useGame } from '../../GameLogic (MVC)/GameContext.jsx';
import { SessionManager } from '../../GameLogic (MVC)/SessionManager.js';
import '../../../style/AchievementPage.css';
import GameBackdrop from "../TerrainBackdrop.jsx";
import { apiUrl } from "../../../config/api.js";

const ACHIEVEMENTS = {
  progression: [
    {
      id: 'complete_level_1',
      title: 'First Step',
      description: 'Complete Level 1',
      icon: '🌱',
      total: 1,
      getProgress: (p) => (p.completedLevels?.includes(1) ? 1 : 0),
      rewards: { gold: 100 },
    },
    {
      id: 'complete_5_levels',
      title: 'Getting Started',
      description: 'Complete 5 levels',
      icon: '🗺️',
      total: 5,
      getProgress: (p) => Math.min(p.completedLevels?.filter((l) => l !== 999).length || 0, 5),
      rewards: { gold: 200, gem: 1 },
    },
    {
      id: 'complete_10_levels',
      title: 'Halfway There',
      description: 'Complete 10 levels',
      icon: '🏆',
      total: 10,
      getProgress: (p) => Math.min(p.completedLevels?.filter((l) => l !== 999).length || 0, 10),
      rewards: { gold: 500, gem: 3 },
    },
    {
      id: 'complete_20_levels',
      title: 'Campaign Complete',
      description: 'Complete all 20 levels',
      icon: '👑',
      total: 20,
      getProgress: (p) => Math.min(p.completedLevels?.filter((l) => l !== 999).length || 0, 20),
      rewards: { gold: 2000, gem: 10 },
    },
    {
      id: 'earn_30_stars',
      title: 'Star Collector',
      description: 'Earn 30 total stars',
      icon: '⭐',
      total: 30,
      getProgress: (p) => Math.min(p.totalStars || 0, 30),
      rewards: { gold: 1000, gem: 5 },
    },
    {
      id: 'collect_all_treasures',
      title: 'Treasure Hunter',
      description: 'Collect all 20 treasure chests',
      icon: '📦',
      total: 20,
      getProgress: (p) => Math.min(p.collectedTreasures?.length || 0, 20),
      rewards: { gold: 500, gem: 20 },
    },
  ],
  combat: [
    {
      id: 'first_blood',
      title: 'First Blood',
      description: 'Kill your first enemy',
      icon: '💀',
      total: 1,
      getProgress: (p) => Math.min(p.totalEnemiesKilled || 0, 1),
      rewards: { gold: 50 },
    },
    {
      id: 'enemy_slayer',
      title: 'Enemy Slayer',
      description: 'Kill 100 enemies',
      icon: '⚔️',
      total: 100,
      getProgress: (p) => Math.min(p.totalEnemiesKilled || 0, 100),
      rewards: { gold: 200, gem: 2 },
    },
    {
      id: 'exterminator',
      title: 'Exterminator',
      description: 'Kill 500 enemies',
      icon: '🔥',
      total: 500,
      getProgress: (p) => Math.min(p.totalEnemiesKilled || 0, 500),
      rewards: { gold: 500, gem: 5 },
    },
    {
      id: 'killing_machine',
      title: 'Killing Machine',
      description: 'Kill 1000 enemies',
      icon: '☠️',
      total: 1000,
      getProgress: (p) => Math.min(p.totalEnemiesKilled || 0, 1000),
      rewards: { gold: 1000, gem: 10 },
    },
  ],
  defense: [
    {
      id: 'first_defender',
      title: 'First Line',
      description: 'Deploy your first defender',
      icon: '🛡️',
      total: 1,
      getProgress: (p) => Math.min(p.totalDefendersDeployed || 0, 1),
      rewards: { gold: 30 },
    },
    {
      id: 'defender_army',
      title: 'Defender Army',
      description: 'Deploy 50 defenders total',
      icon: '🏰',
      total: 50,
      getProgress: (p) => Math.min(p.totalDefendersDeployed || 0, 50),
      rewards: { gold: 200, gem: 2 },
    },
    {
      id: 'perfect_defense',
      title: 'Perfect Defense',
      description: 'Complete a level without losing any defender',
      icon: '✨',
      total: 1,
      getProgress: (p) => (p.specialAchievements?.includes('perfect_defense') ? 1 : 0),
      rewards: { gold: 300, gem: 5 },
    },
    {
      id: 'untouchable',
      title: 'Untouchable',
      description: 'Complete a level without base taking any damage',
      icon: '🌟',
      total: 1,
      getProgress: (p) => (p.specialAchievements?.includes('untouchable') ? 1 : 0),
      rewards: { gold: 500, gem: 10 },
    },
  ],
  resource: [
    {
      id: 'energy_starter',
      title: 'Energy Starter',
      description: 'Collect 50 energy drops',
      icon: '⚡',
      total: 50,
      getProgress: (p) => Math.min(p.totalEnergyCollected || 0, 50),
      rewards: { gold: 100 },
    },
    {
      id: 'energy_hoarder',
      title: 'Energy Hoarder',
      description: 'Collect 200 energy drops',
      icon: '🔋',
      total: 200,
      getProgress: (p) => Math.min(p.totalEnergyCollected || 0, 200),
      rewards: { gold: 300, gem: 3 },
    },
    {
      id: 'card_collector',
      title: 'Card Collector',
      description: 'Unlock 5 defenders',
      icon: '🃏',
      total: 5,
      getProgress: (p) => Math.min(p.cards?.length || 0, 5),
      rewards: { gold: 500, gem: 5 },
    },
    {
      id: 'full_arsenal',
      title: 'Full Arsenal',
      description: 'Unlock all 10 defenders',
      icon: '🎖️',
      total: 10,
      getProgress: (p) => Math.min(p.cards?.length || 0, 10),
      rewards: { gold: 1000, gem: 20 },
    },
  ],
  special: [
    {
      id: 'endless_explorer',
      title: 'Endless Explorer',
      description: 'Unlock Endless Mode',
      icon: '🌀',
      total: 1,
      getProgress: (p) => (p.unlockedLevels?.includes(999) ? 1 : 0),
      rewards: { gold: 500, gem: 5 },
    },
    {
      id: 'endless_survivor',
      title: 'Endless Survivor',
      description: 'Survive 10 waves in Endless Mode',
      icon: '🏄',
      total: 10,
      getProgress: (p) => Math.min(p.endlessHighScore || 0, 10),
      rewards: { gold: 500, gem: 5 },
    },
    {
      id: 'endless_legend',
      title: 'Endless Legend',
      description: 'Survive 25 waves in Endless Mode',
      icon: '🔱',
      total: 25,
      getProgress: (p) => Math.min(p.endlessHighScore || 0, 25),
      rewards: { gold: 2000, gem: 20 },
    },
    {
      id: 'speed_demon',
      title: 'Speed Demon',
      description: 'Complete any level in under 2 minutes',
      icon: '🏃',
      total: 1,
      getProgress: (p) => (p.specialAchievements?.includes('speed_demon') ? 1 : 0),
      rewards: { gold: 500, gem: 10 },
    },
  ],
};

const CATEGORIES = [
  { id: 'progression', name: 'Progress', icon: '📈' },
  { id: 'combat',      name: 'Combat',   icon: '⚔️' },
  { id: 'defense',     name: 'Defense',  icon: '🛡️' },
  { id: 'resource',    name: 'Resource', icon: '💰' },
  { id: 'special',     name: 'Special',  icon: '⭐' },
];

const formatRewards = (rewards) => {
  const parts = [];
  if (rewards.gold)  parts.push(`${rewards.gold} Gold`);
  if (rewards.gem)   parts.push(`${rewards.gem} Gems`);
  if (rewards.iron)  parts.push(`${rewards.iron} Iron`);
  if (rewards.grain) parts.push(`${rewards.grain} Grain`);
  if (rewards.water) parts.push(`${rewards.water} Water`);
  return parts.join(', ');
};

const AchievementPage = () => {
  const { closeAchievements, playerData, setPlayerData } = useGame();
  const [selectedCategory, setSelectedCategory] = useState('progression');
  const [claiming, setClaiming] = useState(null);

  const handleClaim = async (achievement) => {
    if (claiming) return;
    setClaiming(achievement.id);
    try {
      const res = await fetch(apiUrl('/api/player/claim-achievement'), {
        method: 'POST',
        headers: SessionManager.authHeaders(),
        body: JSON.stringify({ achievementId: achievement.id, rewards: achievement.rewards }),
      });
      const updated = await res.json();
      setPlayerData((prev) => ({
        ...prev,
        claimedAchievements: [...(prev.claimedAchievements || []), achievement.id],
        resources: {
          ...prev.resources,
          gold:  updated.gold,
          iron:  updated.iron,
          grain: updated.grain,
          water: updated.water,
          gem:   updated.gem,
        },
      }));
    } catch (e) {
      console.error('Failed to claim achievement:', e);
    } finally {
      setClaiming(null);
    }
  };

  const currentList = ACHIEVEMENTS[selectedCategory] || [];

  return (
    <div className="achievement-page">
            <GameBackdrop />
      <div className="achievement-header">
        <h1>ACHIEVEMENTS</h1>
        <button className="close-button" onClick={closeAchievements}>×</button>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span className="category-icon">{cat.icon}</span>
            <span className="category-name">{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="achievements-container">
        <h2 className="category-title">
          {CATEGORIES.find((c) => c.id === selectedCategory)?.name.toUpperCase()}
        </h2>

        <div className="achievements-list">
          {currentList.map((achievement) => {
            const progress  = playerData ? achievement.getProgress(playerData) : 0;
            const completed = progress >= achievement.total;
            const claimed   = playerData?.claimedAchievements?.includes(achievement.id);
            const pct       = Math.min((progress / achievement.total) * 100, 100);

            return (
              <div
                key={achievement.id}
                className={`achievement-card ${completed ? 'completed' : ''} ${claimed ? 'claimed' : ''}`}
              >
                <div className="achievement-icon">{achievement.icon}</div>

                <div className="achievement-content">
                  <h3 className="achievement-title">{achievement.title}</h3>
                  <p className="achievement-description">{achievement.description}</p>

                  <div className="progress-container">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="progress-text">
                      {completed ? '✓' : `${progress}/${achievement.total}`}
                    </span>
                  </div>

                  <div className="reward-section">
                    {claimed ? (
                      <span className="claimed-text">✓ Claimed: {formatRewards(achievement.rewards)}</span>
                    ) : completed ? (
                      <button
                        className="claim-button"
                        onClick={() => handleClaim(achievement)}
                        disabled={claiming === achievement.id}
                      >
                        {claiming === achievement.id ? 'Claiming…' : `Claim: ${formatRewards(achievement.rewards)}`}
                      </button>
                    ) : (
                      <span className="reward-text">🎁 Reward: {formatRewards(achievement.rewards)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="back-button" onClick={closeAchievements}>
        Back to Lobby
      </button>
    </div>
  );
};

export default AchievementPage;
