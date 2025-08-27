// MapLayout.js - Enhanced map system with 20 levels + endless mode

// Level nodes arranged in a serpentine pattern across the map
export const levelsMapData = [
  // Tutorial Zone (Levels 1-3)
  { id: 1, x: 200, y: 500, zone: 'tutorial', name: 'The Outbreak' },
  { id: 2, x: 350, y: 450, zone: 'tutorial', name: 'Swift Danger' },
  { id: 3, x: 500, y: 400, zone: 'tutorial', name: 'Heavy Resistance' },

  // Early Game Zone (Levels 4-7)
  { id: 4, x: 650, y: 350, zone: 'early', name: 'Explosive Encounter' },
  { id: 5, x: 800, y: 300, zone: 'early', name: 'Ranged Assault' },
  { id: 6, x: 950, y: 350, zone: 'early', name: 'Shield Wall' },
  { id: 7, x: 1100, y: 400, zone: 'early', name: 'Support Squadron' },

  // Mid Game Zone (Levels 8-12)
  { id: 8, x: 1250, y: 450, zone: 'mid', name: 'Multiplication Crisis' },
  { id: 9, x: 1400, y: 500, zone: 'mid', name: 'Swarm Tactics' },
  { id: 10, x: 1550, y: 450, zone: 'mid', name: 'Electromagnetic Chaos', isBoss: true },
  { id: 11, x: 1700, y: 400, zone: 'mid', name: 'Blood Hunt' },
  { id: 12, x: 1850, y: 350, zone: 'mid', name: 'Spectral Invasion' },

  // Late Game Zone (Levels 13-17) - Second row
  { id: 13, x: 1850, y: 250, zone: 'late', name: 'Berserker Rage' },
  { id: 14, x: 1700, y: 200, zone: 'late', name: "Death's Army" },
  { id: 15, x: 1550, y: 150, zone: 'late', name: 'Shadow Strike' },
  { id: 16, x: 1400, y: 200, zone: 'late', name: 'Arcane Apocalypse' },
  { id: 17, x: 1250, y: 250, zone: 'late', name: 'Total Chaos' },

  // End Game Zone (Levels 18-20) - Third row ascent
  { id: 18, x: 1100, y: 200, zone: 'endgame', name: "Titan's Wrath", isBoss: true },
  { id: 19, x: 950, y: 150, zone: 'endgame', name: 'Final Stand' },
  { id: 20, x: 800, y: 100, zone: 'endgame', name: 'The Omega Wave', isBoss: true, isFinal: true },

  // Endless Mode Portal - Unlocked after completing level 20
  {
    id: 999,
    x: 650,
    y: 50,
    zone: 'endless',
    name: 'Endless Survival',
    isEndless: true,
    requiresCompletion: 20, // Requires completing level 20
    special: 'portal' // Special visual indicator
  }
];

// Connection paths between levels
export const connectionsData = [
  // Tutorial connections
  { from: 1, to: 2, x: 275, y: 475, length: 150, rotation: -20 },
  { from: 2, to: 3, x: 425, y: 425, length: 150, rotation: -20 },

  // Early game connections
  { from: 3, to: 4, x: 575, y: 375, length: 150, rotation: -20 },
  { from: 4, to: 5, x: 725, y: 325, length: 150, rotation: -20 },
  { from: 5, to: 6, x: 875, y: 325, length: 150, rotation: 20 },
  { from: 6, to: 7, x: 1025, y: 375, length: 150, rotation: 20 },

  // Mid game connections
  { from: 7, to: 8, x: 1175, y: 425, length: 150, rotation: 20 },
  { from: 8, to: 9, x: 1325, y: 475, length: 150, rotation: 20 },
  { from: 9, to: 10, x: 1475, y: 475, length: 150, rotation: -20 },
  { from: 10, to: 11, x: 1625, y: 425, length: 150, rotation: -20 },
  { from: 11, to: 12, x: 1775, y: 375, length: 150, rotation: -20 },

  // Transition to late game (vertical connection)
  { from: 12, to: 13, x: 1850, y: 300, length: 100, rotation: -90 },

  // Late game connections
  { from: 13, to: 14, x: 1775, y: 225, length: 150, rotation: -160 },
  { from: 14, to: 15, x: 1625, y: 175, length: 150, rotation: -160 },
  { from: 15, to: 16, x: 1475, y: 175, length: 150, rotation: 160 },
  { from: 16, to: 17, x: 1325, y: 225, length: 150, rotation: 160 },

  // End game connections
  { from: 17, to: 18, x: 1175, y: 225, length: 150, rotation: -160 },
  { from: 18, to: 19, x: 1025, y: 175, length: 150, rotation: -160 },
  { from: 19, to: 20, x: 875, y: 125, length: 150, rotation: -160 },

  // Endless portal connection (appears after beating level 20)
  { from: 20, to: 999, x: 725, y: 75, length: 150, rotation: -160, special: 'rainbow' }
];

