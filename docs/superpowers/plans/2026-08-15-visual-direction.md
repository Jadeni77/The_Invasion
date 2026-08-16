# Visual Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game one cartoon-military visual identity, enforced by a token layer that governs both the CSS and the canvas.

**Architecture:** Tokens are defined once in JavaScript and generated into CSS at build time, so the stylesheets and the canvas drawing code read the same source. Two guard tests forbid raw colour literals on either side. The restyle is then applied on top of that foundation, followed by the structural work (lane bands, base presence, card framing) and the sprite-scaling fix.

**Tech Stack:** React 19, Vite 7, Vitest 4 + jsdom, plain CSS, HTML5 canvas.

## Global Constraints

- **No AI attribution anywhere.** No `Co-Authored-By` trailer on commits, no "Generated with Claude Code" in PR bodies, docs or file headers. The repository owner asked for this explicitly.
- **jsdom has no layout engine.** CSS appearance cannot be verified automatically. Never write a test that claims to check how something looks; state the limit instead.
- Vitest runs with `globals: false` — import `describe`/`it`/`expect`/`vi` explicitly.
- Tests live in `__tests__/` beside the source.
- The project relies on `esbuild: { keepNames: true }` in `vite.config.js` because sound resolution keys on `constructor.name`. Do not disturb it.
- `imageSmoothingEnabled = false` is correct for this art and must stay false.
- `font-variant-numeric: tabular-nums` is load-bearing on the game top bar — it stops the readouts shifting as values change width. Preserve it wherever it already appears.
- Every commit must leave the suite green when checked out on its own. If a file outside a task's stated list must change to achieve that, change it and say so in the report.
- Baseline at plan start: **782 tests passing** on `develop`.

---

### Task 1: Token source of truth and generated CSS

**Files:**
- Create: `Frontend/src/style/tokens.js`
- Create: `Frontend/scripts/generate-tokens.mjs`
- Create: `Frontend/src/style/tokens.generated.css`
- Create: `Frontend/src/style/__tests__/tokens.test.js`
- Modify: `Frontend/package.json` (add a `tokens` script)

**Interfaces:**
- Produces: `tokens.js` exporting `colors`, `space`, `radii`, `borders`, `shadows`, `type` as plain objects, plus `cssVariableName(group, key)` returning the kebab-case custom-property name. Every later task consumes these.

**Background:** the interface currently has 162 colour literals across 10 stylesheets and 53 more in canvas drawing code, with no shared definitions. `ctx.fillStyle` cannot resolve `var(--x)`, so a CSS-only token layer would leave the canvas outside it and the two halves would drift. Defining the tokens in JavaScript and generating the CSS keeps one source with two consumers.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/style/__tests__/tokens.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colors, space, radii, borders, shadows, type, cssVariableName } from '../tokens.js';
import { renderTokenCss } from '../../../scripts/generate-tokens.mjs';

const generatedPath = fileURLToPath(new URL('../tokens.generated.css', import.meta.url));

