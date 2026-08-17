# Lobby Campaign Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the lobby from a flat board with features on it into a campaign map the player advances across.

**Architecture:** Collapse the competing CSS rules first, then build terrain, depth and a route in CSS and SVG to replace three background images that never existed. The level path gains vertical amplitude and pans, opening on the player's next playable level.

**Tech Stack:** React 19, Vite 7, Vitest 4 + jsdom, plain CSS, inline SVG.

**Visual reference:** `docs/superpowers/reference/2026-08-17-lobby-campaign-map-mockup.html` — open it in a browser. The owner approved this mockup; it is the target. Match its intent, not its pixels.

## Global Constraints

- **No AI attribution anywhere.** No `Co-Authored-By` trailer, no "Generated with Claude Code" line, no attribution in reports or file headers. The repository owner asked for this explicitly.
- Vitest runs with `globals: false` — import `describe`/`it`/`expect`/`vi` explicitly.
- Tests live in `__tests__/` beside the source.
- Tokens come from `Frontend/src/style/tokens.js`, generated into `tokens.generated.css` by `npm run tokens`. **Never hand-edit the generated file** — a test fails if it goes stale. Need a new token? Add it to `tokens.js` and regenerate.
- **No semantic accent token (`--colors-accent-*`) may be used as a page-scale surface.** That rule is why the board is currently a flat green rectangle.
- `decorative` tokens are explicitly non-semantic; do not use them to carry meaning.
- Existing guards must keep passing: token staleness, font existence, no raw colour literal in CSS or JS/JSX, declared custom properties, WCAG contrast with its pinned opt-out list, heading foreground colour, no raw canvas colour, sprite scaling, sample provenance.
- **jsdom has no layout engine or rasteriser.** No test can confirm appearance. Never write one that implies it; say so instead.
- Every commit must leave the suite green when checked out on its own.
- Baseline at plan start: **1337 tests passing** on `develop`.
- The working tree carries one pre-existing uncommitted edit to `GameLevelConfigs.js` — the owner's playtest hack. Do not commit, stash or revert it.

## Facts established against the real source

Do not re-derive these; they were verified while writing this plan.

- `.lobby-container` is declared **three times** in `Lobby.css` (lines 1, 156, 496). The third uses the `background` shorthand, which erases the other two.
- `.game-map` is declared **twice** — one rule sets `width: 80%; max-width: 800px; background-color: var(--colors-accent-success)`, another sets `height: 60vh; width: 100%; overflow: hidden` with a `surface-sunken` wash.
- **Three referenced images do not exist:** `/assets/lobby-bg.jpg` (`.lobby-container`), `/assets/map-bg.png` (`.game-map`, tiled at `background-size: 200px`), `/assets/level-node.png` (`.level-node`). `public/` contains only `vite.svg`.
- `getLevelStatus(levelId, playerData)` in `MapLayout.jsx` returns `{ locked, completed, stars, available }` — the three node states already exist.
- `zoneConfigs` is `{ tutorial|early|mid|late|endgame|endless: { nodeClass } }`. Colour lives in `Lobby.css`; the inline colour mechanism was deliberately removed and must not come back.
- `Lobby.jsx` holds `mapContainerRef` on `.game-map-container` and `mapRef` on `.game-map`.
- `mapSettings` exposes `mapWidth: 2200`, `mapHeight: 600`, `defaultZoom` — **used** — plus `initialPosition`, `autoCameraEnabled`, `cameraFollowPlayer`, `smoothScrollDuration`, `zoomLevels`, `scrollSpeed`, `edgePadding`, `viewportWidth`, `viewportHeight`, which are **dead config**.
- `Frontend/src/test/sourceFiles.js` exports `stylesheetFiles()`, which walks `src/` recursively and identifies token/font sheets by content. Reuse it; do not hand-list files.

---

### Task 1: Collapse the cascade and guard missing assets

**Files:**
- Modify: `Frontend/src/style/Lobby.css`
- Create: `Frontend/src/style/__tests__/assetUrls.test.js`
- Create: `Frontend/src/style/__tests__/lobbyCascade.test.js`

**Interfaces:**
- Produces: a single `.lobby-container` rule and a single `.game-map` rule. Later tasks assume one of each.

**Background:** the lobby's appearance is currently decided by which duplicate rule happens to come last. Until that is fixed, every later change lands on sand.

- [ ] **Step 1: Write the failing tests**

Create `Frontend/src/style/__tests__/assetUrls.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stylesheetFiles } from '../../test/sourceFiles.js';

// dirname(fileURLToPath(import.meta.url)), not import.meta.dirname: Vite's
// import-analysis rewrites some import.meta forms, and this is the pattern
// every existing test in this repo uses.
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, '..', '..', '..', 'public');

/** Every url() in a stylesheet, paired with the file it should resolve to. */
function urlTargets(cssPath) {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/g)]
    .map((m) => m[1].trim())
    .filter((url) => !url.startsWith('data:') && !url.startsWith('http'))
    .map((url) => ({
      url,
      // A leading slash is served from public/; anything else is relative to the sheet.
      file: url.startsWith('/') ? join(PUBLIC_DIR, url) : resolve(dirname(cssPath), url),
    }));
}

describe('every stylesheet url() resolves to a file that exists', () => {
  const sheets = stylesheetFiles();

  it('finds stylesheets to check', () => {
    expect(sheets.length).toBeGreaterThan(5);
  });

  it.each(sheets)('%s references no missing file', (sheet) => {
    const missing = urlTargets(sheet)
      .filter(({ file }) => !existsSync(file))
      .map(({ url }) => url);
    expect(missing, `${sheet} references missing: ${missing.join(', ')}`).toEqual([]);
  });
});
```

