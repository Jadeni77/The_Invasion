# Game Feel, Audio, and UI Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give The Invasion real audio and game feel, wire its dead settings panel to actual behaviour, and fix the two diagnosed rendering/layout bugs.

**Architecture:** A `FeedbackBus` decouples `GameEngine` from all feedback. The engine emits semantic events (`enemy:died`, `base:damaged`) and never imports audio or effects code. A `FeedbackManager` subscribes and fans out to an `AudioManager` (Web Audio synthesis, no asset files) and a `JuiceManager` (shake, hit-stop, damage numbers), with every dispatch gated through a single `SettingsStore`.

**Tech Stack:** React 19, Vite 7, Vitest 4, Web Audio API, plain ES modules. New dev dependencies: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

**Spec:** `docs/superpowers/specs/2026-08-12-game-feel-audio-design.md`

## Global Constraints

- **No audio files.** Every sound is synthesized at runtime via Web Audio. Nothing binary enters the repo.
- **Volume curve is `gain = (value / 100) ** 2`.** Never map slider values to gain linearly.
- **Hit-stop is capped at 80ms.**
- **Shake applies to world drawing only**, never the HUD.
- **Every `draw*` method must leave canvas state exactly as it found it.** Wrap in `ctx.save()` / `ctx.restore()`.
- **Energy is clamped to 9999** (`GameEngine.js:182`) — four digits is the maximum width any energy readout must reserve.
- Existing test convention: tests live in a `__tests__/` directory beside the source, named `<Module>.test.js`, using `import { describe, it, expect, vi } from 'vitest'`.
- Path note: the directory `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## Milestones

Each milestone leaves the game in a working, shippable state. Stopping after any of them is valid.

| Milestone | Tasks | Delivers |
|---|---|---|
| 1. Bug fixes | 1–2 | The reported text shift is gone; canvas state leaks eliminated |
| 2. Foundations | 3–4 | Test infrastructure; settings actually persist |
| 3. Audio | 5–7 | Synthesized SFX and music, driven by the sliders |
| 4. Juice | 8–10 | Shake, hit-stop, damage numbers |
| 5. Wiring | 11 | Every remaining settings control does something real |

---

## Task 1: Fix top bar text shift (Bug A)

**Files:**
- Modify: `Frontend/src/style/GameBoard.css:28-104`

**Interfaces:**
- Consumes: nothing
- Produces: nothing (CSS only)

**Background:** `.game-top-bar` is `display: flex` with `justify-content: space-between`. When a child's width changes, `space-between` repositions its siblings. `.energy-value` reserves `min-width: 35px` for "3 digits" but energy caps at 9999. `.score-value` reserves nothing. And no numeric readout uses `tabular-nums`, so proportional digit glyphs change width even at a constant digit count (`50 → 88`).

- [ ] **Step 1: Read the current rules**

Run: `sed -n '28,104p' "Frontend/src/style/GameBoard.css"`

Confirm `.energy-value` has `min-width: 35px`, `.score-value` has no width rule, and `.health-value` has `min-width: 50px`.

- [ ] **Step 2: Add a shared numeric readout rule**

Add this block immediately after the `.energy-container, .score-container, .base-health-container` rule (currently ending at line 37):

```css
/* Numeric readouts must not change width as their values change.
   .game-top-bar is flex + space-between, so any width change in one child
   repositions its siblings, which reads on screen as text jumping sideways.
   tabular-nums gives every digit an identical advance width; the fixed
   widths below absorb digit-count changes up to each value's maximum. */
.energy-value,
.score-value,
.health-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  text-align: right;
  flex: 0 0 auto;
}
```

- [ ] **Step 3: Replace the per-value width rules**

Change `.energy-value` (line 50-55) from `min-width: 35px` to a fixed width sized for 4 digits, since energy caps at 9999:

```css
.energy-value {
  width: 4.5ch;
  font-size: 20px;
  font-weight: bold;
  color: white;
}
```

Change `.score-value` (line 69-73) to reserve 6 digits, since score is unbounded and 6 digits covers realistic play:

```css
.score-value {
  width: 6.5ch;
  font-size: 20px;
  font-weight: bold;
  color: white;
}
```

Change `.health-value` (line 100-104) from `min-width: 50px` to a fixed width:

```css
.health-value {
  font-size: 16px;
  color: white;
  width: 4.5ch;
}
```

- [ ] **Step 4: Check the responsive overrides don't reintroduce the bug**

Run: `grep -n -A6 "energy-value\|score-value\|health-value" "Frontend/src/style/GameBoard.css"`

The media-query blocks at lines ~629, ~753, and ~846 change `font-size` on the containers. `ch` units scale with font size, so the fixed widths remain correct. If any override sets an explicit `min-width` or `width` on these three classes, remove it — the `ch`-based rule must win.

- [ ] **Step 5: Verify visually**

Run: `cd Frontend && npm run dev`

Start a level. Collect energy orbs and let the score climb. Confirm the energy, score, and base-health readouts stay put and no neighbouring text jumps sideways. Deliberately watch the transition from 3 to 4 energy digits.

**This manual check is the real verification for this task** — see the "Known verification limit" section of the spec. jsdom has no layout engine, so no automated test can prove the shift is gone.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/style/GameBoard.css
git commit -m "fix: stop top bar text shifting when values change width

.game-top-bar is flex + space-between, so a width change in any child
repositions its siblings. Energy reserved only 3 digits but caps at 9999,
score reserved none, and no readout used tabular-nums, so proportional
digits changed width even at a constant digit count."
```

---

## Task 2: Fix canvas state leaks (Bug B)

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Drops/CardPieceDrop.js:51-83`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawUIs.js:150-182`
- Create: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/__tests__/canvasState.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `createRecordingContext()` test helper, reused by no later task but available

**Background:** There are 19 assignments of `ctx.textAlign = "center"` across the draw modules and zero resets. Canvas defaults to `"start"`. Commit `6802da2` fixed this pattern in `EnergyDrop.draw` but missed `CardPieceDrop.draw`, which sets `textAlign` and contains no `save`/`restore` at all.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/__tests__/canvasState.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CardPieceDrop } from '../Drops/CardPieceDrop.js';
import { EnergyDrop } from '../Drops/EnergyDrop.js';

/**
 * A minimal fake 2D context that records the canvas state properties we care
 * about. Real canvas state is restored by save/restore; this fake mimics that
 * with a stack so we can assert a draw call is state-neutral.
 */
function createRecordingContext() {
  const state = {
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px sans-serif',
  };
  const stack = [];
  return {
    ...state,
    save() { stack.push({ ...this._snapshot() }); },
    restore() {
      const prev = stack.pop();
      if (prev) Object.assign(this, prev);
    },
    _snapshot() {
      return {
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        font: this.font,
      };
    },
    beginPath() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
    fillText() {}, strokeText() {}, moveTo() {}, lineTo() {},
    translate() {}, clearRect() {}, drawImage() {},
    createRadialGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 10 }; },
  };
}

