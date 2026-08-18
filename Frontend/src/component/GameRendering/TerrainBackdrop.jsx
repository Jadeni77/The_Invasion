/**
 * A full-screen painted backdrop for the screens that are not the map.
 *
 * The settings, upgrade, achievement and collection screens each replace the
 * lobby outright, so there was nothing of the game behind them and all four read
 * as a blank page with a panel floating on it. They render the SAME hills the
 * campaign map is drawn from, from the same generator, so they belong to the same
 * world rather than merely resembling it.
 */
import React from 'react';
import '../../style/TerrainBackdrop.css';
import {
  RIDGE_HEIGHT,
  FOREGROUND_HEIGHT,
  ridgeFarPath,
  ridgeNearPath,
  foregroundPath,
} from './terrainSilhouette.js';

/*
 * `preserveAspectRatio="xMidYMax slice"`, NOT `none`. On the map each region's
 * viewBox width equals its rendered width, so `none` is exactly 1:1; this
 * backdrop is whatever the window happens to be, and `none` would stretch the
 * hills by the window's aspect ratio - the bug that had every region's ridgeline
 * at a different size.
 */
const BACKDROP_WIDTH = 1600;

export default function GameBackdrop() {
  return (
      <div className="game-backdrop" aria-hidden="true">
        <svg
            className="game-backdrop-ridge"
            viewBox={`0 0 ${BACKDROP_WIDTH} ${RIDGE_HEIGHT}`}
            preserveAspectRatio="xMidYMax slice"
        >
          <path d={ridgeFarPath(0, BACKDROP_WIDTH)} fill="var(--terrain-ridge-far)" />
          <path d={ridgeNearPath(0, BACKDROP_WIDTH)} fill="var(--terrain-ridge-near)" />
        </svg>
        <svg
            className="game-backdrop-fore"
            viewBox={`0 0 ${BACKDROP_WIDTH} ${FOREGROUND_HEIGHT}`}
            preserveAspectRatio="xMidYMax slice"
        >
          <path d={foregroundPath(0, BACKDROP_WIDTH)} fill="var(--terrain-foreground)" />
        </svg>
      </div>
  );
}
