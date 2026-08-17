#!/usr/bin/env node
/**
 * Generates src/style/tokens.generated.css from src/style/tokens.js.
 * Run with `npm run tokens`. A test fails if the committed file is stale.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GROUPS, cssVariableName } from '../src/style/tokens.js';

const HEADER = [
  '/*',
  ' * GENERATED FILE - DO NOT EDIT.',
  ' * Source: src/style/tokens.js. Regenerate with `npm run tokens`.',
  ' */',
  '',
].join('\n');

export function renderTokenCss() {
  const lines = [HEADER, ':root {'];
  for (const [groupName, group] of Object.entries(GROUPS)) {
    lines.push(`  /* ${groupName} */`);
    for (const [key, value] of Object.entries(group)) {
      lines.push(`  ${cssVariableName(groupName, key)}: ${value};`);
    }
  }
  lines.push('}', '');
  return lines.join('\n');
}

// Deliberately not `new URL('../src/style/tokens.generated.css', import.meta.url)`:
// Vite's import-analysis plugin statically recognizes that exact
// `new URL(literal, import.meta.url)` syntax as its documented asset-URL
// pattern and rewrites it to a dev-server URL (e.g. http://localhost:3000/...)
// at transform time - it does this for every module Vite transforms,
// including this one when Vitest imports it. fileURLToPath then throws
// "The URL must be of scheme file" because the rewritten URL is http:, not
// file:. Building the path with node:path instead avoids that rewrite.
const thisFile = fileURLToPath(import.meta.url);
const outPath = join(dirname(thisFile), '../src/style/tokens.generated.css');

if (process.argv[1] === thisFile) {
  writeFileSync(outPath, renderTokenCss(), 'utf8');
  console.log(`wrote ${outPath}`);
}