// Treasure chests with better rewards distribution
export const chestsData = [
  // Early game chests
  { id: 'chest-1', x: 425, y: 380, rewards: { gold: 100, gem: 1 }, requiresLevel: 2 },
  { id: 'chest-2', x: 875, y: 280, rewards: { iron: 50, grain: 30 }, requiresLevel: 5 },
  { id: 'chest-3', x: 1175, y: 380, rewards: { water: 50, gem: 2 }, requiresLevel: 7 },

  // Mid game chests
  { id: 'chest-4', x: 1475, y: 430, rewards: { gold: 250, iron: 100 }, requiresLevel: 9 },
  { id: 'chest-5', x: 1625, y: 380, rewards: { gem: 5, grain: 100 }, requiresLevel: 11 },
  { id: 'chest-6', x: 1775, y: 300, rewards: { gold: 500, water: 150 }, requiresLevel: 12 },

  // Late game chests
  { id: 'chest-7', x: 1625, y: 130, rewards: { gem: 10, iron: 200 }, requiresLevel: 15 },
  { id: 'chest-8', x: 1325, y: 180, rewards: { gold: 1000, grain: 300 }, requiresLevel: 17 },

  // End game chests
  { id: 'chest-9', x: 1025, y: 130, rewards: { gem: 20, gold: 2000 }, requiresLevel: 19 },
  { id: 'chest-10', x: 725, y: 50, rewards: { gem: 50, all: 500 }, requiresLevel: 20 },

  // Secret chests (hidden or require special conditions)
  {
    id: 'secret-1',
    x: 1000,
    y: 500,
    rewards: { gem: 15, gold: 750 },
    requiresLevel: 10,
    hidden: true,
    condition: 'perfectWave' // No damage taken in wave
  },
  {
    id: 'secret-2',
    x: 1400,
    y: 100,
    rewards: { gem: 25, iron: 500 },
    requiresLevel: 16,
    hidden: true,
    condition: 'speedRun' // Complete level under time limit
  }
];

// Zone visual configurations for styling
export const zoneConfigs = {
  tutorial: {
    backgroundColor: '#4a7c59',
    borderColor: '#2d5436',
    glowColor: '#6fb85f',
    nodeClass: 'tutorial-node'
  },
  early: {
    backgroundColor: '#5a7cb8',
    borderColor: '#3a5c88',
    glowColor: '#7a9cd8',
    nodeClass: 'early-node'
  },
  mid: {
    backgroundColor: '#b87c5a',
    borderColor: '#885c3a',
    glowColor: '#d89c7a',
    nodeClass: 'mid-node'
  },
  late: {
    backgroundColor: '#b85a7c',
    borderColor: '#883a5c',
    glowColor: '#d87a9c',
    nodeClass: 'late-node'
  },
  endgame: {
    backgroundColor: '#7c5ab8',
    borderColor: '#5c3a88',
    glowColor: '#9c7ad8',
    nodeClass: 'endgame-node'
  },
  endless: {
    backgroundColor: '#rainbow-gradient',
    borderColor: '#animated',
    glowColor: '#rainbow-pulse',
    nodeClass: 'endless-portal',
    animation: 'portal-swirl'
  }
};