Create `Frontend/src/style/__tests__/lobbyCascade.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'Lobby.css'), 'utf8');

/** Count top-level rule blocks opening with exactly this selector. */
function declarationsOf(selector) {
  const pattern = new RegExp(`^\\s*${selector.replace('.', '\\.')}\\s*\\{`, 'gm');
  return (css.match(pattern) ?? []).length;
}

describe('the lobby has one rule per container, not several fighting', () => {
  it('declares .lobby-container exactly once', () => {
    expect(declarationsOf('.lobby-container')).toBe(1);
  });

  it('declares .game-map exactly once', () => {
    expect(declarationsOf('.game-map')).toBe(1);
  });

  it('uses no accent token as the map surface', () => {
    const rule = css.slice(css.search(/^\s*\.game-map\s*\{/m));
    expect(rule.slice(0, 400)).not.toMatch(/--colors-accent-/);
  });
});
```

The third test is the one that stops the board being a flat green rectangle again. `accent-success` is the confirmation colour; a page-scale surface is not a confirmation.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Frontend && npx vitest run src/style/__tests__/assetUrls.test.js src/style/__tests__/lobbyCascade.test.js`

Expected: the asset test fails naming `/assets/lobby-bg.jpg`, `/assets/map-bg.png` and `/assets/level-node.png`; the cascade test fails with 3 and 2 declarations.

- [ ] **Step 3: Collapse `.lobby-container`**

Merge the three rules into one, keeping the layout that actually works and dropping the dead image. Replace all three with a single rule:

```css
.lobby-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  height: 100vh;
  padding: var(--space-md);
  background: var(--colors-surface-base);
  font-family: var(--type-display);
  color: var(--colors-text-primary);
  box-sizing: border-box;
}
```

Note what changed and why: **`overflow: hidden` is gone from the page container** — it is what clipped the top bar. Overflow moves onto the map viewport in Task 4. The page background is now a deliberate warm neutral so the map is the focal point rather than competing with it.

- [ ] **Step 4: Collapse `.game-map` and drop the dead texture**

Merge the two `.game-map` rules into one, removing `background-image: url("/assets/map-bg.png")`, its `background-size: 200px`, and the `accent-success` background:

```css
.game-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--colors-surface-sunken);
}
```

Size and overflow move to the viewport wrapper in Task 4; this element becomes the terrain canvas itself.

- [ ] **Step 5: Remove the dead node image**

In the `.level-node` rule, delete `background: url("/assets/level-node.png") center/contain no-repeat;`. Task 3 gives nodes a real appearance. Leave the rest of the rule alone for now.

- [ ] **Step 6: Run the tests and commit**

Run the two targeted files, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/Lobby.css Frontend/src/style/__tests__/assetUrls.test.js \
        Frontend/src/style/__tests__/lobbyCascade.test.js
git commit -m "fix: give the lobby one container rule and stop referencing missing art

The lobby declared .lobby-container three times and .game-map twice, so its
appearance was decided by whichever duplicate came last - a purple gradient
from decorative tokens, over a surface colour, over a background image that
does not exist. Three referenced images never existed at all, which is why the
page fell through to a flat colour, the map to a flat rectangle and the nodes
to plain circles.

The url() guard closes the gap that let all three sit unnoticed: the font test
verified @font-face urls resolved, and nothing checked background-image."
```

---

### Task 2: Build the terrain

**Files:**
- Modify: `Frontend/src/style/Lobby.css`
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Create: `Frontend/src/component/GameRendering/__tests__/TerrainLayers.test.jsx`

**Interfaces:**
- Consumes: the single `.game-map` rule from Task 1; `zoneConfigs` keys from `MapLayout.jsx`.
- Produces: `.zone-background.zone-<key>` backdrops carrying ground, a `.zone-ridge` element per region and a `.zone-fore` element per region. Task 6 places props inside these.

**Background:** three background images never existed, so the map has no material at all. This task supplies ground, depth and framing in CSS and SVG. The owner's one correction to the first mockup was *"there are a lot of empty spaces"* — the ridgeline and foreground bands are what fill the top and bottom.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/TerrainLayers.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zoneConfigs } from '../MapLayout.jsx';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');
const jsx = readFileSync(join(here, '..', 'Lobby.jsx'), 'utf8');

/** Zones that appear on the terrain. The endless portal is not a region. */
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((z) => z !== 'endless');

