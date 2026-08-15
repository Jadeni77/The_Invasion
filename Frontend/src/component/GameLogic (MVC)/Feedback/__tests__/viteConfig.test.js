import { describe, it, expect, vi } from 'vitest';

/**
 * Guards the one build setting the whole sound scheme rests on.
 *
 * `soundKeyFor` (SoundGroups.js) resolves every sound in the game by comparing
 * `constructor.name` against class-name strings. esbuild's production minifier
 * renames classes (`Mortar` -> `Ef`) unless `keepNames` is on, so without that
 * setting every unit collapses to 'projectile' when it fires and
 * 'death-medium' when it dies - the feature becomes a complete no-op in the
 * shipped build while every other test stays green, because a vitest run is
 * never minified.
 *
 * This plan widened that blast radius: the class-name lookup used to be one
 * table in UnitVoices.js and is now soundKeyFor, which every sound routes
 * through. UnitVoices.test.js's "production minification guard" checks a real
 * instance's constructor.name and catches a class rename or a missing mapping;
 * it cannot see this config key being deleted. Asserting the value is the only
 * mechanical guard available from inside a test run - anything stronger would
 * need a real production build and a check of its output, which is far more
 * machinery than this is worth.
 *
 * The two mocks below are why this lives in its own file. vite.config.js pulls
 * in @vitejs/plugin-react, whose transitive imports throw under the jsdom
 * environment this suite runs in ("new TextEncoder().encode('') instanceof
 * Uint8Array is incorrectly false"). Stubbing the plugin and defineConfig -
 * which is an identity function for a plain object anyway - leaves the config's
 * own object literal, the thing actually under test, entirely real.
 */
vi.mock('vite', () => ({ defineConfig: (config) => config }));
vi.mock('@vitejs/plugin-react', () => ({ default: () => ({ name: 'react-plugin-stub' }) }));

const { default: viteConfig } = await import('../../../../../vite.config.js');

describe('vite build config', () => {
  it('keeps class names in production builds', () => {
    expect(viteConfig.esbuild?.keepNames).toBe(true);
  });

  it('still runs tests unminified against jsdom, where constructor.name is intact', () => {
    // Sanity: the guard above is about the BUILD, and this file is only
    // meaningful while tests themselves cannot observe minification.
    expect(viteConfig.test?.environment).toBe('jsdom');
  });
});
