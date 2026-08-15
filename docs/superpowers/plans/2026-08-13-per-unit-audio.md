# Per-Unit Audio Voices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the game's 29 units its own audible voice, so a player can tell a Sniper from a Mortar and a Titan's death from a Basic Enemy's without looking.

**Architecture:** A voice table maps unit class name to one signature synth recipe; hit and death variants derive from that signature by declarative scaling, so a unit sounds like itself in every context. `AudioManager` gains a generic `playRecipe` path with a per-key dedupe window and a concurrency cap, and keeps no knowledge of units — `FeedbackManager` owns the unit-to-voice mapping.

**Tech Stack:** Vite 7, Vitest 4, Web Audio API, plain ES modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-13-per-unit-audio-design.md`

**Branch:** `feature/per-unit-audio`, stacked on `feature/spell-semantics` (PR #4). That parent is required — `defender:died` is emitted from `GameEngine.markDefenderDead`, which exists only there.

## Global Constraints

- **No audio files.** Every sound is synthesized at runtime, as on the existing audio layer.
- **Recipe shape is fixed:** `{ wave, freqStart, freqEnd, duration, gain, noise }`, matching `SfxLibrary`.
- **Derived recipes must satisfy the same validity ranges the `SfxLibrary` tests enforce:** `duration` at most 2 seconds, `gain` greater than 0 and at most 1, frequencies within 20–20000 Hz.
- **Variant scaling factors are exact:** `hit` is `duration × 0.35`, `gain × 0.55`. `death` is `freqStart × 0.5`, `freqEnd × 0.5`, `duration × 2.5`, `gain × 1.15`. `fire` is the signature unchanged.
- **Dedupe window is 40ms. Concurrency cap is 12 voices.**
- **Deployment keeps one shared sound** — `defender:placed` must continue to play `defenderPlaced` and ignore its `type` payload.
- **`AudioManager` must not import `UnitVoices`.** It plays recipes; it does not know what a unit is.
- Existing test convention: tests in a `__tests__/` directory beside the source, explicit `vitest` imports (the project runs `globals: false`).
- Path note: `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `Feedback/UnitVoices.js` | Create | The 29-entry voice table, variant scaling, `resolveVoice`, clamping, fallback |
| `Feedback/AudioManager.js` | Modify | Generic `playRecipe`; dedupe window; concurrency cap |
| `Feedback/FeedbackManager.js` | Modify | Routes unit-carrying events through `resolveVoice` |
| `GameEngine.js` | Modify | Three emit sites gain a `unitType` field |
| `Feedback/__tests__/UnitVoices.test.js` | Create | Coverage, derivation, clamping, fallback |
| `Feedback/__tests__/AudioManager.test.js` | Modify | Dedupe and cap tests appended |
| `Feedback/__tests__/FeedbackManager.test.js` | Modify | Routing tests appended |

---

