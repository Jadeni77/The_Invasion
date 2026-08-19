import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { colors, decorative, space, radii, borders, shadows, type, cssVariableName, withAlpha, withFlicker } from '../tokens.js';
import { renderTokenCss } from '../../../scripts/generate-tokens.mjs';

// Not `new URL('../tokens.generated.css', import.meta.url)`: Vite statically
// recognizes that exact syntax as its asset-URL pattern and rewrites it to a
// dev-server URL, which breaks fileURLToPath under Vitest (see
// generate-tokens.mjs for the full explanation). node:path sidesteps it.
const generatedPath = join(dirname(fileURLToPath(import.meta.url)), '../tokens.generated.css');

describe('design tokens', () => {
  it('names a custom property from a group and key', () => {
    expect(cssVariableName('colors', 'surfaceBase')).toBe('--colors-surface-base');
    expect(cssVariableName('space', 'lg')).toBe('--space-lg');
  });

  it('defines every group the stylesheets rely on', () => {
    for (const group of [colors, space, radii, borders, shadows, type]) {
      expect(Object.keys(group).length).toBeGreaterThan(0);
    }
  });

  it('gives every colour an explicit value, never undefined', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value, `colors.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the committed CSS matches what the generator produces', () => {
    const onDisk = readFileSync(generatedPath, 'utf8');
    expect(onDisk).toBe(renderTokenCss());
  });
});

/*
 * withAlpha and withFlicker carry 146 colour values between them across the
 * canvas drawing code (Task 4), and until now neither had a single test.
 */
describe('withAlpha', () => {
  it('decodes a 6-digit hex token into its RGB channels', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    expect(withAlpha('#0000ff', 0.5)).toBe('rgba(0, 0, 255, 0.5)');
  });

  it('decodes a 3-digit hex shorthand the same way the browser would', () => {
    // #0f0 means #00ff00, not #0f0f0f0 - each digit doubles independently.
    expect(withAlpha('#0f0', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('matches an actual design token', () => {
    expect(withAlpha(colors.accentDanger, 0.4)).toBe('rgba(217, 79, 61, 0.4)');
  });

  it.each([0, 0.5, 1, 0.15, 0.9])('preserves alpha %s exactly, not rounded or clamped', (alpha) => {
    const result = withAlpha(colors.accentDanger, alpha);
    const [, parsedAlpha] = result.match(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/);
    expect(Number(parsedAlpha)).toBe(alpha);
  });

  it('preserves alpha computed at runtime, not just a literal constant', () => {
    const fadeAlpha = 0.73;
    const result = withAlpha(colors.accentDanger, fadeAlpha * 0.7);
    expect(result).toBe(`rgba(217, 79, 61, ${fadeAlpha * 0.7})`);
  });

  it('produces a string every canvas colour property accepts', () => {
    expect(withAlpha(colors.accentDanger, 0.4)).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
  });
});

describe('withFlicker', () => {
  const SAMPLES = 2000;

  it('produces a string every canvas colour property accepts', () => {
    expect(withFlicker(decorative.orange, 0.5, 100)).toMatch(/^rgba\(\d+, [\d.]+, \d+, [\d.]+\)$/);
  });

  it.each([0, 0.5, 1])('preserves alpha %s exactly', (alpha) => {
    const result = withFlicker(decorative.orange, alpha, 100);
    const [, parsedAlpha] = result.match(/rgba\(\d+, [\d.]+, \d+, ([\d.]+)\)/);
    expect(Number(parsedAlpha)).toBe(alpha);
  });

  it('holds the red and blue channels fixed at the token value and only jitters green', () => {
    const [r, , b] = decorative.orange.match(/#(..)(..)(..)/).slice(1).map((h) => parseInt(h, 16));
    for (let i = 0; i < SAMPLES; i++) {
      const [, sr, , sb] = withFlicker(decorative.orange, 1, 100).match(/rgba\((\d+), ([\d.]+), (\d+), [\d.]+\)/);
      expect(Number(sr)).toBe(r);
      expect(Number(sb)).toBe(b);
    }
  });

  it('never produces a green channel outside 0-255, so nothing gets silently clamped', () => {
    for (const jitter of [100, 155]) {
      for (let i = 0; i < SAMPLES; i++) {
        const [, g] = withFlicker(decorative.orange, 1, jitter).match(/rgba\(\d+, ([\d.]+),/);
        expect(Number(g)).toBeGreaterThanOrEqual(0);
        expect(Number(g)).toBeLessThanOrEqual(255);
      }
    }
  });

  it('reproduces the historical [100, 255) flicker range at the jitter-155 call site', () => {
    // decorative.orange's green channel (127) plus a jitter of 155 would run
    // to 282 and get clamped for the top ~17% of outcomes, flattening them to
    // a flat g=255 - this is the bug: the range must start low enough that
    // 255 is a ceiling the maths respects, not one the canvas silently
    // enforces. FireBlast.draw's charge-up glow used exactly rgba(255, 100 +
    // Math.random() * 155, 0, ...) before it read from a token, so [100, 255)
    // is the range being reproduced, not an arbitrary one.
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const [, g] = withFlicker(decorative.orange, 1, 155).match(/rgba\(\d+, ([\d.]+),/);
      min = Math.min(min, Number(g));
      max = Math.max(max, Number(g));
    }
    expect(min).toBeGreaterThanOrEqual(100);
    expect(max).toBeLessThan(255);
    // With 2000 samples the observed spread should hug both ends of the
    // range closely; a narrower spread would mean the range silently shrank.
    expect(min).toBeLessThan(105);
    expect(max).toBeGreaterThan(250);
  });

  it('does not narrow the range when the token channel already fits the jitter', () => {
    // decorative.orange's green (127) plus a jitter of 100 tops out at 227,
    // well under 255 - no capping is needed here, and none should happen.
    let max = -Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const [, g] = withFlicker(decorative.orange, 1, 100).match(/rgba\(\d+, ([\d.]+),/);
      max = Math.max(max, Number(g));
    }
    expect(max).toBeGreaterThan(220);
    expect(max).toBeLessThan(227);
  });
});
