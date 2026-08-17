import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Not `fileURLToPath(new URL('../Card.css', import.meta.url))`: Vite's
// import-analysis plugin statically recognizes that exact `new
// URL(literal, import.meta.url)` syntax as its documented asset-URL pattern
// and rewrites it to a dev-server URL (e.g. http://localhost:3000/...) at
// transform time, for every module it transforms, including this one under
// Vitest. fileURLToPath then throws because the rewritten URL is http:, not
// file:. node:path composition avoids the rewrite (same fix as the other
// tests in this directory).
const styleDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const cardCss = readFileSync(join(styleDir, 'Card.css'), 'utf8');
const generatedCss = readFileSync(join(styleDir, 'tokens.generated.css'), 'utf8');

/** Split a stylesheet into {selector, body} rules (flat - no @media nesting here). */
function rulesOf(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

/** All selectors an exact selector text participates in (handles `a,\nb {`). */
function selectorNames(selector) {
  return selector.split(',').map((s) => s.trim());
}

/** The rule whose selector list contains exactly this selector text. */
function ruleFor(rules, selector) {
  return rules.find((r) => selectorNames(r.selector).includes(selector));
}

/** The first rule whose selector text matches a pattern (for state variants
 *  like `:active` where this test shouldn't dictate the exact selector). */
function ruleMatching(rules, pattern) {
  return rules.find((r) => pattern.test(r.selector));
}

const rules = rulesOf(cardCss);

describe('card reads as a physical object', () => {
  const base = ruleFor(rules, '.card-container');

  it('has a base rule to check (guards against a vacuous run if the class is ever renamed)', () => {
    expect(base, 'no bare .card-container rule found in Card.css').toBeTruthy();
  });

  it('gives the card a thick outline from the token layer, not a hand-picked width or colour', () => {
    // Rejects an implementation that keeps the pre-Task-7 `2px solid
    // var(--colors-surface-panel)` border, or one that reaches for a raw
    // hex/width instead of the shared border-weight and edge-colour tokens.
    expect(base.body).toMatch(/border:\s*var\(--borders-(outline|heavy)\)\s+solid\s+var\(--colors-edge-outline\)/);
  });

  it('lifts the card off the surface with the shared drop shadow', () => {
    // Rejects an implementation that keeps the old bespoke
    // `0 4px 8px color-mix(...)` shadow instead of the shared token, which
    // would leave this card looking different from every other lifted
    // surface in the game.
    expect(base.body).toMatch(/box-shadow:\s*var\(--shadows-drop\)/);
  });

  it('presses the card down and in on :active, not just a colour tint', () => {
    // Rejects an implementation that only swaps a colour/opacity on press
    // (e.g. `:active { opacity: 0.8 }`) instead of giving the object weight:
    // an inset shadow from the shared pressed token, paired with a
    // downward transform so the card actually moves.
    const pressed = ruleMatching(rules, /:active/);
    expect(pressed, 'no :active rule found').toBeTruthy();
    expect(pressed.body).toMatch(/box-shadow:\s*var\(--shadows-pressed\)/);
    expect(pressed.body).toMatch(/transform:\s*translateY\(\s*\d+(\.\d+)?px\s*\)/);
  });

  it('does not press a disabled card', () => {
    // A disabled card can't be clicked (Card.jsx only wires onClick when
    // `!disabled`), so a press effect that still visually depresses it would
    // be lying about what a click there will do. Rejects a naive
    // `.card-container:active` with no `:not(.disabled)` guard.
    const pressed = ruleMatching(rules, /:active/);
    expect(pressed.selector).toMatch(/:not\(\.disabled\)/);
  });
});

describe('recharge is shown on the card itself, not beside it', () => {
  const sweep = ruleFor(rules, '.cooldown-sweep') ?? ruleFor(rules, '.card-cooldown');

  it('has a sweep/cooldown rule to check', () => {
    expect(sweep, 'no .cooldown-sweep or .card-cooldown rule found').toBeTruthy();
  });

  it('is an overlay that fills the card, not a decoration beside it', () => {
    // Rejects an implementation that adds a cooldown *label* somewhere
    // without actually covering the card face - `position: absolute; inset:
    // 0` is what makes this sit "on the card" rather than "beside it".
    expect(sweep.body).toMatch(/position:\s*absolute/);
    expect(sweep.body).toMatch(/inset:\s*0/);
  });

  it('lets clicks reach the card underneath it', () => {
    // Rejects an implementation that forgets `pointer-events: none`, which
    // would silently make every card unclickable while any cooldown
    // overlay is present - a regression jsdom's lack of layout would never
    // surface, since jsdom doesn't dispatch real hit-testing either.
    expect(sweep.body).toMatch(/pointer-events:\s*none/);
  });

  it('draws the recharge wedge from --sweep-angle, not a hardcoded angle', () => {
    // Rejects an implementation that hardcodes a fixed angle (or a
    // percentage) instead of reading the component-supplied custom
    // property, which is what would let this actually animate as cooldown
    // ticks down.
    expect(sweep.body).toMatch(/conic-gradient/);
    const angleRefs = [...sweep.body.matchAll(/var\(--sweep-angle(?:,\s*([^)]+))?\)/g)];
    expect(angleRefs.length, 'expected --sweep-angle to be referenced at least once').toBeGreaterThan(0);
  });

  it('rounds to match the card, so the overlay does not poke out past a rounded corner', () => {
    expect(sweep.body).toMatch(/border-radius:\s*inherit/);
  });
});

describe('--sweep-angle defaults to fully ready', () => {
  it('declares a 0deg default in the generated token layer', () => {
    // This is the load-bearing default: a card whose component never sets
    // --sweep-angle must render fully ready, not fully obscured. Rejects a
    // flipped default (e.g. 360deg) that would make every card look
    // permanently disabled until something remembers to override it.
    expect(generatedCss).toMatch(/--sweep-angle:\s*0deg;/);
  });

  it('every var(--sweep-angle) reference in Card.css also falls back to 0deg locally', () => {
    // Belt-and-suspenders: even if the :root default were ever missing or
    // shadowed, the fallback argument on each var() call must independently
    // resolve to "fully ready", not to some other angle.
    const refs = [...cardCss.matchAll(/var\(--sweep-angle(?:,\s*([^)]+))?\)/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, fallback] of refs) {
      expect(fallback && fallback.trim()).toBe('0deg');
    }
  });
});
