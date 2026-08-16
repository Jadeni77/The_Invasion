import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL at transform time, which breaks fileURLToPath under Vitest. node:path
// composition avoids the rewrite (same fix as the other tests in this dir).
const styleDir = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';

const EXEMPT = new Set(['tokens.generated.css', 'fonts.css']);

function stylesheets() {
  return readdirSync(styleDir).filter((f) => f.endsWith('.css') && !EXEMPT.has(f));
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
  'CollectionPage.css .back-button',
  'GameBoard.css .quit-confirm-button',
  'GameBoard.css .quit-cancel-button',
  'Lobby.css .boss-indicator',
  'Lobby.css .zoom-controls button',
  'SettingModal.css .quality-button.active',
  'SettingModal.css .toggle-button.active',
  'SettingModal.css .cancel-button',
  'SettingModal.css .apply-button',
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

  for (const file of stylesheets()) {
    const css = readFileSync(styleDir + file, 'utf8');
    const rules = rulesOf(css);

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
