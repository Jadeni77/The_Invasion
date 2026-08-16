import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Not `fileURLToPath(new URL('../', import.meta.url))`: Vite's import-analysis
// plugin statically recognizes that exact `new URL(literal, import.meta.url)`
// syntax as its documented asset-URL pattern and rewrites it to a dev-server
// URL (e.g. http://localhost:3000/...) at transform time, for every module it
// transforms, including this one under Vitest. fileURLToPath then throws
// because the rewritten URL is http:, not file:. node:path composition avoids
// the rewrite (same fix as tokens.test.js, fonts.test.js and noRawColours.test.js).
const here = dirname(fileURLToPath(import.meta.url));
const drawsDir = join(here, '..') + '/';
const logicDir = join(here, '..', '..', '..') + '/';

const FILES = [
  ...readdirSync(drawsDir).filter((f) => f.endsWith('.js')).map((f) => drawsDir + f),
  logicDir + 'GameEngine.js',
  logicDir + 'EnemyUnits.js',
  logicDir + 'DefenderUnits.js',
];

/** A literal assigned to a canvas colour property, e.g. ctx.fillStyle = "#fff". */
const LITERAL_ASSIGN = /\.(fillStyle|strokeStyle|shadowColor)\s*=\s*['"`]/g;

describe('canvas drawing uses tokens, not raw colours', () => {
  it('finds drawing files to check', () => {
    expect(FILES.length).toBeGreaterThan(4);
  });

  it.each(FILES)('%s assigns no colour literal', (path) => {
    const src = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const hits = [...src.matchAll(LITERAL_ASSIGN)].map((m) => m[0]);
    expect(hits, `${path} has ${hits.length} literal colour assignments`).toEqual([]);
  });
});