## Task 1: The voice table

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js`

**Interfaces:**
- Consumes: `SFX` from `Feedback/SfxLibrary.js` (for fallback recipes)
- Produces:
  - `UNIT_VOICES` — object mapping unit class name to a signature recipe
  - `VARIANTS` — object mapping variant name to its scaling factors
  - `resolveVoice(unitName, variant): recipe` — returns a valid, clamped recipe; falls back to a generic `SFX` recipe for an unknown name

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as DefenderUnits from '../../DefenderUnits.js';
import * as EnemyUnits from '../../EnemyUnits.js';
import { UNIT_VOICES, resolveVoice } from '../UnitVoices.js';
import { SFX } from '../SfxLibrary.js';

/** Base classes are abstract - they never reach a feedback event on their own. */
const BASE_CLASSES = ['DefenderUnit', 'Enemy'];

/** True only for `class` declarations, not plain exported functions. */
function isClass(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

/**
 * Every concrete unit class the game can instantiate.
 *
 * The isClass filter matters: DefenderUnits.js also exports the plain function
 * isConsumableSpell, which a bare `typeof === 'function'` check would count as a
 * unit and then demand a voice for.
 */
function allUnitNames() {
  const modules = { ...DefenderUnits, ...EnemyUnits };
  return Object.keys(modules)
    .filter((name) => isClass(modules[name]))
    .filter((name) => !BASE_CLASSES.includes(name));
}

describe('voice coverage', () => {
  it('every concrete unit class has a voice', () => {
    const missing = allUnitNames().filter((name) => !UNIT_VOICES[name]);
    expect(missing, `units without a voice: ${missing.join(', ')}`).toEqual([]);
  });

  it('covers all 29 units', () => {
    expect(allUnitNames()).toHaveLength(29);
  });

  it('defines no voice for a class that does not exist', () => {
    const known = new Set(allUnitNames());
    const extra = Object.keys(UNIT_VOICES).filter((name) => !known.has(name));
    expect(extra, `voices for unknown classes: ${extra.join(', ')}`).toEqual([]);
  });
});

describe('voice recipes are valid', () => {
  it.each(Object.entries(UNIT_VOICES))('%s is well formed', (name, recipe) => {
    expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(recipe.wave);
    expect(recipe.freqStart).toBeGreaterThan(0);
    expect(recipe.freqEnd).toBeGreaterThan(0);
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(1);
    expect(typeof recipe.noise).toBe('boolean');
  });
});

describe('resolveVoice', () => {
  it('returns the signature unchanged for the fire variant', () => {
    expect(resolveVoice('Sniper', 'fire')).toEqual(UNIT_VOICES.Sniper);
  });

  it('shortens and quietens the hit variant', () => {
    const signature = UNIT_VOICES.Sniper;
    const hit = resolveVoice('Sniper', 'hit');

    expect(hit.duration).toBeCloseTo(signature.duration * 0.35);
    expect(hit.gain).toBeCloseTo(signature.gain * 0.55);
    expect(hit.freqStart).toBe(signature.freqStart);
  });

  it('pitches down and stretches the death variant', () => {
    const signature = UNIT_VOICES.Sniper;
    const death = resolveVoice('Sniper', 'death');

    expect(death.freqStart).toBeCloseTo(signature.freqStart * 0.5);
    expect(death.freqEnd).toBeCloseTo(signature.freqEnd * 0.5);
    expect(death.duration).toBeCloseTo(signature.duration * 2.5);
    expect(death.gain).toBeCloseTo(signature.gain * 1.15);
  });

  it('keeps the waveform and noise flag across variants', () => {
    const signature = UNIT_VOICES.Mortar;
    for (const variant of ['fire', 'hit', 'death']) {
      const recipe = resolveVoice('Mortar', variant);
      expect(recipe.wave).toBe(signature.wave);
      expect(recipe.noise).toBe(signature.noise);
    }
  });

  it('never derives a recipe outside the valid ranges', () => {
    for (const name of Object.keys(UNIT_VOICES)) {
      for (const variant of ['fire', 'hit', 'death']) {
        const recipe = resolveVoice(name, variant);
        expect(recipe.duration, `${name}/${variant} duration`).toBeGreaterThan(0);
        expect(recipe.duration, `${name}/${variant} duration`).toBeLessThanOrEqual(2);
        expect(recipe.gain, `${name}/${variant} gain`).toBeGreaterThan(0);
        expect(recipe.gain, `${name}/${variant} gain`).toBeLessThanOrEqual(1);
        expect(recipe.freqStart, `${name}/${variant} freqStart`).toBeGreaterThanOrEqual(20);
        expect(recipe.freqEnd, `${name}/${variant} freqEnd`).toBeGreaterThanOrEqual(20);
        expect(recipe.freqStart, `${name}/${variant} freqStart`).toBeLessThanOrEqual(20000);
      }
    }
  });

  it('clamps a signature that would derive out of range', () => {
    // duration 1.5 * 2.5 = 3.75, above the 2s ceiling; gain 0.95 * 1.15 = 1.09, above 1.
    const extreme = { wave: 'sine', freqStart: 30, freqEnd: 25, duration: 1.5, gain: 0.95, noise: false };
    const death = resolveVoice('__test__', 'death', extreme);

    expect(death.duration).toBe(2);
    expect(death.gain).toBe(1);
    expect(death.freqEnd).toBeGreaterThanOrEqual(20);
  });

  it('falls back to a generic recipe for an unknown unit', () => {
    expect(resolveVoice('NoSuchUnit', 'fire')).toEqual(SFX.projectileFired);
    expect(resolveVoice('NoSuchUnit', 'hit')).toEqual(SFX.enemyHit);
    expect(resolveVoice('NoSuchUnit', 'death')).toEqual(SFX.enemyDied);
  });

  it('does not throw on a null or undefined unit name', () => {
    expect(() => resolveVoice(null, 'death')).not.toThrow();
    expect(() => resolveVoice(undefined, 'fire')).not.toThrow();
  });

  it('falls back to the fire variant for an unknown variant name', () => {
    expect(resolveVoice('Sniper', 'nonsense')).toEqual(UNIT_VOICES.Sniper);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js"`

