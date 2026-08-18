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

/**
 * Route geometry - the one thing on this map that everything else is
 * positioned against.
 *
 * **`x` is not authored. It is derived from a stop's position in the route,
 * below, and that is the fix.** The map shipped with hand-typed `x` values
 * folded back on themselves: levels 1-12 ran left to right from 200 to 1850,
 * then levels 13-20 ran back right to left from 1850 to 800, because
 * `mapWidth` was 2200 - inherited from a mockup with 10 levels plus a portal -
 * and 21 nodes do not fit in a width sized for 11. Every column from 650 to
 * 1850 therefore held two levels, one from each leg: 9 and 16 landed 20px
 * apart on a 58px node and rendered as a single doubled circle with both names
 * stacked on it, the four route self-crossings were where one leg cut back
 * across the other, and the terrain escalated backwards from level 13 because
 * the second leg walked back down through zones the first leg had already
 * climbed.
 *
 * One node per x column, x strictly increasing with route order, is what makes
 * all of that structurally impossible rather than merely fixed: two nodes
 * cannot share a column because a column is an array index, and two connectors
 * cannot cross because their x-spans only ever touch at a shared node (see
 * RouteGeometry.test.js, which asserts both rather than assuming them).
 *
 * `NODE_SPACING_X` is the density the mockup was approved at, and it is not
 * only an aesthetic number: `.level-name` is `white-space: nowrap` at 10px
 * bold, and this route's longest names ("Multiplication Crisis",
 * "Electromagnetic Chaos", 21 characters) measure roughly 115px. Two adjacent
 * nodes each carrying a 21-character label need that much clearance plus a gap
 * before the labels collide, which is what ruled out closing the map up to fit
 * fewer screens.
 */
const ROUTE_START_X = 200;
const NODE_SPACING_X = 190;
/** Breathing room past the last stop, so the portal isn't flush to the edge. */
const ROUTE_END_PADDING = 200;

/**
 * The campaign's stops in route order, carrying everything except `x`.
 *
 * `y` is unchanged from the approved mockup's vertical amplitude - it swings
 * across 90-510 of the 600px terrain, rising and falling with varied
 * amplitude rather than as a regular zigzag. Only the horizontal fold was
 * broken, so only `x` is being replaced.
 */
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

/**
 * The level nodes, each in its own x column.
 *
 * `x` is spread *last* deliberately: a stop that tried to carry its own `x`
 * would be overwritten rather than honoured, so the column can only ever come
 * from route order. That is what stops a hand-typed coordinate growing back
 * here and re-folding the route.
 */
export const levelsMapData = routeStops.map((stop, index) => ({
  ...stop,
  x: ROUTE_START_X + index * NODE_SPACING_X,
}));

/** The last stop's column - the portal's, and what sizes the terrain. */
const ROUTE_END_X = levelsMapData[levelsMapData.length - 1].x;

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

/**
 * An on-route chest's position: the midpoint of the connector leaving the
 * level it requires - derived the same way the connector itself now is,
 * rather than hand-typed as a second copy of the same fact.
 *
 * This used to take an `xOverride`, used by exactly one chest (`chest-12`)
 * because the old level 12-13 transition was a *vertical* connector - both
 * legs of the folded route met in column 1850 - so a chest on that
 * connector's own midpoint sat on top of the line rather than beside it. With
 * the fold gone no connector is vertical (every one advances a full column in
 * x), so the override has no remaining caller. It is removed rather than kept
 * "in case": an unread parameter is the drift this file's other comments keep
 * warning about, and a coordinate escape hatch on the one helper that exists
 * to derive coordinates is exactly the hatch a future hand-typed position
 * would come back through.
 */
function chestOnRoute(id, fromId, toId, rewards) {
  const { x, y } = connectionBetween(fromId, toId);
  return { id, x, y, rewards, requiresLevel: fromId };
}

