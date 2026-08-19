/* The route's geometry, asserted rather than assumed. */
import { describe, it, expect } from 'vitest';
import { levelsMapData, connectionsData, mapSettings } from '../MapLayout.jsx';

/** The campaign proper, in route order. The portal (999) is the stop after. */
const CAMPAIGN = levelsMapData.filter((level) => level.id !== 999);
const PORTAL = levelsMapData.find((level) => level.id === 999);

/** The node width the CSS declares (`.level-node`, 54px; a boss is 66px). */
const NODE_WIDTH_PX = 66;

describe('the route occupies one node per column', () => {
  it('has the 21 stops it is supposed to have (guards against a vacuous run)', () => {
    expect(levelsMapData).toHaveLength(21);
    expect(CAMPAIGN).toHaveLength(20);
    expect(PORTAL).toBeDefined();
  });

  it('gives no two nodes the same x column', () => {
    const byColumn = new Map();
    for (const level of levelsMapData) {
      byColumn.set(level.x, [...(byColumn.get(level.x) ?? []), level.id]);
    }
    const shared = [...byColumn.entries()].filter(([, ids]) => ids.length > 1);
    expect(
      shared.map(([x, ids]) => `x=${x}: levels ${ids.join(' and ')}`),
      'two nodes in one column is the defect that stacked levels 9 and 16 into a single circle',
    ).toEqual([]);
    expect(byColumn.size).toBe(levelsMapData.length);
  });

  it('advances x monotonically with level id for 1..20', () => {
    for (let i = 1; i < CAMPAIGN.length; i++) {
      expect(CAMPAIGN[i].id).toBe(CAMPAIGN[i - 1].id + 1);
      expect(
        CAMPAIGN[i].x,
        `level ${CAMPAIGN[i].id} (x=${CAMPAIGN[i].x}) does not sit right of ` +
          `level ${CAMPAIGN[i - 1].id} (x=${CAMPAIGN[i - 1].x})`,
      ).toBeGreaterThan(CAMPAIGN[i - 1].x);
    }
  });

  it('puts level 1 at the left edge and the portal last of all', () => {
    expect(CAMPAIGN[0].id).toBe(1);
    expect(CAMPAIGN[0].x).toBe(Math.min(...levelsMapData.map((l) => l.x)));
    expect(PORTAL.x).toBe(Math.max(...levelsMapData.map((l) => l.x)));
    expect(PORTAL.x).toBeGreaterThan(CAMPAIGN[CAMPAIGN.length - 1].x);
  });

  it('separates every adjacent pair by at least 120px centre to centre', () => {
    for (let i = 1; i < levelsMapData.length; i++) {
      const a = levelsMapData[i - 1];
      const b = levelsMapData[i];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      expect(
        distance,
        `levels ${a.id} and ${b.id} are ${distance.toFixed(1)}px apart centre to centre`,
      ).toBeGreaterThanOrEqual(120);
    }
  });

  it('never lets two node circles overlap, at any distance apart in the route', () => {
    // The 9/16 overlap was between nodes eight apart in route order, not
    // adjacent ones - the check above would not have caught it. Every pair.
    const overlapping = [];
    for (let i = 0; i < levelsMapData.length; i++) {
      for (let j = i + 1; j < levelsMapData.length; j++) {
        const a = levelsMapData[i];
        const b = levelsMapData[j];
        const gap = Math.hypot(b.x - a.x, b.y - a.y);
        if (gap < NODE_WIDTH_PX) {
          overlapping.push(`${a.id}/${b.id} ${gap.toFixed(1)}px apart`);
        }
      }
    }
    expect(overlapping, `node circles are ${NODE_WIDTH_PX}px wide at most`).toEqual([]);
  });

  it('keeps consecutive columns at the approved 180-200px density', () => {
    const gaps = [];
    for (let i = 1; i < levelsMapData.length; i++) {
      gaps.push(levelsMapData[i].x - levelsMapData[i - 1].x);
    }
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(180);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(200);
  });
});

describe('the terrain is wide enough to hold the route it carries', () => {
  it('fits every node inside the map with margin at both ends', () => {
    for (const level of levelsMapData) {
      expect(level.x, `level ${level.id} sits left of the map`).toBeGreaterThan(0);
      expect(level.x, `level ${level.id} sits past the right edge`).toBeLessThan(
        mapSettings.mapWidth,
      );
      expect(level.y).toBeGreaterThan(0);
      expect(level.y).toBeLessThan(mapSettings.mapHeight);
    }
  });

  it('is no longer the mockup width that forced the fold', () => {
    // 2200 held 11 stops. Squeezing 21 into it is the root cause, so a
    // width that has drifted back near it is the regression to catch.
    expect(mapSettings.mapWidth).toBeGreaterThan(3600);
  });

  it('leaves a margin past the last stop, and not much more than a margin', () => {
    // The terrain's width is computed from the last node's column plus
    // padding (see mapSettings in MapLayout.jsx), so adding a stop widens the
    // terrain instead of re-folding the route into a box that no longer fits
    // it. What is checkable here is the consequence: a real margin at the
    // right-hand end, not a wide empty strip the player has to pan across to
    // find nothing.
    const lastX = Math.max(...levelsMapData.map((l) => l.x));
    const padding = mapSettings.mapWidth - lastX;
    expect(padding).toBeGreaterThanOrEqual(100);
    expect(padding).toBeLessThanOrEqual(400);
  });
});

