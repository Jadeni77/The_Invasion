// MapLayout.js - Enhanced map system with 20 levels + endless mode

import { colors, decorative } from "../../style/tokens.js";

/**
 * The seven-stop rainbow, ordered to match `.rainbow-connection` in
 * Lobby.css:857 stop for stop.
 *
 * Composed from tokens rather than written out as seven hex literals. Its one
 * consumer is `endlessPortalConfig.visual.colors` below, which nothing imports
 * yet - so this is a value waiting for a consumer rather than one in use.
 * Kept, rather than deleted with the zone colours, because the config it feeds
 * is exported and a hardcoded rainbow is exactly what would grow back there.
 * If the endless portal ever draws these, it will already agree with the CSS
 * connector that leads to it, which the two hand-written hex lists it replaced
 * did not.
 */
export const RAINBOW_STOPS = [
  colors.accentDanger,
  decorative.orange,
  colors.accentEnergy,
  colors.accentSuccess,
  colors.accentInfo,
  decorative.indigo,
  decorative.violet,
];

// Level nodes arranged in a serpentine pattern across the map
export const levelsMapData = [
  // Tutorial Zone (Levels 1-3)
  { id: 1, x: 200, y: 500, zone: "tutorial", name: "The Outbreak" },
  { id: 2, x: 350, y: 380, zone: "tutorial", name: "Swift Danger" },
  { id: 3, x: 500, y: 460, zone: "tutorial", name: "Explosive Encounter" },

  // Early Game Zone (Levels 4-7)
  { id: 4, x: 650, y: 300, zone: "early", name: "Heavy Resistance" },
  { id: 5, x: 800, y: 420, zone: "early", name: "Ranged Assault" },
  { id: 6, x: 950, y: 260, zone: "early", name: "Shield Wall" },
  { id: 7, x: 1100, y: 400, zone: "early", name: "Support Squadron" },

  // Mid Game Zone (Levels 8-12)
  { id: 8, x: 1250, y: 510, zone: "mid", name: "Multiplication Crisis" },
  { id: 9, x: 1400, y: 320, zone: "mid", name: "Swarm Tactics" },
  {
    id: 10,
    x: 1550,
    y: 440,
    zone: "mid",
    name: "Electromagnetic Chaos",
    isBoss: true,
  },
  { id: 11, x: 1700, y: 200, zone: "mid", name: "Blood Hunt" },
  { id: 12, x: 1850, y: 380, zone: "mid", name: "Spectral Invasion" },

  // Late Game Zone (Levels 13-17) - Second row
  { id: 13, x: 1850, y: 260, zone: "late", name: "Berserker Rage" },
  { id: 14, x: 1700, y: 420, zone: "late", name: "Death's Army" },
  { id: 15, x: 1550, y: 180, zone: "late", name: "Shadow Strike" },
  { id: 16, x: 1400, y: 340, zone: "late", name: "Arcane Apocalypse" },
  { id: 17, x: 1250, y: 140, zone: "late", name: "Total Chaos" },

  // End Game Zone (Levels 18-20) - Third row ascent
  {
    id: 18,
    x: 1100,
    y: 300,
    zone: "endgame",
    name: "Titan's Wrath",
    isBoss: true,
  },
  { id: 19, x: 950, y: 160, zone: "endgame", name: "Final Stand" },
  {
    id: 20,
    x: 800,
    y: 90,
    zone: "endgame",
    name: "The Omega Wave",
    isBoss: true,
    isFinal: true,
  },

  // Endless Mode Portal - Unlocked after completing level 20
  {
    id: 999,
    x: 650,
    y: 100,
    zone: "endless",
    name: "Endless Survival",
    isEndless: true,
    requiresCompletion: 10, // Requires completing level 20
    special: "portal", // Special visual indicator
  },
];

/** A node's own position, looked up by id rather than copied. */
function nodeById(id) {
  const node = levelsMapData.find((level) => level.id === id);
  if (!node) throw new Error(`MapLayout: no level with id ${id}`);
  return node;
}

/**
 * A connector segment between two nodes - midpoint, length and angle
 * computed from their live positions, not hand-typed.
 *
 * This replaces a hardcoded `{ x, y, length, rotation }` per segment that
 * held its own copy of values derivable from `levelsMapData`. That copy is
 * exactly what went stale: every `y` in `levelsMapData` moved to give the
 * route vertical amplitude, nothing recomputed these, and connector lines
 * ended up missing their nodes by up to 125px. A computed midpoint cannot
 * drift out of sync the next time a `y` moves - there is no second copy of
 * the fact to forget to update.
 */
