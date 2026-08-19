/*
 * Fits a unit's native sprite frame into its own on-screen box (its grid cell,
 * for defenders; its declared footprint, for enemies) at the largest
 * whole-number scale that does not overflow either axis, preserving the
 * frame's own aspect ratio.
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