describe('terrain', () => {
  it('gives every terrain zone its own ground rule', () => {
    for (const zone of TERRAIN_ZONES) {
      expect(css, `no .zone-${zone} rule`).toMatch(
        new RegExp(`\\.zone-${zone}\\s*\\{[^}]*background`, 's'),
      );
    }
  });

  it('renders a ridgeline and a foreground band per region', () => {
    expect(jsx).toContain('zone-ridge');
    expect(jsx).toContain('zone-fore');
  });

  it('gives regions distinct ground, so progression is visible', () => {
    const grounds = TERRAIN_ZONES.map((zone) => {
      const m = css.match(new RegExp(`\\.zone-${zone}\\s*\\{([^}]*)\\}`, 's'));
      return m ? m[1].replace(/\s+/g, '') : zone;
    });
    expect(new Set(grounds).size).toBe(TERRAIN_ZONES.length);
  });

  it('uses no accent token for ground', () => {
    for (const zone of TERRAIN_ZONES) {
      const m = css.match(new RegExp(`\\.zone-${zone}\\s*\\{([^}]*)\\}`, 's'));
      expect(m?.[1] ?? '', `.zone-${zone}`).not.toMatch(/--colors-accent-/);
    }
  });

  it('darkens the vignette over the terrain rather than the page', () => {
    expect(css).toMatch(/\.game-map::after\s*\{[^}]*radial-gradient/s);
  });
});
```

The third test is the load-bearing one: five regions that all resolve to the same ground would satisfy every other assertion while showing no progression at all.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/TerrainLayers.test.jsx"`

Expected: FAIL on the missing `.zone-*` ground rules and the absent ridge/fore elements.

- [ ] **Step 3: Give each region its ground**

In `Lobby.css`, replace the existing `.zone-background` colour rules with ground that progresses. Add a repeating pattern for grain over a vertical gradient for surface:

```css
.zone-background {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
}

.zone-tutorial {
  background:
    repeating-linear-gradient(58deg, color-mix(in srgb, var(--colors-accent-success) 5%, transparent) 0 3px, transparent 3px 10px),
    linear-gradient(180deg, var(--terrain-ground-1-top) 0%, var(--terrain-ground-1-mid) 42%, var(--terrain-ground-1-bot) 100%);
}
.zone-early {
  background:
    repeating-linear-gradient(58deg, color-mix(in srgb, var(--colors-edge-highlight) 5%, transparent) 0 3px, transparent 3px 10px),
    linear-gradient(180deg, var(--terrain-ground-2-top) 0%, var(--terrain-ground-2-mid) 42%, var(--terrain-ground-2-bot) 100%);
}
.zone-mid {
  background:
    repeating-linear-gradient(58deg, color-mix(in srgb, var(--colors-edge-highlight) 4%, transparent) 0 3px, transparent 3px 10px),
    linear-gradient(180deg, var(--terrain-ground-3-top) 0%, var(--terrain-ground-3-mid) 42%, var(--terrain-ground-3-bot) 100%);
}
.zone-late {
  background:
    repeating-linear-gradient(58deg, color-mix(in srgb, var(--colors-accent-danger) 5%, transparent) 0 3px, transparent 3px 10px),
    linear-gradient(180deg, var(--terrain-ground-4-top) 0%, var(--terrain-ground-4-mid) 42%, var(--terrain-ground-4-bot) 100%);
}
.zone-endgame {
  background:
    repeating-linear-gradient(58deg, color-mix(in srgb, var(--colors-accent-danger) 6%, transparent) 0 3px, transparent 3px 10px),
    linear-gradient(180deg, var(--terrain-ground-5-top) 0%, var(--terrain-ground-5-mid) 42%, var(--terrain-ground-5-bot) 100%);
}
```

**Add the `terrain` group to `tokens.js` first**, as a sibling export of `colors` and `decorative` — the same shape `decorative` uses — then regenerate with `npm run tokens`. The no-raw-colour guard forbids literals in stylesheets, and these ground shades have no semantic role, so they need their own group rather than a stretched semantic token:

```js
/**
 * Terrain shades for the campaign map. A sibling of `colors`, not part of it:
 * these are ground and scenery, not meaning-bearing, and nothing should reach
 * for `terrain.ground3Mid` expecting it to signify anything.
 */
export const terrain = {
  ground1Top: '#3c4a2c', ground1Mid: '#46552f', ground1Bot: '#39442a',
  ground2Top: '#42392a', ground2Mid: '#544733', ground2Bot: '#3d3427',
  ground3Top: '#3d3226', ground3Mid: '#4b3d2c', ground3Bot: '#352b20',
  ground4Top: '#382a22', ground4Mid: '#46332a', ground4Bot: '#2f231d',
  ground5Top: '#33221d', ground5Mid: '#472e25', ground5Bot: '#2a1b17',
  ridgeFar:  '#2b3520', ridgeNear: '#232c1b', foreground: '#20281a',
  vignette:  '#1a160f',
};
```

Register it in the `GROUPS` map alongside `colors` and `decorative` so the generator emits it. Tasks 3 and 6 add node and prop shades to this same group.

The ground ramps darken and warm as the regions progress, which is what makes distance along the path read as escalation. Do not weaken the colour guard, and do not stretch a semantic token to cover ground.

- [ ] **Step 4: Add the depth layers**

In `Lobby.jsx`, inside each zone backdrop, render a ridgeline above and a foreground band below. Both are inline SVG so they take token colours:

