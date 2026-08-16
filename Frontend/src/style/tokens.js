/**
 * The single source of truth for every visual constant in the game.
 *
 * CSS reads these through tokens.generated.css; canvas drawing code imports
 * them directly, because ctx.fillStyle cannot resolve a CSS variable. Both
 * consumers read this file, so they cannot drift apart.
 *
 * After editing, run `npm run tokens` to regenerate the stylesheet. A test
 * fails if you forget.
 */

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

const GROUPS = { colors, space, radii, borders, shadows, type };

/** camelCase key in a group -> the kebab-case custom property name. */
export function cssVariableName(groupName, key) {
  const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--${groupName}-${kebab}`;
}

export { GROUPS };
