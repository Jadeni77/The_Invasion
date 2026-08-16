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

function check(label, bgBody, fgBody, results, optOuts) {
  const bgValue = declaredValue(bgBody, 'background(?:-color)?');
  const fgValue = declaredValue(fgBody, 'color');
  if (!bgValue || !fgValue) return;

  const reason = optOutReason(fgBody) || optOutReason(bgBody);
  const bg = resolveColour(bgValue);
  const fg = resolveColour(fgValue);
  if (!bg || !fg) return; // not one of this codebase's known colour shapes - not this test's job

  const ratio = contrastRatio(bg.hex, fg.hex);
  const threshold = isLargeText(fgBody) ? 3.0 : 4.5;

  if (reason) {
    optOuts.push(`${label} (${ratio.toFixed(2)}:1, needs ${threshold}:1) - ${reason}`);
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
    for (const [pairFile, containerSel, labelSel] of KNOWN_PAIRS) {
      if (pairFile !== file) continue;
      const containerRule = rules.find((r) => selectorNames(r.selector).includes(containerSel));
      const labelRule = rules.find((r) => r.selector === labelSel);
      if (!containerRule || !labelRule) continue;
      check(`${file} ${labelSel} (bg from ${containerSel})`, containerRule.body, labelRule.body, results, optOuts);
    }
  }

  it('checked at least one colour pair (guards against a vacuous run)', () => {
    expect(results.length).toBeGreaterThan(10);
  });

  it('reports every contrast-ok opt-out in use', () => {
    // This assertion always "passes" - it exists to print the opt-out list
    // in test output whenever there is one, per the instruction to report
    // every use. An empty array here means no rule currently opts out.
    expect(optOuts).toEqual(optOuts);
    if (optOuts.length > 0) {
      console.log('contrast-ok opt-outs in use:\n' + optOuts.map((o) => `  - ${o}`).join('\n'));
    }
  });

  it.each(results.map((r) => [r.label, r]))('%s meets its WCAG threshold', (_label, r) => {
    expect(
      r.ratio,
      `${r.label}: ${r.ratio.toFixed(2)}:1, needs ${r.threshold}:1`,
    ).toBeGreaterThanOrEqual(r.threshold);
  });
});
