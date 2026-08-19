import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { relativeToSrc, stripComments, stylesheetFiles } from '../../test/sourceFiles.js';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL at transform time, which breaks fileURLToPath under Vitest. node:path
// composition avoids the rewrite (same fix as the other tests in this dir).
const styleDir = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';

/**
 * Every stylesheet under `src/`, derived by walking the tree (see
 * src/test/sourceFiles.js) rather than by a non-recursive
 * `readdirSync(src/style)`. A stylesheet colocated with its component was
 * invisible to this guard as well as to the colour and font guards - all four
 * shared that one listing, which is why widening it is a change in one place.
 */
function stylesheets() {
  return stylesheetFiles().map(relativeToSrc);
}

function readStylesheet(rel) {
  return readFileSync(join(styleDir, '..', rel), 'utf8');
}

/** --custom-property -> hex, read straight from the generated stylesheet. */
const TOKEN_HEX = new Map(
  [...readFileSync(styleDir + 'tokens.generated.css', 'utf8')
    .matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
    .map((m) => [m[1], m[2]]),
);

/**
 * A wash this app layers a translucent colour over. There is no single
 * correct answer to "what is actually behind a color-mix(..., transparent)
 * background" without rendering the page - it depends on where in the DOM
 * the element sits - but every screen in this game is built on the same
 * dark backdrop, so compositing against the root surface token is a
 * consistent, documented approximation rather than a guess per-element.
 */
const ASSUMED_BACKDROP = TOKEN_HEX.get('--colors-surface-base');

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexToRgb(hexA)), relativeLuminance(hexToRgb(hexB))].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function compositeOver(fgHex, alpha, backdropHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(backdropHex);
  const out = fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function opaqueMix(hexA, pctA, hexB, pctB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const wa = pctA / (pctA + pctB);
  const wb = pctB / (pctA + pctB);
  const out = a.map((c, i) => Math.round(c * wa + b[i] * wb));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves a declaration's value to an opaque hex colour for contrast
 * maths, or null if the value isn't one of the shapes this codebase's
 * conversion produces (a plain token, or the two color-mix() shapes it
 * uses - see the shape inventory this was written against: every
 * color-mix() in the stylesheets is either `var(--X) P%, transparent` or
 * `var(--X) P%, var(--Y) Q%`).
 */
function resolveColour(value) {
  const trimmed = value.trim();

  const bareVar = trimmed.match(/^var\((--[a-z0-9-]+)\)$/);
  if (bareVar) {
    const hex = TOKEN_HEX.get(bareVar[1]);
    return hex ? { hex, alpha: 1 } : null;
  }

  const mixToTransparent = trimmed.match(
    /^color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s*(\d+)%,\s*transparent\)$/,
  );
  if (mixToTransparent) {
    const hex = TOKEN_HEX.get(mixToTransparent[1]);
    if (!hex) return null;
    const alpha = Number(mixToTransparent[2]) / 100;
    return { hex: compositeOver(hex, alpha, ASSUMED_BACKDROP), alpha: 1 };
  }

  const mixTwoTokens = trimmed.match(
    /^color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s*(\d+)%,\s*var\((--[a-z0-9-]+)\)\s*(\d+)%\)$/,
  );
  if (mixTwoTokens) {
    const [, tokA, pA, tokB, pB] = mixTwoTokens;
    const hexA = TOKEN_HEX.get(tokA);
    const hexB = TOKEN_HEX.get(tokB);
    if (!hexA || !hexB) return null;
    return { hex: opaqueMix(hexA, Number(pA), hexB, Number(pB)), alpha: 1 };
  }

  return null;
}

/** WCAG large text: >=24px at any weight, or >=18.66px (~14pt) bold. */
function isLargeText(body) {
  const sizeMatch = body.match(/font-size:\s*([\d.]+)(px|rem|em)/);
  if (!sizeMatch) return false;
  const px = Number(sizeMatch[1]) * (sizeMatch[2] === 'px' ? 1 : 16);
  const bold = /font-weight:\s*(bold|[7-9]00)/.test(body);
  return px >= 24 || (bold && px >= 18.66);
}