function connectionBetween(fromId, toId, extra) {
  const from = nodeById(fromId);
  const to = nodeById(toId);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    from: fromId,
    to: toId,
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    length: Math.sqrt(dx * dx + dy * dy),
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
    ...extra,
  };
}

// Connection paths between levels. Derived (see connectionBetween above),
// not hand-typed - only `from`/`to`/`special` are authored here.
export const connectionsData = [
  // Tutorial connections
  connectionBetween(1, 2),
  connectionBetween(2, 3),

  // Early game connections
  connectionBetween(3, 4),
  connectionBetween(4, 5),
  connectionBetween(5, 6),
  connectionBetween(6, 7),

  // Mid game connections
  connectionBetween(7, 8),
  connectionBetween(8, 9),
  connectionBetween(9, 10),
  connectionBetween(10, 11),
  connectionBetween(11, 12),

  // Transition to late game (vertical connection)
  connectionBetween(12, 13),

  // Late game connections
  connectionBetween(13, 14),
  connectionBetween(14, 15),
  connectionBetween(15, 16),
  connectionBetween(16, 17),

  // End game connections
  connectionBetween(17, 18),
  connectionBetween(18, 19),
  connectionBetween(19, 20),

  // Endless portal connection (appears after beating level 20)
  connectionBetween(20, 999, { special: "rainbow" }),
];

/**
 * An on-route chest's position: the midpoint of the connector leaving the
 * level it requires - derived the same way the connector itself now is,
 * rather than hand-typed as a second copy of the same fact.
 *
 * `xOverride` exists for exactly one chest, `chest-12`: the level 12-13
 * transition is a vertical connector, so a chest placed exactly on that
 * connector's own midpoint would sit on top of the line instead of beside
 * it. That 50px offset is a deliberate placement choice predating this
 * change, not drift, so it is preserved rather than derived away.
 */
function chestOnRoute(id, fromId, toId, rewards, xOverride) {
  const { x, y } = connectionBetween(fromId, toId);
  return { id, x: xOverride ?? x, y, rewards, requiresLevel: fromId };
}

//TODO: set up defender unlock upon chest reward
// Treasure chests with better rewards distribution. The 20 on-route chests
// below sit at their connector's midpoint (see chestOnRoute above); the two
// secret chests after them are deliberately off-route and keep their
// hand-placed positions.
export const chestsData = [
  // Early game chests
  chestOnRoute("chest-1", 1, 2, { gold: 100, gem: 1, defender: "E-Gen" }),
  chestOnRoute("chest-2", 2, 3, { iron: 50, grain: 30, defender: "Barricade" }),
  chestOnRoute("chest-3", 3, 4, { water: 50, gem: 2, defender: "Grenadier" }),

  // Mid game chests
  chestOnRoute("chest-4", 4, 5, { gold: 250, iron: 100, defender: "Healer" }),
  chestOnRoute("chest-5", 5, 6, { gem: 5, grain: 100 }),
  chestOnRoute("chest-6", 6, 7, { gold: 500, water: 150, defender: "Frost Archer" }),

  // Late game chests
  chestOnRoute("chest-7", 7, 8, { gem: 10, iron: 200 }),
  chestOnRoute("chest-8", 8, 9, { gold: 1000, grain: 300 }),

  // End game chests
  chestOnRoute("chest-9", 9, 10, { gem: 20, gold: 2000 }),
  chestOnRoute("chest-10", 10, 11, { gem: 50, all: 500, defender: "Sniper" }),
  chestOnRoute("chest-11", 11, 12, { gem: 50, all: 500, defender: "Ice Bomb" }),
  chestOnRoute("chest-12", 12, 13, { gem: 50, all: 500 }, 1900),
  chestOnRoute("chest-13", 13, 14, { gem: 50, all: 500 }),
  chestOnRoute("chest-14", 14, 15, { gem: 50, all: 500, defender: "Mortar" }),
  chestOnRoute("chest-15", 15, 16, { gem: 50, all: 500 }),
  chestOnRoute("chest-16", 16, 17, { gem: 50, all: 500, defender: "Fire Blast" }),
  chestOnRoute("chest-17", 17, 18, { gem: 50, all: 500 }),
  chestOnRoute("chest-18", 18, 19, { gem: 50, all: 500 }),
  chestOnRoute("chest-19", 19, 20, { gem: 50, all: 500 }),
  chestOnRoute("chest-20", 20, 999, { gem: 50, all: 500 }),

  // Secret chests (hidden or require special conditions) - off-route by
  // design, so their position is authored directly, not derived.
  {
    id: "secret-1",
    x: 1000,
    y: 500,
    rewards: { gem: 15, gold: 750 },
    requiresLevel: 10,
    hidden: true,
    condition: "perfectWave", // No damage taken in wave
  },
  {
    id: "secret-2",
    x: 1400,
    y: 100,
    rewards: { gem: 25, iron: 500 },
    requiresLevel: 16,
    hidden: true,
    condition: "speedRun", // Complete level under time limit
  },
];
//TODO: set up defender unlock upon level
export const levelDefenderReward = {
  2: "Barricade",
};

