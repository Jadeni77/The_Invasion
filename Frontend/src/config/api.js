/*
 * Where the backend lives. Every fetch in this app used to name
 * `http://localhost:8080` inline - twenty-one times across three source files
 * - which means the build works on a developer's machine and fails on any real
 * domain, silently and everywhere at once.
 */

const DEFAULT_BASE = 'http://localhost:8080';

/** Trailing slashes are easy to add by accident and produce `//api/...`. */
function normalise(base) {
  return String(base).replace(/\/+$/, '');
}

const configured = import.meta.env?.VITE_API_BASE_URL;

/**
 * What is wrong with a configured base, or null if nothing is.
 *
 * Exported so it can be tested for what it decides rather than for the words it
 * uses. Two ways to get this wrong, and both produce a build that looks fine:
 *
 * - Unset. Every request goes to localhost, which exists for nobody but the
 *   developer who built it.
 * - Set to a bare name. `the-invasion-api` is a RELATIVE path, so the browser
 *   resolves it against the frontend's own origin and the game quietly asks
 *   itself for `/the-invasion-api/api/player/me`. This is not hypothetical - it
 *   is what the first deployment shipped, and the old check missed it because a
 *   name is a perfectly truthy string.
 */
export function baseUrlProblem(value) {
  if (!value) {
    return 'VITE_API_BASE_URL is not set, so this production build will call '
      + `${DEFAULT_BASE}, which will not exist for anyone but the developer who `
      + 'built it.';
  }
  if (!/^https?:\/\//i.test(value)) {
    return `VITE_API_BASE_URL is "${value}", which has no http:// or https:// `
      + 'in front of it. A value without one is a relative path, so every '
      + "request will go to this site instead of to the backend - and 404 on "
      + 'a page that does not exist. Use the backend\'s full address.';
  }
  return null;
}

/* Said at module load rather than at the first fetch, by which time the player
   is already looking at a lobby that does not work. */
if (import.meta.env?.PROD) {
  const problem = baseUrlProblem(configured);
  if (problem) console.error(`${problem} See Frontend/.env.example.`);
}

export const API_BASE = normalise(configured || DEFAULT_BASE);

/* Builds a full URL for a backend path. */
export function apiUrl(path) {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${withSlash}`;
}
