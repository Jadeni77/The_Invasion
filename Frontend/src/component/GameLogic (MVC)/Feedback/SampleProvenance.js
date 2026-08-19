/*
 * Which source pack each committed sample file under src/assets/audio/units/
 * was cut from, keyed by sound key (the filename minus extension - see
 * UnitSamples.sampleNameFromPath).
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