```jsx
<div key={`zone-${zone}`} className={`zone-background zone-${zone}`} style={zoneBounds(zone)}>
  <svg className="zone-ridge" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
    <path d={RIDGE_FAR} fill="var(--terrain-ridge-far)" />
    <path d={RIDGE_NEAR} fill="var(--terrain-ridge-near)" />
  </svg>
  <svg className="zone-fore" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
    <path d={FOREGROUND} fill="var(--terrain-foreground)" />
  </svg>
</div>
```

Define the three path constants once at module scope in `Lobby.jsx`, so they are not repeated per zone:

```js
/** Distant hills. Fills the upper third, which was dead space before. */
const RIDGE_FAR = 'M0,150 L60,110 L120,135 L190,80 L260,120 L330,70 L400,115 L470,85 L540,125 L600,100 L600,200 L0,200Z';
/** Nearer hills, drawn over RIDGE_FAR so the two read as depth. */
const RIDGE_NEAR = 'M0,175 L80,145 L160,168 L240,130 L320,160 L410,125 L500,158 L600,138 L600,200 L0,200Z';
/** Foreground lip. Frames the bottom; nearest, so darkest. */
const FOREGROUND = 'M0,55 Q70,28 150,48 T310,40 T470,52 T600,35 L600,100 L0,100Z';
```

And position them:

```css
.zone-ridge {
  position: absolute;
  left: -2%;
  right: -2%;
  top: 0;
  height: 44%;
  opacity: 0.5;
  pointer-events: none;
}

.zone-fore {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22%;
  pointer-events: none;
}
```

- [ ] **Step 5: Add the vignette**

```css
.game-map::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(130% 100% at 50% 45%, transparent 52%, var(--terrain-vignette) 100%);
}
```

Check the stacking: the vignette must sit above terrain and below nodes. Report the z-index values you settled on.

- [ ] **Step 6: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/Lobby.css Frontend/src/style/tokens.js \
        Frontend/src/style/tokens.generated.css \
        Frontend/src/component/GameRendering/Lobby.jsx \
        Frontend/src/component/GameRendering/__tests__/TerrainLayers.test.jsx
git commit -m "feat: give the lobby map ground, depth and framing

Three background images never existed, so the map had no material at all.
Each region now carries its own ground, progressing from settled green to
scorched, with two ridgeline passes filling the upper third and a foreground
band framing the bottom - the top and bottom being exactly where the owner
reported empty space."
```

---

### Task 3: The route and the nodes

**Files:**
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Modify: `Frontend/src/component/GameRendering/MapLayout.jsx` (node coordinates only)
- Modify: `Frontend/src/style/Lobby.css`
- Create: `Frontend/src/component/GameRendering/__tests__/RouteAndNodes.test.jsx`

**Interfaces:**
- Consumes: `getLevelStatus(levelId, playerData)` returning `{ locked, completed, stars, available }`; `levelsMapData` and `connectionsData` from `MapLayout.jsx`.
- Produces: `.level-node` with exactly one of `.completed`, `.available`, `.locked`.

**Background:** the path currently hugs a narrow horizontal band, which is why the vertical space read as empty. Nodes are uniform dark circles on the old green board, so the numbers are hard to read and the next playable level is not obvious.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/RouteAndNodes.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelsMapData } from '../MapLayout.jsx';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

describe('node states', () => {
  it.each(['.level-node.completed', '.level-node.available', '.level-node.locked'])(
    '%s has its own declared appearance',
    (selector) => {
      expect(ruleBody(selector).trim().length, `${selector} has no rule`).toBeGreaterThan(0);
    },
  );

  it('makes the three states visually distinct, not three shades of one', () => {
    const bodies = ['.level-node.completed', '.level-node.available', '.level-node.locked']
      .map((s) => ruleBody(s).replace(/\s+/g, ''));
    expect(new Set(bodies).size).toBe(3);
  });

  it('draws the available node with the energy accent so it reads as next', () => {
    expect(ruleBody('.level-node.available')).toMatch(/--colors-accent-energy/);
  });

  it('gives node numbers the display font', () => {
    expect(ruleBody('.level-node')).toMatch(/--type-display/);
  });

  it('makes a boss node read as fortified, not just red', () => {
    const boss = ruleBody('.level-node.boss');
    expect(boss.trim().length, 'no .level-node.boss rule').toBeGreaterThan(0);
    // Shape and weight, not only hue - a red circle is still a circle.
    expect(boss).toMatch(/border-radius|border-width|--borders-heavy/);
  });

  it('draws chests as landmarks with their own rule', () => {
    expect(ruleBody('.map-chest').trim().length, 'no .map-chest rule').toBeGreaterThan(0);
  });
});

describe('the route uses the full height', () => {
  const ys = levelsMapData.map((l) => l.y);

  it('spans most of the map height rather than a narrow band', () => {
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(spread).toBeGreaterThan(200);
  });

  it('alternates rather than drifting one way', () => {
    let reversals = 0;
    for (let i = 2; i < ys.length; i++) {
      const prev = Math.sign(ys[i - 1] - ys[i - 2]);
      const next = Math.sign(ys[i] - ys[i - 1]);
      if (prev !== 0 && next !== 0 && prev !== next) reversals++;
    }
    expect(reversals).toBeGreaterThan(4);
  });
});
```

