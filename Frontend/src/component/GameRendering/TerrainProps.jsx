/* eslint-disable react-refresh/only-export-components -- this module exports
   PROP_KINDS/PROPS_BY_ZONE/FOREGROUND_BAND_TOP/PROP_ROWS alongside the
   TerrainProp component, same shape as GameContext.jsx. */
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

const SHAPES = {
  // Pine silhouette: a wide triangle of foliage over a short trunk. Reads
  // clearly even at the far row's 17px/0.45-opacity treatment because it's
  // one filled shape rather than fine detail.
  tree: (
    <>
      <rect x="7" y="10" width="2" height="6" fill="var(--terrain-prop-dark)" />
      <path d="M8,0 L14,10 L2,10Z" fill="var(--terrain-prop-leaf)" />
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
  fire: <path d="M8,3 Q11,9 8,16 Q5,9 8,3Z" fill="var(--terrain-prop-ember)" />,
  // Classic rounded-top tombstone rather than a cross, so it isn't
  // mistakable for a religious symbol.
  grave: <path d="M4,16 L4,9 Q4,5 8,5 Q12,5 12,9 L12,16Z" fill="var(--terrain-prop-stone)" />,
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
