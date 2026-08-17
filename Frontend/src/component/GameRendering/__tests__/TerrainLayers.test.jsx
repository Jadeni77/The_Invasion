import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zoneConfigs } from '../MapLayout.jsx';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');
const jsx = readFileSync(join(here, '..', 'Lobby.jsx'), 'utf8');

/** Zones that appear on the terrain. The endless portal is not a region. */
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((z) => z !== 'endless');

describe('terrain', () => {
  it('gives every terrain zone its own ground rule', () => {
    for (const zone of TERRAIN_ZONES) {
      expect(css, `no .zone-${zone} rule`).toMatch(
        new RegExp(`\\.zone-${zone}\\s*\\{[^}]*background`, 's'),
      );
    }
  });

  it('renders a ridgeline and a foreground band per region', () => {
    expect(jsx).toContain('zone-ridge');
    expect(jsx).toContain('zone-fore');
  });

  it('gives regions distinct ground, so progression is visible', () => {
    const grounds = TERRAIN_ZONES.map((zone) => {
      const m = css.match(new RegExp(`\\.zone-${zone}\\s*\\{([^}]*)\\}`, 's'));
      return m ? m[1].replace(/\s+/g, '') : zone;
    });
    expect(new Set(grounds).size).toBe(TERRAIN_ZONES.length);
  });

  it('uses no accent token for ground', () => {
    for (const zone of TERRAIN_ZONES) {
      const m = css.match(new RegExp(`\\.zone-${zone}\\s*\\{([^}]*)\\}`, 's'));
      expect(m?.[1] ?? '', `.zone-${zone}`).not.toMatch(/--colors-accent-/);
    }
  });

  it('darkens the vignette over the terrain rather than the page', () => {
    expect(css).toMatch(/\.game-map::after\s*\{[^}]*radial-gradient/s);
  });
});