Expected: FAIL — cannot resolve `../UnitVoices.js`.

- [ ] **Step 3: Implement UnitVoices**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js`:

```js
import { SFX } from './SfxLibrary.js';

/**
 * One signature recipe per unit - that unit's voice.
 *
 * Hit and death sounds are DERIVED from the signature (see VARIANTS) rather than
 * authored separately, so a unit is recognisable as itself whether it is firing,
 * being hit, or dying. Recipe shape matches SfxLibrary.
 *
 * Barricade, EnergyGenerator, FireBlast and IceBomb never fire a projectile, so
 * their signatures are tuned for how the derived death variant reads.
 */
export const UNIT_VOICES = {
  // --- Defenders ---
  BasicDefender:    { wave: 'square',   freqStart: 640,  freqEnd: 880,  duration: 0.06, gain: 0.18, noise: false },
  HealerDefender:   { wave: 'sine',     freqStart: 660,  freqEnd: 990,  duration: 0.18, gain: 0.28, noise: false },
  GrenadeDefender:  { wave: 'sawtooth', freqStart: 220,  freqEnd: 110,  duration: 0.14, gain: 0.40, noise: true  },
  BarricadeDefender:{ wave: 'triangle', freqStart: 160,  freqEnd: 120,  duration: 0.20, gain: 0.30, noise: false },
  EnergyGenerator:  { wave: 'sine',     freqStart: 520,  freqEnd: 780,  duration: 0.16, gain: 0.22, noise: false },
  Sniper:           { wave: 'square',   freqStart: 1400, freqEnd: 700,  duration: 0.05, gain: 0.30, noise: false },
  Mortar:           { wave: 'sawtooth', freqStart: 120,  freqEnd: 60,   duration: 0.30, gain: 0.50, noise: true  },
  FrostArcher:      { wave: 'triangle', freqStart: 1100, freqEnd: 1500, duration: 0.12, gain: 0.22, noise: false },
  FireBlast:        { wave: 'sawtooth', freqStart: 300,  freqEnd: 80,   duration: 0.40, gain: 0.50, noise: true  },
  IceBomb:          { wave: 'sine',     freqStart: 900,  freqEnd: 300,  duration: 0.35, gain: 0.40, noise: true  },

  // --- Enemies ---
  BasicEnemy:       { wave: 'sawtooth', freqStart: 300,  freqEnd: 180,  duration: 0.12, gain: 0.25, noise: true  },
  FastEnemy:        { wave: 'square',   freqStart: 520,  freqEnd: 380,  duration: 0.08, gain: 0.20, noise: false },
  TankEnemy:        { wave: 'sawtooth', freqStart: 150,  freqEnd: 90,   duration: 0.22, gain: 0.40, noise: true  },
  BombEnemy:        { wave: 'sawtooth', freqStart: 260,  freqEnd: 70,   duration: 0.30, gain: 0.45, noise: true  },
  RangeEnemy:       { wave: 'triangle', freqStart: 420,  freqEnd: 300,  duration: 0.10, gain: 0.22, noise: false },
  ShieldEnemy:      { wave: 'square',   freqStart: 260,  freqEnd: 200,  duration: 0.16, gain: 0.30, noise: true  },
  HealerEnemy:      { wave: 'sine',     freqStart: 600,  freqEnd: 420,  duration: 0.16, gain: 0.25, noise: false },
  SplitterEnemy:    { wave: 'sawtooth', freqStart: 380,  freqEnd: 220,  duration: 0.14, gain: 0.28, noise: true  },
  MiniEnemy:        { wave: 'square',   freqStart: 700,  freqEnd: 560,  duration: 0.07, gain: 0.16, noise: false },
  SwarmLeader:      { wave: 'sawtooth', freqStart: 340,  freqEnd: 240,  duration: 0.18, gain: 0.30, noise: true  },
  EMPEnemy:         { wave: 'square',   freqStart: 800,  freqEnd: 200,  duration: 0.20, gain: 0.30, noise: false },
  VampireEnemy:     { wave: 'triangle', freqStart: 340,  freqEnd: 200,  duration: 0.20, gain: 0.28, noise: false },
  GhostEnemy:       { wave: 'sine',     freqStart: 500,  freqEnd: 260,  duration: 0.28, gain: 0.22, noise: false },
  BerserkerEnemy:   { wave: 'sawtooth', freqStart: 240,  freqEnd: 140,  duration: 0.20, gain: 0.42, noise: true  },
  NecromancerEnemy: { wave: 'triangle', freqStart: 200,  freqEnd: 130,  duration: 0.30, gain: 0.35, noise: false },
  AssassinEnemy:    { wave: 'square',   freqStart: 900,  freqEnd: 500,  duration: 0.07, gain: 0.25, noise: false },
  MageEnemy:        { wave: 'sine',     freqStart: 700,  freqEnd: 460,  duration: 0.22, gain: 0.30, noise: false },
  TitanEnemy:       { wave: 'sawtooth', freqStart: 100,  freqEnd: 50,   duration: 0.40, gain: 0.55, noise: true  },
  BossEnemy:        { wave: 'sawtooth', freqStart: 130,  freqEnd: 55,   duration: 0.50, gain: 0.60, noise: true  },
};

