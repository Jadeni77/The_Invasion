/*
 * Noticing that the game has been redeployed underneath you.
 *
 * Merging to main publishes a new build immediately, and an open tab keeps
 * running the one it loaded - Cloudflare serves old asset URLs alongside the
 * new ones, so nothing breaks and nobody is interrupted. The cost is the
 * opposite problem: a player can sit on a build from days ago and never know.
 *
 * So the tab asks. It carries the id of the build it came from, and compares it
 * against the one being served now.
 */

/* Replaced at build time by vite.config.js. Undefined under plain node. */
/* global __BUILD_ID__ */
export const BUILD_ID =
  typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'development';

/** How often a tab asks whether it has been superseded. */
export const UPDATE_POLL_MS = 5 * 60 * 1000;

/**
 * Whether `deployed` is a different build from the one running.
 *
 * Anything unknown means no: a failed fetch, a missing file, and the dev server
 * (which serves no version.json at all) must never nag. Only a build id that is
 * present, valid and genuinely different counts.
 */
export function updateAvailable(deployed, current = BUILD_ID) {
  if (!deployed || typeof deployed !== 'string') return false;
  if (!current || current === 'development') return false;
  return deployed !== current;
}

/**
 * The build id currently being served, or null if it cannot be determined.
 *
 * Cache-busted twice over - a query parameter and `no-store` - because the
 * whole point is to bypass whatever the browser and the CDN are holding.
 */
export async function fetchDeployedBuildId(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response?.ok) return null;
    const data = await response.json();
    return typeof data?.buildId === 'string' ? data.buildId : null;
  } catch {
    // Offline, or the file is not there. Silence is right: this is a courtesy,
    // not a feature the player is waiting on.
    return null;
  }
}
