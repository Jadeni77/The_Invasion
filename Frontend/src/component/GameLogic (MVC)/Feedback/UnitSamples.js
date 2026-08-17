import { UNIT_VOICES } from './UnitVoices.js';

/**
 * Sample files are discovered at build time by filename. Dropping
 * src/assets/audio/units/mortar.wav makes every unit that resolves to the
 * 'mortar' sound key (see SoundGroups.js) play that sample with no code
 * change; a sound key with no file keeps its synthesized voice.
 */
const modules = import.meta.glob('/src/assets/audio/units/*.{ogg,wav,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Strips directories and the file extension, leaving the sound key. */
export function sampleNameFromPath(path) {
  const file = path.split('/').pop();
  const lastDot = file.lastIndexOf('.');
  return lastDot === -1 ? file : file.slice(0, lastDot);
}

/** Sound key -> hashed asset URL, for every supplied file. */
export const SAMPLE_URLS = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [sampleNameFromPath(path), url]),
);

/**
 * How each variant transforms a unit's sample.
 *
 * death lowers playbackRate, which pitches the sound down AND lengthens it -
 * the natural analogue of the synthesized death variant. Its effective duration
 * is therefore buffer.duration / playbackRate, not buffer.duration.
 *
 * EVERY VARIANT soundKeyFor (SoundGroups.js) SPECIAL-CASES MUST HAVE AN ENTRY
 * HERE - see UnitSamples.test.js's "every variant soundKeyFor special-cases
 * has a sample transform", which derives that set from soundKeyFor's own
 * source rather than trusting this comment to stay in sync with it.
 *
 * charge/impact/phase were missing entirely until this task - the melee-
 * variant trap repeating: soundKeyFor, MIX_TIERS and UNIT_VOICES all knew
 * about quake-charge/quake-impact/phase-change, but nothing here did, so
 * `SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire` silently handed any
 * sample dropped under those keys fire's identity transform - full gain,
 * full length - no matter how the file or the tier were authored. Nothing
 * caught it because no sample existed under those keys to expose it.
 *
 * Their two numbers are pulling in different directions for different reasons:
 *
 * - gainScale (0.6 for impact and phase, 0.45 for charge, all below fire's 1)
 *   exists because quake-charge/quake-impact/phase-change all sit in the LOUD
 *   mix tier (MIX_TIERS, same as baseDamaged and boss) - deliberately, per
 *   that table's own comment, because a ground pound and a phase transition
 *   cost the player most of the board. That tier is shared with two sounds
 *   this task does not touch (baseDamaged, boss) and is asserted equal to
 *   them by existing tests, so it is the wrong lever for a problem specific
 *   to ONE file's mastering: Earthquake_Spell.ogg (and the Eagle Artillery
 *   set generally) is mastered close to 0dBFS peak, which at
 *   SAMPLE_BASE_GAIN(0.7) * gainScale(1) * LOUD(1.0) would make the ground
 *   pound louder than the synth version the owner already played and called
 *   "so loud" - the opposite of the ask. gainScale is the same lever
 *   hit/melee already use to sit quieter than their tier alone would produce,
 *   so lowering it here for these three keeps the tier's meaning (how much
 *   the MOMENT matters, shared with baseDamaged/boss) separate from how loud
 *   this particular recording happens to be. charge stays quieter than
 *   impact (0.45 < 0.6), preserving the synth recipe's own wind-up-quieter-
 *   than-impact relationship (UNIT_VOICES gain 0.30 vs 0.60).
 *
 * - durationScale stays 1 (full length) for all three, because the actual
 *   fix for their length - the charge and impact samples outlasting their
 *   ~0.5s/~1.2s windows in the ground pound - was applied by TRIMMING THE
 *   FILES with ffmpeg before they were committed, not by scaling here. A
 *   durationScale below 1 makes AudioManager.playSample fade continuously
 *   across the ENTIRE truncated length (its `durationScale < 1` branch),
 *   which is right for masking a hard cut in a 40ms hit and wrong for a
 *   sound meant to hold its own shape - and its own natural decay - for the
 *   better part of a second or more. See the audio README for what each file
 *   was trimmed to and why.
 */
export const SAMPLE_VARIANTS = {
  fire:  { playbackRate: 1,    gainScale: 1,    durationScale: 1    },
  hit:   { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  melee: { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  death: { playbackRate: 0.75, gainScale: 1,    durationScale: 1    },
  charge: { playbackRate: 1, gainScale: 0.45, durationScale: 1 },
  impact: { playbackRate: 1, gainScale: 0.6,  durationScale: 1 },
  phase:  { playbackRate: 1, gainScale: 0.6,  durationScale: 1 },
  /**
   * The Mortar's shell landing (EagleArtillery_Impact.ogg, trimmed to ~0.58s -
   * the attack transient plus a short release, not the source file's full
   * 2.52s continuous rumble).
   *
   * gainScale 0.65 rather than fire's 1: the file is mastered to the same
   * near-0dBFS peak as every other sample here (measured -0.2dB), and
   * mortar-impact sits in the MID mix tier (0.7) alongside the Mortar's own
   * fire sample, which already plays at gainScale 1 - SAMPLE_BASE_GAIN(0.7) *
   * 1 * 0.7. Leaving this at 1 as well would make the payoff exactly as loud
   * as the launch off the same hot master, with no headroom for "heavy but
   * not the loudest thing in the game" (the owner's own words, after already
   * calling one synth sound too loud once). 0.65 keeps it slightly ABOVE the
   * shared 'hit' sound that follows it (see FeedbackManager's
   * 'defender:shellLanded' handler) so the landing still reads as the more
   * prominent of the two, without reaching fire's own level.
   */
  landing: { playbackRate: 1, gainScale: 0.65, durationScale: 1 },
};

/**
 * Supplied sample names that match no sound key.
 *
 * A misnamed file loads fine and then never plays, silently. Reporting it turns
 * a typo into a visible mistake.
 */
export function unknownSampleNames(names) {
  return names.filter((name) => !Object.hasOwn(UNIT_VOICES, name));
}