/** How each variant transforms a unit's signature. */
export const VARIANTS = {
  fire:  { freqScale: 1,   durationScale: 1,    gainScale: 1    },
  hit:   { freqScale: 1,   durationScale: 0.35, gainScale: 0.55 },
  death: { freqScale: 0.5, durationScale: 2.5,  gainScale: 1.15 },
};

/** Generic recipes used when a unit has no voice of its own. */
const FALLBACK = {
  fire:  SFX.projectileFired,
  hit:   SFX.enemyHit,
  death: SFX.enemyDied,
};

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MAX_DURATION = 2;
const MAX_GAIN = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves a unit's voice for one variant.
 *
 * Unknown unit names fall back to the generic recipe rather than going silent or
 * throwing - a unit added later is quieter than intended, never broken.
 *
 * The optional signature parameter exists for testing derivation against a known
 * input; production callers pass two arguments.
 */
export function resolveVoice(unitName, variant, signature = UNIT_VOICES[unitName]) {
  const scale = VARIANTS[variant] ?? VARIANTS.fire;

  if (!signature) {
    return FALLBACK[variant] ?? FALLBACK.fire;
  }

  return {
    wave: signature.wave,
    noise: signature.noise,
    freqStart: clamp(signature.freqStart * scale.freqScale, MIN_FREQ, MAX_FREQ),
    freqEnd: clamp(signature.freqEnd * scale.freqScale, MIN_FREQ, MAX_FREQ),
    duration: clamp(signature.duration * scale.durationScale, 0.01, MAX_DURATION),
    gain: clamp(signature.gain * scale.gainScale, 0.001, MAX_GAIN),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js"`

Expected: all tests PASS.

If the "covers all 29 units" test fails with a different count, do NOT change the number to match. Read which classes the helper found and report the discrepancy — the count is a deliberate assertion that the roster is what the spec says it is.

- [ ] **Step 5: Run the full suite**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

Expected: all pre-existing tests still pass. `UnitVoices.js` is new and imported by nothing yet, so nothing existing can break.

- [ ] **Step 6: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js"
git commit -m "feat: add per-unit voice table with derived variants

One signature recipe per unit; hit and death variants derive from it by
declarative scaling so a unit sounds like itself in every context. A coverage
test fails by name if any concrete unit class lacks a voice."
```

---

## Task 2: Voice limiting in AudioManager

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js` (`playSfx`, around line 92)
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js` (append)

**Interfaces:**
- Consumes: nothing from Task 1 — `AudioManager` must NOT import `UnitVoices`
- Produces:
  - `AudioManager.playRecipe(recipe, dedupeKey)` — plays any recipe object, applying the dedupe window and concurrency cap
  - `AudioManager.playSfx(id)` — unchanged signature, now delegates to `playRecipe(SFX[id], id)`
  - Exported constants `DEDUPE_WINDOW_SECONDS = 0.04` and `MAX_VOICES = 12`

**Background:** `playSfx` currently creates nodes for every call unconditionally. When a Grenadier's splash kills six Basic Enemies on one frame, six identical sounds start at the same instant and their amplitudes sum — six times the intended level, which clips and reads as one distorted noise. This task adds the dedupe window that collapses those into one, and a cap so a runaway wave cannot saturate the mix.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js`.

Add `DEDUPE_WINDOW_SECONDS` and `MAX_VOICES` to the existing import from `../AudioManager.js`, then append:

```js
describe('voice limiting', () => {
  const RECIPE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('exposes the configured window and cap', () => {
    expect(DEDUPE_WINDOW_SECONDS).toBe(0.04);
    expect(MAX_VOICES).toBe(12);
  });

  it('plays a recipe object directly', () => {
    const { ctx, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'Sniper:fire');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('collapses the same key repeated inside the window', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'BasicEnemy:death');

    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('plays the same key again once the window has passed', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    ctx.currentTime += 0.05;
    audio.playRecipe(RECIPE, 'BasicEnemy:death');

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('does not collapse DIFFERENT keys in the same frame', () => {
    const { ctx, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'BasicEnemy:death');
    audio.playRecipe(RECIPE, 'TitanEnemy:death');
    audio.playRecipe(RECIPE, 'Sniper:fire');

    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('stops the oldest voice when the cap is exceeded', () => {
    const { ctx, made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }
    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);

    audio.playRecipe(RECIPE, 'overflow:death');

    // The oldest voice is stopped a second time, early.
    expect(made.oscillators[0].stop.mock.calls.length).toBe(2);
  });

  it('leaves voices untouched at exactly the cap', () => {
    const { made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }

    expect(made.oscillators.every((osc) => osc.stop.mock.calls.length === 1)).toBe(true);
  });

  it('forgets voices that have already finished', () => {
    const { ctx, made, audio } = readyAudio();

    for (let i = 0; i < MAX_VOICES; i++) {
      audio.playRecipe(RECIPE, `unit${i}:death`);
    }
    // Advance past the recipe duration so every voice has ended naturally.
    // The cap should then have room again without stopping anything early.
    ctx.currentTime += 1;
    audio.playRecipe(RECIPE, 'later:death');

    expect(made.oscillators[0].stop.mock.calls.length).toBe(1);
  });

  it('still plays shared sounds through playSfx', () => {
    const { ctx, audio } = readyAudio();
    audio.playSfx('enemyHit');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('dedupes playSfx by its sound id', () => {
    const { ctx, audio } = readyAudio();
    audio.playSfx('enemyHit');
    audio.playSfx('enemyHit');
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
  });

  it('ignores an unknown sound id without throwing', () => {
    const { audio } = readyAudio();
    expect(() => audio.playSfx('nope')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js" -t "voice limiting"`

Expected: FAIL — `playRecipe` is not a function, and the constants are not exported.

- [ ] **Step 3: Implement the constants and voice tracking**

In `AudioManager.js`, add these exports beside the existing `volumeToGain`:

```js
/** The same sound key repeated inside this window plays once. */
export const DEDUPE_WINDOW_SECONDS = 0.04;

/** Maximum simultaneously sounding voices. */
export const MAX_VOICES = 12;
```

In the constructor, beside the existing fields, add:

```js
    this.lastPlayedAt = new Map(); // dedupe key -> AudioContext time
    this.activeVoices = [];        // { source, endTime }, oldest first
```

- [ ] **Step 4: Replace `playSfx` with the generic path**

`playSfx` currently reads:

```js
  playSfx(id) {
    const recipe = SFX[id];
    if (!recipe || !this.ctx) return;
    ...
  }
```

Replace the whole method with these two:

```js
  playSfx(id) {
    this.playRecipe(SFX[id], id);
  }

  /**
   * Plays any recipe, keyed for deduplication.
   *
   * Two limits keep a busy wave readable. The same key inside DEDUPE_WINDOW_SECONDS
   * plays once - six splash kills would otherwise start six identical sounds whose
   * amplitudes sum to six times the intended level, which clips. And no more than
   * MAX_VOICES sound at once; beyond that the oldest is stopped early.
   */
  playRecipe(recipe, dedupeKey) {
    if (!recipe || !this.ctx) return;

    const now = this.ctx.currentTime;

    const lastPlayed = this.lastPlayedAt.get(dedupeKey);
    if (lastPlayed !== undefined && now - lastPlayed < DEDUPE_WINDOW_SECONDS) return;
    this.lastPlayedAt.set(dedupeKey, now);

    // Drop voices that have already finished before judging the cap.
    this.activeVoices = this.activeVoices.filter((voice) => voice.endTime > now);
    if (this.activeVoices.length >= MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      try {
        oldest.source.stop(now);
      } catch {
        // Already stopped; nothing to do.
      }
    }

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

    this.activeVoices.push({ source, endTime: end });
  }
```

Note `playSfx` no longer guards `!recipe` itself — `playRecipe` does, so an unknown id is still a safe no-op.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"`

Expected: all tests in the file PASS, including the pre-existing ones.

**One pre-existing test may now fail:** any test that calls the same sound twice in a row and expects two oscillators will now get one, because dedupe applies to `playSfx` too. If that happens, it is an intended behaviour change — advance `ctx.currentTime` past the window between the two calls and add a brief comment saying why. Do NOT remove the dedupe. Report exactly which test you changed and why.

- [ ] **Step 6: Run the full suite**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

- [ ] **Step 7: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"
git commit -m "feat: add voice dedupe window and concurrency cap

playSfx created nodes unconditionally, so six splash kills started six
identical sounds whose amplitudes summed and clipped. Adds a 40ms per-key
dedupe window and a 12-voice cap, both in a generic playRecipe path."
```

---

## Task 3: Route unit events through their voices

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (three emit sites)
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js` (append)

**Interfaces:**
- Consumes: `resolveVoice(unitName, variant)` from Task 1; `audio.playRecipe(recipe, dedupeKey)` from Task 2
- Produces: nothing

**Background:** `defender:placed` and `projectile:fired` already carry unit identity and their handlers ignore it. Three other events carry no identity at all and need it added. All three new fields use the key `unitType`.

**IMPORTANT — locate the emit sites by surrounding code, not by line number.** Earlier work on this codebase shifted line numbers repeatedly, and a plan citing stale numbers caused two real defects. Find each by its content:

- `enemy:hit` — inside the projectile-hit branch, emitted right after `projectile.target.takeDamage(...)`.
- `enemy:died` — inside `emitEnemyDeathFeedback(enemy)`, the dedupe helper.
- `defender:died` — inside `markDefenderDead(defender)`.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js`.

Add these imports to the file's existing import block:

```js
import { resolveVoice, UNIT_VOICES } from '../UnitVoices.js';
```

Then append:

```js
describe('per-unit voices', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = { playSfx: vi.fn(), playRecipe: vi.fn(), setVolumes: vi.fn() };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('plays the firing defender its own voice', () => {
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('Sniper', 'fire'),
      'Sniper:fire',
    );
  });

  it('gives two different defenders different firing sounds', () => {
    bus.emit('projectile:fired', { defenderType: 'Sniper' });
    bus.emit('projectile:fired', { defenderType: 'Mortar' });

    const [first, second] = audio.playRecipe.mock.calls;
    expect(first[0]).not.toEqual(second[0]);
    expect(first[1]).not.toBe(second[1]);
  });

  it('plays the dying enemy its own death voice', () => {
    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('TitanEnemy', 'death'),
      'TitanEnemy:death',
    );
  });

  it('plays the hit enemy its own hit voice and still shows a damage number', () => {
    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('TankEnemy', 'hit'),
      'TankEnemy:hit',
    );
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
  });

  it('plays the dying defender its own death voice and still shakes', () => {
    bus.emit('defender:died', { unitType: 'Mortar', x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('Mortar', 'death'),
      'Mortar:death',
    );
    expect(juice.addTrauma).toHaveBeenCalled();
  });

  it('keeps boss deaths dramatic - hit stop and heavy shake', () => {
    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });

    expect(juice.triggerHitStop).toHaveBeenCalled();
    expect(juice.addTrauma).toHaveBeenCalledWith(0.6);
  });

  it('deployment stays ONE shared sound regardless of unit', () => {
    bus.emit('defender:placed', { type: 'Sniper' });
    bus.emit('defender:placed', { type: 'Mortar' });

    expect(audio.playSfx).toHaveBeenCalledTimes(2);
    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('falls back without throwing when an event carries no unit type', () => {
    expect(() => bus.emit('enemy:died', { isBoss: false, x: 1, y: 2 })).not.toThrow();
    expect(audio.playRecipe).toHaveBeenCalled();
  });

  it('leaves non-unit events on the shared sounds', () => {
    bus.emit('energy:collected', { amount: 25 });
    bus.emit('level:won', {});

    expect(audio.playSfx).toHaveBeenCalledWith('energyCollected');
    expect(audio.playSfx).toHaveBeenCalledWith('levelWon');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js" -t "per-unit voices"`

Expected: FAIL — the handlers still call `playSfx` with generic ids, so `playRecipe` is never called. The "deployment stays ONE shared sound" and "leaves non-unit events on the shared sounds" tests should PASS already, confirming the existing routing works.

- [ ] **Step 3: Add the `unitType` field at the three emit sites**

In `GameEngine.js`, find each site by its surrounding content and add the field.

The `enemy:hit` emit, following `projectile.target.takeDamage(...)`, becomes:

```js
          this.emitFeedback('enemy:hit', {
            unitType: projectile.target.constructor.name,
            damage: projectile.damage,
            x: projectile.target.x + projectile.target.width / 2,
            y: projectile.target.y,
          });
```

The `enemy:died` emit inside `emitEnemyDeathFeedback(enemy)` becomes:

```js
    this.emitFeedback('enemy:died', {
      unitType: enemy.constructor.name,
      isBoss: Boolean(enemy.isBoss), x: enemy.x, y: enemy.y,
    });
```

The `defender:died` emit inside `markDefenderDead(defender)` becomes:

```js
    this.emitFeedback('defender:died', {
      unitType: defender.constructor.name,
      x: defender.x,
      y: defender.y,
    });
```

- [ ] **Step 4: Route the handlers through `resolveVoice`**

In `FeedbackManager.js`, add the import:

```js
import { resolveVoice } from './UnitVoices.js';
```

Add a small private helper to the class, above `attach()`:

```js
  /** Plays a unit's own voice for one variant, keyed so repeats collapse. */
  playUnitVoice(unitName, variant) {
    this.audio.playRecipe(resolveVoice(unitName, variant), `${unitName}:${variant}`);
  }
```

Then replace four handlers inside `attach()`.

`projectile:fired` becomes:

```js
    on('projectile:fired', ({ defenderType }) => this.playUnitVoice(defenderType, 'fire'));
```

`enemy:hit` becomes:

```js
    on('enemy:hit', ({ unitType, damage, x, y }) => {
      this.playUnitVoice(unitType, 'hit');
      this.juice.addDamageNumber(x, y, damage);
    });
```

`enemy:died` becomes:

```js
    on('enemy:died', ({ unitType, isBoss }) => {
      this.playUnitVoice(unitType, 'death');
      if (isBoss) {
        this.juice.addTrauma(0.6);
        this.juice.triggerHitStop(80);
      } else {
        this.juice.addTrauma(0.08);
      }
    });
```

Note the boss branch no longer selects a different sound — a boss now has its own voice like every other unit — but it keeps the heavier shake and the hit-stop, which are what make a boss death feel weighty.

`defender:died` becomes:

```js
    on('defender:died', ({ unitType }) => {
      this.playUnitVoice(unitType, 'death');
      this.juice.addTrauma(0.15);
    });
```

**Leave `defender:placed` exactly as it is.** It must keep calling `this.audio.playSfx('defenderPlaced')` and ignoring its payload.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"`

Expected: all tests in the file PASS.

**Pre-existing tests in this file will need updating**, because four handlers no longer call `playSfx`. Any existing test asserting `playSfx` was called with `'enemyDied'`, `'bossDied'`, `'enemyHit'`, `'projectileFired'`, or `'defenderDied'` is now testing removed behaviour. Update those to assert the corresponding `playRecipe` call instead, and add a brief comment noting the sound is now per-unit. Report exactly which tests you changed. Do NOT delete them and do NOT weaken them to `expect(...).toHaveBeenCalled()` without an argument check.

- [ ] **Step 6: Run the full suite**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

- [ ] **Step 7: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"
git commit -m "feat: route unit events through per-unit voices

Firing, hit and death now play the unit's own voice; three emit sites gained
a unitType field. Deployment deliberately keeps one shared sound."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

Expected: no new errors.

- [ ] **Confirm each success criterion from the spec**

1. Each of the 29 units has a distinct, hand-tuned voice.
2. A unit is recognisable as the same unit whether firing, being hit, or dying.
3. Deployment plays one shared sound regardless of unit.
4. Six simultaneous identical kills produce one clean sound, not six stacked.
5. Two different units dying simultaneously both play.
6. Adding a unit class without a voice fails the test suite by name.
7. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 1, 2 and 4 are audible rather than testable. Play a level and confirm: different defenders sound different when firing; a unit's death is recognisably the same unit that was firing; a Grenadier splash killing several enemies at once produces one clean sound rather than a distorted crunch; and placing any defender still plays the same placement sound.
