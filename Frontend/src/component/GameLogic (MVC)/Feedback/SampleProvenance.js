/**
 * Which source pack each committed sample file under
 * src/assets/audio/units/ was cut from, keyed by sound key (the filename
 * minus extension - see UnitSamples.sampleNameFromPath).
 *
 * This cannot be derived from code: nothing in the repository records where a
 * .wav's audio actually came from except this file and the audio README's
 * prose, and prose drifts. It exists because the owner's rule for this
 * project is a PACK rule, not a key rule - "Eagle Artillery belongs to the
 * Mortar only, the earthquake belongs to the Titan only" - and that is a
 * property of which pack a file's content was cut from, which the sound-key
 * architecture alone cannot express or enforce. quake-charge.wav was Eagle
 * Artillery content sitting under a Titan-exclusive key, and every existing
 * guard (SOUND_KEYS, soundKeyFor, MIX_TIERS, UNIT_VOICES, SAMPLE_VARIANTS) was
 * satisfied throughout, because none of them know or care what pack a sample
 * came from - only this manifest, cross-referenced against soundKeyFor's own
 * reachability (see SampleProvenance.test.js), can catch that class of bug.
 *
 * Keep this in sync with the audio README's per-file provenance notes when a
 * sample is added, replaced or removed.
 */
export const SAMPLE_PROVENANCE = {
  mortar: 'EagleArtillery_Fire',
  'mortar-impact': 'EagleArtillery_Impact',
  'quake-impact': 'Earthquake_Spell',
};

/** Source packs whose content belongs to the Mortar and to it alone. */
export const EAGLE_ARTILLERY_PREFIX = 'EagleArtillery';

/** Source packs whose content belongs to the Titan and to it alone. */
export const EARTHQUAKE_SOURCE = 'Earthquake_Spell';
