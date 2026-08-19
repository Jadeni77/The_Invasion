/* Sound identity is by archetype, not by unit. */

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
  SwarmLeader: 'summon',
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

/* Every sound key soundKeyFor can return. */
export const SOUND_KEYS = [
  'projectile', 'artillery', 'magic', 'fire', 'heal', 'melee', 'summon', 'hit',
  'mortar', 'sniper', 'mortar-impact',
  'quake-impact', 'phase-change',
  'death-small', 'death-medium', 'death-defender', 'titan', 'boss',
];

/* Resolves a unit and variant to its sound key. */
export function soundKeyFor(unitName, variant) {
  if (variant === 'hit') return 'hit';

  // Every melee strike shares one sound: which enemy swung carries nothing the
  // player needs, and a Vampire's claw would otherwise fall through to the
  // firing branch and play a generic arrow.
  if (variant === 'melee') return 'melee';

  // Big-ability sounds, keyed by the variant like hit and melee rather than by
  // the unit. Only the Titan reaches them today, but they are named for what
  // the player has to recognise - a board-wide slam landing, a boss
  // escalating - not for who is doing it, which is the same rule the rest of
  // this file follows. Without these branches the abilities would fall
  // through to the firing branch and a board-wide earthquake would play a bow
  // twang.
  //
  // A third branch, `variant === 'charge'` -> 'quake-charge', used to sit
  // here: a rising synth tone for the ground pound's 500ms wind-up. Dropped
  // per the owner's ask ("can we only keep the earthquake sound without the
  // initial beep?") - EnemyUnits.performGroundPound no longer emits the event
  // that reached it, so the branch is gone rather than left unreachable.
  if (variant === 'impact') return 'quake-impact';
  if (variant === 'phase') return 'phase-change';

  // The Mortar's shell landing - the payoff half of its two sounds, the other
  // being its own firing signature above. Named 'landing' rather than reusing
  // 'impact' on purpose: 'impact' already means the Titan's ground pound
  // (quake-impact) above, and the owner's rule is that Eagle Artillery belongs
  // to the Mortar only while the earthquake belongs to the Titan only - a
  // shared variant name would let a Mortar shell resolve to quake-impact the
  // moment someone reused it, exactly the cross-contamination this file's
  // sample-provenance guard (SampleProvenance.test.js) exists to catch. Only
  // the Mortar reaches this variant today, which is why it is keyed by
  // variant rather than by unit, the same reasoning charge/impact/phase above
  // already follow.
  if (variant === 'landing') return 'mortar-impact';

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

/*
 * Relative level per sound key. Projectiles and hits fire constantly, so they
 * must sit under everything else - without this the mix has no foreground and
 * reads as noise however well the individual sounds are chosen.
 */
export const MIX_TIERS = {
  /*
   * Lobby rewards. MID, not LOUD: a chest is a good moment, not a board-wide
   * event, and the lobby is quiet - nothing else is competing with it, so it
   * does not need the headroom a boss death does.
   */
  treasureCollected: MID, defenderUnlocked: MID,

  // Unit sound keys, returned by soundKeyFor.
  projectile: QUIET, hit: QUIET,
  artillery: MID, magic: MID, fire: MID, heal: MID, melee: MID, summon: MID,
  mortar: MID, sniper: MID,
  /*
   * The Mortar's shell landing sits beside its own firing sound in the MID
   * tier, not with the Titan's abilities in LOUD.
   */
  'mortar-impact': MID,
  'death-small': MID, 'death-medium': MID, 'death-defender': MID,
  titan: LOUD, boss: LOUD,
  /* The Titan's two AoE abilities, both LOUD. */
  'quake-impact': LOUD, 'phase-change': LOUD,

  // Game-event sounds, keyed by their SfxLibrary id because they play through
  // playSfx rather than through unit resolution. The ids must match exactly or
  // the tier silently never applies.
  energyCollected: QUIET, defenderPlaced: QUIET, deployRejected: QUIET,
  /*
   * Removing a defender sits at MID, not beside defenderPlaced in the quiet
   * tier.
   */
  defenderRemoved: MID,
  waveStarted: MID, bossWaveStarted: MID,
  baseDamaged: LOUD, levelWon: LOUD, levelLost: LOUD,
};

/** The multiplier for a key; unknown keys sit mid rather than silent. */
export function mixGainFor(soundKey) {
  return MIX_TIERS[soundKey] ?? MID;
}