// Endless Mode Configuration
export const endlessPortalConfig = {
  // Visual properties for the endless portal
  visual: {
    type: 'portal',
    animation: 'swirl',
    particles: true,
    glowIntensity: 2,
    pulseSpeed: 1.5,
    colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3']
  },

  // Unlock requirements
  requirements: {
    minLevel: 20, // Must complete level 20
    alternativeUnlock: {
      totalStars: 50, // Or collect 50 stars from perfect level completions
      achievement: 'veteran_defender' // Or unlock through achievement
    }
  },

  // Endless mode special features
  features: {
    leaderboard: true,
    weeklyChallenge: true,
    milestoneRewards: [
      { wave: 10, reward: { gem: 10, gold: 500 } },
      { wave: 25, reward: { gem: 25, gold: 1500 } },
      { wave: 50, reward: { gem: 50, gold: 5000, uniqueCard: 'Elite Defender' } },
      { wave: 100, reward: { gem: 100, gold: 15000, uniqueCard: 'Legendary Guardian' } }
    ],
    difficultyModifiers: [
      { name: 'Iron Will', description: 'Enemies have 25% more health', multiplier: 1.5 },
      { name: 'Swarm', description: 'Double enemy spawn rate', multiplier: 2.0 },
      { name: 'Poverty', description: 'Half starting energy', multiplier: 1.8 },
      { name: 'Glass Cannon', description: 'Double damage both ways', multiplier: 2.5 }
    ]
  },

  // Entry cost and rewards
  economy: {
    entryCost: 0, // Free to enter
    waveRewardFormula: (wave) => ({
      gold: Math.floor(50 * Math.pow(1.1, wave)),
      score: Math.floor(100 * Math.pow(1.15, wave))
    }),
    deathReward: (wave) => ({
      gold: Math.floor(wave * 25),
      gem: Math.floor(wave / 10),
      experience: wave * 100
    })
  }
};

// Map viewport and camera settings
export const mapSettings = {
  viewportWidth: 1920,
  viewportHeight: 600,
  mapWidth: 2200,
  mapHeight: 600,
  initialPosition: { x: 0, y: 0 },
  zoomLevels: [0.75, 1.0, 1.25, 1.5],
  defaultZoom: 1.0,
  scrollSpeed: 1.5,
  edgePadding: 50,

  // Auto-camera movement to show player progress
  autoCameraEnabled: true,
  cameraFollowPlayer: true,
  smoothScrollDuration: 500
};

// Achievement triggers for map progression
export const mapAchievements = [
  { id: 'first_steps', trigger: 'complete_level_1', reward: { gem: 5 } },
  { id: 'halfway_there', trigger: 'complete_level_10', reward: { gem: 20 } },
  { id: 'campaign_complete', trigger: 'complete_level_20', reward: { gem: 100, uniqueCard: 'Champion Defender' } },
  { id: 'endless_warrior', trigger: 'survive_endless_wave_50', reward: { gem: 200, title: 'Endless Warrior' } },
  { id: 'treasure_hunter', trigger: 'collect_all_chests', reward: { gem: 150, gold: 10000 } },
  { id: 'perfectionist', trigger: 'three_star_all_levels', reward: { gem: 500, uniqueCard: 'Perfect Strategist' } }
];

// Function to check if endless mode should be unlocked
export function isEndlessUnlocked(playerData) {
  // Primary unlock: complete level 20
  if (playerData.completedLevels?.includes(20)) {
    return true;
  }

  // Alternative unlock: collect enough stars
  const totalStars = playerData.levelStars?.reduce((sum, stars) => sum + stars, 0) || 0;
  if (totalStars >= 50) {
    return true;
  }

  // Alternative unlock: specific achievement
  if (playerData.achievements?.includes('veteran_defender')) {
    return true;
  }

  return false;
}

// Function to get level status
export function getLevelStatus(levelId, playerData) {
  if (levelId === 999) {
    return {
      locked: !isEndlessUnlocked(playerData),
      completed: false, // Endless is never "completed"
      stars: 0,
      highestWave: playerData.endlessHighScore || 0,
      available: isEndlessUnlocked(playerData)
    };
  }

  const isUnlocked = playerData.unlockedLevels?.includes(levelId) || levelId === 1;
  const isCompleted = playerData.completedLevels?.includes(levelId);
  const stars = playerData.levelStars?.[levelId - 1] || 0;

  return {
    locked: !isUnlocked,
    completed: isCompleted,
    stars: stars,
    available: isUnlocked && !isCompleted
  };
}