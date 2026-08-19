// MapLayout.js - Enhanced map system with 20 levels + endless mode

import { colors, decorative } from "../../style/tokens.js";

/*
 * The seven-stop rainbow, ordered to match `.rainbow-connection` in
 * Lobby.css:857 stop for stop.
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

/*
 * Route geometry - the one thing on this map that everything else is
 * positioned against.
 */
const ROUTE_START_X = 200;
const NODE_SPACING_X = 190;
/*
 * The terrain's height, and the factor that spreads the authored `y` values
 * across it.
 */
const AUTHORED_MAP_HEIGHT = 600;
const MAP_HEIGHT = 720;
const Y_SCALE = MAP_HEIGHT / AUTHORED_MAP_HEIGHT;
/** Breathing room past the last stop, so the portal isn't flush to the edge. */
const ROUTE_END_PADDING = 200;

/* The campaign's stops in route order, carrying everything except `x`. */
const routeStops = [
  // Tutorial Zone (Levels 1-3)
  { id: 1, y: 500, zone: "tutorial", name: "The Outbreak" },
  { id: 2, y: 380, zone: "tutorial", name: "Swift Danger" },
  { id: 3, y: 460, zone: "tutorial", name: "Explosive Encounter" },

  // Early Game Zone (Levels 4-7)
  { id: 4, y: 300, zone: "early", name: "Heavy Resistance" },
  { id: 5, y: 420, zone: "early", name: "Ranged Assault" },
  { id: 6, y: 260, zone: "early", name: "Shield Wall" },
  { id: 7, y: 400, zone: "early", name: "Support Squadron" },

  // Mid Game Zone (Levels 8-12)
  { id: 8, y: 510, zone: "mid", name: "Multiplication Crisis" },
  { id: 9, y: 320, zone: "mid", name: "Swarm Tactics" },
  { id: 10, y: 440, zone: "mid", name: "Electromagnetic Chaos", isBoss: true },
  { id: 11, y: 200, zone: "mid", name: "Blood Hunt" },
  { id: 12, y: 380, zone: "mid", name: "Spectral Invasion" },

  // Late Game Zone (Levels 13-17)
  { id: 13, y: 260, zone: "late", name: "Berserker Rage" },
  { id: 14, y: 420, zone: "late", name: "Death's Army" },
  { id: 15, y: 180, zone: "late", name: "Shadow Strike" },
  { id: 16, y: 340, zone: "late", name: "Arcane Apocalypse" },
  { id: 17, y: 140, zone: "late", name: "Total Chaos" },

  // End Game Zone (Levels 18-20) - the final ascent
  { id: 18, y: 300, zone: "endgame", name: "Titan's Wrath", isBoss: true },
  { id: 19, y: 160, zone: "endgame", name: "Final Stand" },
  {
    id: 20,
    y: 90,
    zone: "endgame",
    name: "The Omega Wave",
    isBoss: true,
    isFinal: true,
  },

  // Endless Mode Portal - Unlocked after completing level 20
  {
    id: 999,
    y: 100,
    zone: "endless",
    name: "Endless Survival",
    isEndless: true,
    requiresCompletion: 10, // Requires completing level 20
    special: "portal", // Special visual indicator
  },
];

/* The level nodes, each in its own x column. */
export const levelsMapData = routeStops.map((stop, index) => ({
  ...stop,
  x: ROUTE_START_X + index * NODE_SPACING_X,
  y: Math.round(stop.y * Y_SCALE),
}));

/** The last stop's column - the portal's, and what sizes the terrain. */
const ROUTE_END_X = levelsMapData[levelsMapData.length - 1].x;

/** A node's own position, looked up by id rather than copied. */
function nodeById(id) {
  const node = levelsMapData.find((level) => level.id === id);
  if (!node) throw new Error(`MapLayout: no level with id ${id}`);
  return node;
}

/*
 * A connector segment between two nodes - midpoint, length and angle computed
 * from their live positions, not hand-typed.
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

  // Transition to late game. Was described here as "vertical" because the
  // folded route doubled back in column 1850 and levels 12 and 13 shared it;
  // it advances a column like every other connector now.
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

/*
 * An on-route chest's position: the midpoint of the connector leaving the
 * level it requires - derived the same way the connector itself now is, rather
 * than hand-typed as a second copy of the same fact.
 */
function chestOnRoute(id, fromId, toId, rewards) {
  const { x, y } = connectionBetween(fromId, toId);
  return { id, x, y, rewards, requiresLevel: fromId };
}

/*
 * A secret chest's position: off the route by design, but anchored to the node
 * that unlocks it rather than to an absolute coordinate.
 */
function chestNearLevel(id, requiresLevel, rewards, dx, dy, extra) {
  const node = nodeById(requiresLevel);
  return { id, x: node.x + dx, y: node.y + dy, rewards, requiresLevel, ...extra };
}

/*
 * The defenders a chest unlocks, as a list, whichever way its reward was
 * written.
 */
export function chestDefenders(chest) {
  const named = chest?.rewards?.defender;
  if (!named) return [];
  return Array.isArray(named) ? named : [named];
}

