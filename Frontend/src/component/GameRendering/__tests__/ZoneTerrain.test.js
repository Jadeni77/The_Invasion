/**
 * The terrain's relationship to the route.
 *
 * This is the assertion nothing made, and its absence is why the map shipped
 * with the terrain escalating backwards. The ground was painted as five
 * equal-width bands in `zoneConfigs` key order; the route ran through the
 * zones in its own order; and with the route folded back on itself from level
 * 13, the two disagreed - the return leg walked right to left back through
 * regions the outbound leg had already climbed, so a level's ground had no
 * particular relationship to the level's own zone. Every layer was individually
 * correct. Nothing owned how they related.
 *
 * So the property under test is the relationship itself: for every level, the
 * region whose span contains that level's x must be the region the level says
 * it belongs to. Arithmetic over the exported data - what the ground actually
 * *looks* like is the owner's judgement, since jsdom has no rasteriser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  levelsMapData,
  mapSettings,
  zoneConfigs,
  zoneSpans,
  zoneAtX,
  TERRAIN_ZONES,
} from '../MapLayout.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

const CAMPAIGN = levelsMapData.filter((level) => level.id !== 999);
const PORTAL = levelsMapData.find((level) => level.id === 999);

describe('every level stands on its own zone\'s ground', () => {
  it('has regions and levels to compare (guards against a vacuous run)', () => {
    expect(TERRAIN_ZONES.length).toBeGreaterThan(3);
    expect(Object.keys(zoneSpans)).toEqual(TERRAIN_ZONES);
    expect(CAMPAIGN).toHaveLength(20);
  });

  it.each(CAMPAIGN.map((level) => [level.id, level.zone, level.x]))(
    'level %i belongs to zone %s and stands on that zone\'s ground at x=%i',
    (id, zone, x) => {
      expect(
        zoneAtX(x),
        `level ${id} belongs to '${zone}' but x=${x} lands on '${zoneAtX(x)}' ground`,
      ).toBe(zone);
    },
  );

  it('leaves every node clear of its own region\'s edges, not balanced on one', () => {
    // Containment alone would be satisfied by a node sitting one pixel inside
    // a boundary, where the node's 66px circle would straddle two grounds.
    for (const level of CAMPAIGN) {
      const { left, width } = zoneSpans[level.zone];
      expect(level.x - left, `level ${level.id} is on its region's left edge`).toBeGreaterThan(33);
      expect(
        left + width - level.x,
        `level ${level.id} is on its region's right edge`,
      ).toBeGreaterThan(33);
    }
  });

  it('stands the endless portal on the endgame ground, the region it leads out of', () => {
    // Not a region of its own: `.zone-endless` has no rule and paints no
    // band, so if the endgame band stopped at level 20 the portal would stand
    // on the raw map surface. Asserted rather than left to be noticed.
    expect(PORTAL.zone).toBe('endless');
    expect(zoneSpans.endless).toBeUndefined();
    expect(zoneAtX(PORTAL.x)).toBe(TERRAIN_ZONES[TERRAIN_ZONES.length - 1]);
    expect(zoneAtX(PORTAL.x)).toBe('endgame');
  });
});

describe('the regions tile the terrain in route order', () => {
  it('runs the regions in the order the route walks through them', () => {
    const firstAppearance = [];
    for (const level of levelsMapData) {
      if (level.zone === 'endless') continue;
      if (!firstAppearance.includes(level.zone)) firstAppearance.push(level.zone);
    }
    expect(TERRAIN_ZONES).toEqual(firstAppearance);
  });

  it('covers the full width with no gap and no overlap', () => {
    let edge = 0;
    for (const zone of TERRAIN_ZONES) {
      const { left, width } = zoneSpans[zone];
      expect(left, `${zone} does not start where the previous region ended`).toBe(edge);
      expect(width, `${zone} has no width`).toBeGreaterThan(0);
      edge = left + width;
    }
    expect(edge, 'the last region does not reach the right edge').toBe(mapSettings.mapWidth);
  });

  it('gives a region a width that reflects how many levels it holds', () => {
    // The equal-width bands this replaced were `mapWidth / 5` regardless of
    // what stood on them. A region holding 5 levels must now be wider than one
    // holding 3, or the span is not really derived from its levels.
    const counts = Object.fromEntries(
      TERRAIN_ZONES.map((zone) => [zone, CAMPAIGN.filter((l) => l.zone === zone).length]),
    );
    const widest = TERRAIN_ZONES.reduce((a, b) =>
      zoneSpans[a].width >= zoneSpans[b].width ? a : b,
    );
    const narrowest = TERRAIN_ZONES.reduce((a, b) =>
      zoneSpans[a].width <= zoneSpans[b].width ? a : b,
    );
    expect(counts[widest]).toBeGreaterThan(counts[narrowest]);
    expect(new Set(TERRAIN_ZONES.map((z) => zoneSpans[z].width)).size).toBeGreaterThan(1);
  });

  it('keeps each region\'s levels contiguous in route order', () => {
    // A region whose levels were interleaved with another's could not have a
    // single span containing exactly its own levels - the spans would have to
    // overlap, and some level would stand on a neighbour's ground.
    const seen = [];
    for (const level of CAMPAIGN) {
      if (seen[seen.length - 1] !== level.zone) {
        expect(seen, `zone '${level.zone}' is revisited later in the route`).not.toContain(
          level.zone,
        );
        seen.push(level.zone);
      }
    }
    expect(seen).toEqual(TERRAIN_ZONES);
  });
});

describe('every region a level stands in can actually paint itself', () => {
  it.each(TERRAIN_ZONES)('%s has a zoneConfigs entry and a .zone-<key> ground rule', (zone) => {
    // A zone named by a level but missing from either side renders no band at
    // all: Lobby.jsx maps `zoneConfigs`' keys to backdrops, and Lobby.css is
    // where the ground gradient lives. Either gap leaves those levels standing
    // on the bare map surface, which no containment check would notice.
    expect(Object.keys(zoneConfigs), `zoneConfigs has no '${zone}'`).toContain(zone);
    expect(css, `no .zone-${zone} ground rule`).toMatch(
      new RegExp(`\\.zone-${zone}\\s*\\{[^}]*background`, 's'),
    );
  });

  it('names no region in zoneConfigs that no level stands in, except the portal', () => {
    const unused = Object.keys(zoneConfigs).filter(
      (zone) => zone !== 'endless' && !TERRAIN_ZONES.includes(zone),
    );
    expect(unused, 'a configured region with no levels paints ground nothing stands on').toEqual([]);
  });
});
