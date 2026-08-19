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

/*
 * A production build pointed at localhost is a deployment that appears to work
 * until the first request. Rather than fail at the first fetch - by which time the
 * player is looking at a broken lobby - say so loudly at module load.
 */
if (import.meta.env?.PROD && !configured) {
  console.error(
    'VITE_API_BASE_URL is not set, so this production build will call '
    + `${DEFAULT_BASE}, which will not exist for anyone but the developer who `
    + 'built it. Set it in the build environment (see Frontend/.env.example).',
  );
}

export const API_BASE = normalise(configured || DEFAULT_BASE);

/* Builds a full URL for a backend path. */
export function apiUrl(path) {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${withSlash}`;
}