The "visually distinct" and "alternates" tests are the load-bearing pair. Three rules that all say the same thing, or a path that slopes gently in one direction, would satisfy every other assertion while leaving the screen exactly as it is.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/RouteAndNodes.test.jsx"`

Expected: FAIL on the missing state rules, and on the route spread if the current `y` values sit in a narrow band. **Record the actual spread and reversal count from the failure output** — that tells you how far the existing path is from the target.

- [ ] **Step 3: Give the nodes three real states**

Replace the `.level-node` rules in `Lobby.css`:

```css
.level-node {
  position: absolute;
  width: 54px;
  height: 54px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--type-display);
  font-size: var(--type-size-md);
  border: var(--borders-outline) solid var(--colors-edge-outline);
  cursor: pointer;
}

.level-node.completed {
  background: radial-gradient(circle at 35% 30%, var(--colors-surface-raised), var(--terrain-node-done));
  color: var(--colors-text-primary);
  box-shadow: var(--shadows-drop);
}

.level-node.available {
  background: radial-gradient(circle at 35% 30%, var(--terrain-node-open), var(--colors-accent-energy));
  color: var(--colors-edge-outline);
  box-shadow: var(--shadows-drop), 0 0 0 6px color-mix(in srgb, var(--colors-accent-energy) 16%, transparent);
}

.level-node.locked {
  background: var(--colors-surface-sunken);
  color: var(--colors-text-muted);
  box-shadow: none;
  cursor: not-allowed;
}
```

The available node is the only one carrying the energy accent, which is what makes "where do I click" answerable without reading.

- [ ] **Step 4: Set the state class from status**

In `Lobby.jsx`, the node className is currently built from `status.locked` alone. Replace it so exactly one state class is applied:

```jsx
const stateClass = status.locked ? 'locked' : status.completed ? 'completed' : 'available';
```

then use `` className={`level-node ${zone.nodeClass} ${stateClass}`} ``. Read the surrounding JSX before editing — other classes may be present and must be preserved.

- [ ] **Step 5: Make boss nodes fortified and chests landmarks**

A boss node that is merely a red circle is still a circle. Give it shape and weight, and give chests a rule of their own so they read as things on the route rather than decoration:

```css
.level-node.boss {
  width: 66px;
  height: 66px;
  border-radius: var(--radii-lg);
  border-width: var(--borders-heavy);
  font-size: var(--type-size-lg);
  background: radial-gradient(circle at 35% 30%, var(--terrain-node-boss), var(--colors-accent-danger));
  color: var(--colors-edge-outline);
}

/* A dashed ring, so a boss reads as a fortified position rather than a stop. */
.level-node.boss::after {
  content: '';
  position: absolute;
  inset: -8px;
  border: var(--borders-thin) dashed color-mix(in srgb, var(--colors-accent-danger) 45%, transparent);
  border-radius: calc(var(--radii-lg) + 4px);
}

.map-chest {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  filter: drop-shadow(0 2px 2px var(--colors-edge-outline));
  pointer-events: none;
}
```

`Lobby.jsx` already renders chests from `chestsData`; give that element the `map-chest` class. Read how it renders today before editing — do not change which chests appear or where.

**On contrast:** the existing WCAG guard measures rules declaring both `color` and `background`. The three node states and the boss rule all declare both, so they are picked up automatically. **Run the contrast test after this step and report the measured ratios** — the available node puts dark text on the energy accent, which is the pairing most likely to fail.

- [ ] **Step 6: Give the route vertical amplitude**

In `MapLayout.jsx`, adjust the `y` values in `levelsMapData` so the path swings between roughly 15% and 85% of `mapHeight` (600), alternating direction between consecutive levels rather than drifting. **Do not change any `x` value, any `id`, any `name`, or `connectionsData`** — only `y`. Report the spread and reversal count you achieved.

- [ ] **Step 7: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/Lobby.css Frontend/src/style/tokens.js \
        Frontend/src/style/tokens.generated.css \
        Frontend/src/component/GameRendering/Lobby.jsx \
        Frontend/src/component/GameRendering/MapLayout.jsx \
        Frontend/src/component/GameRendering/__tests__/RouteAndNodes.test.jsx
git commit -m "feat: swing the route through the full height and give nodes three states

