import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { colors, space, radii, borders, shadows, type, cssVariableName } from '../tokens.js';
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
