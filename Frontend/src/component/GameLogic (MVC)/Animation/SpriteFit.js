/**
 * Fits a unit's native sprite frame into its own on-screen box (its grid
 * cell, for defenders; its declared footprint, for enemies) at the largest
 * whole-number scale that does not overflow either axis, preserving the
 * frame's own aspect ratio.
 *
 * Shared between DefenderUnits.js and EnemyUnits.js because both sides need
 * the same fix for the same underlying reason: a unit's box size (grid cell
 * or footprint) and its sprite's native pixel size are two independent
 * numbers, and drawing at anything other than a whole-number multiple of the
 * native size produces uneven pixel rows under nearest-neighbour sampling.
 * Neither side can assume its native size is a single shared constant -
 * enemy frames vary 64-100px wide across types, and defenders are not all
 * cropped to the same 48x48 either (Mortar and Frost Archer's true art
 * doesn't fit the 48x48 template every other defender uses and is drawn
 * uncropped, at 64x64 - see AssetManifest.js) - so this always reads the
 * native size from the caller rather than baking one in.
 *
 * When the native frame doesn't fit inside the box at even 1x scale on some
 * axis, there is no integer upscale that avoids overflowing the box, so this
 * falls back to drawing directly at the box's own size (the same behaviour
 * every unit had before whole-number scaling existed), which never
 * overflows by construction.
 */
export function fitNativeFrame(nativeWidth, nativeHeight, boxWidth, boxHeight) {
  if (!nativeWidth || !nativeHeight) {
    return { drawnWidth: boxWidth, drawnHeight: boxHeight, insetX: 0, insetY: 0 };
  }
  const fitScale = Math.min(boxWidth / nativeWidth, boxHeight / nativeHeight);
  if (fitScale < 1) {
    return { drawnWidth: boxWidth, drawnHeight: boxHeight, insetX: 0, insetY: 0 };
  }
  const scale = Math.floor(fitScale);
  const drawnWidth = nativeWidth * scale;
  const drawnHeight = nativeHeight * scale;
  return {
    drawnWidth,
    drawnHeight,
    insetX: Math.round((boxWidth - drawnWidth) / 2),
    insetY: Math.round((boxHeight - drawnHeight) / 2),
  };
}