The path hugged a narrow band, which is why the vertical space read as empty,
and every node looked the same so the next playable level was not obvious.
Completed, available and locked are now distinct, and only the available node
carries the energy accent."
```

---

### Task 4: Pan the map and open on the next level

**Files:**
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Modify: `Frontend/src/style/Lobby.css`
- Modify: `Frontend/src/component/GameRendering/MapLayout.jsx` (remove dead config)
- Create: `Frontend/src/component/GameRendering/__tests__/MapPanning.test.jsx`

**Interfaces:**
- Consumes: `mapContainerRef` on `.game-map-container`, `mapRef` on `.game-map`, `getLevelStatus`.
- Produces: `nextPlayableLevelId(playerData)` exported from `MapLayout.jsx`, returning a level id or `null`.

**Background:** the map is wider than its viewport and the overflow is clipped, so levels 15 through 17 are unreachable. Moving overflow onto the viewport is also what un-clips the top bar.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/MapPanning.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextPlayableLevelId, levelsMapData } from '../MapLayout.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

describe('overflow lives on the viewport, not the page', () => {
  it('does not clip the page container', () => {
    expect(ruleBody('.lobby-container')).not.toMatch(/overflow\s*:\s*hidden/);
  });

  it('scrolls the map viewport horizontally', () => {
    expect(ruleBody('.game-map-container')).toMatch(/overflow-x\s*:\s*auto/);
  });
});

describe('nextPlayableLevelId', () => {
  it('is level 1 for a new player', () => {
    expect(nextPlayableLevelId({ unlockedLevels: [1], completedLevels: [] })).toBe(1);
  });

  it('is the first unlocked, uncompleted level', () => {
    expect(nextPlayableLevelId({
      unlockedLevels: [1, 2, 3, 4],
      completedLevels: [1, 2],
    })).toBe(3);
  });

  it('is null when everything unlocked is finished', () => {
    expect(nextPlayableLevelId({ unlockedLevels: [1, 2], completedLevels: [1, 2] })).toBe(null);
  });

  it('never returns a locked level', () => {
    const id = nextPlayableLevelId({ unlockedLevels: [1], completedLevels: [1] });
    expect(id === null || levelsMapData.some((l) => l.id === id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/MapPanning.test.jsx"`

Expected: FAIL — `nextPlayableLevelId` is not exported, and the overflow assertions fail.

- [ ] **Step 3: Export the next playable level**

Add to `MapLayout.jsx`, beside `getLevelStatus`:

```js
/**
 * The level the map should open on: the first unlocked one the player has not
 * finished. Null when they have cleared everything currently unlocked, in
 * which case the caller should fall back to its own default.
 */
export function nextPlayableLevelId(playerData) {
  for (const level of levelsMapData) {
    const status = getLevelStatus(level.id, playerData);
    if (status.available) return level.id;
  }
  return null;
}
```

- [ ] **Step 4: Move overflow to the viewport**

In `Lobby.css`, the `.lobby-container` rule from Task 1 already has no `overflow: hidden`. Give the viewport the scroll instead:

```css
.game-map-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: var(--borders-outline) solid var(--colors-edge-outline);
  border-radius: var(--radii-lg);
  box-shadow: inset 0 0 40px var(--terrain-vignette);
  cursor: grab;
}

.game-map-container:active {
  cursor: grabbing;
}
```

`min-height: 0` matters: without it a flex child refuses to shrink below its content and the map pushes the page taller than the viewport, which is how the clipping started.

- [ ] **Step 5: Open centred on the next playable level**

In `Lobby.jsx`, after the map mounts, set the viewport's scroll so the next playable node is centred. Add drag-to-pan with pointer events:

```jsx
useEffect(() => {
  const viewport = mapContainerRef.current;
  if (!viewport) return;
  const targetId = nextPlayableLevelId(playerData);
  const target = levelsMapData.find((l) => l.id === targetId) ?? levelsMapData[0];
  if (!target) return;
  viewport.scrollLeft = target.x * mapZoom - viewport.clientWidth / 2;
}, [playerData, mapZoom]);
```

Then drag-to-pan:

```jsx
const drag = useRef({ active: false, startX: 0, startScroll: 0 });

const onPointerDown = (e) => {
  const viewport = mapContainerRef.current;
  if (!viewport) return;
  drag.current = { active: true, startX: e.clientX, startScroll: viewport.scrollLeft };
  viewport.setPointerCapture(e.pointerId);
};
const onPointerMove = (e) => {
  const viewport = mapContainerRef.current;
  if (!viewport || !drag.current.active) return;
  viewport.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
};
const onPointerUp = () => { drag.current.active = false; };
```

Attach all three to `.game-map-container`. **A drag must not fire a node click** — check how the node's click handler is wired and report what you did to prevent a pan from launching a level, because that is the bug this interaction always has.

- [ ] **Step 6: Remove the dead camera config**

`mapSettings` in `MapLayout.jsx` exposes `initialPosition`, `autoCameraEnabled`, `cameraFollowPlayer`, `smoothScrollDuration`, `zoomLevels`, `scrollSpeed`, `edgePadding`, `viewportWidth` and `viewportHeight`. **Only `mapWidth`, `mapHeight` and `defaultZoom` are read anywhere.** Delete the unread keys — this codebase has repeatedly had to remove config that looked meaningful and did nothing. Verify with a grep before deleting each, and report which you removed.

- [ ] **Step 7: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/Lobby.css Frontend/src/component/GameRendering/Lobby.jsx \
        Frontend/src/component/GameRendering/MapLayout.jsx \
        Frontend/src/component/GameRendering/__tests__/MapPanning.test.jsx
git commit -m "feat: pan the campaign map, opening on the next playable level

