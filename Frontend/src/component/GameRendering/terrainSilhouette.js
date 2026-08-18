/**
 * The terrain silhouettes, generated from ABSOLUTE map x.
 *
 * Pure geometry, no JSX: the campaign map draws these per region and
 * TerrainBackdrop draws them full-screen behind the screens that are not the map,
 * so both get their hills from one place. A file that exports a component may not
 * also export helpers (react-refresh/only-export-components), which is the
 * immediate reason this is its own module - but it is the right split regardless.
 *
 * These used to be three fixed paths on a `viewBox="0 0 600 200"` with
 * `preserveAspectRatio="none"`, one instance per region. Regions are not the same
 * width - they span 380px to 760px - so the same hills were stretched anywhere
 * from 0.63x to 1.27x, and because each instance restarted the pattern at its own
 * left edge the silhouette did not line up across a boundary either.
 *
 * Generating from absolute x fixes both: peaks sit on a fixed pitch in map
 * coordinates, so every hill is the same width everywhere, and a region's last
 * peak and its neighbour's first are consecutive points on one continuous range.
 */

/** Peak spacing in map px. Fixed, so hill width never depends on region width. */
const RIDGE_PITCH = 95;
export const RIDGE_HEIGHT = 200;

/**
 * A silhouette across [left, left + width], as a closed path in LOCAL
 * coordinates. `phase` offsets the alternating heights so the far and near
 * ranges do not peak in the same places.
 */
function silhouette(left, width, { pitch, crest, trough, phase = 0, baseline = RIDGE_HEIGHT }) {
  // Start one pitch before the region and end one after, so a partial hill at
  // either edge is drawn rather than clipped into a vertical wall.
  const first = Math.floor(left / pitch) - 1;
  const last = Math.ceil((left + width) / pitch) + 1;

  const local = (k) => k * pitch - left;
  const heightAt = (k) => ((k + phase) % 2 === 0 ? crest : trough);

  /*
   * Quadratic curves, not straight lines: each peak is the CONTROL point and the
   * midpoints between peaks are the on-curve anchors, which is what makes these
   * roll rather than zig-zag. A first pass drew `L` segments between peaks and
   * the foreground band came out looking like a folded strip of paper.
   */
  const midX = (k) => (local(k) + local(k + 1)) / 2;
  const midY = (k) => (heightAt(k) + heightAt(k + 1)) / 2;

  let d = `M${midX(first).toFixed(1)},${midY(first).toFixed(1)}`;
  for (let k = first + 1; k <= last - 1; k++) {
    d += ` Q${local(k).toFixed(1)},${heightAt(k)} ${midX(k).toFixed(1)},${midY(k).toFixed(1)}`;
  }

  const startX = midX(first).toFixed(1);
  const endX = midX(last - 1).toFixed(1);
  return `${d} L${endX},${baseline} L${startX},${baseline}Z`;
}

export const ridgeFarPath = (left, width) =>
    silhouette(left, width, { pitch: RIDGE_PITCH, crest: 70, trough: 130, phase: 0 });

/** Nearer hills, drawn over the far range so the two read as depth. */
export const ridgeNearPath = (left, width) =>
    silhouette(left, width, { pitch: RIDGE_PITCH * 1.35, crest: 122, trough: 168, phase: 1 });

/** The foreground band, on its own shorter viewBox. */
export const FOREGROUND_HEIGHT = 100;
export const foregroundPath = (left, width) =>
    silhouette(left, width, {
      pitch: RIDGE_PITCH * 1.9, crest: 30, trough: 58, phase: 0, baseline: FOREGROUND_HEIGHT,
    });
