/**
 * Sound identity is by archetype, not by unit.
 *
 * A Shooter and a Skeleton firing a basic projectile carry no information that
 * distinguishing them would convey, so they share one sound. Grouping this way
 * cuts the sound set from 29 to 14, and that reduction is itself the fix for
 * incoherence: a small set can come from a single pack, while a large one
 * pushes toward mixing packs with different room tone and mastering.
 */

/** Units whose firing sound is their own, not their category's. */
const FIRE_SIGNATURES = {
  Mortar: 'mortar',
  Sniper: 'sniper',
};

/** Firing sound by unit, for units without a signature. */
const FIRE_GROUPS = {
  BasicDefender: 'projectile',
  RangeEnemy: 'projectile',
  AssassinEnemy: 'projectile',
  GrenadeDefender: 'artillery',
  FrostArcher: 'magic',
  IceBomb: 'magic',
  MageEnemy: 'magic',
  FireBlast: 'fire',
  HealerDefender: 'heal',
  HealerEnemy: 'heal',
  NecromancerEnemy: 'summon',
  SplitterEnemy: 'summon',
};

/** Units whose death sound is their own. */
const DEATH_SIGNATURES = {
  TitanEnemy: 'titan',
  BossEnemy: 'boss',
};

/** Enemies small enough to die lightly. Everything else dies medium. */
const SMALL_ENEMIES = new Set([
  'BasicEnemy', 'FastEnemy', 'MiniEnemy', 'SwarmLeader',
]);

/** Every defender, for death-sound purposes. */
const DEFENDERS = new Set([
  'BasicDefender', 'HealerDefender', 'GrenadeDefender', 'BarricadeDefender',
  'EnergyGenerator', 'Sniper', 'Mortar', 'FrostArcher', 'FireBlast', 'IceBomb',
]);

/**
 * Every sound key soundKeyFor can return.
 *
 * Game events (deploy, energy, wave, win, lose) are NOT here - they play through
 * playSfx by their SfxLibrary id, not through unit resolution. They still get a
 * mix tier, keyed by that id; see MIX_TIERS.
 */
export const SOUND_KEYS = [
  'projectile', 'artillery', 'magic', 'fire', 'heal', 'melee', 'summon', 'hit',
  'mortar', 'sniper',
  'death-small', 'death-medium', 'death-defender', 'titan', 'boss',
];

/**
 * Resolves a unit and variant to its sound key.
 *
 * Unknown units resolve to a sensible default rather than undefined, so a unit
 * added later is generic rather than silent.
 */
export function soundKeyFor(unitName, variant) {
  if (variant === 'hit') return 'hit';

  if (variant === 'death') {
    if (DEATH_SIGNATURES[unitName]) return DEATH_SIGNATURES[unitName];
    if (DEFENDERS.has(unitName)) return 'death-defender';
    if (SMALL_ENEMIES.has(unitName)) return 'death-small';
    return 'death-medium';
  }

  // Everything else is a firing or acting sound.
  return FIRE_SIGNATURES[unitName] ?? FIRE_GROUPS[unitName] ?? 'projectile';
}

const LOUD = 1.0;
const MID = 0.7;
const QUIET = 0.4;

/**
 * Relative level per sound key.
 *
 * Projectiles and hits fire constantly, so they must sit under everything else -
 * without this the mix has no foreground and reads as noise however well the
 * individual sounds are chosen.
 */
export const MIX_TIERS = {
  // Unit sound keys, returned by soundKeyFor.
  projectile: QUIET, hit: QUIET, energy: QUIET,
  artillery: MID, magic: MID, fire: MID, heal: MID, melee: MID, summon: MID,
  mortar: MID, sniper: MID,
  'death-small': MID, 'death-medium': MID, 'death-defender': MID,
  titan: LOUD, boss: LOUD,

  // Game-event sounds, keyed by their SfxLibrary id because they play through
  // playSfx rather than through unit resolution. The ids must match exactly or
  // the tier silently never applies.
  energyCollected: QUIET, defenderPlaced: QUIET, deployRejected: QUIET,
  waveStarted: MID, bossWaveStarted: MID,
  baseDamaged: LOUD, levelWon: LOUD, levelLost: LOUD,
};

/** The multiplier for a key; unknown keys sit mid rather than silent. */
export function mixGainFor(soundKey) {
  return MIX_TIERS[soundKey] ?? MID;
}