The map was wider than its viewport and the overflow was clipped, so levels 15
to 17 were unreachable. Overflow moves to the viewport, which is also what
un-clips the top bar, and the map opens centred on the level the player can
actually play next. Also removes nine mapSettings keys that nothing read."
```

---

### Task 5: Compact the top chrome into one band

**Files:**
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Modify: `Frontend/src/style/Lobby.css`
- Create: `Frontend/src/component/GameRendering/__tests__/TopBand.test.jsx`

**Interfaces:**
- Consumes: existing player, energy and resource markup in `Lobby.jsx`.
- Produces: a single `.lobby-topband` container holding all three.

**Background:** the player bar, energy panel and resource pills are three stacked blocks consuming roughly a third of the height before the map begins. The map is the screen's subject and should have that space.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/TopBand.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(join(here, '..', 'Lobby.jsx'), 'utf8');
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

describe('top chrome is one band', () => {
  it('renders a single band container', () => {
    expect(jsx).toContain('lobby-topband');
  });

  it('lays the band out as a row', () => {
    const body = ruleBody('.lobby-topband');
    expect(body).toMatch(/display\s*:\s*flex/);
    expect(body).not.toMatch(/flex-direction\s*:\s*column/);
  });

  it('does not let the band grow at the map\'s expense', () => {
    expect(ruleBody('.lobby-topband')).toMatch(/flex\s*:\s*0 0 auto/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/TopBand.test.jsx"`

Expected: FAIL — no `lobby-topband` exists.

- [ ] **Step 3: Wrap the three blocks in one band**

In `Lobby.jsx`, wrap the player info, the menu buttons, the energy display and the resource pills in a single `<div className="lobby-topband">`. **Do not change their internal markup or their existing class names** — other rules and the guard tests depend on them. This is a wrapper and a layout change, nothing more.

- [ ] **Step 4: Lay the band out**

```css
.lobby-topband {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  padding: var(--space-sm) var(--space-md);
  background: linear-gradient(180deg, var(--colors-surface-panel), var(--colors-surface-sunken));
  border: var(--borders-outline) solid var(--colors-edge-outline);
  border-radius: var(--radii-lg);
  box-shadow: var(--shadows-drop), inset 0 1px 0 var(--colors-edge-highlight);
}
```

Then neutralise the stacking the three blocks currently do on their own: remove any `width: 100%`, `margin-bottom` or `display: block` from their own rules that would keep them on separate lines. **Report every rule you changed**, since these are layout edits jsdom cannot verify.

- [ ] **Step 5: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/style/Lobby.css Frontend/src/component/GameRendering/Lobby.jsx \
        Frontend/src/component/GameRendering/__tests__/TopBand.test.jsx
git commit -m "feat: compact the lobby's three chrome blocks into one band

Player identity, menu buttons, energy and resources were three stacked blocks
taking roughly a third of the height before the map began. They now share one
row, and the map gets the space."
```

---

### Task 6: Replace the emoji props with SVG scenery

**Files:**
- Create: `Frontend/src/component/GameRendering/TerrainProps.jsx`
- Modify: `Frontend/src/component/GameRendering/Lobby.jsx`
- Modify: `Frontend/src/style/Lobby.css`
- Create: `Frontend/src/component/GameRendering/__tests__/TerrainProps.test.jsx`

**Interfaces:**
- Consumes: `zoneConfigs` keys; the `.zone-background` elements from Task 2.
- Produces: `<TerrainProp kind={...} />` rendering inline SVG, and `PROPS_BY_ZONE` mapping each zone to the prop kinds that belong in it.

**Background:** the approved mockup used emoji as a stand-in to prove placement and density. Emoji cannot be recoloured, so shipping them would reintroduce a second palette next to the token layer — the exact problem the visual-direction work removed.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/__tests__/TerrainProps.test.jsx`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPS_BY_ZONE, PROP_KINDS } from '../TerrainProps.jsx';
import { zoneConfigs } from '../MapLayout.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'TerrainProps.jsx'), 'utf8');
const TERRAIN_ZONES = Object.keys(zoneConfigs).filter((z) => z !== 'endless');