describe('canvas state hygiene', () => {
  it('CardPieceDrop.draw does not leak textAlign', () => {
    const ctx = createRecordingContext();
    const before = ctx._snapshot();

    new CardPieceDrop(100, 100, 1).draw(ctx);

    expect(ctx._snapshot()).toEqual(before);
  });

  it('EnergyDrop.draw does not leak textAlign', () => {
    const ctx = createRecordingContext();
    const before = ctx._snapshot();

    new EnergyDrop(100, 100, 25).draw(ctx);

    expect(ctx._snapshot()).toEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/__tests__/canvasState.test.js"`

Expected: the `CardPieceDrop` test FAILS, reporting `textAlign` is `"center"` but expected `"start"`. The `EnergyDrop` test PASSES — it was already fixed by `6802da2`, and its passing confirms the test itself is sound.

- [ ] **Step 3: Fix CardPieceDrop**

In `CardPieceDrop.js`, wrap the body of `draw(ctx)` (line 51-83). Add `ctx.save();` immediately after the `if (this.collected) return;` guard and `const alpha = this.opacity;`, and `ctx.restore();` as the final statement before the closing brace:

```js
    draw(ctx) {
        if (this.collected) return;

        const alpha = this.opacity;

        ctx.save();

        // ... existing body unchanged ...

        ctx.restore();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/__tests__/canvasState.test.js"`

Expected: both tests PASS.

- [ ] **Step 5: Fix the unguarded DrawUIs method**

`DrawUIs.drawNormalWaveInfo` (line 150) sets `fillStyle`, `font`, `textAlign`, and `textBaseline` with no `save`/`restore`. It is currently called from inside `drawUI`'s save/restore pair, so it does not leak today — but it is one refactor away from doing so. Make it self-contained. Add `ctx.save();` as the first statement of the method and `ctx.restore();` as the last:

```js
    // Fix: Draw normal mode wave info
    drawNormalWaveInfo(ctx) {
        ctx.save();

        ctx.fillStyle = "#FFF";
        // ... existing body unchanged ...

        ctx.restore();
    }
```

- [ ] **Step 6: Verify the full suite still passes**

Run: `cd Frontend && npm test`

Expected: all tests pass, including the three pre-existing manager test files.

- [ ] **Step 7: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Drops/CardPieceDrop.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawUIs.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/__tests__/canvasState.test.js"
git commit -m "fix: stop canvas draw calls leaking textAlign state

19 textAlign assignments existed across the draw modules with zero resets.
Commit 6802da2 fixed this in EnergyDrop but missed CardPieceDrop, which had
no save/restore at all. Adds a regression test that would have caught it."
```

---

## Task 3: Add component test infrastructure

**Files:**
- Modify: `Frontend/package.json`
- Modify: `Frontend/vite.config.js`
- Create: `Frontend/src/test/setup.js`

**Interfaces:**
- Consumes: nothing
- Produces: a jsdom test environment, enabling React component tests in all later tasks

- [ ] **Step 1: Install the dependencies**

```bash
cd Frontend && npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create the test setup file**

Create `Frontend/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 3: Configure vitest**

Replace `Frontend/vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
  },
})
```

- [ ] **Step 4: Verify the existing suite still passes under jsdom**

Run: `cd Frontend && npm test`

Expected: all pre-existing tests still pass. The environment change from `node` to `jsdom` must not break them — they are pure logic tests with no DOM usage.

- [ ] **Step 5: Commit**

```bash
git add Frontend/package.json Frontend/package-lock.json Frontend/vite.config.js Frontend/src/test/setup.js
git commit -m "test: add jsdom environment and React testing library"
```

---

## Task 4: SettingsStore

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/SettingsStore.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SettingsStore.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DEFAULT_SETTINGS` — the settings object shape
  - `loadSettings(): Settings`
  - `saveSettings(settings: Settings): void`
  - `subscribe(fn: (settings: Settings) => void): () => void`
  - `getSettings(): Settings` — synchronous current value, for draw code
  - Storage key: `'gameSettings'` (matches the key `SettingModal` already writes)

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SettingsStore.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, loadSettings, saveSettings, subscribe, getSettings,
} from '../SettingsStore.js';

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it('returns defaults when nothing is stored', () => {
    localStorage.clear();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', () => {
    const next = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, masterVolume: 20 },
    };
    saveSettings(next);
    expect(loadSettings().audio.masterVolume).toBe(20);
  });

  it('fills in missing keys from defaults', () => {
    localStorage.setItem('gameSettings', JSON.stringify({ audio: { masterVolume: 10 } }));
    const loaded = loadSettings();
    expect(loaded.audio.masterVolume).toBe(10);
    expect(loaded.audio.musicVolume).toBe(DEFAULT_SETTINGS.audio.musicVolume);
    expect(loaded.display.screenShake).toBe(DEFAULT_SETTINGS.display.screenShake);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('gameSettings', 'not json{{');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies subscribers on save', () => {
    const seen = vi.fn();
    const unsub = subscribe(seen);
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, screenShake: false } });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0][0].display.screenShake).toBe(false);
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    const seen = vi.fn();
    subscribe(seen)();
    saveSettings(DEFAULT_SETTINGS);
    expect(seen).not.toHaveBeenCalled();
  });

  it('exposes the current value synchronously', () => {
    saveSettings({ ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display, showHealthBars: false } });
    expect(getSettings().display.showHealthBars).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SettingsStore.test.js"`

Expected: FAIL — cannot resolve `../SettingsStore.js`.

- [ ] **Step 3: Implement SettingsStore**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/SettingsStore.js`:

```js
const STORAGE_KEY = 'gameSettings';

export const DEFAULT_SETTINGS = {
  audio: { masterVolume: 80, musicVolume: 50, soundEffects: 70 },
  display: {
    graphicsQuality: 'medium',
    showDamageNumbers: true,
    showHealthBars: true,
    screenShake: true,
  },
  gameplay: {
    autoCollectEnergy: false,
    autoDeployDefenders: false,
    showTutorialHints: true,
    confirmDeployment: false,
  },
};

const subscribers = new Set();
let current = null;

/** Merges stored values over defaults, one level deep per category. */
function merge(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
  const out = {};
  for (const category of Object.keys(DEFAULT_SETTINGS)) {
    out[category] = { ...DEFAULT_SETTINGS[category], ...(stored[category] || {}) };
  }
  return out;
}

export function loadSettings() {
  let parsed = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  current = merge(parsed);
  return current;
}

export function saveSettings(settings) {
  current = merge(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable (private browsing). Keep the in-memory
    // value so the session still honours the change.
  }
  for (const fn of subscribers) fn(current);
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getSettings() {
  return current ?? loadSettings();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SettingsStore.test.js"`

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/"
git commit -m "feat: add SettingsStore with persistence and subscriptions"
```

---

## Task 5: FeedbackBus

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackBus.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackBus.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `class FeedbackBus` with `on(event, fn): () => void`, `off(event, fn): void`, `emit(event, payload): void`

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackBus.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';

describe('FeedbackBus', () => {
  it('delivers an emitted event to a subscriber with its payload', () => {
    const bus = new FeedbackBus();
    const heard = vi.fn();
    bus.on('enemy:died', heard);

    bus.emit('enemy:died', { x: 5, isBoss: true });

    expect(heard).toHaveBeenCalledWith({ x: 5, isBoss: true });
  });

  it('delivers to every subscriber of the same event', () => {
    const bus = new FeedbackBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('base:damaged', a);
    bus.on('base:damaged', b);

    bus.emit('base:damaged', { damage: 10 });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('does not deliver to subscribers of other events', () => {
    const bus = new FeedbackBus();
    const other = vi.fn();
    bus.on('wave:started', other);

    bus.emit('enemy:died', {});

    expect(other).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new FeedbackBus();
    const heard = vi.fn();
    bus.on('enemy:hit', heard)();

    bus.emit('enemy:hit', {});

    expect(heard).not.toHaveBeenCalled();
  });

  it('tolerates a subscriber unsubscribing during emit', () => {
    const bus = new FeedbackBus();
    const second = vi.fn();
    let unsubFirst;
    unsubFirst = bus.on('wave:started', () => unsubFirst());
    bus.on('wave:started', second);

    expect(() => bus.emit('wave:started', {})).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
  });

  it('emitting an event with no subscribers is a no-op', () => {
    const bus = new FeedbackBus();
    expect(() => bus.emit('nobody:listening', {})).not.toThrow();
  });

  it('isolates a throwing subscriber from the others', () => {
    const bus = new FeedbackBus();
    const good = vi.fn();
    bus.on('enemy:died', () => { throw new Error('boom'); });
    bus.on('enemy:died', good);

    expect(() => bus.emit('enemy:died', {})).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackBus.test.js"`

Expected: FAIL — cannot resolve `../FeedbackBus.js`.

- [ ] **Step 3: Implement FeedbackBus**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackBus.js`:

```js
/**
 * Minimal publish/subscribe bus decoupling GameEngine from feedback.
 * The engine emits semantic events; audio and juice subscribe to them.
 */
export class FeedbackBus {
  constructor() {
    this.handlers = new Map();
  }

  /** Subscribes to an event. Returns an unsubscribe function. */
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  }

  /**
   * Publishes an event. Iterates a copy so a handler may unsubscribe during
   * dispatch, and isolates throwing handlers so one bad subscriber cannot
   * stop feedback for the rest or break the game loop.
   */
  emit(event, payload) {
    const subscribers = this.handlers.get(event);
    if (!subscribers) return;
    for (const fn of [...subscribers]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`FeedbackBus handler for "${event}" threw:`, err);
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackBus.test.js"`

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackBus.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackBus.test.js"
git commit -m "feat: add FeedbackBus pub/sub"
```

---

## Task 6: SfxLibrary and AudioManager

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/SfxLibrary.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SfxLibrary.test.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js`

**Interfaces:**
- Consumes: `SettingsStore` (`getSettings`)
- Produces:
  - `SFX` — a plain object mapping sound id → recipe
  - `SFX_IDS: string[]`
  - `class AudioManager` with `init()`, `resume(): Promise<void>`, `setVolumes({masterVolume, musicVolume, soundEffects})`, `playSfx(id)`, `get musicBus()`, `get isReady()`

**Recipe shape:** `{ wave, freqStart, freqEnd, duration, gain, noise }` where `wave` is an `OscillatorType`, frequencies are Hz, `duration` is seconds, `gain` is 0–1, and `noise` is a boolean selecting a filtered noise burst instead of an oscillator.

- [ ] **Step 1: Write the failing SfxLibrary test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SfxLibrary.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SFX, SFX_IDS } from '../SfxLibrary.js';

const REQUIRED_IDS = [
  'defenderPlaced', 'defenderDied', 'projectileFired', 'enemyHit',
  'enemyDied', 'bossDied', 'energyCollected', 'deployRejected',
  'baseDamaged', 'waveStarted', 'bossWaveStarted', 'levelWon', 'levelLost',
];

describe('SfxLibrary', () => {
  it('defines every sound the event catalog requires', () => {
    for (const id of REQUIRED_IDS) {
      expect(SFX, `missing sound: ${id}`).toHaveProperty(id);
    }
  });

  it('exposes SFX_IDS matching the SFX keys', () => {
    expect([...SFX_IDS].sort()).toEqual(Object.keys(SFX).sort());
  });

  it.each(Object.entries(SFX))('recipe %s is well formed', (id, recipe) => {
    expect(Number.isFinite(recipe.freqStart), `${id} freqStart`).toBe(true);
    expect(Number.isFinite(recipe.freqEnd), `${id} freqEnd`).toBe(true);
    expect(recipe.freqStart).toBeGreaterThan(0);
    expect(recipe.freqEnd).toBeGreaterThan(0);
    expect(recipe.freqStart).toBeLessThan(20000);
    expect(recipe.freqEnd).toBeLessThan(20000);
  });

  it.each(Object.entries(SFX))('recipe %s has a sane duration and gain', (id, recipe) => {
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.duration, `${id} must stay short enough not to overlap itself`).toBeLessThanOrEqual(2);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(1);
  });

  it.each(Object.entries(SFX))('recipe %s uses a valid oscillator type', (id, recipe) => {
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(recipe.wave);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SfxLibrary.test.js"`

Expected: FAIL — cannot resolve `../SfxLibrary.js`.

- [ ] **Step 3: Implement SfxLibrary**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/SfxLibrary.js`:

```js
/**
 * Synth recipes for every game sound. Pure data, no Web Audio types, so this
 * is testable without an AudioContext and tunable without touching playback.
 *
 * wave      - oscillator shape
 * freqStart - Hz at note start
 * freqEnd   - Hz at note end (a slide from freqStart)
 * duration  - seconds
 * gain      - peak gain, 0..1, before bus volumes are applied
 * noise     - when true, plays a filtered noise burst instead of a tone
 */
export const SFX = {
  // Placing a unit: short low thunk.
  defenderPlaced:   { wave: 'sine',     freqStart: 220, freqEnd: 110, duration: 0.12, gain: 0.5, noise: false },
  // Losing a unit: descending crumble.
  defenderDied:     { wave: 'sawtooth', freqStart: 180, freqEnd: 60,  duration: 0.35, gain: 0.4, noise: true  },
  // Firing: quick upward blip.
  projectileFired:  { wave: 'square',   freqStart: 640, freqEnd: 880, duration: 0.06, gain: 0.18, noise: false },
  // Enemy taking damage: dull tick.
  enemyHit:         { wave: 'triangle', freqStart: 320, freqEnd: 240, duration: 0.07, gain: 0.25, noise: false },
  // Enemy death: short noisy squelch.
  enemyDied:        { wave: 'sawtooth', freqStart: 300, freqEnd: 90,  duration: 0.22, gain: 0.4, noise: true  },
  // Boss death: long low roar.
  bossDied:         { wave: 'sawtooth', freqStart: 160, freqEnd: 40,  duration: 0.9,  gain: 0.6, noise: true  },
  // Collecting energy: bright rising ping.
  energyCollected:  { wave: 'sine',     freqStart: 880, freqEnd: 1320, duration: 0.15, gain: 0.35, noise: false },
  // Rejected action: dull buzz.
  deployRejected:   { wave: 'square',   freqStart: 140, freqEnd: 120, duration: 0.14, gain: 0.25, noise: false },
  // Base hit: urgent alarm.
  baseDamaged:      { wave: 'sawtooth', freqStart: 440, freqEnd: 220, duration: 0.4,  gain: 0.55, noise: false },
  // Wave incoming: horn.
  waveStarted:      { wave: 'sawtooth', freqStart: 180, freqEnd: 240, duration: 0.7,  gain: 0.45, noise: false },
  // Boss wave: lower, longer sting.
  bossWaveStarted:  { wave: 'sawtooth', freqStart: 110, freqEnd: 90,  duration: 1.2,  gain: 0.6, noise: false },
  // Victory: rising fanfare note.
  levelWon:         { wave: 'triangle', freqStart: 523, freqEnd: 1046, duration: 0.8, gain: 0.5, noise: false },
  // Defeat: descending tone.
  levelLost:        { wave: 'triangle', freqStart: 440, freqEnd: 110, duration: 1.1,  gain: 0.5, noise: false },
};

export const SFX_IDS = Object.keys(SFX);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SfxLibrary.test.js"`

Expected: all PASS.

- [ ] **Step 5: Write the failing AudioManager test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from '../AudioManager.js';

function createMockContext() {
  const made = { gains: [], oscillators: [], buffers: [] };
  const gainNode = () => {
    const node = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    made.gains.push(node);
    return node;
  };
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: { id: 'destination' },
    createGain: vi.fn(gainNode),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      made.oscillators.push(osc);
      return osc;
    }),
    createBufferSource: vi.fn(() => {
      const src = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      made.buffers.push(src);
      return src;
    }),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(256) })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(),
    })),
    resume: vi.fn(function () { this.state = 'running'; return Promise.resolve(); }),
    sampleRate: 44100,
  };
  return { ctx, made };
}

