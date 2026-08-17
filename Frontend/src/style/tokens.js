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

/**
 * Hues that carry no meaning - they exist to tell decorative elements apart
 * (a rainbow connector, a spinning portal, a purple reward marker), not to
 * signal state the way `colors` does. Kept separate so nobody reaches for
 * "decorative.violet" expecting it to mean "danger" or "success" the way an
 * accent token would. Each value is a hue that was already in use in the
 * pre-token stylesheets (not invented), reused here so a handful of
 * decorative effects that need more than the four semantic accents can stay
 * multi-hued instead of collapsing onto a semantic token they don't mean.
 */
export const decorative = {
  violet: '#9370db',
  indigo: '#4b0082',
  orange: '#ff7f00',
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

/**
 * Not a shared design constant like the groups above - `angle` is the
 * ready-state default for a per-card custom property a component sets
 * per-instance (a cooldown fraction becomes a sweep angle on the card's
 * recharge overlay; see `.cooldown-sweep` in Card.css). It is declared here,
 * at its default, only so `var(--sweep-angle, 0deg)` resolves against a real
 * declared custom property instead of an undeclared one - stylesheets are
 * held to that rule for every var() reference, not just palette tokens.
 * `sweep.angle` -> `--sweep-angle` (no group segment doubled into the name)
 * because the component contract this backs already names the property
 * `--sweep-angle`, not `--sweep-sweep-angle`.
 */
export const sweep = {
  angle: '0deg',
};

const GROUPS = { colors, decorative, space, radii, borders, shadows, type, sweep };

/** camelCase key in a group -> the kebab-case custom property name. */
export function cssVariableName(groupName, key) {
  const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--${groupName}-${kebab}`;
}

/**
 * Compose a token colour with an alpha channel for canvas contexts that need
 * translucency. Tokens are stored as opaque hex, but ctx.fillStyle,
 * ctx.strokeStyle and ctx.shadowColor sometimes need a fading trail, a pulse,
 * or a gradient stop with less than full opacity - CSS variables cannot do
 * that, so drawing code composes an rgba() string from the same token
 * instead of hand-writing one.
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

/**
 * Builds a `ctx.font` string from the type tokens.
 *
 * `ctx.font` takes the CSS `font` shorthand and needs a concrete family
 * list - it cannot resolve `var(--type-display)` any more than `fillStyle`
 * can resolve `var(--colors-surface-panel)`. Every canvas string in this game
 * was therefore hardcoded as `"bold 12px Arial"` at 28 sites, so the
 * battlefield drew in Arial in the same frame as a DOM HUD rendering in Black
 * Ops One, and the font guard - which only reads stylesheets - could not see
 * any of it.
 *
 * The full stack is passed through, not just the first family, so canvas text
 * falls back the same way DOM text does if the display face is unavailable.
 *
 * @param {number} sizePx  Size in CSS pixels; may be fractional (fade
 *                         effects scale it by an alpha).
 * @param {string} [weight] Optional weight/style prefix, e.g. 'bold'.
 */
export function canvasFont(sizePx, weight) {
  return `${weight ? `${weight} ` : ''}${sizePx}px ${type.display}`;
}

/**
 * Makes sure the display face is actually loaded before canvas text asks for
 * it.
 *
 * This is the ordering trap that a naive "just put the family in ctx.font"
 * fix walks into. DOM text triggers a font fetch when an element that needs
 * the face is laid out; canvas text does not. `ctx.font` is resolved against
 * the font faces already available to the document, and a `@font-face` that
 * has not loaded yet is simply not among them - so the canvas silently draws
 * in the next family in the stack and never retries, because nothing
 * re-renders a canvas when a font arrives. In practice the DOM usually wins
 * this race for us (the lobby and HUD both use --type-display, and
 * `font-display: swap` means the fetch starts as soon as they paint), which
 * is exactly what makes the bug intermittent and worth removing rather than
 * relying on.
 *
 * Resolves - never rejects - so a caller can await it unconditionally: a
 * missing `document.fonts` (jsdom, SSR, Node) or a failed fetch must not stop
 * the game from starting, it just means the fallback family is used.
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

/**
 * A few fire/ember particle effects jitter their green channel every frame for
 * a hand-drawn flicker, rather than painting a flat colour. That jitter is
 * anchored to a token's own channels - not a hardcoded hue - so the flicker
 * is still recognisably "the token" with noise added, and cannot drift from
 * it the way a hand-picked literal could.
 *
 * The jitter's starting point is capped at `255 - jitter`, not the jittered
 * result: capping the result would let the canvas's own channel clamp do the
 * same job silently, collapsing every value above 255 onto a single flat 255
 * and erasing that whole slice of the intended spread. Capping the start
 * keeps the full range inside 0-255 so nothing downstream ever needs to
 * clamp. For a token whose green channel already sits inside the range
 * `jitter` leaves room for, this changes nothing; for one that doesn't (e.g.
 * `decorative.orange`'s 127 against a jitter of 155), it reproduces the
 * historical [100, 255) spread this codebase used before there were tokens,
 * rather than the [127, 282) range a naive `g + jitter` produces.
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
