import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { PROPS_BY_ZONE, PROP_KINDS, PROP_ROWS, FOREGROUND_BAND_TOP, TerrainProp } from '../TerrainProps.jsx';
import { zoneConfigs } from '../MapLayout.jsx';

// dirname(fileURLToPath(import.meta.url)), not import.meta.dirname and not
// `new URL('../TerrainProps.jsx', import.meta.url)`: Vite's import-analysis
// plugin rewrites that literal `new URL(...)` shape into a dev-server
// http: URL, and fileURLToPath then throws under Vitest.
const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'TerrainProps.jsx'), 'utf8');
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((z) => z !== 'endless');

describe('terrain props', () => {
  it('gives every terrain zone at least two prop kinds', () => {
    for (const zone of TERRAIN_ZONES) {
      expect(PROPS_BY_ZONE[zone]?.length ?? 0, `zone ${zone}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('names only kinds that exist', () => {
    for (const kinds of Object.values(PROPS_BY_ZONE)) {
      for (const kind of kinds) expect(PROP_KINDS).toContain(kind);
    }
  });

  it('uses no emoji — props must take token colours', () => {
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  // Matches both `fill="..."` and `stroke="..."`. A guard that only checked
  // `fill` would wave a raw hex `stroke=` straight through - exactly what
  // `deadTree`, `tent` and `rubble` use for their line detail below. Every
  // guard failure this project has found so far failed on scope like that,
  // never on the matching logic itself.
  it('colours every prop from the token layer', () => {
    const colours = [...src.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) {
      if (colour === 'none') continue;
      expect(colour, `raw colour ${colour}`).toMatch(/^var\(--/);
    }
  });

  it('varies props by zone rather than repeating one set', () => {
    const signatures = TERRAIN_ZONES.map((z) => (PROPS_BY_ZONE[z] ?? []).join(','));
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  // The foreground band (.zone-fore, z-4, see Lobby.css) paints over the
  // bottom 22% of every zone. If a row's offset ever gets nudged back down
  // to or below that line, this fails instead of the prop silently vanishing
  // behind the band.
  it('keeps both prop rows clear of the foreground band', () => {
    for (const [row, value] of Object.entries(PROP_ROWS)) {
      expect(value, `PROP_ROWS.${row}`).toBeGreaterThan(FOREGROUND_BAND_TOP);
    }
  });

  // Step 3's original signature (kind, className) drops position entirely -
  // every prop instance would land in the same spot. TerrainProp must accept
  // and forward `style` for Lobby.jsx's per-instance left/bottom placement
  // to have any effect.
  it('forwards style so each instance can be positioned independently', () => {
    const { container } = render(<TerrainProp kind="tree" style={{ left: '42%', bottom: '30%' }} />);
    const svg = container.querySelector('svg.terrain-prop');
    expect(svg?.style.left).toBe('42%');
    expect(svg?.style.bottom).toBe('30%');
  });
});