/**
 * Zone visual configurations.
 *
 * **These carry no colour, deliberately. `Lobby.css` is the single source for
 * what a zone looks like.**
 *
 * The first pass at this moved the five zone hues from raw hex onto tokens but
 * left them here, as inline styles - which reintroduced the exact defect the
 * move was meant to fix, one zone at a time. `Lobby.css` briefly carried five
 * reviewed, tokenized zone-node rules for this (`.tutorial-node`
 * accent-success, `.early-node` accent-info, `.mid-node` surface-raised,
 * `.late-node` accent-danger, `.endgame-node` decorative-violet). Four of
 * them happened to agree with the inline values; `.mid-node` did not, and
 * because an inline style beats a stylesheet, the reviewed earth-tone
 * `surface-raised` was silently overridden by `decorative.orange` - the
 * loudest colour on the map - on the first screen a player sees.
 *
 * Two sources that must agree is this codebase's most repeated defect, and the
 * token module exists to remove it. So the stylesheet won, for three reasons:
 * it is where the reviewed choice already lived; it is reachable by the CSS
 * colour, font and contrast guards, where an inline style is reachable only by
 * the JSX guard added in this same wave; and deleting the inline colours
 * removes the override *mechanism*, not just today's one instance of it.
 *
 * Those five zone-node rules are gone now, for a second, unrelated reason:
 * once every node also carries a state class (`.level-node.completed`/
 * `.available`/`.locked`, two classes, specificity 0-2-0), a single-class
 * zone rule like `.tutorial-node` (0-1-0) can never win the cascade for the
 * same property, on any node, regardless of source order - they were dead
 * weight, not a second source of truth to reconcile. Zone identity now lives
 * entirely in the terrain (`.zone-<key>`'s ground/ridge/foreground in
 * Lobby.css); the node is state-coloured only, matching the approved mockup.
 *
 * `nodeClass` went with them for the five real zones below - nothing reads
 * it once nothing styles it, and an unconsumed field is exactly the drift
 * this comment already warns about for `backgroundColor`/`borderColor`/
 * `glowColor`. `endless`'s `nodeClass` and `animation` are left alone: they
 * were never wired to anything to begin with (the endless node renders its
 * own portal markup in `renderEndlessPortal`, not through this config), which
 * is a pre-existing, separate gap this change did not create and is not
 * fixing here.
 */
export const zoneConfigs = {
  tutorial: {},
  early: {},
  mid: {},
  late: {},
  endgame: {},
  endless: { nodeClass: "endless-portal", animation: "portal-swirl" },
};

