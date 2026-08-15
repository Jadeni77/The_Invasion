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
 */
export const SAMPLE_VARIANTS = {
  fire:  { playbackRate: 1,    gainScale: 1,    durationScale: 1    },
  hit:   { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  death: { playbackRate: 0.75, gainScale: 1,    durationScale: 1    },
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
