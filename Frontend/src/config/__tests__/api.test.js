/* The backend URL is configurable, and no source file names it inline. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_BASE, apiUrl, baseUrlProblem } from '../api.js';
import { sourceFiles, stripComments } from '../../test/sourceFiles.js';

/* Derived from this file's own location rather than `process.cwd()`, which is not
   a declared global here and makes paths depend on where vitest was started. */
const SRC_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const shortPath = (file) => relative(SRC_ROOT, file);

describe('apiUrl', () => {
  it('builds an absolute URL from a rooted path', () => {
    expect(apiUrl('/api/player/me')).toBe(`${API_BASE}/api/player/me`);
  });

  it('tolerates a path that forgot its leading slash', () => {
    expect(apiUrl('api/player/me')).toBe(`${API_BASE}/api/player/me`);
  });

  it('never produces a double slash', () => {
    // A trailing slash on the configured base is the easy mistake, and
    // `//api/player/me` is not the same URL.
    expect(apiUrl('/api/player/me')).not.toContain('//api');
    expect(API_BASE.endsWith('/')).toBe(false);
  });

  it('defaults to localhost so local development needs no setup', () => {
    // The default is what makes `npm run dev` work out of the box; the production
    // guard in api.js is what stops it shipping silently.
    expect(API_BASE).toMatch(/^https?:\/\//);
  });
});

describe('no source file names the backend host inline', () => {
  /** Everything under src/, minus this config module and the tests. */
  const candidates = sourceFiles().filter((file) => {
    const rel = shortPath(file);
    if (rel.includes('__tests__')) return false;
    return !rel.endsWith('config/api.js');
  });

  it('scans a real set of files (guards against a vacuous run)', () => {
    expect(candidates.length).toBeGreaterThan(20);
  });

  it('leaves no hardcoded localhost:8080 anywhere in the app', () => {
    // Comments stripped: a URL in prose is not a fetch target, and this file's
    // own explanation of the bug mentions the host it forbids.
    const offenders = candidates.filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes('localhost:8080'),
    ).map(shortPath);

    expect(
      offenders,
      'import { apiUrl } from the config module instead - a URL written inline '
      + 'here cannot be pointed at a deployed backend',
    ).toEqual([]);
  });

  it('leaves no other hardcoded http origin either', () => {
    // The narrower check would pass the moment someone typed a different host,
    // which is the same bug with a different string in it.
    const offenders = [];
    for (const file of candidates) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const match of src.matchAll(/https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?/g)) {
        const origin = match[0];
        // XML namespaces and font CDNs are not backend calls.
        if (origin.includes('w3.org') || origin.includes('fonts.googleapis.com')) continue;
        offenders.push(`${shortPath(file)}: ${origin}`);
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});

/*
 * The deployed bundle called `the-invasion-api/api/player/me`, because
 * VITE_API_BASE_URL had been set to the Render service's NAME rather than its
 * address. A bare name is a relative path, so the browser resolved it against
 * the frontend's own origin and every request 404'd on the site itself.
 *
 * The check that existed only asked whether the variable was set, and a name is
 * a perfectly truthy string - so it passed, and the mistake reached production.
 */
describe('what makes a configured backend address unusable', () => {
  it('rejects nothing at all', () => {
    expect(baseUrlProblem(undefined)).toMatch(/not set/i);
    expect(baseUrlProblem('')).toMatch(/not set/i);
  });

  it('rejects a bare name, which is the mistake that shipped', () => {
    expect(baseUrlProblem('the-invasion-api')).toMatch(/relative path/i);
  });

  it('rejects a host with no scheme', () => {
    expect(baseUrlProblem('the-invasion-api.onrender.com')).toMatch(/relative path/i);
  });

  it('rejects a leading-slash path, which is also relative to this site', () => {
    expect(baseUrlProblem('/api')).toMatch(/relative path/i);
  });

  it('accepts a real address', () => {
    expect(baseUrlProblem('https://the-invasion-api.onrender.com')).toBeNull();
    expect(baseUrlProblem('http://localhost:8080')).toBeNull();
  });

  it('names the offending value, so the message says what to change', () => {
    expect(baseUrlProblem('the-invasion-api')).toContain('the-invasion-api');
  });
});
