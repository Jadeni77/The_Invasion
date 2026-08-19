/* The single source of truth for every visual constant in the game. */

export const colors = {
  surfaceBase:    '#2f2a1d',
  surfacePanel:   '#4a4231',
  surfaceRaised:  '#6b5c40',
  surfaceSunken:  '#241f16',
  edgeOutline:    '#1a160f',
  edgeHighlight:  '#a8906a',
  textPrimary:    '#f5ecd8',
  textMuted:      '#b8a888',
  accentEnergy:   '#ffd700',
  accentDanger:   '#d94f3d',
  accentSuccess:  '#5fa855',
  accentInfo:     '#4a9cc4',
};

/*
 * Hues that carry no meaning - they exist to tell decorative elements apart (a
 * rainbow connector, a spinning portal, a purple reward marker), not to signal
 * state the way `colors` does.
 */
export const decorative = {
  violet: '#9370db',
  indigo: '#4b0082',
  orange: '#ff7f00',
};

/**
 * Terrain shades for the campaign map. A sibling of `colors`, not part of it:
 * these are ground and scenery, not meaning-bearing, and nothing should reach
 * for `terrain.ground3Mid` expecting it to signify anything.
 */
export const terrain = {
  ground1Top: '#3c4a2c', ground1Mid: '#46552f', ground1Bot: '#39442a',
  ground2Top: '#42392a', ground2Mid: '#544733', ground2Bot: '#3d3427',
  ground3Top: '#3d3226', ground3Mid: '#4b3d2c', ground3Bot: '#352b20',
  ground4Top: '#382a22', ground4Mid: '#46332a', ground4Bot: '#2f231d',
  ground5Top: '#33221d', ground5Mid: '#472e25', ground5Bot: '#2a1b17',
  ridgeFar:  '#2b3520', ridgeNear: '#232c1b', foreground: '#20281a',
  vignette:  '#1a160f',
  // The route's node states. A completed node's dominant fill (moss over a
  // cleared path), the available node's inner highlight (paired with
  // --colors-accent-energy for the outer ring - see Lobby.css
  // .level-node.available), and the boss node's ember core (paired with
  // --colors-accent-danger). Each was chosen so the text colour the state
  // rule declares stays legible against it - see contrastRatio findings in
  // task-3-report.md.
  nodeDone:  '#2f4a2f', nodeOpen: '#ffe9a0', nodeBoss: '#ff9d52',
  // Scenery fills for TerrainProp (see TerrainProps.jsx). Five hues cover
  // all six prop kinds: propDark doubles as bark (tree/deadTree trunks) and
  // rubble's shadow block, propStone doubles as rubble and grave. None of
  // these borrow a `colors.*` accent - scenery is ground dressing, not a
  // state signal, same reasoning as the ground shades above.
  propDark:   '#2a2015', propLeaf: '#5a7a3f', propCloth: '#a9784f',
  propStone:  '#8a8578', propEmber: '#ff7a3d',
};

export const space = {
  xs: '4px', sm: '8px', md: '12px', lg: '20px', xl: '32px',
};

export const radii = {
  sm: '4px', md: '8px', lg: '14px', pill: '999px',
};

export const borders = {
  thin: '2px', outline: '3px', heavy: '5px',
};

export const shadows = {
  drop:    '0 4px 0 rgba(26, 22, 15, 0.55)',
  panel:   '0 6px 18px rgba(26, 22, 15, 0.45)',
  pressed: 'inset 0 3px 0 rgba(26, 22, 15, 0.45)',
};

export const type = {
  display:       "'Black Ops One', system-ui, sans-serif",
  body:          "system-ui, -apple-system, 'Segoe UI', sans-serif",
  sizeSm:        '12px',
  sizeMd:        '16px',
  sizeLg:        '22px',
  sizeXl:        '34px',
  weightRegular: '400',
  lineTight:     '1.1',
  lineBody:      '1.5',
};

/*
 * Not a shared design constant like the groups above - `angle` is the
 * ready-state default for a per-card custom property a component sets
 * per-instance (a cooldown fraction becomes a sweep angle on the card's
 * recharge overlay; see `.cooldown-sweep` in Card.css).
 */
export const sweep = {
  angle: '0deg',
};

const GROUPS = { colors, decorative, terrain, space, radii, borders, shadows, type, sweep };

/** camelCase key in a group -> the kebab-case custom property name. */
export function cssVariableName(groupName, key) {
  const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--${groupName}-${kebab}`;
}

/*
 * Compose a token colour with an alpha channel for canvas contexts that need
 * translucency.
 */
export function withAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Builds a `ctx.font` string from the type tokens. */
export function canvasFont(sizePx, weight) {
  return `${weight ? `${weight} ` : ''}${sizePx}px ${type.display}`;
}

/*
 * Makes sure the display face is actually loaded before canvas text asks for
 * it.
 */
export function ensureDisplayFontLoaded(doc = globalThis.document) {
  const fonts = doc && doc.fonts;
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve();
  // A size is required by the shorthand parser even though it is irrelevant
  // to which face gets fetched.
  return Promise.resolve(fonts.load(`1em ${type.display}`)).then(
    () => undefined,
    () => undefined,
  );
}

/*
 * A few fire/ember particle effects jitter their green channel every frame for
 * a hand-drawn flicker, rather than painting a flat colour.
 */
export function withFlicker(hex, alpha, jitter) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const start = Math.max(0, Math.min(g, 255 - jitter));
  return `rgba(${r}, ${start + Math.random() * jitter}, ${b}, ${alpha})`;
}

export { GROUPS };