describe('terrain props', () => {
  it('gives every terrain zone at least two prop kinds', () => {
    for (const zone of TERRAIN_ZONES) {
      expect(PROPS_BY_ZONE[zone]?.length ?? 0, `zone ${zone}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('names only kinds that exist', () => {
    for (const kinds of Object.values(PROPS_BY_ZONE)) {
      for (const kind of kinds) expect(PROP_KINDS).toContain(kind);
    }
  });

  it('uses no emoji — props must take token colours', () => {
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('colours every prop from the token layer', () => {
    const fills = [...src.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) {
      expect(fill, `raw fill ${fill}`).toMatch(/^var\(--/);
    }
  });

  it('varies props by zone rather than repeating one set', () => {
    const signatures = TERRAIN_ZONES.map((z) => (PROPS_BY_ZONE[z] ?? []).join(','));
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });
});
```

The emoji test and the token-fill test are the two that matter: either failure means the props have brought their own palette, which is what this task exists to prevent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/__tests__/TerrainProps.test.jsx"`

Expected: FAIL — `TerrainProps.jsx` does not exist.

- [ ] **Step 3: Build the props**

Create `Frontend/src/component/GameRendering/TerrainProps.jsx`. Each kind is a small inline SVG whose fills reference tokens, so a prop recolours with the palette:

```jsx
/**
 * Scenery for the campaign map's regions. Inline SVG rather than emoji so
 * every prop takes its colour from the token layer - an emoji carries its own
 * palette, which is what the visual-direction work removed.
 */

export const PROP_KINDS = ['tree', 'deadTree', 'tent', 'rubble', 'fire', 'grave'];

/** Which props belong in which region. Character progresses with the terrain. */
export const PROPS_BY_ZONE = {
  tutorial: ['tree', 'tent'],
  early: ['tree', 'rubble'],
  mid: ['deadTree', 'rubble', 'tent'],
  late: ['deadTree', 'fire', 'grave'],
  endgame: ['fire', 'grave', 'rubble'],
};

const SHAPES = {
  tree: (
    <>
      <rect x="7" y="10" width="2" height="6" fill="var(--terrain-prop-dark)" />
      <path d="M8,0 L14,10 L2,10Z" fill="var(--terrain-prop-leaf)" />
    </>
  ),
  deadTree: (
    <>
      <rect x="7" y="6" width="2" height="10" fill="var(--terrain-prop-dark)" />
      <path d="M8,8 L3,4 M8,10 L13,6" stroke="var(--terrain-prop-dark)" strokeWidth="1.5" fill="none" />
    </>
  ),
  tent: <path d="M1,16 L8,3 L15,16Z" fill="var(--terrain-prop-cloth)" />,
  rubble: (
    <>
      <rect x="2" y="12" width="5" height="4" fill="var(--terrain-prop-stone)" />
      <rect x="8" y="13" width="6" height="3" fill="var(--terrain-prop-dark)" />
    </>
  ),
  fire: <path d="M8,3 Q11,9 8,16 Q5,9 8,3Z" fill="var(--terrain-prop-ember)" />,
  grave: (
    <>
      <rect x="6" y="7" width="4" height="9" fill="var(--terrain-prop-stone)" />
      <rect x="3" y="9" width="10" height="2" fill="var(--terrain-prop-stone)" />
    </>
  ),
};

export function TerrainProp({ kind, className = '' }) {
  const shape = SHAPES[kind];
  if (!shape) return null;
  return (
    <svg className={`terrain-prop ${className}`} viewBox="0 0 16 16" aria-hidden="true">
      {shape}
    </svg>
  );
}
```

Add the `terrain-prop-*` tokens to the `terrain` group in `tokens.js` and regenerate with `npm run tokens`.

- [ ] **Step 4: Place them in the regions**

In `Lobby.jsx`, inside each zone backdrop, render a few props at fixed positions. **Positions must be deterministic, not random** — a prop that moves on every render is distracting, and a test cannot pin it. Derive the placement from the zone key and the prop index:

```jsx
{(PROPS_BY_ZONE[zone] ?? []).map((kind, i) => (
  <TerrainProp
    key={`${zone}-${kind}-${i}`}
    kind={kind}
    className={i % 2 === 0 ? 'prop-near' : 'prop-far'}
    style={{ left: `${18 + i * 26}%`, bottom: i % 2 === 0 ? '22%' : '50%' }}
  />
))}
```

`TerrainProp` will need to accept and forward `style` for that to work — add it to the signature.

```css
.terrain-prop {
  position: absolute;
  width: 26px;
  height: 26px;
  transform: translate(-50%, 0);
  pointer-events: none;
}

/* Distant props are smaller and fainter, so they sit in the ridgeline
   rather than on top of it. */
.terrain-prop.prop-far {
  width: 17px;
  height: 17px;
  opacity: 0.45;
}
```

- [ ] **Step 5: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add Frontend/src/component/GameRendering/TerrainProps.jsx \
        Frontend/src/component/GameRendering/Lobby.jsx \
        Frontend/src/component/GameRendering/__tests__/TerrainProps.test.jsx \
        Frontend/src/style/Lobby.css Frontend/src/style/tokens.js \
        Frontend/src/style/tokens.generated.css
git commit -m "feat: fill the map's regions with SVG scenery instead of emoji

The approved mockup used emoji to prove placement and density. Emoji cannot be
recoloured, so shipping them would have put a second palette next to the token
layer. These props take their fills from tokens and vary by region, so the
scenery progresses with the ground."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

- [ ] **Confirm the guards are non-vacuous**

The two that matter most here are the `url()` guard and the emoji guard. Reintroduce a missing image reference and an emoji prop in turn, confirm each fails, then restore.

- [ ] **Confirm each success criterion from the spec**

1. The lobby reads as a place being advanced across, not a board with features on it.
2. No dead space that neither route, terrain, scenery nor framing occupies.
3. `.lobby-container` is declared once, and the page background is deliberate.
4. No stylesheet references a missing file — all three broken image references resolved or removed.
5. Level numbers are legible, and the next playable level is obvious without reading.
6. The top bar is never clipped.
7. Every level and the endless portal is reachable.
8. No semantic accent token is used as a page-scale surface.
9. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 1, 2, 5 and 6 are visual and **cannot be verified here** — jsdom has no layout engine or rasteriser. Compare against `docs/superpowers/reference/2026-08-17-lobby-campaign-map-mockup.html`, which the owner approved. Check specifically: that dragging the map does not launch a level, that the top bar is never cut off at any window height, and that every level from 1 to 20 plus the endless portal can be reached by panning.
