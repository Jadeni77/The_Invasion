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

  // Source-text checks, not render checks: jsdom has no layout engine or
  // rasteriser, so none of the tests below can see an actual ridgeline,
  // band, or darkened vignette on screen - only what the source files say.
  it('Lobby.jsx source references zone-ridge and zone-fore, once each overall', () => {
    // `.toContain` proves the substring appears somewhere in the file, not
    // once per region and not that either renders - see TERRAIN_ZONES.map
    // above (Lobby.jsx maps one <svg className="zone-ridge"> /
    // <svg className="zone-fore"> pair per zone at render time; this only
    // confirms the JSX source that does that exists, not that it ran).
    expect(jsx).toContain('zone-ridge');
    expect(jsx).toContain('zone-fore');
  });

  it('the five zone ground rule bodies are textually distinct from each other', () => {
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

  it('Lobby.css declares .game-map::after (the vignette) as a radial-gradient', () => {
    expect(css).toMatch(/\.game-map::after\s*\{[^}]*radial-gradient/s);
  });
});