/**
 * A secret chest's position: off the route by design, but anchored to the node
 * that unlocks it rather than to an absolute coordinate.
 *
 * Both secret chests used to hold hand-typed positions (1000,500) and
 * (1400,100), chosen against the old 2200-wide folded map. Those numbers
 * survived the fold as coordinates but not as *placements*: on the unfolded
 * terrain x=1000 is beside level 5 and x=1400 beside level 7, nowhere near the
 * levels 10 and 16 that reveal them. Deriving the offset from the required
 * level's own node keeps them off-route (that is what the offsets are for)
 * while keeping them next to the level they belong to, the same property
 * `chestOnRoute` gives the on-route chests.
 */
function chestNearLevel(id, requiresLevel, rewards, dx, dy, extra) {
  const node = nodeById(requiresLevel);
  return { id, x: node.x + dx, y: node.y + dy, rewards, requiresLevel, ...extra };
}

/**
 * The defenders a chest unlocks, as a list, whichever way its reward was
 * written.
 *
 * `rewards.defender` was a single string per chest because there used to be a
 * chest per level - twenty of them, so nine defenders fitted one to a chest
 * with room to spare. Six landmark chests cannot carry nine defenders one at a
 * time, and dropping three is not an option (they are real unlocks: Healer,
 * Sniper, Mortar and the rest). So the field takes a string or an array, and
 * everything that reads it goes through here rather than each caller
 * remembering to handle both. Exported so GameContext and the chest tests share
 * one definition of the shape instead of two that can disagree.
 */
export function chestDefenders(chest) {
  const named = chest?.rewards?.defender;
  if (!named) return [];
  return Array.isArray(named) ? named : [named];
}

/**
 * A chest's resource rewards, expanded to one accumulated amount per resource.
 *
 * `all: N` is shorthand for N of each of gold/iron/grain/water, and `defender`
 * is not a resource. Both have to be resolved before a reward can be applied or
 * reported, and **that resolution used to exist twice** in `collectTreasure`:
 * once to credit the player locally, which accumulated, and once to build the
 * backend payload, which *assigned*. So a chest carrying both `gold: 1000` and
 * `all: 1500` credited the player 2500 gold and told the server 1500 - whichever
 * of the two keys `Object.entries` reached last simply overwrote the other.
 *
 * No chest combined the two while there was one chest per level, so the
 * disagreement was latent; three of the six consolidated landmarks combine them.
 * The fix is not to correct the second copy - it is to have one copy. Both
 * callers read this, so they cannot drift, and the arithmetic is unit-testable
 * without standing up the provider.
 */
export function resourceRewardsOf(chest) {
  const totals = {};
  const credit = (resource, amount) => {
    totals[resource] = (totals[resource] ?? 0) + amount;
  };
  for (const [resource, amount] of Object.entries(chest?.rewards ?? {})) {
    if (resource === "defender") continue;
    if (resource === "all") {
      for (const res of ["gold", "iron", "grain", "water"]) credit(res, amount);
    } else {
      credit(resource, amount);
    }
  }
  return totals;
}

/**
 * Treasure chests: **six landmarks along the route, not one per level.**
 *
 * There were twenty on-route chests, one on every connector. The approved
 * mockup had three, placed as landmarks between nodes - one per level is
 * wallpaper, and it is a large part of why the map read as cluttered: twenty
 * near-identical 40px sprites competing with twenty-one nodes for the same
 * eye.
 *
 * Six, spaced roughly evenly from x=295 to x=3715, one per terrain region plus
 * a second through the long late stretch. Each still sits at its connector's
 * midpoint via `chestOnRoute`, so moving a node moves its chest.
 *
 * **No reward was dropped in the cut.** The twenty chests' resources are
 * consolidated onto these six and the arithmetic is asserted in
 * ChestLandmarks.test.js against the totals the twenty carried: gold 3850,
 * iron 350, grain 430, water 200, gem 588, and 5500 of `all` (which grants its
 * amount to each of gold/iron/grain/water). All nine defenders survive too,
 * which is what `defender` accepting a list is for - see chestDefenders above.
 * The distribution is weighted late, so a landmark reads as worth reaching
 * rather than as one of twenty identical pickups.
 */