// Endless Mode Configuration
export const endlessPortalConfig = {
  // Visual properties for the endless portal
  visual: {
    type: "portal",
    animation: "swirl",
    particles: true,
    glowIntensity: 2,
    pulseSpeed: 1.5,
    // Was a second, independent seven-hex rainbow. Same list, one source.
    colors: RAINBOW_STOPS,
  },

  // Unlock requirements
  requirements: {
    minLevel: 20, // Must complete level 20
    alternativeUnlock: {
      totalStars: 50, // Or collect 50 stars from perfect level completions
      achievement: "veteran_defender", // Or unlock through achievement
    },
  },

  // Endless mode special features
  features: {
    leaderboard: true,
    weeklyChallenge: true,
    milestoneRewards: [
      { wave: 10, reward: { gem: 10, gold: 500 } },
      { wave: 25, reward: { gem: 25, gold: 1500 } },
      {
        wave: 50,
        reward: { gem: 50, gold: 5000, uniqueCard: "Elite Defender" },
      },
      {
        wave: 100,
        reward: { gem: 100, gold: 15000, uniqueCard: "Legendary Guardian" },
      },
    ],
    difficultyModifiers: [
      {
        name: "Iron Will",
        description: "Enemies have 25% more health",
        multiplier: 1.5,
      },
      {
        name: "Swarm",
        description: "Double enemy spawn rate",
        multiplier: 2.0,
      },
      { name: "Poverty", description: "Half starting energy", multiplier: 1.8 },
      {
        name: "Glass Cannon",
        description: "Double damage both ways",
        multiplier: 2.5,
      },
    ],
  },

  // Entry cost and rewards
  economy: {
    entryCost: 0, // Free to enter
    waveRewardFormula: (wave) => ({
      gold: Math.floor(50 * Math.pow(1.1, wave)),
      score: Math.floor(100 * Math.pow(1.15, wave)),
    }),
    deathReward: (wave) => ({
      gold: Math.floor(wave * 25),
      gem: Math.floor(wave / 10),
      experience: wave * 100,
    }),
  },
};

/**
 * The map's own dimensions and default zoom - the only three fields here
 * anything reads (`mapWidth`/`mapHeight` size `.game-map` and place its zone
 * bands, `defaultZoom` seeds the zoom state in Lobby.jsx). This used to also
 * carry `viewportWidth`, `viewportHeight`, `initialPosition`, `zoomLevels`,
 * `scrollSpeed`, `edgePadding`, `autoCameraEnabled`, `cameraFollowPlayer` and
 * `smoothScrollDuration` - a camera system for auto-scrolling and multi-level
 * zoom that nothing in this codebase ever called. Removed rather than left
 * "for later": a config value with no reader is not a design decision
 * waiting to be used, it is drift waiting to be noticed by whoever next
 * reads this file and assumes it does something.
 */
export const mapSettings = {
  mapWidth: 2200,
  mapHeight: 600,
  defaultZoom: 1.0,
};

// Achievement triggers for map progression
export const mapAchievements = [
  { id: "first_steps", trigger: "complete_level_1", reward: { gem: 5 } },
  { id: "halfway_there", trigger: "complete_level_10", reward: { gem: 20 } },
  {
    id: "campaign_complete",
    trigger: "complete_level_20",
    reward: { gem: 100, uniqueCard: "Champion Defender" },
  },
  {
    id: "endless_warrior",
    trigger: "survive_endless_wave_50",
    reward: { gem: 200, title: "Endless Warrior" },
  },
  {
    id: "treasure_hunter",
    trigger: "collect_all_chests",
    reward: { gem: 150, gold: 10000 },
  },
  {
    id: "perfectionist",
    trigger: "three_star_all_levels",
    reward: { gem: 500, uniqueCard: "Perfect Strategist" },
  },
];

// Function to check if endless mode should be unlocked
export function isEndlessUnlocked(playerData) {
  // Primary unlock: complete level 20
  if (playerData.completedLevels?.includes(10)) {
    return true;
  }

  // Alternative unlock: collect enough stars
  const totalStars =
    playerData.levelStars?.reduce((sum, stars) => sum + stars, 0) || 0;
  if (totalStars >= 50) {
    return true;
  }

  // Alternative unlock: specific achievement
  if (playerData.achievements?.includes("veteran_defender")) {
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
      available: isEndlessUnlocked(playerData),
    };
  }

  const isUnlocked =
    playerData.unlockedLevels?.includes(levelId) || levelId === 1;
  const isCompleted = playerData.completedLevels?.includes(levelId);
  const stars = playerData.levelStars?.[levelId - 1] || 0;

  return {
    locked: !isUnlocked,
    completed: isCompleted,
    stars: stars,
    available: isUnlocked && !isCompleted,
  };
}

/**
 * The level the map should open on: the first unlocked one the player has not
 * finished. Null when they have cleared everything currently unlocked, in
 * which case the caller should fall back to its own default.
 */
export function nextPlayableLevelId(playerData) {
  for (const level of levelsMapData) {
    const status = getLevelStatus(level.id, playerData);
    if (status.available) return level.id;
  }
  return null;
}
