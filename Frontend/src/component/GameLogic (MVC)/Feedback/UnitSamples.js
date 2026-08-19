import { UNIT_VOICES } from './UnitVoices.js';

/* Sample files are discovered at build time by filename. */
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

/* How each variant transforms a unit's sample. */
export const SAMPLE_VARIANTS = {
  fire:  { playbackRate: 1,    gainScale: 1,    durationScale: 1    },
  hit:   { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  melee: { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  death: { playbackRate: 0.75, gainScale: 1,    durationScale: 1    },
  impact: { playbackRate: 1, gainScale: 0.6,  durationScale: 1 },
  phase:  { playbackRate: 1, gainScale: 0.6,  durationScale: 1 },
  /*
   * The Mortar's shell landing (EagleArtillery_Impact.ogg, trimmed to ~0.58s -
   * the attack transient plus a short release, not the source file's full
   * 2.52s continuous rumble).
   */
  landing: { playbackRate: 1, gainScale: 0.65, durationScale: 1 },
};

/* Supplied sample names that match no sound key. */
export function unknownSampleNames(names) {
  return names.filter((name) => !Object.hasOwn(UNIT_VOICES, name));
}
