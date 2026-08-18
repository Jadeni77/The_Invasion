import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import {
  PROPS_BY_ZONE,
  PROP_KINDS,
  PROP_ROWS,
  PROP_SPACING_PX,
  FOREGROUND_BAND_TOP,
  SHAPE_KINDS,
  TerrainProp,
  propsForZone,
} from '../TerrainProps.jsx';
import { zoneSpans, TERRAIN_ZONES } from '../MapLayout.jsx';
import { stripComments } from '../../../test/sourceFiles.js';

// dirname(fileURLToPath(import.meta.url)), not import.meta.dirname and not
// `new URL('../TerrainProps.jsx', import.meta.url)`: Vite's import-analysis
// plugin rewrites that literal `new URL(...)` shape into a dev-server
// http: URL, and fileURLToPath then throws under Vitest.
const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'TerrainProps.jsx'), 'utf8');
// TERRAIN_ZONES comes from MapLayout now - it used to be re-derived here from
// `zoneConfigs`, which is the same "two lists of the same fact" shape that let
// the band order disagree with the route order in the first place.

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
  // A numeric-constant comparison, not a rendered-position check: nothing
  // here measures where a prop actually lands, only that the two exported
  // offset constants disagree in the right direction.
  it('PROP_ROWS constants both sit numerically above FOREGROUND_BAND_TOP', () => {
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

/**
 * How much scenery a region gets, and where.
 *
 * The count used to be "one prop per kind this region names" - two or three
 * each, thirteen props across the whole map. On terrain 4200px wide that is not
 * scenery, and combined with a 26px prop size it satisfied the "no dead space"
 * criterion on paper only. None of these tests can see a rendered prop: jsdom
 * has no layout engine or rasteriser, so whether the ground now looks occupied
 * is the owner's call. What is checkable is the arithmetic that decides it.
 */
describe('scenery covers the ground it is given', () => {
  const REGION_WIDTHS = TERRAIN_ZONES.map((zone) => [zone, zoneSpans[zone].width]);

  it('has regions with real widths to lay props out in (guards against a vacuous run)', () => {
    expect(REGION_WIDTHS.length).toBeGreaterThan(3);
    for (const [zone, width] of REGION_WIDTHS) {
      expect(width, `region ${zone} has no width`).toBeGreaterThan(300);
    }
  });

  it.each(REGION_WIDTHS)('gives %s roughly one prop per %i px of its own ground', (zone, width) => {
    const props = propsForZone(zone, width);
    // Within one of the ideal, which is all rounding allows.
    expect(Math.abs(props.length - width / PROP_SPACING_PX)).toBeLessThanOrEqual(1);
    expect(props.length).toBeGreaterThanOrEqual(4);
  });

  it('places every prop clear of the foreground band, per prop and not just per row', () => {
    // The old guard compared the two PROP_ROWS constants against
    // FOREGROUND_BAND_TOP. Offsets are now staggered per prop, so the
    // constants agreeing is no longer sufficient - what matters is where each
    // prop actually ends up.
    for (const [zone, width] of REGION_WIDTHS) {
      for (const prop of propsForZone(zone, width)) {
        expect(
          prop.bottom,
          `${zone} prop ${prop.key} would sit inside the foreground band`,
        ).toBeGreaterThan(FOREGROUND_BAND_TOP);
      }
    }
  });

  it('keeps every prop inside its own region rather than spilling into the next', () => {
    for (const [zone, width] of REGION_WIDTHS) {
      for (const prop of propsForZone(zone, width)) {
        expect(prop.left, `${zone} prop ${prop.key}`).toBeGreaterThan(0);
        expect(prop.left, `${zone} prop ${prop.key}`).toBeLessThan(100);
      }
    }
  });

  it('spreads props out instead of stacking them at one offset', () => {
    for (const [zone, width] of REGION_WIDTHS) {
      const offsets = propsForZone(zone, width).map((p) => p.left);
      expect(new Set(offsets).size, `${zone} repeats a horizontal offset`).toBe(offsets.length);
    }
  });

  it('uses both rows, and puts more than one kind in each', () => {
    // Cycling the kind list while alternating the row makes every near prop
    // the first kind and every far prop the second, for any region naming
    // exactly two - which is four of the five. Two ruled rows of one tree
    // each is the failure this decorrelation exists to avoid.
    for (const [zone, width] of REGION_WIDTHS) {
      const props = propsForZone(zone, width);
      const rows = new Set(props.map((p) => p.row));
      expect(rows, `${zone} uses only one row`).toEqual(new Set(['near', 'far']));

      if (props.filter((p) => p.row === 'near').length < 2) continue;
      const nearKinds = new Set(props.filter((p) => p.row === 'near').map((p) => p.kind));
      const farKinds = new Set(props.filter((p) => p.row === 'far').map((p) => p.kind));
      expect(
        nearKinds.size + farKinds.size,
        `${zone} pins one kind to each row`,
      ).toBeGreaterThan(2);
    }
  });

  it('names only kinds that have a shape, however many it emits', () => {
    for (const [zone, width] of REGION_WIDTHS) {
      for (const prop of propsForZone(zone, width)) {
        expect(SHAPE_KINDS, `${zone} emitted '${prop.kind}'`).toContain(prop.kind);
      }
    }
  });

  it('is deterministic - the same region lays out identically twice', () => {
    for (const [zone, width] of REGION_WIDTHS) {
      expect(propsForZone(zone, width)).toEqual(propsForZone(zone, width));
    }
  });

  it('never emits fewer props than the region names kinds, even with no width', () => {
    for (const zone of TERRAIN_ZONES) {
      expect(propsForZone(zone, 0).length).toBe(PROPS_BY_ZONE[zone].length);
    }
    expect(propsForZone('endless', 900)).toEqual([]);
    expect(propsForZone('nonexistent-zone', 900)).toEqual([]);
  });

  it('still exports the row offsets the stagger is measured from', () => {
    for (const [row, value] of Object.entries(PROP_ROWS)) {
      expect(value, `PROP_ROWS.${row}`).toBeGreaterThan(FOREGROUND_BAND_TOP);
    }
  });
});

/**
 * Prop size, read from the stylesheet that decides it.
 *
 * A source-text check, not a rendered one - jsdom applies no stylesheet and
 * measures nothing, so "does a 70px tree look like scenery" is the owner's
 * judgement. The number is still worth pinning: 26px on 600px-tall terrain
 * beside 54-66px level nodes is what made these read as dirt specks, and it is
 * a single declaration away from happening again.
 */
describe('props are sized to be seen', () => {
  const css = readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

  function sizeOf(selector) {
    const rule = css.match(
      new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'),
    );
    const width = rule?.[1].match(/width:\s*(\d+)px/);
    const height = rule?.[1].match(/height:\s*(\d+)px/);
    return { width: Number(width?.[1]), height: Number(height?.[1]) };
  }

  it('draws the near row at roughly 70px square', () => {
    const { width, height } = sizeOf('.terrain-prop');
    expect(width).toBeGreaterThanOrEqual(60);
    expect(width).toBe(height);
  });

  it('draws the far row smaller than the near row, but still visible', () => {
    const near = sizeOf('.terrain-prop');
    const far = sizeOf('.terrain-prop.prop-far');
    expect(far.width).toBeGreaterThanOrEqual(40);
    expect(far.width).toBeLessThan(near.width);
    expect(far.width).toBe(far.height);
  });

  it('keeps props out of the way of clicks and in their layer', () => {
    // Both pre-existing and both load-bearing: a 70px prop is big enough to
    // cover a chest's hit target, and z-index 3 is pinned by
    // lobbyZOrder.test.js as part of the documented stack.
    const rule = css.match(/\.terrain-prop\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(rule).toMatch(/z-index:\s*3/);
  });
});
