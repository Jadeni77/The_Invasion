import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { PROPS_BY_ZONE, PROP_KINDS, PROP_ROWS, FOREGROUND_BAND_TOP, SHAPE_KINDS, TerrainProp } from '../TerrainProps.jsx';
import { zoneConfigs } from '../MapLayout.jsx';
import { stripComments } from '../../../test/sourceFiles.js';

// dirname(fileURLToPath(import.meta.url)), not import.meta.dirname and not
// `new URL('../TerrainProps.jsx', import.meta.url)`: Vite's import-analysis
// plugin rewrites that literal `new URL(...)` shape into a dev-server
// http: URL, and fileURLToPath then throws under Vitest.
const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'TerrainProps.jsx'), 'utf8');
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((z) => z !== 'endless');

/** Same list `noRawColours.test.js` uses for the equivalent repo-wide check. */
const CSS_NAMED_COLOURS = new Set([
  'white', 'black', 'red', 'green', 'blue', 'gold', 'brown', 'gray', 'grey',
  'orange', 'yellow', 'purple', 'pink', 'cyan', 'magenta', 'silver', 'navy',
  'teal', 'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'darkgoldenrod',
  'darkslategray', 'lightgray', 'lightgrey',
]);
const NAMED_ALLOWED = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

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

  // PROP_KINDS and PROPS_BY_ZONE were only consistent with SHAPES by
  // inspection - name a kind in either without a matching SHAPES entry and
  // TerrainProp silently returns null for it (see the component below).
  // Nothing else fails; the prop just never renders. This is the guard for
  // that: every kind named anywhere must actually have a shape.
  it('gives every named kind an actual SHAPES entry', () => {
    for (const kind of PROP_KINDS) {
      expect(SHAPE_KINDS, `PROP_KINDS names '${kind}' with no SHAPES entry`).toContain(kind);
    }
    for (const [zone, kinds] of Object.entries(PROPS_BY_ZONE)) {
      for (const kind of kinds) {
        expect(SHAPE_KINDS, `zone ${zone} names '${kind}' with no SHAPES entry`).toContain(kind);
      }
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

  // The check above only sees literal `fill="..."`/`stroke="..."` attributes
  // in the source text - a raw hex reaching a prop through
  // `style={{ fill: '#aabbcc' }}`, a CSS class, or any spelling other than
  // those two attributes would sail through it unnoticed. This scans the
  // whole file, comments stripped, for a colour literal in any form - hex,
  // rgb()/rgba(), hsl()/hsla(), or a bare CSS colour name - so scope comes
  // from what the file *is* (must contain no colour literal at all) rather
  // than from how a colour happens to be written. Kept alongside the
  // positive fill/stroke check above, not instead of it.
  it('contains no colour literal in any form, however it is applied', () => {
    const code = stripComments(src);
    const found = [];
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
    for (const m of code.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/gi)) found.push(m[0]);
    for (const m of code.matchAll(/[a-z]+/gi)) {
      const word = m[0].toLowerCase();
      if (!NAMED_ALLOWED.has(word) && CSS_NAMED_COLOURS.has(word)) found.push(word);
    }
    expect(found, `TerrainProps.jsx has colour literal(s): ${found.join(', ')}`).toEqual([]);
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