/*
 * Connector segments must not cross. Monotonic x makes a crossing
 * geometrically impossible, but "impossible" is what the folded route was
 * assumed to be too, so it is computed here: an exact segment-segment
 * intersection over the derived `connectionsData`, not an argument about why
 * it cannot happen.
 */
const cross = (ax, ay, bx, by) => ax * by - ay * bx;

/** A connector as its two real endpoints, looked up from the nodes. */
function segmentOf(connection) {
  const from = levelsMapData.find((l) => l.id === connection.from);
  const to = levelsMapData.find((l) => l.id === connection.to);
  return { p: { x: from.x, y: from.y }, q: { x: to.x, y: to.y } };
}

/**
 * Where two closed segments meet: `null`, a single point, or a shared stretch.
 * Standard parametric form - `t` along `a`, `u` along `b` - with the parallel
 * and collinear cases handled rather than divided by zero.
 */
function meetingOf(a, b) {
  const r = { x: a.q.x - a.p.x, y: a.q.y - a.p.y };
  const s = { x: b.q.x - b.p.x, y: b.q.y - b.p.y };
  const qp = { x: b.p.x - a.p.x, y: b.p.y - a.p.y };
  const denom = cross(r.x, r.y, s.x, s.y);

  if (denom === 0) {
    if (cross(qp.x, qp.y, r.x, r.y) !== 0) return null; // parallel, disjoint
    const rr = r.x * r.x + r.y * r.y;
    const t0 = (qp.x * r.x + qp.y * r.y) / rr;
    const t1 = t0 + (s.x * r.x + s.y * r.y) / rr;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (hi < lo) return null;
    return { kind: lo === hi ? 'point' : 'stretch', t: lo };
  }

  const t = cross(qp.x, qp.y, s.x, s.y) / denom;
  const u = cross(qp.x, qp.y, r.x, r.y) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { kind: 'point', t };
}

describe('no connector crosses another', () => {
  const segments = connectionsData.map((connection) => ({
    connection,
    segment: segmentOf(connection),
  }));

  it('has connectors to compare (guards against a vacuous run)', () => {
    // 20 segments -> 190 pairs. A run that silently compared nothing would
    // pass every assertion below.
    expect(segments).toHaveLength(20);
    expect((segments.length * (segments.length - 1)) / 2).toBe(190);
  });

  it('meets another connector only at a node the two of them share', () => {
    const crossings = [];
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        const meeting = meetingOf(a.segment, b.segment);
        if (!meeting) continue;

        const label =
          `${a.connection.from}-${a.connection.to} and ` +
          `${b.connection.from}-${b.connection.to}`;

        if (meeting.kind === 'stretch') {
          crossings.push(`${label} run along each other`);
          continue;
        }

        // A single meeting point is legitimate only when it *is* the node
        // both connectors are attached to - consecutive segments of one
        // route share exactly that. Anything else is a crossing.
        const shared = [a.connection.from, a.connection.to].filter(
          (id) => id === b.connection.from || id === b.connection.to,
        );
        const point = {
          x: a.segment.p.x + meeting.t * (a.segment.q.x - a.segment.p.x),
          y: a.segment.p.y + meeting.t * (a.segment.q.y - a.segment.p.y),
        };
        const atSharedNode = shared.some((id) => {
          const node = levelsMapData.find((l) => l.id === id);
          return Math.hypot(node.x - point.x, node.y - point.y) < 1e-9;
        });
        if (!atSharedNode) {
          crossings.push(
            `${label} meet at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`,
          );
        }
      }
    }
    expect(crossings, 'the folded route crossed itself four times').toEqual([]);
  });

  it('confirms the shared-node case is really being exercised, not skipped', () => {
    // The check above would also pass if every pair returned `null` because
    // the geometry helper was broken. Consecutive connectors must meet.
    const first = segmentOf(connectionsData[0]);
    const second = segmentOf(connectionsData[1]);
    expect(meetingOf(first, second)).not.toBeNull();
    // And two connectors from opposite ends of the route must not.
    const last = segmentOf(connectionsData[connectionsData.length - 1]);
    expect(meetingOf(first, last)).toBeNull();
  });
});

describe('connectors and chests still derive from the nodes', () => {
  it('places every connector at the midpoint of the two nodes it joins', () => {
    for (const connection of connectionsData) {
      const { p, q } = segmentOf(connection);
      expect(connection.x).toBeCloseTo((p.x + q.x) / 2, 6);
      expect(connection.y).toBeCloseTo((p.y + q.y) / 2, 6);
      expect(connection.length).toBeCloseTo(Math.hypot(q.x - p.x, q.y - p.y), 6);
    }
  });

  it('joins consecutive levels, so the route is one continuous path', () => {
    const ids = levelsMapData.map((l) => l.id);
    for (let i = 1; i < ids.length; i++) {
      const link = connectionsData.find(
        (c) => c.from === ids[i - 1] && c.to === ids[i],
      );
      expect(link, `no connector from level ${ids[i - 1]} to ${ids[i]}`).toBeDefined();
    }
    expect(connectionsData).toHaveLength(ids.length - 1);
  });
});
