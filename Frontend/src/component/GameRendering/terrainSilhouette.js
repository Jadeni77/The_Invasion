/* The terrain silhouettes, generated from ABSOLUTE map x. */

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
   * Quadratic curves, not straight lines: each peak is the CONTROL point and
   * the midpoints between peaks are the on-curve anchors, which is what makes
   * these roll rather than zig-zag.
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
