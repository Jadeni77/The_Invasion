/* eslint-disable react-refresh/only-export-components -- this module exports
   PROP_KINDS/PROPS_BY_ZONE/FOREGROUND_BAND_TOP/PROP_ROWS/PROP_SPACING_PX and
   propsForZone alongside the TerrainProp component, same shape as
   GameContext.jsx. */
/**
 * Scenery for the campaign map's regions. Inline SVG rather than emoji so
 * every prop takes its colour from the token layer - an emoji carries its own
 * palette, which is what the visual-direction work removed.
 */

export const PROP_KINDS = ['tree', 'deadTree', 'tent', 'rubble', 'fire', 'grave'];

/** Which props belong in which region. Character progresses with the terrain. */
export const PROPS_BY_ZONE = {
  tutorial: ['tree', 'tent'],
  early: ['tree', 'rubble'],
  mid: ['deadTree', 'rubble', 'tent'],
  late: ['deadTree', 'fire', 'grave'],
  endgame: ['fire', 'grave', 'rubble'],
};

/** The foreground band (.zone-fore, z-4) paints over the bottom 22% of each
 *  zone. Both rows sit above it so no prop is occluded. */
export const FOREGROUND_BAND_TOP = 22;
export const PROP_ROWS = { near: 30, far: 52 };

/**
 * Roughly how much horizontal ground one prop is meant to occupy, in map
 * pixels.
 *
 * The count used to be "one prop per kind this zone names" - two or three per
 * region, which was already thin on a 2200px map and is scenery-by-homeopathy
 * on the 4200px one: five regions, thirteen props, at 26px each. The spec's
 * second success criterion is "no dead space that neither route, terrain,
 * scenery nor framing occupies", so the count is derived from how much ground
 * there is to occupy instead of from how many kinds happen to be listed.
 */
export const PROP_SPACING_PX = 150;

/**
 * The props a region actually renders, positioned deterministically.
 *
 * Deterministic, not random: a prop that moves on every render is distracting,
 * and a random position is not something a test can pin. The caller passes the
 * region's own width (`zoneSpans` in MapLayout) rather than this module
 * importing the map - scenery should not need to know about level data to know
 * how much ground it has.
 *
 * Kind selection is deliberately decorrelated from the row. Cycling the kind
 * list straight through while alternating near/far row makes every near prop
 * the first kind and every far prop the second whenever a region names exactly
 * two, which is four of the five regions - two tidy rows of one tree each,
 * rather than scenery. The `floor(i / kinds.length)` term shifts the cycle so
 * both kinds appear in both rows.
 */
export function propsForZone(zone, spanWidthPx = 0) {
  const kinds = PROPS_BY_ZONE[zone] ?? [];
  if (kinds.length === 0) return [];

  const count = Math.max(kinds.length, Math.round(spanWidthPx / PROP_SPACING_PX));
  const step = 100 / (count + 1);

  return Array.from({ length: count }, (_, i) => {
    const row = i % 2 === 0 ? 'near' : 'far';
    return {
      key: `${zone}-${i}`,
      kind: kinds[(i + Math.floor(i / kinds.length)) % kinds.length],
      row,
      // Percentages of the region's own box, so a region keeps its scenery
      // spread across itself whatever its width.
      left: (i + 1) * step,
      // A couple of points of deterministic stagger, so neither row reads as
      // a ruled line. Only ever upward from the row's own offset, which keeps
      // every prop clear of FOREGROUND_BAND_TOP by construction rather than
      // by checking the arithmetic each time.
      bottom: PROP_ROWS[row] + (i % 3) * 2,
    };
  });
}

/*
 * Every shape below is drawn to read at the near row's 70px, not only at the
 * 26px these were first sized for. That distinction matters: at 26px a single
 * filled triangle is a convincing tree because it is barely more than a
 * gesture, and at 70px the same triangle is a flat triangle. Three shapes
 * gained a second element for exactly that reason (see each comment), which is
 * the "fix the geometry" half of enlarging them rather than just scaling up
 * something that was only ever legible because it was small.
 */
