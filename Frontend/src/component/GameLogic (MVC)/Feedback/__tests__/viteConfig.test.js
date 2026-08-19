import { describe, it, expect, vi } from 'vitest';

/* Guards the one build setting the whole sound scheme rests on. */
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