export const chestsData = [
  // Tutorial. Requires level 1, which is always unlocked, so the first
  // landmark is reachable from a standing start.
  chestOnRoute("chest-1", 1, 2, {
    gold: 100,
    gem: 1,
    defender: ["E-Gen", "Barricade"],
  }),

  // Early region.
  chestOnRoute("chest-2", 5, 6, {
    iron: 150,
    grain: 130,
    water: 50,
    gem: 7,
    defender: ["Grenadier", "Healer"],
  }),

  // Mid region.
  chestOnRoute("chest-3", 8, 9, {
    gold: 750,
    iron: 200,
    grain: 300,
    water: 150,
    gem: 30,
    defender: "Frost Archer",
  }),

  // The crossing into the late region.
  chestOnRoute("chest-4", 12, 13, {
    gold: 1000,
    gem: 100,
    all: 1500,
    defender: ["Sniper", "Ice Bomb"],
  }),

  // Late region.
  chestOnRoute("chest-5", 16, 17, {
    gold: 1000,
    gem: 200,
    all: 2000,
    defender: "Mortar",
  }),

  // Endgame, on the last climb to level 20.
  chestOnRoute("chest-6", 19, 20, {
    gold: 1000,
    gem: 250,
    all: 2000,
    defender: "Fire Blast",
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
  /**
   * Derived from the route, not chosen for it. This was the literal 2200 that
   * caused the fold: a width sized for the mockup's 10 levels plus a portal,
   * asked to hold 21 nodes. Computing it from the last node's column means
   * adding a level widens the terrain instead of squeezing the route into a
   * box that no longer fits it - the two facts cannot drift apart, because
   * there is only one of them.
   */
  mapWidth: ROUTE_END_X + ROUTE_END_PADDING,
  mapHeight: 600,
  defaultZoom: 1.0,
};

/**
 * The terrain regions, in the order the route walks through them.
 *
 * **Derived from the route, not from `zoneConfigs`' key order.** Those two
 * being separate lists is how the terrain came to escalate backwards: the
 * ground was painted as five equal-width bands in `zoneConfigs` order while
 * the route ran through the zones in its own order, and with the route folded
 * the two disagreed from level 13 on - the return leg walked back down through
 * regions the outbound leg had already climbed. Taking the order from the
 * route's own first appearance of each zone means the bands cannot be in a
 * different order from the levels standing on them, because it is the same
 * order.
 *
 * `endless` is excluded: it is the portal at the far end, not a region, and
 * has never painted a band (`.zone-endless` has no rule in Lobby.css).
 */
export const TERRAIN_ZONES = [
  ...new Set(levelsMapData.filter((level) => level.zone !== "endless").map((level) => level.zone)),
];

/**
 * Each region's horizontal span, sized to cover exactly the levels assigned to
 * it, so a level always stands on its own zone's ground.
 *
 * Boundaries land halfway between the last node of one region and the first
 * node of the next, which is what makes the containment exact rather than
 * coincidental: every node sits strictly inside its own region's span with
 * roughly half a column of ground to spare on the side facing its neighbour.
 * Region widths therefore vary with how many levels a region holds (tutorial
 * has 3, mid and late have 5) instead of every region being `mapWidth / 5`
 * wide regardless of what stands on it - which happened to be nearly right
 * once the route was unfolded, and is the kind of "nearly right by accident"
 * this map has already been bitten by twice.
 *
 * The first region starts at 0 and the last runs to `mapWidth`, so the bands
 * tile the whole terrain with no bare strip at either end. The portal's own
 * column is past the last campaign level, so the portal stands on the endgame
 * region's ground - deliberate: the endless run is where the endgame leads,
 * and the alternative is the portal standing on the raw `.game-map` surface.
 * ZoneTerrain.test.js asserts that placement explicitly rather than leaving it
 * to be discovered.
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