/** `/* contrast-ok: reason *‍/` anywhere in the rule opts it out, and is reported. */
function optOutReason(body) {
  const m = body.match(/\/\*\s*contrast-ok:?\s*([^*]*)\*\//);
  return m ? m[1].trim() || '(no reason given)' : null;
}

function declaredValue(body, prop) {
  // Value up to the next `;`, tolerant of functions containing commas.
  const re = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+);`);
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Some containers hold their readout in a differently-named sibling class
 * rather than a nested selector (`.score-container` holds `.score-label`,
 * not `.score-container .score-label` in the CSS text - the JSX puts them
 * side by side in the DOM), so selector-text analysis alone can't find the
 * pairing. These are the container/text pairs this review turned up (see
 * GameBoard.jsx); add to this list if a new one like it is introduced -
 * this test can't discover it on its own.
 */
const KNOWN_PAIRS = [
  ['GameBoard.css', '.score-container', '.score-label'],
  ['GameBoard.css', '.base-health-container', '.health-value'],
  ['GameBoard.css', '.energy-container', '.energy-value'],
];

/**
 * Every rule allowed to sit below its WCAG floor today, pinned by name.
 *
 * A `/* contrast-ok *‍/` comment is an escape hatch, and an unaudited escape
 * hatch is worse than none: it looks supervised. So the set is pinned here -
 * a rule that starts opting out without being added to this list fails the
 * test, and a rule that stops needing its opt-out fails it too (delete the
 * entry). Adding to this list is the deliberate act; the comment alone is
 * not enough.
 *
 * All 14 below are one systemic pattern: `text-primary` on a saturated
 * accent background - white text on a coloured button, an app-wide
 * convention that predates the token conversion. See task-3-report.md,
 * "The systemic finding the test surfaced", for the measured ratios and the
 * token-only fix that would clear all of them at once.
 */
const EXPECTED_OPT_OUTS = [
  'CardSelectionModal.css .selection-indicator',
  'CardSelectionModal.css .confirm-button',
  'CollectionPage.css .collection-tab.active',
  'CollectionPage.css .unit-sprite',
  'CollectionPage.css .collection-unit-status',
  'CollectionPage.css .collection-page .back-button',
  'GameBoard.css .quit-confirm-button',
  'GameBoard.css .quit-cancel-button',
  'Lobby.css .boss-indicator',
  'Lobby.css .zoom-controls button',
  'SettingModal.css .toggle-button.active',
];

function rulesOf(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

/** All selectors an exact selector text participates in (handles `a,\nb {`). */
function selectorNames(selector) {
  return selector.split(',').map((s) => s.trim());
}

/**
 * The winning declaration of `prop` for `selector`, resolved the way the
 * cascade resolves it.
 *
 * Every rule involved here is a single class selector, so all of them carry
 * the same specificity - a grouped rule (`.a, .b, .c { }`) and a
 * single-selector rule (`.b { }`) are equally specific, contrary to the
 * intuition that the more specific-looking one wins. With specificity tied,
 * the last declaration in file order wins, so this walks the whole file and
 * keeps the last rule that names `selector` *and* declares `prop`.
 *
 * Resolved per declaration rather than per rule, because a rule may set
 * `color` while a later rule naming the same selector sets only `background`:
 * the winner for each property has to be found separately, or one of them
 * gets read off a rule the cascade already overrode.
 *
 * (Rules nested in an `@media` block are included, since `rulesOf` flattens
 * them. In this stylesheet those only ever restate `padding`/`font-size` for
 * these selectors, never a colour, so flattening cannot change a colour
 * answer here; a future media-query colour override would need a
 * viewport-aware model this test does not have.)
 */
function cascadingDeclaration(rules, selector, prop) {
  let winner = null;
  for (const rule of rules) {
    if (!selectorNames(rule.selector).includes(selector)) continue;
    const value = declaredValue(rule.body, prop);
    if (value !== null) winner = { value, body: rule.body };
  }
  return winner;
}

function check(label, bgBody, fgBody, results, optOuts) {
  const bgValue = declaredValue(bgBody, 'background(?:-color)?');
  const fgValue = declaredValue(fgBody, 'color');
  if (!bgValue || !fgValue) return;
  checkDeclarations(
    label,
    { value: bgValue, body: bgBody },
    { value: fgValue, body: fgBody },
    results,
    optOuts,
  );
}

function checkDeclarations(label, bgDecl, fgDecl, results, optOuts) {
  const reason = optOutReason(fgDecl.body) || optOutReason(bgDecl.body);
  const bg = resolveColour(bgDecl.value);
  const fg = resolveColour(fgDecl.value);
  if (!bg || !fg) return; // not one of this codebase's known colour shapes - not this test's job

  const ratio = contrastRatio(bg.hex, fg.hex);
  const threshold = isLargeText(fgDecl.body) ? 3.0 : 4.5;

  if (reason) {
    optOuts.push({
      label,
      detail: `${label} (${ratio.toFixed(2)}:1, needs ${threshold}:1) - ${reason}`,
      reason,
    });
    return;
  }
  results.push({ label, ratio, threshold, pass: ratio >= threshold });
}

describe('WCAG contrast ratio for token-derived colour pairs', () => {
  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  const results = [];
  const optOuts = [];

  for (const path of stylesheets()) {
    const css = readStylesheet(path);
    const rules = rulesOf(css);
    // Opt-out labels stay keyed on the sheet's own name, not its path from
    // `src/`. EXPECTED_OPT_OUTS below is an audited list the owner signed off
    // on; widening this guard's file list is not a re-audit, and rewriting all
    // fourteen entries to carry a `style/` prefix would make the diff read
    // like one. A colocated sheet with a colliding basename would be
    // ambiguous here, which is a problem to have when one exists.
    const file = basename(path);

    // Same-rule pairs: one selector sets both color and background(-color).
    for (const { selector, body } of rules) {
      check(`${file} ${selector}`, body, body, results, optOuts);
    }

    // Descendant-combinator pairs: `.X h1`/`.X p`/etc. for text colour,
    // paired with the background declared on the bare `.X` selector(s).
    for (const { selector, body: fgBody } of rules) {
      const m = selector.match(/^(\.[a-zA-Z0-9-]+)\s+[a-zA-Z0-9.-]+$/);
      if (!m) continue;
      const parentSelector = m[1];
      for (const { selector: otherSelector, body: bgBody } of rules) {
        if (!selectorNames(otherSelector).includes(parentSelector)) continue;
        check(`${file} ${selector} (bg from ${otherSelector})`, bgBody, fgBody, results, optOuts);
      }
    }

    // Explicit container/label pairs that selector text alone can't reveal.
    // Each side is resolved through the cascade (last equally-specific
    // declaration wins), not by taking the first rule that mentions the
    // selector: all three of these containers are named first in a shared
    // `.energy-container, .score-container, .base-health-container` rule and
    // again in their own later rule, and it is the later one that decides
    // the background actually rendered.
    for (const [pairFile, containerSel, labelSel] of KNOWN_PAIRS) {
      if (pairFile !== file) continue;
      const bgDecl = cascadingDeclaration(rules, containerSel, 'background(?:-color)?');
      const fgDecl = cascadingDeclaration(rules, labelSel, 'color');
      if (!bgDecl || !fgDecl) continue;
      checkDeclarations(`${file} ${labelSel} (bg from ${containerSel})`, bgDecl, fgDecl, results, optOuts);
    }
  }

  it('checked at least one colour pair (guards against a vacuous run)', () => {
    expect(results.length).toBeGreaterThan(10);
  });

  it('opts out of exactly the rules on the expected list', () => {
    const inUse = optOuts.map((o) => o.label).sort();
    const expected = [...EXPECTED_OPT_OUTS].sort();
    const added = inUse.filter((l) => !expected.includes(l));
    const removed = expected.filter((l) => !inUse.includes(l));
    expect(
      inUse,
      `contrast-ok opt-outs drifted from EXPECTED_OPT_OUTS.\n` +
        `  new (add deliberately, with a measured ratio and a reason): ${added.join(', ') || 'none'}\n` +
        `  gone (good news - delete from the list): ${removed.join(', ') || 'none'}`,
    ).toEqual(expected);
  });

  it('opts out of exactly the expected number of rules', () => {
    expect(
      optOuts.length,
      `${optOuts.length} contrast-ok opt-outs in use, EXPECTED_OPT_OUTS lists ${EXPECTED_OPT_OUTS.length}`,
    ).toBe(EXPECTED_OPT_OUTS.length);
  });

  it('reports every contrast-ok opt-out in use, each with a measured ratio', () => {
    if (optOuts.length > 0) {
      console.log('contrast-ok opt-outs in use:\n' + optOuts.map((o) => `  - ${o.detail}`).join('\n'));
    }
    // A `contrast-ok` comment copy-pasted onto a new rule without its own
    // measurement is the failure mode this catches: the opt-out has to state
    // the ratio it is accepting, not merely claim the exemption.
    const unmeasured = optOuts.filter((o) => !/\d+(\.\d+)?\s*:\s*1/.test(o.reason)).map((o) => o.label);
    expect(
      unmeasured,
      `contrast-ok comments with no measured ratio in their reason: ${unmeasured.join(', ')}`,
    ).toEqual([]);
  });

  it.each(results.map((r) => [r.label, r]))('%s meets its WCAG threshold', (_label, r) => {
    expect(
      r.ratio,
      `${r.label}: ${r.ratio.toFixed(2)}:1, needs ${r.threshold}:1`,
    ).toBeGreaterThanOrEqual(r.threshold);
  });
});

/**
 * C1 and C2 shared one root cause the block above cannot see: a rule that
 * declares `color` and no `background` of its own, painted over a surface a
 * *different* rule controls. `.level-number` inherits from whichever
 * `.level-node.<state>` rule matched its ancestor; `.level-name`/`.star` sit
 * outside the node's own box (pushed there by a negative `bottom`) and paint
 * over the zone terrain beside it instead. Neither pairing is written down
 * anywhere in the CSS as a `.parent .child` selector, so the descendant-pair
 * mechanism above - which matches CSS selector *text* - cannot find either
 * one. Full cascade/box-layout resolution is out of scope (see the module
 * docstring above and the fix report this guard shipped with); what follows
 * is deliberately the smallest thing that closes the specific hole C1/C2
 * exploited, scoped to Lobby.css, where it happened.
 *
 * The two backgrounds a Lobby.css child rule can actually be sitting on,
 * both derived from the stylesheet's own content rather than named by hand:
 *
 * - a "state family": a base selector combined with modifier classes
 *   (`.level-node.completed`/`.available`/`.locked`/`.boss` - discovered by
 *   the compound-selector *shape* `.base.modifier`, not by knowing
 *   "level-node" is a thing), for rules painted directly on their own
 *   container; or
 * - the zone terrain: every `.zone-<region>` ground rule, discovered by its
 *   own gradient shape (`linear-gradient(180deg, ...)`), for rules pushed
 *   outside their container's box.
 *
 * Which of the two applies to a given orphan rule is decided by one
 * mechanical, CSS-native signal: does the rule (or a pluralised wrapper of
 * the same name - `.star` inside `.stars`, the one convention this file
 * actually uses for "item inside its group") declare a *negative*
 * top/bottom/left/right? A negative inset is what pushes a child out of its
 * positioned ancestor's padding box and onto whatever is rendered behind it -
 * `.level-number` has none (it sits centred, in front of the node, via the
 * parent's `place-items: center`); `.level-name` has its own (`bottom:
 * -20px`); `.star` doesn't, but `.stars` - the wrapper every `.star` renders
 * inside - does (`bottom: -15px`).
 */
describe('descendant text-colour rules whose background lives in a different rule (Lobby.css)', () => {
  const lobbyCss = readStylesheet('style/Lobby.css');
  // Comments stripped before parsing: `rulesOf`'s selector capture is
  // `[^{}]+`, which is exactly as happy to swallow a preceding `/* ... */`
  // block (no braces in it) as it is the real selector - so a rule
  // immediately preceded by a comment (most rules in this file) captures
  // "<comment text>\n.the-actual-selector" as its selector, and every regex
  // below anchors on `^\.` to identify a plain class rule. Left unstripped,
  // that silently dropped `.zone-tutorial` and `.level-node.completed` from
  // this block's own detection - the same failure mode as the `rulesOf`
  // caller above, just newly load-bearing here because this block matches
  // selectors structurally instead of a hand-named list.
  const lobbyRules = rulesOf(stripComments(lobbyCss));

  function ruleFor(selector) {
    return lobbyRules.find((r) => r.selector === selector);
  }

  function varTokensIn(value) {
    return [...new Set([...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => TOKEN_HEX.get(m[1])).filter(Boolean))];
  }

  function hasNegativeInset(body) {
    return /(?:^|[;{\s])(?:top|bottom|left|right):\s*-/.test(body);
  }

  /** Every `.zone-<region>` ground rule, found by its own gradient shape. */
  const zoneGroundPalette = lobbyRules
    .filter((r) => /^\.zone-[a-zA-Z0-9-]+$/.test(r.selector))
    .map((r) => declaredValue(r.body, 'background(?:-color)?'))
    .filter((v) => v && v.includes('linear-gradient(180deg'))
    .flatMap(varTokensIn);

  /** `.base.modifier` families with at least one member declaring a background. */
  const families = new Map();
  for (const rule of lobbyRules) {
    const m = rule.selector.match(/^\.([a-zA-Z0-9-]+)\.[a-zA-Z0-9-]+$/);
    if (!m) continue;
    const bg = declaredValue(rule.body, 'background(?:-color)?');
    if (!bg) continue;
    const stops = varTokensIn(bg);
    families.set(m[1], [...(families.get(m[1]) ?? []), ...stops]);
  }

  /** The one family sharing a hyphen-word with `name` - ambiguous or no match returns null. */
  function familyPaletteFor(name) {
    const words = name.split('-');
    const hits = [...families.entries()].filter(([base]) => base.split('-').some((w) => words.includes(w)));
    return hits.length === 1 ? hits[0][1] : null;
  }

  /** Plain, single-class rules with their own `color` and no `background` of their own. */
  const orphanRules = lobbyRules.filter(
    (r) =>
      /^\.[a-zA-Z0-9-]+$/.test(r.selector) &&
      declaredValue(r.body, 'color') &&
      !declaredValue(r.body, 'background(?:-color)?'),
  );

  const results = [];
  for (const rule of orphanRules) {
    const name = rule.selector.slice(1);
    const fg = resolveColour(declaredValue(rule.body, 'color'));
    if (!fg) continue;
    const threshold = isLargeText(rule.body) ? 3.0 : 4.5;
    const plural = ruleFor(`.${name}s`);
    const escapes = hasNegativeInset(rule.body) || (plural && hasNegativeInset(plural.body));
    const palette = escapes ? zoneGroundPalette : familyPaletteFor(name);
    if (!palette) continue; // no derivable background source for this rule - see "what this cannot see" below
    for (const bgHex of palette) {
      const ratio = contrastRatio(bgHex, fg.hex);
      results.push({
        label: `Lobby.css .${name} vs ${escapes ? 'zone terrain' : 'its state family'} stop ${bgHex}`,
        ratio,
        threshold,
      });
    }
  }

  it('found orphan rules and checked at least one pairing (guards against a vacuous run)', () => {
    expect(orphanRules.length).toBeGreaterThan(0);
    expect(results.length).toBeGreaterThan(10);
  });

  it.each(results.map((r) => [r.label, r]))('%s meets its WCAG threshold', (_label, r) => {
    expect(
      r.ratio,
      `${r.label}: ${r.ratio.toFixed(2)}:1, needs ${r.threshold}:1`,
    ).toBeGreaterThanOrEqual(r.threshold);
  });
});