/* The card pieces a chest grants, as defender name -> count. */
export function chestCardPieces(chest) {
  return chest?.rewards?.cardPieces ?? {};
}

/* A chest's resource rewards, expanded to one accumulated amount per resource. */
export function resourceRewardsOf(chest) {
  const totals = {};
  const credit = (resource, amount) => {
    totals[resource] = (totals[resource] ?? 0) + amount;
  };
  for (const [resource, amount] of Object.entries(chest?.rewards ?? {})) {
    if (resource === "defender" || resource === "cardPieces") continue;
    if (resource === "all") {
      for (const res of ["gold", "iron", "grain", "water"]) credit(res, amount);
    } else {
      credit(resource, amount);
    }
  }
  return totals;
}

/*
 * Treasure chests: **six landmarks along the route, not one per level.** There
 * were twenty on-route chests, one on every connector.
 */
export const chestsData = [
  // Tutorial. Requires level 1, which is always unlocked, so the first
  // landmark is reachable from a standing start.
  chestOnRoute("chest-1", 1, 2, {
    gold: 100,
    gem: 1,
    cardPieces: { Shooter: 5 },
  }),

  // Early region.
  chestOnRoute("chest-2", 5, 6, {
    iron: 150,
    grain: 130,
    water: 50,
    gem: 7,
    cardPieces: { Grenadier: 10 },
  }),

  // Mid region.
  chestOnRoute("chest-3", 8, 9, {
    gold: 750,
    iron: 200,
    grain: 300,
    water: 150,
    gem: 30,
    cardPieces: { Healer: 15 },
  }),

  // The crossing into the late region.
  chestOnRoute("chest-4", 12, 13, {
    gold: 1000,
    gem: 100,
    all: 1500,
    cardPieces: { Sniper: 25 },
  }),

  // Late region.
  chestOnRoute("chest-5", 16, 17, {
    gold: 1000,
    gem: 200,
    all: 2000,
    cardPieces: { "Fire Blast": 30 },
  }),

  // Endgame, on the last climb to level 20.
  chestOnRoute("chest-6", 19, 20, {
    gold: 1000,
    gem: 250,
    all: 2000,
    cardPieces: { Mortar: 40 },
  }),

  // Secret chests (hidden or require special conditions). Off-route by
  // design - the offsets below are what puts them beside the trail rather
  // than on it - but anchored to the node that reveals them, not to an
  // absolute coordinate. See chestNearLevel above.
  chestNearLevel("secret-1", 10, { gem: 15, gold: 750 }, -70, 90, {
    hidden: true,
    condition: "perfectWave", // No damage taken in wave
  }),
  chestNearLevel("secret-2", 16, { gem: 25, iron: 500 }, 80, 85, {
    hidden: true,
    condition: "speedRun", // Complete level under time limit
  }),
];
//TODO: set up defender unlock upon level
export const levelDefenderReward = {
  2: "Barricade",
};

/* Zone visual configurations. **These carry no colour, deliberately. */
export const zoneConfigs = {
  // `label` is the region's name, painted faintly across its own span. The
  // approved mockup carried these ("SETTLED GROUND", "THE ASHLANDS"); without
  // them a region is a colour change with no reason attached, which is part of
  // why the map read as a board rather than a place.
  tutorial: { label: "Settled ground" },
  early: { label: "The green line" },
  mid: { label: "The ashlands" },
  late: { label: "Scorched reach" },
  endgame: { label: "The last stand" },
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

/*
 * The map's own dimensions and default zoom - the only three fields here
 * anything reads (`mapWidth`/`mapHeight` size `.game-map` and place its zone
 * bands, `defaultZoom` seeds the zoom state in Lobby.jsx).
 */
export const mapSettings = {
  /* Derived from the route, not chosen for it. */
  mapWidth: ROUTE_END_X + ROUTE_END_PADDING,
  mapHeight: MAP_HEIGHT,
  defaultZoom: 1.0,
};

/* The terrain regions, in the order the route walks through them. */
export const TERRAIN_ZONES = [
  ...new Set(levelsMapData.filter((level) => level.zone !== "endless").map((level) => level.zone)),
];

/*
 * Each region's horizontal span, sized to cover exactly the levels assigned to
 * it, so a level always stands on its own zone's ground.
 */
function terrainZoneSpans() {
  const extremes = TERRAIN_ZONES.map((zone) => {
    const columns = levelsMapData.filter((level) => level.zone === zone).map((level) => level.x);
    return { zone, first: Math.min(...columns), last: Math.max(...columns) };
  });

  const spans = {};
  extremes.forEach((region, index) => {
    const before = extremes[index - 1];
    const after = extremes[index + 1];
    const left = before ? (before.last + region.first) / 2 : 0;
    const right = after ? (region.last + after.first) / 2 : mapSettings.mapWidth;
    spans[region.zone] = { left, width: right - left };
  });
  return spans;
}

export const zoneSpans = terrainZoneSpans();

/** The region whose span contains `x`, or null past both ends of the terrain. */
export function zoneAtX(x) {
  for (const zone of TERRAIN_ZONES) {
    const { left, width } = zoneSpans[zone];
    if (x >= left && x < left + width) return zone;
  }
  return null;
}

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
