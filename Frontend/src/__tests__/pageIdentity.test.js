/*
 * What a stranger sees before the game has drawn anything: the tab, the icon,
 * and the preview when the link is pasted into a chat.
 *
 * The deployed site shipped with `<title>Vite + React</title>` and Vite's own
 * logo, because index.html is written once at scaffold time and then never
 * looked at again - no screen renders it, so nothing in the app ever pointed at
 * it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT } from '../test/sourceFiles.js';

const PROJECT = join(SRC_ROOT, '..');
const html = readFileSync(join(PROJECT, 'index.html'), 'utf8');

/** Content of the first `<meta>` whose name or property matches. */
function metaContent(key) {
  const pattern = new RegExp(
    `<meta[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  return html.match(pattern)?.[1] ?? null;
}

describe('the page a link opens', () => {
  it('reads the real index.html', () => {
    expect(html).toContain('<div id="root">');
  });

  it('is named after the game, not the toolchain', () => {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';

    expect(title).toBe('The Invasion');
    expect(title.toLowerCase(), 'the scaffold default').not.toContain('vite');
  });

  it('carries its own icon rather than Vite\'s', () => {
    const icon = html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/i)?.[1];

    expect(icon).toBeTruthy();
    expect(icon, 'still the scaffold logo').not.toContain('vite.svg');
    // Referenced from the site root, so it must exist in public/ to be served.
    expect(existsSync(join(PROJECT, 'public', icon.replace(/^\//, '')))).toBe(true);
  });

  it('says what the game is, for a search result or a pasted link', () => {
    expect(metaContent('description')).toBeTruthy();
    expect(metaContent('og:title')).toBe('The Invasion');
    expect(metaContent('og:description')).toBeTruthy();
  });

  it('tints the mobile browser chrome to the game, not to white', () => {
    // Landscape phones are a supported way to play; a bright band above a dark
    // game is the seam that gives away.
    expect(metaContent('theme-color')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