const SHAPES = {
  // Two-tier pine over a trunk. The upper tier's base (y=5.5) sits below the
  // lower tier's apex (y=4), so the two same-coloured triangles merge into one
  // silhouette with a step in its outline at each side - which is what reads
  // as a conifer at 70px. A single triangle (what this was) reads as a
  // triangle at that size, and the tiers cost nothing at the far row's 45px
  // because the step is in the silhouette, not in fine interior detail.
  tree: (
    <>
      <rect x="7" y="11" width="2" height="5" fill="var(--terrain-prop-dark)" />
      <path d="M8,0 L12,5.5 L4,5.5Z" fill="var(--terrain-prop-leaf)" />
      <path d="M8,4 L14,11 L2,11Z" fill="var(--terrain-prop-leaf)" />
    </>
  ),
  // Bare trunk with asymmetric branches instead of foliage - the leafless
  // silhouette is what should read as "dead" next to `tree`'s solid triangle.
  deadTree: (
    <>
      <rect x="7" y="8" width="2" height="8" fill="var(--terrain-prop-dark)" />
      <path
        d="M8,8 L4,2 M8,8 L12,3 M8,11 L3,8"
        stroke="var(--terrain-prop-dark)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  // Triangular canvas with a centre pole and a door outline, so it reads as
  // a tent rather than a plain triangle.
  tent: (
    <>
      <path d="M1,16 L8,3 L15,16Z" fill="var(--terrain-prop-cloth)" />
      <path
        d="M8,3 L8,16 M5.5,16 L8,9 L10.5,16"
        stroke="var(--terrain-prop-dark)"
        strokeWidth="1"
        fill="none"
      />
    </>
  ),
  // Three overlapping tilted blocks, not a continuous jagged silhouette -
  // a single zigzag skyline reads as distant mountains, not debris. Discrete
  // rotated rectangles read as a collapsed, broken pile instead.
  rubble: (
    <>
      <rect x="1" y="9" width="7" height="6" fill="var(--terrain-prop-stone)" transform="rotate(-10 4.5 12)" />
      <rect x="6" y="11" width="6" height="5" fill="var(--terrain-prop-dark)" transform="rotate(7 9 13.5)" />
      <rect x="9" y="7" width="6" height="8" fill="var(--terrain-prop-stone)" transform="rotate(-5 12 11)" />
    </>
  ),
  // A flame over a dark log, not a bare flame. The lone leaf-shaped path this
  // was reads as a flame at 26px and as an orange leaf at 70px; the log gives
  // it a base to burn on and settles what it is. Ember over prop-dark, so the
  // fire is the bright thing in the frame and the fuel recedes.
  fire: (
    <>
      <path d="M8,1 Q12,8 8,14 Q4,8 8,1Z" fill="var(--terrain-prop-ember)" />
      <rect x="3" y="13" width="10" height="2.5" fill="var(--terrain-prop-dark)" />
    </>
  ),
  // Classic rounded-top tombstone rather than a cross, so it isn't
  // mistakable for a religious symbol. The turned earth at its foot and the
  // inscription bar are what stop it reading as a plain rounded blob once it
  // is 70px tall - both in prop-dark, so they read as recesses in the stone.
  grave: (
    <>
      <path d="M4,15 L4,8 Q4,4 8,4 Q12,4 12,8 L12,15Z" fill="var(--terrain-prop-stone)" />
      <rect x="2.5" y="14.5" width="11" height="1.5" fill="var(--terrain-prop-dark)" />
      <rect x="6" y="8" width="4" height="1" fill="var(--terrain-prop-dark)" />
    </>
  ),
};

/** Kinds that actually have a rendered shape. Exported so a test can catch
 *  PROP_KINDS or a PROPS_BY_ZONE entry naming a kind SHAPES doesn't define -
 *  without this, TerrainProp just returns null for it and the prop silently
 *  never appears; nothing else would fail. */
export const SHAPE_KINDS = Object.keys(SHAPES);

export function TerrainProp({ kind, className = '', style }) {
  const shape = SHAPES[kind];
  if (!shape) return null;
  return (
    <svg className={`terrain-prop ${className}`} viewBox="0 0 16 16" aria-hidden="true" style={style}>
      {shape}
    </svg>
  );
}