describe('AudioManager', () => {
  let ctx, made, audio;

  beforeEach(() => {
    ({ ctx, made } = createMockContext());
    audio = new AudioManager(() => ctx);
    audio.init();
  });

  it('builds a master, sfx, and music gain graph', () => {
    expect(ctx.createGain).toHaveBeenCalledTimes(3);
    // sfx and music both route into master; master routes to destination.
    expect(made.gains[0].connect).toHaveBeenCalledWith(ctx.destination);
    expect(made.gains[1].connect).toHaveBeenCalledWith(made.gains[0]);
    expect(made.gains[2].connect).toHaveBeenCalledWith(made.gains[0]);
  });

  it('applies a squared perceptual volume curve, not linear', () => {
    audio.setVolumes({ masterVolume: 50, musicVolume: 100, soundEffects: 0 });
    expect(made.gains[0].gain.value).toBeCloseTo(0.25); // (50/100)^2
    expect(made.gains[2].gain.value).toBeCloseTo(1);    // (100/100)^2
    expect(made.gains[1].gain.value).toBeCloseTo(0);    // (0/100)^2
  });

  it('is silent at volume 0', () => {
    audio.setVolumes({ masterVolume: 0, musicVolume: 0, soundEffects: 0 });
    expect(made.gains[0].gain.value).toBe(0);
  });

  it('clamps out-of-range volumes into 0..100', () => {
    audio.setVolumes({ masterVolume: 150, musicVolume: -20, soundEffects: 70 });
    expect(made.gains[0].gain.value).toBeCloseTo(1);
    expect(made.gains[2].gain.value).toBe(0);
  });

  it('creates a suspended context and only resumes on request', () => {
    expect(ctx.resume).not.toHaveBeenCalled();
    audio.resume();
    expect(ctx.resume).toHaveBeenCalledOnce();
  });

  it('plays a tone for an oscillator-based sound', () => {
    audio.resume();
    audio.playSfx('projectileFired');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    const osc = made.oscillators[0];
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });

  it('plays a noise burst for a noise-based sound', () => {
    audio.resume();
    audio.playSfx('enemyDied');
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it('ignores an unknown sound id without throwing', () => {
    audio.resume();
    expect(() => audio.playSfx('nope')).not.toThrow();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('does not throw when playing before init', () => {
    const fresh = new AudioManager(() => createMockContext().ctx);
    expect(() => fresh.playSfx('enemyHit')).not.toThrow();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"`

Expected: FAIL — cannot resolve `../AudioManager.js`.

- [ ] **Step 7: Implement AudioManager**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js`:

```js
import { SFX } from './SfxLibrary.js';

/** Converts a 0..100 slider value to gain using a perceptual (squared) curve. */
export function volumeToGain(value) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  return (clamped / 100) ** 2;
}

/**
 * Owns the AudioContext and its gain graph, and renders SfxLibrary recipes.
 *
 * The context factory is injected so tests can supply a mock. Browsers refuse
 * to start an AudioContext without a user gesture, so the context is created
 * suspended and resume() must be called from a real click.
 */
export class AudioManager {
  constructor(contextFactory = () => new (window.AudioContext || window.webkitAudioContext)()) {
    this.contextFactory = contextFactory;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = this.contextFactory();

    // Order matters: tests assert master is the first gain created.
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
  }

  get isReady() {
    return Boolean(this.ctx) && this.ctx.state === 'running';
  }

  get musicBus() {
    return this.musicGain;
  }

  /** Must be called from a user gesture handler. */
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx.state !== 'running') return this.ctx.resume();
    return Promise.resolve();
  }

  setVolumes({ masterVolume, musicVolume, soundEffects }) {
    if (!this.ctx) this.init();
    this.masterGain.gain.value = volumeToGain(masterVolume);
    this.sfxGain.gain.value = volumeToGain(soundEffects);
    this.musicGain.gain.value = volumeToGain(musicVolume);
  }

  playSfx(id) {
    const recipe = SFX[id];
    if (!recipe || !this.ctx) return;

    const now = this.ctx.currentTime;
    const end = now + recipe.duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    envelope.gain.setValueAtTime(recipe.gain, now);
    // Exponential fade to near-silence; exponentialRamp cannot reach exactly 0.
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    const source = recipe.noise
      ? this.createNoiseSource(recipe)
      : this.createToneSource(recipe, now, end);

    source.connect(envelope);
    source.start(now);
    source.stop(end);
  }

  createToneSource(recipe, now, end) {
    const osc = this.ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(recipe.freqEnd, end);
    return osc;
  }

  createNoiseSource(recipe) {
    const frames = Math.floor(this.ctx.sampleRate * recipe.duration);
    const buffer = this.ctx.createBuffer(1, Math.max(1, frames), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }
}
```

- [ ] **Step 8: Run both audio tests to verify they pass**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/"`

Expected: SfxLibrary, AudioManager, FeedbackBus, and SettingsStore tests all PASS.

- [ ] **Step 9: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/"
git commit -m "feat: add synthesized SFX library and AudioManager

All sound is generated at runtime via Web Audio; no audio files are added.
Volume uses a squared perceptual curve rather than the raw slider value."
```

---

## Task 7: MusicPlayer

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/MusicPlayer.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/MusicPlayer.test.js`

**Interfaces:**
- Consumes: `AudioManager` (`ctx`, `musicBus`)
- Produces: `class MusicPlayer` with `start()`, `stop()`, `get isPlaying()`

**Design:** A four-chord loop scheduled with a lookahead timer. Each `tick()` schedules any chord whose start time falls inside the lookahead window, which keeps timing accurate even when `setInterval` drifts.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/MusicPlayer.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MusicPlayer, PROGRESSION } from '../MusicPlayer.js';

function createMockAudio() {
  const oscillators = [];
  const ctx = {
    currentTime: 0,
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    },
  };
  return { audio: { ctx, musicBus: { id: 'musicBus' } }, ctx, oscillators };
}

describe('MusicPlayer', () => {
  let audio, ctx, oscillators, player;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ audio, ctx, oscillators } = createMockAudio());
    player = new MusicPlayer(audio);
  });

  afterEach(() => {
    player.stop();
    vi.useRealTimers();
  });

  it('defines a non-empty chord progression', () => {
    expect(PROGRESSION.length).toBeGreaterThan(0);
    for (const chord of PROGRESSION) {
      expect(chord.length).toBeGreaterThan(0);
      for (const freq of chord) expect(freq).toBeGreaterThan(0);
    }
  });

  it('reports not playing before start', () => {
    expect(player.isPlaying).toBe(false);
  });

  it('schedules notes once started', () => {
    player.start();
    vi.advanceTimersByTime(100);
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('routes every note to the music bus, never the destination', () => {
    player.start();
    vi.advanceTimersByTime(100);
    for (const osc of oscillators) expect(osc.connect).toHaveBeenCalled();
  });

  it('keeps scheduling as time advances, wrapping the loop', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const afterFirst = oscillators.length;

    // Advance the audio clock past the whole progression and tick again.
    ctx.currentTime += PROGRESSION.length * 2;
    vi.advanceTimersByTime(500);

    expect(oscillators.length).toBeGreaterThan(afterFirst);
  });

  it('stops scheduling after stop()', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const count = oscillators.length;

    player.stop();
    ctx.currentTime += 10;
    vi.advanceTimersByTime(1000);

    expect(oscillators.length).toBe(count);
    expect(player.isPlaying).toBe(false);
  });

  it('start() twice does not double-schedule', () => {
    player.start();
    vi.advanceTimersByTime(100);
    const count = oscillators.length;

    player.start();
    vi.advanceTimersByTime(0);

    expect(oscillators.length).toBe(count);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/MusicPlayer.test.js"`

Expected: FAIL — cannot resolve `../MusicPlayer.js`.

- [ ] **Step 3: Implement MusicPlayer**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/MusicPlayer.js`:

```js
/**
 * A minimal looping chord bed. Deliberately simple: this is ambience so the
 * Music Volume slider controls something real, not a composed soundtrack.
 *
 * Uses lookahead scheduling - a coarse timer that schedules precise Web Audio
 * start times slightly ahead of the clock. setInterval alone is far too jittery
 * to drive audio directly.
 */

/** Am - F - C - G, one chord per bar, as raw frequencies in Hz. */
export const PROGRESSION = [
  [220.00, 261.63, 329.63], // Am
  [174.61, 220.00, 261.63], // F
  [130.81, 164.81, 196.00], // C
  [196.00, 246.94, 293.66], // G
];

const SECONDS_PER_CHORD = 2;
const LOOKAHEAD_SECONDS = 0.5;
const TICK_MS = 50;

export class MusicPlayer {
  constructor(audioManager) {
    this.audio = audioManager;
    this.timer = null;
    this.nextChordTime = 0;
    this.chordIndex = 0;
  }

  get isPlaying() {
    return this.timer !== null;
  }

  start() {
    if (this.timer !== null) return;
    const ctx = this.audio.ctx;
    if (!ctx) return;

    this.nextChordTime = ctx.currentTime;
    this.chordIndex = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Schedules every chord that starts inside the lookahead window. */
  tick() {
    const ctx = this.audio.ctx;
    if (!ctx) return;

    while (this.nextChordTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleChord(PROGRESSION[this.chordIndex], this.nextChordTime);
      this.nextChordTime += SECONDS_PER_CHORD;
      this.chordIndex = (this.chordIndex + 1) % PROGRESSION.length;
    }
  }

  scheduleChord(frequencies, startTime) {
    const ctx = this.audio.ctx;
    const endTime = startTime + SECONDS_PER_CHORD;

    for (const frequency of frequencies) {
      const envelope = ctx.createGain();
      envelope.connect(this.audio.musicBus);
      // Slow swell in and out so chords blend rather than click.
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.linearRampToValueAtTime(0.08, startTime + 0.4);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, startTime);
      osc.connect(envelope);
      osc.start(startTime);
      osc.stop(endTime);
    }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/MusicPlayer.test.js"`

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/MusicPlayer.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/MusicPlayer.test.js"
git commit -m "feat: add looping synthesized music bed"
```

---

## Task 8: JuiceManager

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/JuiceManager.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/JuiceManager.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `class JuiceManager` with:
  - `addTrauma(amount)`, `getShakeOffset(): {x, y}`
  - `triggerHitStop(ms)`, `isFrozen(): boolean`
  - `addDamageNumber(x, y, damage)`, `get damageNumbers()`
  - `triggerFlash(color, ms)`, `getFlash(): {color, alpha} | null`
  - `update(deltaMs)`
  - `setEnabled({screenShake, showDamageNumbers})`
  - Constant `MAX_HIT_STOP_MS = 80`

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/JuiceManager.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { JuiceManager, MAX_HIT_STOP_MS, MAX_SHAKE_PIXELS } from '../JuiceManager.js';

describe('JuiceManager', () => {
  let juice;

  beforeEach(() => {
    juice = new JuiceManager();
  });

  describe('screen shake', () => {
    it('is still when no trauma has been added', () => {
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });

    it('offsets the view after trauma', () => {
      juice.addTrauma(1);
      const { x, y } = juice.getShakeOffset();
      expect(Math.abs(x) + Math.abs(y)).toBeGreaterThan(0);
    });

    it('never exceeds the maximum displacement', () => {
      juice.addTrauma(10); // deliberately over-large
      for (let i = 0; i < 50; i++) {
        const { x, y } = juice.getShakeOffset();
        expect(Math.abs(x)).toBeLessThanOrEqual(MAX_SHAKE_PIXELS);
        expect(Math.abs(y)).toBeLessThanOrEqual(MAX_SHAKE_PIXELS);
      }
    });

    it('decays back to stillness over time', () => {
      juice.addTrauma(1);
      juice.update(2000);
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });

    it('produces no shake when disabled', () => {
      juice.setEnabled({ screenShake: false });
      juice.addTrauma(1);
      expect(juice.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('hit stop', () => {
    it('is not frozen by default', () => {
      expect(juice.isFrozen()).toBe(false);
    });

    it('freezes after being triggered', () => {
      juice.triggerHitStop(50);
      expect(juice.isFrozen()).toBe(true);
    });

    it('unfreezes once the duration elapses', () => {
      juice.triggerHitStop(50);
      juice.update(60);
      expect(juice.isFrozen()).toBe(false);
    });

    it('clamps requests to the maximum', () => {
      juice.triggerHitStop(5000);
      juice.update(MAX_HIT_STOP_MS + 1);
      expect(juice.isFrozen()).toBe(false);
    });
  });

  describe('damage numbers', () => {
    it('starts with none', () => {
      expect(juice.damageNumbers).toHaveLength(0);
    });

    it('adds one with its position and value', () => {
      juice.addDamageNumber(10, 20, 35);
      expect(juice.damageNumbers[0]).toMatchObject({ x: 10, damage: 35 });
    });

    it('drifts upward and fades as time passes', () => {
      juice.addDamageNumber(10, 100, 5);
      const startY = juice.damageNumbers[0].y;
      juice.update(200);
      expect(juice.damageNumbers[0].y).toBeLessThan(startY);
      expect(juice.damageNumbers[0].alpha).toBeLessThan(1);
    });

    it('expires them', () => {
      juice.addDamageNumber(10, 20, 5);
      juice.update(2000);
      expect(juice.damageNumbers).toHaveLength(0);
    });

    it('adds none when disabled', () => {
      juice.setEnabled({ showDamageNumbers: false });
      juice.addDamageNumber(10, 20, 5);
      expect(juice.damageNumbers).toHaveLength(0);
    });
  });

  describe('flash', () => {
    it('is absent by default', () => {
      expect(juice.getFlash()).toBeNull();
    });

    it('reports colour and fades out', () => {
      juice.triggerFlash('#ff0000', 200);
      expect(juice.getFlash().color).toBe('#ff0000');
      const initial = juice.getFlash().alpha;
      juice.update(100);
      expect(juice.getFlash().alpha).toBeLessThan(initial);
      juice.update(200);
      expect(juice.getFlash()).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/JuiceManager.test.js"`

Expected: FAIL — cannot resolve `../JuiceManager.js`.

- [ ] **Step 3: Implement JuiceManager**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/JuiceManager.js`:

```js
/** Hit-stop is capped so it can never noticeably desynchronise the game clock. */
export const MAX_HIT_STOP_MS = 80;
export const MAX_SHAKE_PIXELS = 12;

const TRAUMA_DECAY_PER_SECOND = 1.5;
const DAMAGE_NUMBER_LIFETIME_MS = 700;
const DAMAGE_NUMBER_RISE_PIXELS = 40;

/**
 * Owns all non-audio feedback: screen shake, hit-stop, damage numbers, flash.
 *
 * Shake uses a trauma model - displacement is proportional to trauma squared.
 * Squaring keeps small hits subtle and makes large ones violent; linear shake
 * reads as uniform mush.
 */
export class JuiceManager {
  constructor() {
    this.trauma = 0;
    this.hitStopRemainingMs = 0;
    this._damageNumbers = [];
    this.flash = null;
    this.shakeEnabled = true;
    this.damageNumbersEnabled = true;
  }

  setEnabled({ screenShake, showDamageNumbers } = {}) {
    if (screenShake !== undefined) this.shakeEnabled = screenShake;
    if (showDamageNumbers !== undefined) this.damageNumbersEnabled = showDamageNumbers;
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  getShakeOffset() {
    if (!this.shakeEnabled || this.trauma <= 0) return { x: 0, y: 0 };
    const magnitude = this.trauma ** 2 * MAX_SHAKE_PIXELS;
    return {
      x: (Math.random() * 2 - 1) * magnitude,
      y: (Math.random() * 2 - 1) * magnitude,
    };
  }

  triggerHitStop(ms) {
    this.hitStopRemainingMs = Math.min(MAX_HIT_STOP_MS, ms);
  }

  isFrozen() {
    return this.hitStopRemainingMs > 0;
  }

  addDamageNumber(x, y, damage) {
    if (!this.damageNumbersEnabled) return;
    this._damageNumbers.push({
      x, y, damage, alpha: 1, ageMs: 0, originY: y,
    });
  }

  get damageNumbers() {
    return this._damageNumbers;
  }

  triggerFlash(color, durationMs) {
    this.flash = { color, alpha: 1, ageMs: 0, durationMs };
  }

  getFlash() {
    return this.flash;
  }

  update(deltaMs) {
    const deltaSeconds = deltaMs / 1000;

    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY_PER_SECOND * deltaSeconds);
    this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - deltaMs);

    for (const number of this._damageNumbers) {
      number.ageMs += deltaMs;
      const progress = Math.min(1, number.ageMs / DAMAGE_NUMBER_LIFETIME_MS);
      number.y = number.originY - DAMAGE_NUMBER_RISE_PIXELS * progress;
      number.alpha = 1 - progress;
    }
    this._damageNumbers = this._damageNumbers.filter(
      (n) => n.ageMs < DAMAGE_NUMBER_LIFETIME_MS
    );

    if (this.flash) {
      this.flash.ageMs += deltaMs;
      const progress = Math.min(1, this.flash.ageMs / this.flash.durationMs);
      this.flash.alpha = 1 - progress;
      if (progress >= 1) this.flash = null;
    }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/JuiceManager.test.js"`

Expected: all 15 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/JuiceManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/JuiceManager.test.js"
git commit -m "feat: add JuiceManager for shake, hit-stop, damage numbers, flash"
```

---

## Task 9: Game clock — fix pause/hit-stop time desync

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js:687-691`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/WaveManager.js:35`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/WaveManager.test.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/GameClock.test.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/GameClock.js`

**Interfaces:**
- Consumes: nothing
- Produces: `class GameClock` with `advance(realDeltaMs)`, `get now()`, `reset()`

**Background — this fixes a pre-existing bug, not just a hit-stop precondition.** `GameEngine.update()` computes `const now = Date.now()` (line 689) and injects it into `waveManager.update(now, ...)`. But `update()` early-returns when `this.isPaused` (line 688) while wall-clock time keeps advancing. So pausing for two minutes and resuming makes `timeSinceLastWave` jump, and `shouldStartNextWave` immediately fires — a burst of waves. Hit-stop would introduce the same fault dozens of times per match.

`WaveManager` already takes `now` as a parameter, so the fix is to inject a clock that only advances during live gameplay.

- [ ] **Step 1: Write the failing GameClock test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/GameClock.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { GameClock } from '../GameClock.js';

describe('GameClock', () => {
  let clock;

  beforeEach(() => {
    clock = new GameClock();
  });

  it('starts at zero', () => {
    expect(clock.now).toBe(0);
  });

  it('accumulates advanced time', () => {
    clock.advance(16);
    clock.advance(16);
    expect(clock.now).toBe(32);
  });

  it('does not advance when it is not told to', () => {
    clock.advance(16);
    expect(clock.now).toBe(16);
    expect(clock.now).toBe(16);
  });

  it('ignores negative deltas, which a clock adjustment could produce', () => {
    clock.advance(100);
    clock.advance(-50);
    expect(clock.now).toBe(100);
  });

  it('clamps absurd deltas so a backgrounded tab cannot jump the clock', () => {
    clock.advance(60_000);
    expect(clock.now).toBeLessThanOrEqual(1000);
  });

  it('resets to zero', () => {
    clock.advance(500);
    clock.reset();
    expect(clock.now).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/GameClock.test.js"`

Expected: FAIL — cannot resolve `../GameClock.js`.

- [ ] **Step 3: Implement GameClock**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/GameClock.js`:

```js
/**
 * Monotonic gameplay clock, advanced only while the game is actually running.
 *
 * Wave timing must not use Date.now(): update() is skipped while paused and
 * during hit-stop, so wall-clock time would keep running and produce a burst
 * of waves on resume.
 */
const MAX_DELTA_MS = 1000;

export class GameClock {
  constructor() {
    this.elapsedMs = 0;
  }

  get now() {
    return this.elapsedMs;
  }

  /**
   * Advances by one frame's real elapsed time. Negative deltas are ignored and
   * large ones clamped, so a backgrounded tab resumes smoothly instead of
   * fast-forwarding the match.
   */
  advance(realDeltaMs) {
    if (!Number.isFinite(realDeltaMs) || realDeltaMs <= 0) return;
    this.elapsedMs += Math.min(realDeltaMs, MAX_DELTA_MS);
  }

  reset() {
    this.elapsedMs = 0;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/GameClock.test.js"`

Expected: all 6 tests PASS.

- [ ] **Step 5: Make WaveManager's initial timestamp clock-relative**

`WaveManager.js:35` currently reads `this.lastWaveStartTime = Date.now();`. With an injected clock starting at 0, that value must start at 0 too, or `now - lastWaveStartTime` is hugely negative and the first wave never starts.

Change line 35 to:

```js
        this.lastWaveStartTime = 0;
```

- [ ] **Step 6: Run the existing WaveManager tests**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/WaveManager.test.js"`

The existing tests call `waveManager.update(1000, ...)`. With `lastWaveStartTime` previously set to `Date.now()`, `shouldStartNextWave` returned false for wave 0; now `1000 - 0 >= 1000` is true, so wave 1 starts.

**If any test fails, that failure is the intended behaviour change, not a regression.** Read the failing assertion and update it to expect the wave to start, adding a comment noting the clock is now gameplay-relative. Do not revert line 35.

- [ ] **Step 7: Wire the clock into GameEngine**

In `GameEngine.js`, add the import at the top with the other imports:

```js
import { GameClock } from './Feedback/GameClock.js';
```

In the constructor, beside the other manager instantiations (near line 107), add:

```js
    this.gameClock = new GameClock();
    this.lastFrameTime = null;
```

Replace `update()` at lines 687-691. It currently reads:

```js
  update() {
    if (this.gameOver || this.isPaused) return;
    const now = Date.now();

    this.waveManager.update(now, this.enemies.length, this.gameOver);
```

Change it to advance the gameplay clock from real frame deltas, so paused and hit-stopped time is excluded:

```js
  update() {
    if (this.gameOver || this.isPaused) {
      // Drop the frame reference so the pause does not count as one huge frame.
      this.lastFrameTime = null;
      return;
    }

    const realNow = performance.now();
    const deltaMs = this.lastFrameTime === null ? 0 : realNow - this.lastFrameTime;
    this.lastFrameTime = realNow;

    this.gameClock.advance(deltaMs);
    const now = this.gameClock.now;

    this.waveManager.update(now, this.enemies.length, this.gameOver);
```

- [ ] **Step 8: Reset the clock when a level restarts**

Find the reset block in `GameEngine.js` that sets `this.enemiesKilled = 0` and the other per-level counters (around line 391-397, in the method that also calls `this.waveManager.reset()`). Add alongside them:

```js
    this.gameClock.reset();
    this.lastFrameTime = null;
```

- [ ] **Step 9: Verify the whole suite and play the game**

Run: `cd Frontend && npm test`

Expected: all tests pass.

Then run: `cd Frontend && npm run dev`

Play a level. Confirm waves still start and progress normally. Then pause for ~30 seconds and resume: **no burst of waves should appear.** That burst is the pre-existing bug this task fixes, so confirm it is gone.

- [ ] **Step 10: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/WaveManager.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/WaveManager.test.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/GameClock.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/GameClock.test.js"
git commit -m "fix: drive wave timing from a gameplay clock, not wall clock

update() early-returns while paused but Date.now() kept advancing, so
resuming produced a burst of waves. Also a precondition for hit-stop,
which skips update() the same way."
```

---

## Task 10: FeedbackManager and engine events

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js`
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (constructor, `deployDefender`, `update`, `draw`, enemy-death and base-damage paths)

**Interfaces:**
- Consumes: `FeedbackBus`, `AudioManager`, `JuiceManager`, `SettingsStore`
- Produces: `class FeedbackManager` with `constructor(bus, audio, juice)`, `attach(): () => void`, `applySettings(settings)`

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackBus } from '../FeedbackBus.js';
import { FeedbackManager } from '../FeedbackManager.js';
import { DEFAULT_SETTINGS } from '../SettingsStore.js';

describe('FeedbackManager', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = { playSfx: vi.fn(), setVolumes: vi.fn() };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('plays the placement sound when a defender is placed', () => {
    bus.emit('defender:placed', { type: 'Shooter' });
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
  });

  it('plays the collection sound when energy is collected', () => {
    bus.emit('energy:collected', { amount: 25 });
    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected');
  });

  it('shows a damage number when an enemy is hit', () => {
    bus.emit('enemy:hit', { damage: 12, x: 30, y: 40 });
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
    expect(audio.playSfx).toHaveBeenCalledWith('enemyHit');
  });

  it('shakes and flashes when the base is damaged', () => {
    bus.emit('base:damaged', { damage: 10 });
    expect(audio.playSfx).toHaveBeenCalledWith('baseDamaged');
    expect(juice.addTrauma).toHaveBeenCalled();
    expect(juice.triggerFlash).toHaveBeenCalled();
  });

  it('uses the boss sound and hit-stop for a boss death', () => {
    bus.emit('enemy:died', { isBoss: true, x: 1, y: 2 });
    expect(audio.playSfx).toHaveBeenCalledWith('bossDied');
    expect(juice.triggerHitStop).toHaveBeenCalled();
  });

  it('uses the ordinary sound and no hit-stop for a normal death', () => {
    bus.emit('enemy:died', { isBoss: false, x: 1, y: 2 });
    expect(audio.playSfx).toHaveBeenCalledWith('enemyDied');
    expect(juice.triggerHitStop).not.toHaveBeenCalled();
  });

  it('distinguishes boss waves from ordinary waves', () => {
    bus.emit('wave:started', { number: 3, isBoss: false });
    expect(audio.playSfx).toHaveBeenCalledWith('waveStarted');
    audio.playSfx.mockClear();
    bus.emit('wave:started', { number: 4, isBoss: true });
    expect(audio.playSfx).toHaveBeenCalledWith('bossWaveStarted');
  });

  it('plays win and lose stings', () => {
    bus.emit('level:won', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon');
    bus.emit('level:lost', {});
    expect(audio.playSfx).toHaveBeenCalledWith('levelLost');
  });

  it('forwards volumes and toggles to audio and juice on settings change', () => {
    manager.applySettings(DEFAULT_SETTINGS);
    expect(audio.setVolumes).toHaveBeenCalledWith(DEFAULT_SETTINGS.audio);
    expect(juice.setEnabled).toHaveBeenCalledWith({
      screenShake: DEFAULT_SETTINGS.display.screenShake,
      showDamageNumbers: DEFAULT_SETTINGS.display.showDamageNumbers,
    });
  });

  it('stops responding after detach', () => {
    manager.detach();
    bus.emit('energy:collected', { amount: 1 });
    expect(audio.playSfx).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"`

Expected: FAIL — cannot resolve `../FeedbackManager.js`.

- [ ] **Step 3: Implement FeedbackManager**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js`:

```js
/**
 * Translates gameplay events into sound and juice.
 *
 * This is the single place that knows an enemy death should make a noise, and
 * the single place settings gate feedback. GameEngine emits semantic events and
 * knows nothing about audio.
 */
export class FeedbackManager {
  constructor(bus, audioManager, juiceManager) {
    this.bus = bus;
    this.audio = audioManager;
    this.juice = juiceManager;
    this.unsubscribers = [];
  }

  attach() {
    const on = (event, handler) => this.unsubscribers.push(this.bus.on(event, handler));

    on('defender:placed', () => this.audio.playSfx('defenderPlaced'));

    on('defender:died', () => {
      this.audio.playSfx('defenderDied');
      this.juice.addTrauma(0.15);
    });

    on('projectile:fired', () => this.audio.playSfx('projectileFired'));

    on('enemy:hit', ({ damage, x, y }) => {
      this.audio.playSfx('enemyHit');
      this.juice.addDamageNumber(x, y, damage);
    });

    on('enemy:died', ({ isBoss }) => {
      if (isBoss) {
        this.audio.playSfx('bossDied');
        this.juice.addTrauma(0.6);
        this.juice.triggerHitStop(80);
      } else {
        this.audio.playSfx('enemyDied');
        this.juice.addTrauma(0.08);
      }
    });

    on('energy:collected', () => this.audio.playSfx('energyCollected'));

    on('deploy:rejected', () => this.audio.playSfx('deployRejected'));

    on('base:damaged', () => {
      this.audio.playSfx('baseDamaged');
      this.juice.addTrauma(0.5);
      this.juice.triggerFlash('#ff0000', 250);
    });

    on('wave:started', ({ isBoss }) => {
      this.audio.playSfx(isBoss ? 'bossWaveStarted' : 'waveStarted');
    });

    on('level:won', () => this.audio.playSfx('levelWon'));
    on('level:lost', () => this.audio.playSfx('levelLost'));

    return () => this.detach();
  }

  detach() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  applySettings(settings) {
    this.audio.setVolumes(settings.audio);
    this.juice.setEnabled({
      screenShake: settings.display.screenShake,
      showDamageNumbers: settings.display.showDamageNumbers,
    });
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"`

Expected: all 10 tests PASS.

- [ ] **Step 5: Give GameEngine a bus and emit events**

In `GameEngine.js`, add to the constructor beside `this.gameClock`:

```js
    this.feedbackBus = null; // injected by GameContext; null in tests
```

Add a helper method next to `update()`:

```js
  /** Emits a feedback event if a bus is attached. Safe when it is not. */
  emitFeedback(event, payload) {
    this.feedbackBus?.emit(event, payload);
  }
```

Add these emit calls at the existing sites:

1. In `deployDefender`, immediately after `this.defendersDeployed++;` (line ~494):
```js
    this.emitFeedback('defender:placed', { type: newUnit.constructor.name });
```

2. In the energy collection branch, after `this.energyCollected++;` (line ~183):
```js
        this.emitFeedback('energy:collected', { amount: drop.amount });
```

3. In the enemy-death branch, after `this.enemiesKilled++;` (line ~644):
```js
          this.emitFeedback('enemy:died', {
            isBoss: Boolean(enemy.isBoss), x: enemy.x, y: enemy.y,
          });
```

4. In the defender-death branch, after `this.defendersLost++;` (line ~750):
```js
          this.emitFeedback('defender:died', { x: defender.x, y: defender.y });
```

5. In the base-damage branch, after `this.baseDamageTaken += damage;` (line ~904):
```js
          this.emitFeedback('base:damaged', { damage });
```

6. In `showWaveAnnouncement`'s caller (line ~235), beside the existing `drawUIs` call:
```js
      this.emitFeedback('wave:started', { number: waveNumber, isBoss });
```

7. In the projectile-hit branch, immediately after `const died = projectile.target.takeDamage(...)` (line ~979):
```js
          this.emitFeedback('enemy:hit', {
            damage: projectile.damage,
            x: projectile.target.x + projectile.target.width / 2,
            y: projectile.target.y,
          });
```

8. In the invalid-deployment guard in `deployDefender`, replacing the bare `console.log` before `return false` (line ~472):
```js
      console.log("Invalid deployment position");
      this.emitFeedback('deploy:rejected', { reason: 'invalidPosition' });
      return false;
```

9. Immediately before each `this.onLoseCb({` call (lines ~1213 and ~1227):
```js
          this.emitFeedback('level:lost', {});
```

10. Immediately before the `this.onWinCb({` call (line ~1249):
```js
      this.emitFeedback('level:won', {});
```

11. In `DefenderUnits.js`, after `this.gameEngine.projectiles.push(projectile);` (line 2211):
```js
    this.gameEngine.emitFeedback('projectile:fired', { defenderType: this.constructor.name });
```

- [ ] **Step 6: Apply hit-stop and shake in the loop and draw**

In `update()`, immediately after `this.gameClock.advance(deltaMs);`, add:

```js
    this.juiceManager?.update(deltaMs);
    // Hit-stop freezes gameplay for a few frames while drawing continues.
    if (this.juiceManager?.isFrozen()) return;
```

In `draw(ctx)` (line 1263), wrap world drawing in the shake transform. The HUD must stay outside it. Replace the body with:

```js
  draw(ctx) {
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.drawUIs.drawBackground(ctx);

    // World layer: shake applies here only, never to the HUD.
    const shake = this.juiceManager?.getShakeOffset() ?? { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    this.gridManager.drawGrid(ctx);
    this.drawEntities.drawDefenders(ctx);
    this.drawEntities.drawEnemies(ctx);
    this.drawEntities.drawProjectiles(ctx);
    this.drawEntities.drawSpellProjectiles(ctx);
    this.drawEntities.drawEnergyDrops(ctx);
    this.drawEntities.drawCardPieceDrops(ctx);
    this.drawExplosionEffect.drawExplosions(ctx);

    ctx.restore();

    // HUD layer: unaffected by shake.
    this.drawUIs.drawUI(ctx);
    this.drawUIs.drawDamageNumbers(ctx, this.juiceManager?.damageNumbers ?? []);
    this.drawUIs.drawFlash(ctx, this.juiceManager?.getFlash() ?? null);
  }
```

Note this also moves `drawUI` after the world, so the HUD renders on top rather than beneath the entities.

- [ ] **Step 7: Add the two new DrawUIs methods**

In `DrawUIs.js`, add these methods to the class:

```js
    /** Draws floating damage numbers. State-neutral. */
    drawDamageNumbers(ctx, numbers) {
        if (!numbers.length) return;
        ctx.save();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const number of numbers) {
            ctx.fillStyle = `rgba(255, 80, 80, ${number.alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${number.alpha})`;
            ctx.lineWidth = 3;
            ctx.strokeText(String(number.damage), number.x, number.y);
            ctx.fillText(String(number.damage), number.x, number.y);
        }
        ctx.restore();
    }

    /** Draws a full-screen colour flash. State-neutral. */
    drawFlash(ctx, flash) {
        if (!flash) return;
        ctx.save();
        ctx.globalAlpha = flash.alpha * 0.35;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight);
        ctx.restore();
    }
```

- [ ] **Step 8: Wire the feedback stack in GameContext**

In `GameContext.jsx`, add the imports:

```js
import { FeedbackBus } from "./Feedback/FeedbackBus.js";
import { AudioManager } from "./Feedback/AudioManager.js";
import { JuiceManager } from "./Feedback/JuiceManager.js";
import { MusicPlayer } from "./Feedback/MusicPlayer.js";
import { FeedbackManager } from "./Feedback/FeedbackManager.js";
import { loadSettings, subscribe } from "./Feedback/SettingsStore.js";
```

Inside `GameProvider`, build the stack once in a ref and expose it:

```js
  const feedbackRef = useRef(null);
  if (feedbackRef.current === null) {
    const bus = new FeedbackBus();
    const audio = new AudioManager();
    const juice = new JuiceManager();
    const music = new MusicPlayer(audio);
    const manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
    manager.applySettings(loadSettings());
    feedbackRef.current = { bus, audio, juice, music, manager };
  }

  // Keep audio and juice in step with the settings panel.
  useEffect(() => subscribe((settings) => {
    feedbackRef.current.manager.applySettings(settings);
  }), []);

  // Browsers block AudioContext until a user gesture, so start on first click.
  useEffect(() => {
    const startAudio = () => {
      feedbackRef.current.audio.resume().then(() => {
        feedbackRef.current.audio.setVolumes(loadSettings().audio);
        feedbackRef.current.music.start();
      });
      window.removeEventListener("pointerdown", startAudio);
    };
    window.addEventListener("pointerdown", startAudio);
    return () => window.removeEventListener("pointerdown", startAudio);
  }, []);
```

Add `feedback: feedbackRef.current` to the context value object (beside `fetchPlayerData`).

- [ ] **Step 9: Inject the bus and juice into the engine**

In `GameBoard.jsx`, where the `GameEngine` is constructed, pull `feedback` from `useGame()` and assign after construction:

```js
      gameEngineRef.current.feedbackBus = feedback.bus;
      gameEngineRef.current.juiceManager = feedback.juice;
```

- [ ] **Step 10: Verify the suite and play**

Run: `cd Frontend && npm test`

Expected: all tests pass.

Run: `cd Frontend && npm run dev`

Play a level and confirm: placing a defender makes a sound; shooting makes a sound; energy collection pings; damage numbers float up from hit enemies; the screen shakes and flashes red when the base is hit; killing a boss briefly freezes the frame. **Confirm the HUD does not shake with the world.**

- [ ] **Step 11: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/"
git commit -m "feat: wire gameplay events to audio and juice

GameEngine emits semantic events; FeedbackManager translates them into
sound and juice. Shake applies to the world layer only, never the HUD."
```

---

## Task 11: Make the settings panel real

**Files:**
- Modify: `Frontend/src/component/GameRendering/LobbyButton/SettingModal.jsx:9-88, 199-242`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/DropManager.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/Draws/DrawExplosionEffect.js`
- Create: `Frontend/src/component/GameRendering/LobbyButton/__tests__/SettingModal.test.jsx`

**Interfaces:**
- Consumes: `SettingsStore` (`loadSettings`, `saveSettings`, `getSettings`)
- Produces: nothing

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameRendering/LobbyButton/__tests__/SettingModal.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingModal from '../SettingModal.jsx';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../../GameLogic (MVC)/Feedback/SettingsStore.js';

vi.mock('../../../GameLogic (MVC)/GameContext.jsx', () => ({
  useGame: () => ({ closeSettings: vi.fn() }),
}));

describe('SettingModal', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
  });

  it('loads persisted settings rather than hardcoded defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, audio: { ...DEFAULT_SETTINGS.audio, masterVolume: 33 } });
    render(<SettingModal />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('persists a changed toggle when Apply is pressed', () => {
    render(<SettingModal />);
    fireEvent.click(screen.getByRole('button', { name: /Screen Shake toggle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));
    expect(loadSettings().display.screenShake).toBe(false);
  });

  it('discards changes when Cancel is pressed', () => {
    render(<SettingModal />);
    fireEvent.click(screen.getByRole('button', { name: /Screen Shake toggle/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(loadSettings().display.screenShake).toBe(true);
  });

  it('disables the tutorial hints control, which has nothing to control', () => {
    render(<SettingModal />);
    expect(screen.getByRole('button', { name: /Tutorial Hints toggle/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/LobbyButton/__tests__/SettingModal.test.jsx"`

Expected: FAIL — the modal currently seeds hardcoded state and never reads storage.

- [ ] **Step 3: Replace the modal's dead state**

In `SettingModal.jsx`, replace the import block and the `useState` initialiser (lines 1-28):

```jsx
import React, { useState } from 'react';
import { useGame } from '../../GameLogic (MVC)/GameContext.jsx';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../GameLogic (MVC)/Feedback/SettingsStore.js';
import '../../../style/SettingModal.css';

const SettingModal = () => {
    const { closeSettings } = useGame();

    // Seed from persisted settings, not hardcoded values.
    const [settings, setSettings] = useState(() => loadSettings());
```

Replace `handleApply` and `handleReset` (lines 60-88):

```jsx
    const handleApply = () => {
        saveSettings(settings);
        closeSettings();
    };

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
    };
```

Cancel already calls `closeSettings` without saving, which is now genuinely a discard because the store holds the last applied value.

- [ ] **Step 4: Add accessible names to the toggles**

Each toggle button currently has only a visual label. Add an `aria-label` to every toggle so tests and screen readers can identify them. For each of the six toggle buttons, add an `aria-label` naming its setting, for example on the Screen Shake button (line 190):

```jsx
                            <button
                                aria-label="Screen Shake toggle"
                                className={`toggle-button ${settings.display.screenShake ? 'active' : ''}`}
                                onClick={() => handleDisplayChange('screenShake', !settings.display.screenShake)}
                            >
```

Apply the same pattern with `aria-label="Damage Numbers toggle"`, `"Health Bars toggle"`, `"Auto-collect Energy toggle"`, `"Tutorial Hints toggle"`, and `"Confirm Deployment toggle"`.

- [ ] **Step 5: Disable the tutorial hints control**

There is no tutorial system for this toggle to control. Leaving it live would recreate the exact problem this work is fixing. Replace the Show Tutorial Hints block (lines 223-231) with:

```jsx
                    <div className="setting-item">
                        <label>Show Tutorial Hints (Coming Soon)</label>
                        <button
                            aria-label="Tutorial Hints toggle"
                            className="toggle-button disabled"
                            disabled
                        >
                            Disabled
                        </button>
                    </div>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameRendering/LobbyButton/__tests__/SettingModal.test.jsx"`

Expected: all 4 tests PASS.

- [ ] **Step 7: Wire auto-collect energy**

`DropManager` only has `handleEnemyDeath` — it has no per-frame update. The energy drop update loop lives in `GameEngine.js:718-721`. Add the import to `GameEngine.js`:

```js
import { getSettings } from './Feedback/SettingsStore.js';
```

Replace the loop at line 718 with:

```js
    for (let i = this.energyDrops.length - 1; i >= 0; i--) {
      const drop = this.energyDrops[i];
      // Auto-collect pulls orbs in without a click when the setting is on.
      if (getSettings().gameplay.autoCollectEnergy && !drop.collectAnimation) {
        drop.startCollectionAnimation(110, 20);
        this.inGameEnergy = Math.min(9999, this.inGameEnergy + drop.amount);
        this.energyCollected++;
        this.updateEnergyCb(this.inGameEnergy);
        this.emitFeedback('energy:collected', { amount: drop.amount });
      }
      if (!drop.update()) {
        this.energyDrops.splice(i, 1);
      }
    }
```

- [ ] **Step 8: Wire graphics quality to particle count**

In `DrawExplosionEffect.js`, import the accessor:

```js
import { getSettings } from '../../Feedback/SettingsStore.js';
```

Add a multiplier helper to the class:

```js
    /** Scales particle counts by the graphics quality setting. */
    particleScale() {
        const quality = getSettings().display.graphicsQuality;
        if (quality === 'low') return 0.3;
        if (quality === 'high') return 1.5;
        return 1;
    }
```

The class has two named particle emitters, at line 85 and line 366, each declaring `const particleCount = <number>;`. Scale both, with a floor of 1 so an explosion is never invisible.

Line 85 becomes:

```js
        const particleCount = Math.max(1, Math.round(8 * this.particleScale()));
```

Line 366 becomes:

```js
        const particleCount = Math.max(1, Math.round(12 * this.particleScale()));
```

Leave the other loops (spikes, swirls, cracks, ripples, debris) alone — they are shape geometry rather than particle density, and scaling them would deform the effects rather than thin them.

- [ ] **Step 9: Wire show health bars**

Health bars are drawn inline inside the unit classes, not via a `DrawEntities` method, so gate them at the draw site. In both `EnemyUnits.js` and `DefenderUnits.js`, add the import:

```js
import { getSettings } from './Feedback/SettingsStore.js';
```

There are exactly two blocks to guard, both already conditional on the unit being damaged. Extend each condition with the setting.

`EnemyUnits.js:337` currently reads `if (this.health < this.maxHealth) {`. Change it to:

```js
      if (this.health < this.maxHealth && getSettings().display.showHealthBars) {
```

`DefenderUnits.js` has the matching block whose body starts at line 283 with `ctx.fillStyle = "red";`. Find its enclosing `if (this.health < this.maxHealth) {` (the line immediately above 283) and apply the identical change:

```js
      if (this.health < this.maxHealth && getSettings().display.showHealthBars) {
```

Leave the "Shield health bar" at `EnemyUnits.js:664` alone — a shield is a gameplay state indicator rather than a health bar, and hiding it would conceal information the player needs.

- [ ] **Step 10: Verify everything**

Run: `cd Frontend && npm test`

Expected: the full suite passes.

Run: `cd Frontend && npm run dev`

Open Settings and confirm each control now does something real:
- Drag Master Volume to 0 — all sound stops.
- Drag Music Volume — the chord bed changes level independently of SFX.
- Turn Screen Shake off — base hits no longer shake the view.
- Turn Damage Numbers off — no floating numbers appear.
- Turn Health Bars off — bars disappear from units.
- Set Graphics Quality to Low — explosions emit visibly fewer particles.
- Turn Auto-collect Energy on — orbs collect themselves.
- Press Cancel after changing something — the change is discarded.
- Reload the page — applied settings persist.

- [ ] **Step 11: Commit**

```bash
git add "Frontend/src/component/GameRendering/LobbyButton/" \
        "Frontend/src/component/GameLogic (MVC)/"
git commit -m "feat: wire the settings panel to real behaviour

Every control now changes behaviour or is visibly disabled. Tutorial hints
is disabled rather than faked, since no tutorial system exists."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

Expected: no new errors. The project has existing lint discipline — commit `f70bf97` was a lint fix — so leaving new warnings is not acceptable.

- [ ] **Confirm every success criterion from the spec**

1. Collecting energy, gaining score, and taking base damage never reposition adjacent top-bar text.
2. No `draw*` method leaks canvas state; the regression test proves it.
3. Every gameplay event in the catalog produces audible feedback.
4. Every control in the settings panel either changes real behaviour or is visibly disabled.
5. Settings persist across reloads; Cancel reverts.
6. The full test suite passes.
