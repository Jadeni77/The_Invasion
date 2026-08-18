import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(join(here, '..', 'Lobby.jsx'), 'utf8');
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

describe('top chrome is one band', () => {
  // Source-text checks, not render checks: jsdom has no layout engine, so
  // nothing here proves the band actually appears on screen as one row - see
  // the two tests below for exactly what each does and does not verify.
  it('Lobby.jsx source references the lobby-topband class', () => {
    expect(jsx).toContain('lobby-topband');
  });

  it('Lobby.css declares .lobby-topband as flex, not flex-direction: column', () => {
    const body = ruleBody('.lobby-topband');
    expect(body).toMatch(/display\s*:\s*flex/);
    expect(body).not.toMatch(/flex-direction\s*:\s*column/);
  });

  it('does not let the band grow at the map\'s expense', () => {
    expect(ruleBody('.lobby-topband')).toMatch(/flex\s*:\s*0 0 auto/);
  });
});