describe('design tokens', () => {
  it('names a custom property from a group and key', () => {
    expect(cssVariableName('colors', 'surfaceBase')).toBe('--colors-surface-base');
    expect(cssVariableName('space', 'lg')).toBe('--space-lg');
  });

  it('defines every group the stylesheets rely on', () => {
    for (const group of [colors, space, radii, borders, shadows, type]) {
      expect(Object.keys(group).length).toBeGreaterThan(0);
    }
  });

  it('gives every colour an explicit value, never undefined', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value, `colors.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the committed CSS matches what the generator produces', () => {
    const onDisk = readFileSync(generatedPath, 'utf8');
    expect(onDisk).toBe(renderTokenCss());
  });
});
```

The last test is the load-bearing one: it fails if someone hand-edits the generated CSS or forgets to regenerate after changing `tokens.js`. Without it the two sources drift, which is the defect this whole task exists to prevent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run src/style/__tests__/tokens.test.js`

Expected: FAIL — cannot resolve `../tokens.js`.

- [ ] **Step 3: Write the token source**

Create `Frontend/src/style/tokens.js`:

```js
/**
 * The single source of truth for every visual constant in the game.
 *
 * CSS reads these through tokens.generated.css; canvas drawing code imports
 * them directly, because ctx.fillStyle cannot resolve a CSS variable. Both
 * consumers read this file, so they cannot drift apart.
 *
 * After editing, run `npm run tokens` to regenerate the stylesheet. A test
 * fails if you forget.
 */

export const colors = {
  surfaceBase:    '#2f2a1d',
  surfacePanel:   '#4a4231',
  surfaceRaised:  '#6b5c40',
  surfaceSunken:  '#241f16',
  edgeOutline:    '#1a160f',
  edgeHighlight:  '#a8906a',
  textPrimary:    '#f5ecd8',
  textMuted:      '#b8a888',
  accentEnergy:   '#ffd700',
  accentDanger:   '#d94f3d',
  accentSuccess:  '#5fa855',
  accentInfo:     '#4a9cc4',
};

export const space = {
  xs: '4px', sm: '8px', md: '12px', lg: '20px', xl: '32px',
};

export const radii = {
  sm: '4px', md: '8px', lg: '14px', pill: '999px',
};

export const borders = {
  thin: '2px', outline: '3px', heavy: '5px',
};

export const shadows = {
  drop:    '0 4px 0 rgba(26, 22, 15, 0.55)',
  panel:   '0 6px 18px rgba(26, 22, 15, 0.45)',
  pressed: 'inset 0 3px 0 rgba(26, 22, 15, 0.45)',
};

export const type = {
  display:       "'Black Ops One', system-ui, sans-serif",
  body:          "system-ui, -apple-system, 'Segoe UI', sans-serif",
  sizeSm:        '12px',
  sizeMd:        '16px',
  sizeLg:        '22px',
  sizeXl:        '34px',
  weightRegular: '400',
  lineTight:     '1.1',
  lineBody:      '1.5',
};

const GROUPS = { colors, space, radii, borders, shadows, type };

/** camelCase key in a group -> the kebab-case custom property name. */
export function cssVariableName(groupName, key) {
  const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--${groupName}-${kebab}`;
}

export { GROUPS };
```

- [ ] **Step 4: Write the generator**

Create `Frontend/scripts/generate-tokens.mjs`:

```js
#!/usr/bin/env node
/**
 * Generates src/style/tokens.generated.css from src/style/tokens.js.
 * Run with `npm run tokens`. A test fails if the committed file is stale.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

const outPath = fileURLToPath(new URL('../src/style/tokens.generated.css', import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(outPath, renderTokenCss(), 'utf8');
  console.log(`wrote ${outPath}`);
}
```

- [ ] **Step 5: Add the script and generate**

In `Frontend/package.json`, add to `"scripts"`:

```json
"tokens": "node scripts/generate-tokens.mjs"
```

Run: `cd Frontend && npm run tokens`

- [ ] **Step 6: Run the tests and commit**

Run: `cd Frontend && npx vitest run src/style/__tests__/tokens.test.js`, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/tokens.js Frontend/scripts/generate-tokens.mjs \
        Frontend/src/style/tokens.generated.css \
        Frontend/src/style/__tests__/tokens.test.js Frontend/package.json
git commit -m "feat: define visual tokens once in JS and generate the CSS

ctx.fillStyle cannot resolve a CSS variable, so a CSS-only token layer would
leave the canvas outside it and the two halves would drift - the failure this
codebase repeats. One source, two consumers, with a test that fails if the
generated sheet goes stale."
```

---

### Task 2: Self-host the display font

**Files:**
- Create: `Frontend/src/assets/fonts/black-ops-one-v20-latin-regular.woff2`
- Create: `Frontend/src/assets/fonts/OFL.txt`
- Create: `Frontend/src/style/fonts.css`
- Create: `Frontend/src/style/__tests__/fonts.test.js`
- Modify: `Frontend/src/main.jsx` (import `fonts.css` and `tokens.generated.css`)

**Interfaces:**
- Consumes: `type.display` from `tokens.js`, which names `'Black Ops One'` first.
- Produces: an `@font-face` rule for `Black Ops One` that later tasks rely on being loadable.

**Background:** `Lobby.css` declares `font-family: "Pixel"` twice, but no font file exists anywhere in the repository, there is no `@font-face` rule and no CDN import — so it has silently fallen back to sans-serif and the game has no typography of its own. The guard test in this task exists specifically so that cannot happen again.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/style/__tests__/fonts.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type } from '../tokens.js';

const fontsCss = readFileSync(fileURLToPath(new URL('../fonts.css', import.meta.url)), 'utf8');

/** Every family named first in a token stack, i.e. the one we intend to use. */
function primaryFamilies() {
  return [type.display, type.body]
    .map((stack) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, ''))
    .filter((family) => !family.startsWith('system-ui'));
}

describe('fonts', () => {
  it('declares an @font-face for every non-system family the tokens name', () => {
    for (const family of primaryFamilies()) {
      expect(fontsCss, `no @font-face for ${family}`).toContain(`font-family: '${family}'`);
    }
  });

  it('points every @font-face at a file that exists', () => {
    const urls = [...fontsCss.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const resolved = fileURLToPath(new URL(url, new URL('../fonts.css', import.meta.url)));
      expect(existsSync(resolved), `missing font file: ${url}`).toBe(true);
    }
  });
});
```

The second test is the one that matters. The "Pixel" bug was a declared family with no file behind it, and nothing noticed for the life of the project.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run src/style/__tests__/fonts.test.js`

Expected: FAIL — cannot read `../fonts.css`.

- [ ] **Step 3: Fetch the font**

Black Ops One is SIL Open Font Licensed. Download the latin regular woff2 and the licence:

```bash
mkdir -p Frontend/src/assets/fonts
curl -fsSL -o Frontend/src/assets/fonts/black-ops-one-v20-latin-regular.woff2 \
  "https://fonts.gstatic.com/s/blackopsone/v20/qWcsB6-ypo7xBdr6Xshe96H3aDvbtw.woff2"
curl -fsSL -o Frontend/src/assets/fonts/OFL.txt \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/blackopsone/OFL.txt"
```

**If either download fails, stop and report BLOCKED.** Do not fall back to a system font and do not leave the family declared without a file — that is exactly the "Pixel" defect this task is fixing. Verify both files are non-empty before continuing.

- [ ] **Step 4: Write the font stylesheet**

Create `Frontend/src/style/fonts.css`:

```css
/*
 * Self-hosted so the game works offline and does not depend on a third party.
 * A test asserts every family named in tokens.js has a rule here and a file
 * behind it - the previous "Pixel" family had neither and silently did nothing.
 */
@font-face {
  font-family: 'Black Ops One';
  src: url('../assets/fonts/black-ops-one-v20-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

- [ ] **Step 5: Import both stylesheets at the app root**

In `Frontend/src/main.jsx`, add these imports above the existing style imports, `tokens.generated.css` first so its custom properties are defined before any stylesheet uses them:

```js
import './style/tokens.generated.css';
import './style/fonts.css';
```

- [ ] **Step 6: Run the tests and commit**

Run: `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/assets/fonts Frontend/src/style/fonts.css \
        Frontend/src/style/__tests__/fonts.test.js Frontend/src/main.jsx
git commit -m "feat: self-host Black Ops One as the display face

The game declared font-family Pixel in two places with no font file, no
@font-face and no CDN import, so it has silently been sans-serif throughout.
The test asserts every family the tokens name has a rule and a file behind it,
so a declared-but-absent font fails loudly instead of degrading in silence."
```

---

### Task 3: Convert the stylesheets to tokens

**Files:**
- Modify: every `.css` file in `Frontend/src/style/` except `tokens.generated.css` and `fonts.css`
- Create: `Frontend/src/style/__tests__/noRawColours.test.js`

**Interfaces:**
- Consumes: the custom properties emitted by `tokens.generated.css`.

**Background:** 162 distinct colour literals across ten stylesheets, in three unrelated palettes. This task replaces them with token references. Where an existing colour has no exact token, choose the nearest token by role rather than adding a token per shade — the point is to collapse 162 values into twelve, not to preserve every one.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/style/__tests__/noRawColours.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const styleDir = fileURLToPath(new URL('../', import.meta.url));

/** Generated or font-only sheets are allowed to hold literals. */
const EXEMPT = new Set(['tokens.generated.css', 'fonts.css']);

const NAMED_ALLOWED = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

function stylesheets() {
  return readdirSync(styleDir).filter((f) => f.endsWith('.css') && !EXEMPT.has(f));
}

function rawColoursIn(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  for (const m of withoutComments.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\brgba?\([^)]*\)/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/\bhsla?\([^)]*\)/g)) found.push(m[0]);
  for (const m of withoutComments.matchAll(/:\s*([a-z]+)\s*[;!]/g)) {
    const word = m[1].toLowerCase();
    if (!NAMED_ALLOWED.has(word) && CSS_NAMED_COLOURS.has(word)) found.push(word);
  }
  return found;
}

/** The named colours actually used in this codebase today, plus common ones. */
const CSS_NAMED_COLOURS = new Set([
  'white', 'black', 'red', 'green', 'blue', 'gold', 'brown', 'gray', 'grey',
  'orange', 'yellow', 'purple', 'pink', 'cyan', 'magenta', 'silver', 'navy',
  'teal', 'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'darkgoldenrod',
  'darkslategray', 'lightgray', 'lightgrey',
]);

describe('stylesheets use tokens, not raw colours', () => {
  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  it.each(stylesheets())('%s contains no raw colour literal', (file) => {
    const found = rawColoursIn(readFileSync(styleDir + file, 'utf8'));
    expect(found, `${file} still has raw colours: ${found.join(', ')}`).toEqual([]);
  });
});

describe('every referenced custom property exists', () => {
  const declared = new Set(
    [...readFileSync(styleDir + 'tokens.generated.css', 'utf8')
      .matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );

  it.each(stylesheets())('%s references only declared properties', (file) => {
    const used = [...readFileSync(styleDir + file, 'utf8')
      .matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((name) => !declared.has(name));
    expect(missing, `${file} uses undeclared: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('numeric readouts keep their tabular figures', () => {
  const gameBoard = readFileSync(styleDir + 'GameBoard.css', 'utf8');

  it('keeps tabular-nums on the top bar', () => {
    expect(gameBoard).toContain('font-variant-numeric: tabular-nums');
  });

  it.each([
    ['.energy-value', '4.5ch'],
    ['.score-value', '6.5ch'],
    ['.health-value', '5.5ch'],
  ])('keeps the reserved width on %s', (selector, width) => {
    const rule = gameBoard.slice(gameBoard.indexOf(selector));
    expect(rule.slice(0, 200)).toContain(width);
  });
});
```

Three things are being guarded here, and the first two are not decoration. `finds stylesheets to check` fails if the directory scan silently matches nothing, which would make every other assertion vacuous. The undeclared-property check catches a typo like `var(--colors-suface-base)`, which CSS ignores in silence and which would otherwise render as an unstyled element nobody notices.

The `tabular-nums` block guards a fix that has already been made once: the top bar used to shift sideways as the energy value changed width, and the reserved `ch` widths are what stop it. A font change is exactly the edit that would quietly undo it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run src/style/__tests__/noRawColours.test.js`

Expected: FAIL on every stylesheet, listing its literals. Record the count from the output.

- [ ] **Step 3: Convert each stylesheet**

Work through the failures one file at a time, replacing each literal with `var(--colors-…)`. Map by role, not by hue:

| Old role | Token |
|---|---|
| Page and board backgrounds (`#1a1a2e`, `#0f3460`) | `var(--colors-surface-base)` |
| Panels, modals, cards at rest (`#16213e`, `#8b6f4b`) | `var(--colors-surface-panel)` |
| Raised controls, buttons (`#d4c0a1`) | `var(--colors-surface-raised)` |
| Wells, slots, disabled states (`#333`) | `var(--colors-surface-sunken)` |
| Body text (`#fff`, `#ffffff`) | `var(--colors-text-primary)` |
| Secondary text (`#ccc`, `#aaa`) | `var(--colors-text-muted)` |
| Energy, currency, stars (`#ffd700`, `#ffcc00`, `#f39c12`) | `var(--colors-accent-energy)` |
| Damage, errors, rejection (`#e74c3c`) | `var(--colors-accent-danger)` |
| Success, rewards (`#4caf50`, `#27ae60`) | `var(--colors-accent-success)` |
| Frost, info (`#3498db`, `#4fc3f7`) | `var(--colors-accent-info)` |

Apply the identity while you are in each file: `var(--borders-outline)` solid `var(--colors-edge-outline)` on interactive elements, `var(--shadows-drop)` beneath them, `var(--radii-lg)` on panels, `var(--type-display)` on headings and numeric readouts.

**Do not remove `font-variant-numeric: tabular-nums` or change the `ch` widths on `.energy-value`, `.score-value` or `.health-value` in `GameBoard.css`.** They stop the top bar shifting as values change width, and a font change is exactly what would silently undo that.

- [ ] **Step 4: Run the tests**

Run: `cd Frontend && npx vitest run src/style/__tests__/noRawColours.test.js` — expect PASS for every file. Then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/style
git commit -m "refactor: convert every stylesheet to design tokens

162 colour literals in three unrelated palettes across ten stylesheets, with
nothing holding them in agreement. They now reference the generated tokens, and
a test derived from the directory listing fails if a new stylesheet arrives
with literals in it."
```

---

### Task 4: Convert canvas drawing to tokens

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawEntities.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawUIs.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawExplosionEffect.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawNegativeEffect.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js`, `EnemyUnits.js`, `DefenderUnits.js` (drawing methods only)
- Create: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/__tests__/noRawCanvasColours.test.js`

**Interfaces:**
- Consumes: `colors` from `Frontend/src/style/tokens.js`.

**Background:** 53 literal colour assignments to `fillStyle` in the game logic, plus `strokeStyle` and `shadowColor`. These are half the game's colour and the half the player looks at most.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/__tests__/noRawCanvasColours.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const drawsDir = fileURLToPath(new URL('../', import.meta.url));
const logicDir = fileURLToPath(new URL('../../../', import.meta.url));

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/__tests__/noRawCanvasColours.test.js"`

Expected: FAIL, reporting counts per file. `GameEngine.js` and the `Draws/` files should account for most of them.

- [ ] **Step 3: Convert the assignments**

In each file, import the palette and replace the literals:

```js
import { colors } from '../../../../style/tokens.js';
```

Adjust the relative depth per file. Then, for example:

```js
ctx.fillStyle = colors.surfacePanel;
ctx.strokeStyle = colors.edgeOutline;
```

Map by role using the same table as Task 3. Where a drawing colour has genuine gameplay meaning that no token covers — the enemy projectile red `#FF4444`, the earthquake browns — use the nearest accent (`accentDanger`, `surfaceRaised`) rather than adding a token. If a colour truly cannot be expressed, **stop and report it** rather than adding a one-off token; a token used once is a literal with extra steps.

Some colours arrive as object properties rather than assignments — the explosion objects carry `color`, `innerColor` and `particleColor`. Convert those construction sites too, even though the regex only catches the assignment form. **Report how many you converted that the test does not catch**, so the gap is on the record.

- [ ] **Step 4: Run the tests**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)"
git commit -m "refactor: draw the canvas from the same tokens as the CSS

53 colour literals lived in the drawing code, which ctx.fillStyle cannot read
from a CSS variable. They now import the token module directly, so the board and
the interface cannot drift apart."
```

---

### Task 5: Integer sprite scaling and a minimum cell that fits the art

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/GridManager.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/DefenderUnits.js` (the `drawImage` call)
- Modify: `Frontend/src/component/GameLogic (MVC)/EnemyUnits.js` (the `drawImage` call)
- Create: `Frontend/src/component/GameLogic (MVC)/__tests__/SpriteScaling.test.js`

**Interfaces:**
- Produces: `SPRITE_NATIVE_PX` exported from `GridManager.js`, the post-crop source size the grid minimum is derived from.

**Background:** the art is pixel art, so `imageSmoothingEnabled = false` is right. But `GridManager` sets `gridSize` to any integer from 40 to 80, sprites are drawn at `this.width`/`this.height` which equal the cell size, and the post-crop art is 48px — so the scale ratio is almost never whole and pixel rows come out uneven.

**Before writing code, establish the real post-crop frame size for both sides.** `AssetManifest.enemies` and `AssetManifest.defenders` were observed to differ — defender entries carry `cropConfig` cropping 48×48 out of a 64px frame, and Basic Zombie's attack sheet is 80×64. Read the manifest and report what each side actually is. If enemies are not 48 after cropping, the constant must accommodate both or the two sides need separate constants; say which you chose and why.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/__tests__/SpriteScaling.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { GridManager, SPRITE_NATIVE_PX } from '../GameEngineBreakDown/InGameManagerHandlers/GridManager.js';

/** Every viewport the game realistically runs at, small to large. */
const VIEWPORTS = [
  [640, 480], [800, 600], [1024, 768], [1280, 720],
  [1440, 900], [1920, 1080], [2560, 1440],
];

describe('sprite scaling', () => {
  it('never produces a cell smaller than the sprite it must hold', () => {
    for (const [w, h] of VIEWPORTS) {
      const grid = new GridManager(w, h, 1);
      expect(grid.gridSize, `${w}x${h}`).toBeGreaterThanOrEqual(SPRITE_NATIVE_PX);
    }
  });

  it('draws at a whole-number scale at every viewport', () => {
    for (const [w, h] of VIEWPORTS) {
      const grid = new GridManager(w, h, 1);
      const scale = Math.floor(grid.gridSize / SPRITE_NATIVE_PX);
      expect(scale, `${w}x${h}`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(scale)).toBe(true);
    }
  });

  it('centres the sprite in its cell on whole pixels', () => {
    const grid = new GridManager(1920, 1080, 1);
    const scale = Math.floor(grid.gridSize / SPRITE_NATIVE_PX);
    const drawn = SPRITE_NATIVE_PX * scale;
    const offset = Math.round((grid.gridSize - drawn) / 2);
    expect(Number.isInteger(offset)).toBe(true);
    expect(offset).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/SpriteScaling.test.js"`

Expected: FAIL — `SPRITE_NATIVE_PX` is not exported, and the minimum cell is 40.

- [ ] **Step 3: Raise the grid minimum**

In `GridManager.js`, add the export near the top of the file:

```js
/**
 * The post-crop size of a sprite frame. Cells never go below this, so the art
 * always draws at a whole-number scale - pixel art at a fractional scale gives
 * uneven pixel rows, which is what this constant exists to prevent.
 */
export const SPRITE_NATIVE_PX = 48;
```

Then replace the playability clamp. Locate it by content — it currently reads:

```js
        if (this.gridSize < 40) {
            this.gridSize = 40; //minimun for playability
        }
```

Replace with:

```js
        if (this.gridSize < SPRITE_NATIVE_PX) {
            this.gridSize = SPRITE_NATIVE_PX; // never smaller than the art it holds
        }
```

- [ ] **Step 4: Draw at integer scale, centred**

In `DefenderUnits.js`, locate the `ctx.drawImage(` call inside the animation-frame branch — it currently passes `this.x, this.y, this.width, this.height`. Replace that call with:

```js
          const scale = Math.max(1, Math.floor(this.width / SPRITE_NATIVE_PX));
          const drawn = SPRITE_NATIVE_PX * scale;
          const insetX = Math.round((this.width - drawn) / 2);
          const insetY = Math.round((this.height - drawn) / 2);
          ctx.drawImage(
            frames[this.animationFrame],
            this.x + insetX,
            this.y + insetY,
            drawn,
            drawn,
          );
```

Add the import at the top of the file:

```js
import { SPRITE_NATIVE_PX } from './GameEngineBreakDown/InGameManagerHandlers/GridManager.js';
```

Apply the same change to the equivalent `ctx.drawImage(` call in `EnemyUnits.js`.

**Watch the horizontal flip.** The draw is wrapped in `ctx.scale(-1, 1)` and `ctx.translate(-this.x * 2 - this.width, 0)`, which is computed from `this.width`. Changing the drawn width without accounting for that will shift flipped sprites sideways. Verify a flipped unit still lands in its cell and report what you found — if the translate needs adjusting, adjust it and say so.

- [ ] **Step 5: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add "Frontend/src/component/GameLogic (MVC)"
git commit -m "fix: draw pixel art at whole-number scale in every cell

Cells were any integer from 40 to 80 while the post-crop art is 48px, so the
scale ratio was almost never whole and nearest-neighbour sampling produced
uneven pixel rows. Sprites now draw at an integer multiple centred in the cell,
and the grid minimum rises to the sprite's own size so it can never overflow."
```

---

### Task 6: Give the battlefield lanes and a base

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/GridManager.js` (lane band drawing)
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawEntities.js` (base rendering)
- Create: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/LaneBands.test.js`

**Interfaces:**
- Consumes: `colors` from `tokens.js`, `SPRITE_NATIVE_PX` and `gridSize`/`gridOffsetX`/`gridOffsetY` from `GridManager`.
- Produces: `GridManager.drawLaneBands(ctx)`.

**Background:** the grid is only visible when highlighted, so the player cannot see which row an enemy is walking down or where a unit may be placed. Permanent low-contrast lane banding is the structural idea borrowed from Plants vs. Zombies' lawn stripes, in this game's own vocabulary.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/LaneBands.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { GridManager } from '../GridManager.js';

function fakeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(),
    set fillStyle(v) { this._fills.push(v); },
    get fillStyle() { return this._fills.at(-1); },
    _fills: [],
  };
}

describe('lane bands', () => {
  it('draws one band per row', () => {
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    expect(ctx.fillRect).toHaveBeenCalledTimes(grid.getRowsForLevel());
  });

  it('alternates between two tones so adjacent rows are distinguishable', () => {
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    const distinct = new Set(ctx._fills);
    expect(distinct.size).toBe(2);
  });

  it('leaves canvas state as it found it', () => {
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('spans the full grid width', () => {
    const grid = new GridManager(1280, 720, 1);
    const ctx = fakeCtx();
    grid.drawLaneBands(ctx);
    const widths = ctx.fillRect.mock.calls.map((c) => c[2]);
    for (const w of widths) expect(w).toBe(grid.getColsForLevel() * grid.gridSize);
  });
});
```

The state-hygiene test is not ceremony: a canvas draw that leaks `fillStyle` has already caused a real bug in this codebase (`CardPieceDrop` leaking `textAlign`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/LaneBands.test.js"`

Expected: FAIL — `drawLaneBands` is not a function.

- [ ] **Step 3: Implement lane bands**

Add to `GridManager.js`, importing `colors` from `../../../../style/tokens.js`:

```js
    /**
     * Alternating bands, one per row, drawn under everything else. The grid is
     * otherwise invisible unless highlighted, which leaves the player guessing
     * which row an enemy is in and where a unit may be placed.
     */
    drawLaneBands(ctx) {
        const rows = this.getRowsForLevel();
        const width = this.getColsForLevel() * this.gridSize;
        ctx.save();
        for (let row = 0; row < rows; row++) {
            ctx.fillStyle = row % 2 === 0 ? colors.surfaceBase : colors.surfaceSunken;
            ctx.fillRect(
                this.gridOffsetX,
                this.gridOffsetY + row * this.gridSize,
                width,
                this.gridSize,
            );
        }
        ctx.restore();
    }
```

If `getColsForLevel` does not exist under that name, use whatever the file already uses to compute columns — read the file rather than assuming, and report the name you found.

- [ ] **Step 4: Call it from the draw loop**

In `GameEngine.js`, find where the frame is drawn and the grid is rendered. Call `this.gridManager.drawLaneBands(ctx)` **before** entities are drawn, so the bands sit underneath. Report the call site you chose.

- [ ] **Step 5: Give the base visual weight**

Add to `DrawEntities.js`, importing `colors` from `'../../../../style/tokens.js'`:

```js
    /**
     * The defended edge, drawn as a structure rather than an implied boundary.
     * Occupies the strip left of the grid, so it meets the playfield exactly.
     */
    drawBase(ctx) {
        const grid = this.gameEngine.gridManager;
        if (!grid) return;

        const width = grid.gridOffsetX;
        const height = grid.getRowsForLevel() * grid.gridSize;
        if (width <= 0) return;

        ctx.save();

        ctx.fillStyle = colors.surfacePanel;
        ctx.fillRect(0, grid.gridOffsetY, width, height);

        // Inner highlight, so the wall reads as lit from the playfield side.
        ctx.fillStyle = colors.edgeHighlight;
        ctx.fillRect(width - 6, grid.gridOffsetY, 6, height);

        ctx.strokeStyle = colors.edgeOutline;
        ctx.lineWidth = 5;
        ctx.strokeRect(0, grid.gridOffsetY, width, height);

        ctx.restore();
    }
```

Call it from the same draw pass as the lane bands, after them and before the units, so it sits under everything that moves. If `gridOffsetX` is zero at some viewport the base has no room and the early return keeps it from drawing a degenerate rectangle — report whether that happens at any viewport in the sprite-scaling test's list.

- [ ] **Step 6: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add "Frontend/src/component/GameLogic (MVC)"
git commit -m "feat: band the lanes and give the base a body

The grid was invisible unless highlighted, so the player could not see which row
an enemy was in or where a unit could go. Alternating bands make the playfield
legible, and the defended edge is now a structure rather than an implied line."
```

---

### Task 7: Cards as physical objects

**Files:**
- Modify: `Frontend/src/style/Card.css`
- Modify: `Frontend/src/style/CardSelectionModal.css`
- Create: `Frontend/src/style/__tests__/cardTokens.test.js`

**Interfaces:**
- Consumes: the generated custom properties.

**Background:** the structural idea borrowed from seed packets is that a card reads as a physical object you pick up, with its readiness visible on the object itself rather than in a separate indicator.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/style/__tests__/cardTokens.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../Card.css', import.meta.url)), 'utf8');

describe('card styling', () => {
  it('gives the card a thick outline from the token layer', () => {
    expect(css).toMatch(/var\(--borders-(outline|heavy)\)/);
    expect(css).toContain('var(--colors-edge-outline)');
  });

  it('lifts the card off the surface with the shared drop shadow', () => {
    expect(css).toContain('var(--shadows-drop)');
  });

  it('shows cooldown on the card itself, not beside it', () => {
    expect(css).toMatch(/\.card-cooldown|\.cooldown-sweep/);
  });

  it('presses the card in rather than only tinting it', () => {
    expect(css).toContain('var(--shadows-pressed)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run src/style/__tests__/cardTokens.test.js`

Expected: FAIL on all four.

- [ ] **Step 3: Style the card as an object**

In `Card.css`:

```css
.card {
  background: var(--colors-surface-raised);
  border: var(--borders-outline) solid var(--colors-edge-outline);
  border-radius: var(--radii-md);
  box-shadow: var(--shadows-drop);
  font-family: var(--type-display);
  color: var(--colors-text-primary);
  position: relative;
  overflow: hidden;
  transition: transform 60ms ease-out, box-shadow 60ms ease-out;
}

.card:active {
  transform: translateY(2px);
  box-shadow: var(--shadows-pressed);
}

/*
 * Recharge shown on the card itself rather than beside it. The angle comes
 * from --sweep-angle, which the component sets from its cooldown fraction.
 */
.cooldown-sweep {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: conic-gradient(
    var(--colors-surface-sunken) var(--sweep-angle, 0deg),
    transparent var(--sweep-angle, 0deg)
  );
  opacity: 0.72;
}
```

`--sweep-angle` defaults to `0deg`, so a card whose component never sets it renders fully ready rather than fully obscured. That default matters: the failure mode of the opposite default is every card looking permanently disabled.

**Check whether the card component already has cooldown state available before adding markup.** If the component does not currently expose a cooldown fraction, style the sweep and report that wiring it needs a component change, rather than inventing a data source.

- [ ] **Step 4: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style
git commit -m "feat: make cards read as objects you pick up

A card is now outlined, lifted and pressable, with recharge shown on the card
itself rather than beside it - the seed-packet idea in this game's vocabulary."
```

---

### Task 8: Lobby settings button and star styling

**Files:**
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Modify: `Frontend/src/style/Lobby.css`
- Modify: `Frontend/src/style/GameBoard.css`
- Create: `Frontend/src/component/GameRendering/__tests__/LobbySettings.test.jsx`

**Interfaces:**
- Consumes: the existing `SettingModal` component and whatever open/close state the game top bar's settings button already uses.

**Background:** a settings button exists in the game top bar but not in the lobby, and there is now audio worth configuring before a run rather than during one. Stars already render in both places — `Lobby.jsx` draws a five-star row per level and `GameBoard.jsx` shows a count on the results screen — so they need the new treatment, not new behaviour.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/LobbySettings.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lobby = readFileSync(fileURLToPath(new URL('../Lobby.jsx', import.meta.url)), 'utf8');

describe('lobby settings', () => {
  it('renders a settings control', () => {
    expect(lobby).toMatch(/settings-button|SettingModal/);
  });

  it('can open the settings modal', () => {
    expect(lobby).toContain('SettingModal');
  });
});
```

This is a source-shape test rather than a render test, because `Lobby.jsx` pulls in game context and asset loading that a unit test cannot cheaply stand up. **Say so in the report** — a source-shape assertion is weaker than a render assertion and should not be presented as equivalent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/LobbySettings.test.jsx"`

Expected: FAIL — `Lobby.jsx` does not mention `SettingModal`.

- [ ] **Step 3: Add the button**

In `Lobby.jsx`, import `SettingModal` and add local open state, following the pattern the game top bar already uses in `GameBoard.jsx` — read that first and match it rather than inventing a second convention. Place the button in the lobby's top-right corner.

- [ ] **Step 4: Style the stars**

In `Lobby.css` — the existing markup is a `.stars` container of `.star` spans, where an earned one carries `.earned`:

```css
.stars {
  display: flex;
  gap: var(--space-xs);
  justify-content: center;
}

.star {
  color: var(--colors-surface-sunken);
  text-shadow: 0 1px 0 var(--colors-edge-outline);
  font-size: var(--type-size-md);
  line-height: 1;
}

.star.earned {
  color: var(--colors-accent-energy);
  text-shadow: 0 2px 0 var(--colors-edge-outline);
}
```

In `GameBoard.css`, give the results-screen star count the display face:

```css
.stars-value {
  font-family: var(--type-display);
  font-size: var(--type-size-xl);
  color: var(--colors-accent-energy);
  line-height: var(--type-line-tight);
}
```

Do not change the star *count* logic in either file's component. Stars are already computed, stored and rendered; this task styles them and nothing more.

- [ ] **Step 5: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/component/GameRendering Frontend/src/style
git commit -m "feat: put settings in the lobby and style the star ratings

Settings existed only inside a run, which is the wrong moment to set audio
levels. Stars already rendered in the lobby and on the results screen; they now
carry the token treatment."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

- [ ] **Confirm the token layer is airtight**

Both guard tests must pass, and both must be non-vacuous — confirm each still fails when a literal is deliberately reintroduced, then restore.

- [ ] **Confirm each success criterion from the spec**

1. Every screen reads as one game rather than three.
2. No stylesheet outside `tokens.generated.css` contains a raw colour literal.
3. The game has a real display font, and it is actually loaded.
4. Pixel art is crisp at every window size the game supports.
5. Lane bands make the grid legible without needing to be highlighted.
6. The base reads as a place being defended.
7. Cards read as physical objects, with cooldown visible on the card.
8. The lobby has a settings button.
9. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 1, 3, 4, 5, 6 and 7 are visual only — jsdom has no layout engine and cannot confirm any of them. The owner confirms them by looking. State this plainly rather than implying the suite covers appearance.
