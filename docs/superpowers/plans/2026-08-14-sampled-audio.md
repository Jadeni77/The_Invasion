# Sampled Audio with Synthesis Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the project owner improve the game's audio by dropping `<ClassName>.ogg` files into a folder, with the existing synthesized voices as a per-unit fallback so nothing ever goes silent.

**Architecture:** `import.meta.glob` discovers sample files at build time and maps each basename to its hashed URL. `AudioManager` loads and decodes them into a buffer cache and plays them through the same envelope, dedupe window and voice cap as synthesized sounds. `FeedbackManager` decides per unit whether a sample exists, falling back to `resolveVoice` when it does not.

**Tech Stack:** Vite 7, Vitest 4, Web Audio API, plain ES modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-14-sampled-audio-design.md`

**Branch:** `feature/per-unit-audio` — continues the existing branch and PR #5 rather than stacking, so the PR lands as one coherent change.

## Global Constraints

- **Sample files live at `Frontend/src/assets/audio/units/<ClassName>.<ext>`**, where `<ClassName>` exactly matches the unit's class name — the same keys `UNIT_VOICES` uses. Supported extensions: `ogg`, `wav`, `mp3`.
- **The synthesized voice table is kept, not deleted.** It is the fallback. With zero sample files present the game must sound exactly as it does today.
- **The fallback decision lives in `FeedbackManager`, never in `AudioManager`.** `AudioManager` exposes `hasSample(name)` — a plain string lookup — and holds no knowledge of units.
- **Samples obey the existing limits:** the 40ms per-key dedupe window (`DEDUPE_WINDOW_SECONDS`) and the 12-voice cap (`MAX_VOICES`).
- **Per-file load failures are isolated.** One fetch or decode error leaves that unit on synthesis; every other file still loads.
- **`death` effective duration is `buffer.duration / playbackRate`.** Using the raw buffer duration would cut every death sound off early.
- The roster is 29 units: 10 defenders and 19 enemies.
- Existing test convention: tests in a `__tests__/` directory beside the source, explicit `vitest` imports (`globals: false`).
- Path note: `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `Feedback/UnitSamples.js` | Create | Build-time discovery, basename mapping, variant transforms, misnamed-file detection |
| `Feedback/AudioManager.js` | Modify | `loadSamples`, `hasSample`, `playSample` |
| `Feedback/FeedbackManager.js` | Modify | Per-unit sample-or-synth routing |
| `GameContext.jsx` | Modify | Calls `loadSamples` on the first-gesture audio start |
| `GameEngine.js` | Modify | Three added `enemy:hit` emits |
| `DefenderUnits.js` | Modify | Spell detonation emits |
| `src/assets/audio/units/README.md` | Create | The 29-filename checklist for the owner |

---

## Task 1: Discovery and transforms

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/UnitSamples.js`
- Create: `Frontend/src/assets/audio/units/README.md`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js`

**Interfaces:**
- Consumes: `UNIT_VOICES` from `Feedback/UnitVoices.js` (to detect misnamed files)
- Produces:
  - `sampleNameFromPath(path): string` — basename without extension
  - `SAMPLE_URLS: Record<string, string>` — name → hashed URL, built from `import.meta.glob`
  - `SAMPLE_VARIANTS: Record<'fire'|'hit'|'death', {playbackRate, gainScale, durationScale}>`
  - `unknownSampleNames(names): string[]` — supplied names that match no unit class

Note the sample base gain is NOT defined here. It is an audio-playback concern and belongs solely to
`AudioManager` (Task 2), which is its only consumer. Defining it in both places would be a needless
duplication.

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  sampleNameFromPath,
  SAMPLE_VARIANTS,
  unknownSampleNames,
} from '../UnitSamples.js';

describe('sampleNameFromPath', () => {
  it.each([
    ['/src/assets/audio/units/Mortar.ogg', 'Mortar'],
    ['/src/assets/audio/units/Sniper.wav', 'Sniper'],
    ['/src/assets/audio/units/TitanEnemy.mp3', 'TitanEnemy'],
    ['../../assets/audio/units/BasicEnemy.ogg', 'BasicEnemy'],
  ])('maps %s to %s', (path, expected) => {
    expect(sampleNameFromPath(path)).toBe(expected);
  });

  it('keeps a name containing dots intact apart from the extension', () => {
    expect(sampleNameFromPath('/a/b/My.Unit.ogg')).toBe('My.Unit');
  });
});

describe('SAMPLE_VARIANTS', () => {
  it('plays fire untransformed', () => {
    expect(SAMPLE_VARIANTS.fire).toEqual({ playbackRate: 1, gainScale: 1, durationScale: 1 });
  });

  it('makes hit shorter and quieter at normal pitch', () => {
    expect(SAMPLE_VARIANTS.hit.playbackRate).toBe(1);
    expect(SAMPLE_VARIANTS.hit.gainScale).toBe(0.55);
    expect(SAMPLE_VARIANTS.hit.durationScale).toBe(0.35);
  });

  it('pitches death down, which also lengthens it', () => {
    expect(SAMPLE_VARIANTS.death.playbackRate).toBe(0.75);
    expect(SAMPLE_VARIANTS.death.durationScale).toBe(1);
  });

  it('every variant is within valid multiplier ranges', () => {
    for (const [name, t] of Object.entries(SAMPLE_VARIANTS)) {
      expect(t.playbackRate, `${name} playbackRate`).toBeGreaterThan(0);
      expect(t.gainScale, `${name} gainScale`).toBeGreaterThan(0);
      expect(t.gainScale, `${name} gainScale`).toBeLessThanOrEqual(1);
      expect(t.durationScale, `${name} durationScale`).toBeGreaterThan(0);
    }
  });
});

describe('unknownSampleNames', () => {
  it('accepts names that match unit classes', () => {
    expect(unknownSampleNames(['Mortar', 'Sniper', 'TitanEnemy'])).toEqual([]);
  });

  it('reports a misnamed file so a typo is visible', () => {
    expect(unknownSampleNames(['Mortar', 'Zombie'])).toEqual(['Zombie']);
  });

  it('is case sensitive, because class names are', () => {
    expect(unknownSampleNames(['mortar'])).toEqual(['mortar']);
  });

  it('returns an empty array for no input', () => {
    expect(unknownSampleNames([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js"`

Expected: FAIL — cannot resolve `../UnitSamples.js`.

- [ ] **Step 3: Implement UnitSamples**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/UnitSamples.js`:

```js
import { UNIT_VOICES } from './UnitVoices.js';

/**
 * Sample files are discovered at build time by filename. Dropping
 * src/assets/audio/units/Mortar.ogg makes the Mortar play that sample with no
 * code change; a unit with no file keeps its synthesized voice.
 */
const modules = import.meta.glob('/src/assets/audio/units/*.{ogg,wav,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Strips directories and the file extension, leaving the unit class name. */
export function sampleNameFromPath(path) {
  const file = path.split('/').pop();
  const lastDot = file.lastIndexOf('.');
  return lastDot === -1 ? file : file.slice(0, lastDot);
}

/** Unit class name -> hashed asset URL, for every supplied file. */
export const SAMPLE_URLS = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [sampleNameFromPath(path), url]),
);

/**
 * How each variant transforms a unit's sample.
 *
 * death lowers playbackRate, which pitches the sound down AND lengthens it -
 * the natural analogue of the synthesized death variant. Its effective duration
 * is therefore buffer.duration / playbackRate, not buffer.duration.
 */
export const SAMPLE_VARIANTS = {
  fire:  { playbackRate: 1,    gainScale: 1,    durationScale: 1    },
  hit:   { playbackRate: 1,    gainScale: 0.55, durationScale: 0.35 },
  death: { playbackRate: 0.75, gainScale: 1,    durationScale: 1    },
};

/**
 * Supplied sample names that match no unit class.
 *
 * A misnamed file loads fine and then never plays, silently. Reporting it turns
 * a typo into a visible mistake.
 */
export function unknownSampleNames(names) {
  return names.filter((name) => !Object.hasOwn(UNIT_VOICES, name));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js"`

Expected: all tests PASS. Note `import.meta.glob` over an empty or absent directory resolves to `{}` under Vitest, so `SAMPLE_URLS` is simply empty — that is the correct state before any file is supplied.

- [ ] **Step 5: Create the owner's checklist**

Create `Frontend/src/assets/audio/units/README.md`:

```markdown
# Unit sound files

Drop a file here named exactly after a unit's class name and that unit will play it.
No code change is needed — files are discovered at build time.

Supported extensions: `.ogg` (preferred — small and widely supported), `.wav`, `.mp3`.

**Any unit without a file keeps its synthesized voice**, so you can add these a few at a
time and hear each one. Nothing goes silent.

Each file is used three ways: as recorded when the unit acts, shortened and quieter when
it lands a hit, and pitched down when it dies. Short, punchy sounds work best — roughly
0.1 to 0.5 seconds.

A file whose name matches no unit below is reported as a warning in the browser console,
so a typo is visible rather than silent.

## Defenders (10)

- [ ] `BasicDefender.ogg` — the Shooter
- [ ] `HealerDefender.ogg` — Healer
- [ ] `GrenadeDefender.ogg` — Grenadier
- [ ] `BarricadeDefender.ogg` — Barricade (heard only when destroyed)
- [ ] `EnergyGenerator.ogg` — E-Gen (heard only when destroyed)
- [ ] `Sniper.ogg` — Sniper
- [ ] `Mortar.ogg` — Mortar
- [ ] `FrostArcher.ogg` — Frost Archer
- [ ] `FireBlast.ogg` — Fire Blast spell
- [ ] `IceBomb.ogg` — Ice Bomb spell

## Enemies (19)

- [ ] `BasicEnemy.ogg`
- [ ] `FastEnemy.ogg`
- [ ] `TankEnemy.ogg`
- [ ] `BombEnemy.ogg`
- [ ] `RangeEnemy.ogg`
- [ ] `ShieldEnemy.ogg`
- [ ] `HealerEnemy.ogg`
- [ ] `SplitterEnemy.ogg`
- [ ] `MiniEnemy.ogg`
- [ ] `SwarmLeader.ogg`
- [ ] `EMPEnemy.ogg`
- [ ] `VampireEnemy.ogg`
- [ ] `GhostEnemy.ogg`
- [ ] `BerserkerEnemy.ogg`
- [ ] `NecromancerEnemy.ogg`
- [ ] `AssassinEnemy.ogg`
- [ ] `MageEnemy.ogg`
- [ ] `TitanEnemy.ogg`
- [ ] `BossEnemy.ogg` — currently unreachable; `BossEnemy` is not wired into the engine

Good CC0 sources: [Kenney](https://kenney.nl/assets?q=audio) (Impact Sounds and Digital Audio
suit this game), and [OpenGameArt](https://opengameart.org/).
```

- [ ] **Step 6: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

Expected: all pre-existing tests still pass; the new module is imported by nothing yet.

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/UnitSamples.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitSamples.test.js" \
        Frontend/src/assets/audio/units/README.md
git commit -m "feat: discover unit sample files by filename convention

Dropping src/assets/audio/units/<ClassName>.ogg makes that unit play the
sample, with no code change. Includes a checklist README and detection of
misnamed files, which would otherwise load and never play."
```

---

## Task 2: Load and play samples

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js` (append)

**Interfaces:**
- Consumes: nothing from Task 1 — `AudioManager` must not import `UnitSamples`
- Produces:
  - `async loadSamples(urlMap): Promise<void>` — fetches and decodes each entry, caching buffers
  - `hasSample(name): boolean`
  - `playSample(name, transform, dedupeKey): void` where `transform` is `{playbackRate, gainScale, durationScale}`

**Background:** `playRecipe` already implements the dedupe window, the voice cap and the envelope. `playSample` must reuse all three — the only difference is an `AudioBufferSourceNode` in place of an oscillator.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js`.

The existing mock context needs two additions. Extend `createMockContext` so its returned `ctx` also has:

```js
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: 0.4 })),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      };
      made.buffers.push(src);
      return src;
    }),
```

(If `createBufferSource` already exists on the mock, add `playbackRate: { value: 1 }` to the object it returns rather than duplicating the method.)

Then append:

```js
describe('samples', () => {
  const FIRE = { playbackRate: 1, gainScale: 1, durationScale: 1 };
  const DEATH = { playbackRate: 0.75, gainScale: 1, durationScale: 1 };
  const HIT = { playbackRate: 1, gainScale: 0.55, durationScale: 0.35 };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  function stubFetchOk() {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no samples before loading', () => {
    const { audio } = readyAudio();
    expect(audio.hasSample('Mortar')).toBe(false);
  });

  it('loads and caches a sample', async () => {
    stubFetchOk();
    const { audio } = readyAudio();

    await audio.loadSamples({ Mortar: '/assets/Mortar.ogg' });

    expect(audio.hasSample('Mortar')).toBe(true);
    expect(audio.hasSample('Sniper')).toBe(false);
  });

  it('isolates a failed fetch so other samples still load', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (
      String(url).includes('Broken')
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    )));
    const { audio } = readyAudio();

    await audio.loadSamples({ Broken: '/a/Broken.ogg', Mortar: '/a/Mortar.ogg' });

    expect(audio.hasSample('Broken')).toBe(false);
    expect(audio.hasSample('Mortar')).toBe(true);
  });

  it('isolates a failed decode the same way', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    ctx.decodeAudioData = vi.fn((_buf) => Promise.reject(new Error('bad audio')));

    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    expect(audio.hasSample('Mortar')).toBe(false);
  });

  it('does not throw when loading with no context', async () => {
    const audio = new AudioManager(() => { throw new Error('no web audio'); });
    audio.init();
    await expect(audio.loadSamples({ Mortar: '/a/Mortar.ogg' })).resolves.toBeUndefined();
  });

  it('plays a loaded sample through the sfx bus', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
    const src = made.buffers.at(-1);
    expect(src.start).toHaveBeenCalled();
    expect(src.stop).toHaveBeenCalled();
    // envelope is the most recently created gain, and must reach the sfx bus
    expect(made.gains.at(-1).connect).toHaveBeenCalledWith(made.gains[1]);
  });

  it('applies the variant playbackRate', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', DEATH, 'Mortar:death');

    expect(made.buffers.at(-1).playbackRate.value).toBeCloseTo(0.75);
  });

  it('lengthens death rather than cutting it off early', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', DEATH, 'Mortar:death');

    // buffer 0.4s at rate 0.75 lasts 0.5333s, so stop must be later than 0.4
    const stopAt = made.buffers.at(-1).stop.mock.calls[0][0];
    expect(stopAt).toBeGreaterThan(ctx.currentTime + 0.4);
  });

  it('truncates hit', async () => {
    stubFetchOk();
    const { ctx, made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', HIT, 'Mortar:hit');

    const stopAt = made.buffers.at(-1).stop.mock.calls[0][0];
    expect(stopAt).toBeCloseTo(ctx.currentTime + 0.4 * 0.35);
  });

  it('ignores an unloaded sample without throwing', () => {
    const { ctx, audio } = readyAudio();
    expect(() => audio.playSample('NoSuch', FIRE, 'NoSuch:fire')).not.toThrow();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('applies the dedupe window to samples', async () => {
    stubFetchOk();
    const { ctx, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    audio.playSample('Mortar', FIRE, 'Mortar:fire');
    audio.playSample('Mortar', FIRE, 'Mortar:fire');

    expect(ctx.createBufferSource).toHaveBeenCalledOnce();
  });

  it('counts samples against the voice cap', async () => {
    stubFetchOk();
    const { made, audio } = readyAudio();
    await audio.loadSamples({ Mortar: '/a/Mortar.ogg' });

    for (let i = 0; i < MAX_VOICES + 1; i++) {
      audio.playSample('Mortar', FIRE, `key${i}`);
    }

    expect(made.buffers[0].stop.mock.calls.length).toBe(2);
  });
});
```

Add `afterEach` to the file's `vitest` import if it is not already there.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js" -t "samples"`

Expected: FAIL — `loadSamples`, `hasSample` and `playSample` are not functions.

- [ ] **Step 3: Add the sample cache and loader**

In `AudioManager.js`, add to the constructor beside `this.activeVoices`:

```js
    this.samples = new Map(); // unit name -> AudioBuffer
```

Add these three methods after `playRecipe`:

```js
  /**
   * Fetches and decodes every supplied sample.
   *
   * Failures are isolated per file: one bad download or corrupt file leaves that
   * unit on its synthesized voice while every other sample still loads.
   */
  async loadSamples(urlMap) {
    if (!this.ctx) return;

    await Promise.all(Object.entries(urlMap).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = await response.arrayBuffer();
        this.samples.set(name, await this.ctx.decodeAudioData(encoded));
      } catch (err) {
        console.error(`Could not load audio sample "${name}" from ${url}:`, err);
      }
    }));
  }

  hasSample(name) {
    return this.samples.has(name);
  }

  /**
   * Plays a loaded sample, applying a variant transform.
   *
   * Shares the dedupe window, voice cap and envelope with playRecipe - only the
   * source node differs. Effective duration divides by playbackRate, because
   * pitching a sample down lengthens it; using the raw buffer duration would cut
   * every death sound off early.
   */
  playSample(name, transform, dedupeKey) {
    const buffer = this.samples.get(name);
    if (!buffer || !this.ctx) return;

    const now = this.ctx.currentTime;

    const lastPlayed = this.lastPlayedAt.get(dedupeKey);
    if (lastPlayed !== undefined && now - lastPlayed < DEDUPE_WINDOW_SECONDS) return;
    this.lastPlayedAt.set(dedupeKey, now);

    this.activeVoices = this.activeVoices.filter((voice) => voice.endTime > now);
    if (this.activeVoices.length >= MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      try {
        oldest.source.stop(now);
      } catch {
        // Already stopped; nothing to do.
      }
    }

    const duration = (buffer.duration / transform.playbackRate) * transform.durationScale;
    const end = now + duration;

    const envelope = this.ctx.createGain();
    envelope.connect(this.sfxGain);
    envelope.gain.setValueAtTime(SAMPLE_BASE_GAIN * transform.gainScale, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = transform.playbackRate;
    source.connect(envelope);
    source.start(now);
    source.stop(end);

    this.activeVoices.push({ source, endTime: end });
  }
```

Add the base-gain constant beside the existing exports near the top of the file:

```js
/** Base gain applied to every sample before its variant gainScale. */
export const SAMPLE_BASE_GAIN = 0.7;
```

This constant lives ONLY here — `AudioManager` is its only consumer, and `UnitSamples` must not define a second copy. `AudioManager` must NOT import `UnitSamples`: it receives transforms as plain objects, so it stays free of unit knowledge.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"`

Expected: all tests in the file PASS, including the pre-existing ones.

- [ ] **Step 5: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"
git commit -m "feat: load and play audio samples

Samples share the envelope, dedupe window and voice cap with synthesized
sounds. Per-file load failures are isolated, and death divides duration by
playbackRate so pitching down lengthens rather than truncates."
```

---

## Task 3: Route per unit, sample or synth

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/GameContext.jsx`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js` (append)

**Interfaces:**
- Consumes: `hasSample(name)`, `playSample(name, transform, dedupeKey)` from Task 2; `SAMPLE_URLS`, `SAMPLE_VARIANTS`, `unknownSampleNames` from Task 1
- Produces: nothing

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js`. Add to its imports:

```js
import { SAMPLE_VARIANTS } from '../UnitSamples.js';
```

Then append:

```js
describe('sample-or-synth routing', () => {
  let bus, audio, juice, manager;

  beforeEach(() => {
    bus = new FeedbackBus();
    audio = {
      playSfx: vi.fn(), playRecipe: vi.fn(), playSample: vi.fn(),
      hasSample: vi.fn(() => false), setVolumes: vi.fn(),
    };
    juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    manager = new FeedbackManager(bus, audio, juice);
    manager.attach();
  });

  it('falls back to the synthesized voice when no sample exists', () => {
    audio.hasSample.mockReturnValue(false);

    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playRecipe).toHaveBeenCalled();
    expect(audio.playSample).not.toHaveBeenCalled();
  });

  it('plays the sample when one exists', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:died', { unitType: 'TitanEnemy', isBoss: false, x: 1, y: 2 });

    expect(audio.playSample).toHaveBeenCalledWith(
      'TitanEnemy', SAMPLE_VARIANTS.death, 'TitanEnemy:death',
    );
    expect(audio.playRecipe).not.toHaveBeenCalled();
  });

  it('decides per unit, not globally', () => {
    audio.hasSample.mockImplementation((name) => name === 'Mortar');

    bus.emit('projectile:fired', { defenderType: 'Mortar' });
    bus.emit('projectile:fired', { defenderType: 'Sniper' });

    expect(audio.playSample).toHaveBeenCalledWith('Mortar', SAMPLE_VARIANTS.fire, 'Mortar:fire');
    expect(audio.playRecipe).toHaveBeenCalledOnce();
  });

  it('uses the hit transform for hits and still shows a damage number', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:hit', { unitType: 'TankEnemy', damage: 12, x: 30, y: 40 });

    expect(audio.playSample).toHaveBeenCalledWith(
      'TankEnemy', SAMPLE_VARIANTS.hit, 'TankEnemy:hit',
    );
    expect(juice.addDamageNumber).toHaveBeenCalledWith(30, 40, 12);
  });

  it('keeps boss deaths weighty regardless of source', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('enemy:died', { unitType: 'BossEnemy', isBoss: true, x: 1, y: 2 });

    expect(juice.triggerHitStop).toHaveBeenCalled();
    expect(juice.addTrauma).toHaveBeenCalledWith(0.6);
  });

  it('leaves deployment on the shared sound even with samples present', () => {
    audio.hasSample.mockReturnValue(true);

    bus.emit('defender:placed', { type: 'Mortar' });

    expect(audio.playSfx).toHaveBeenCalledWith('defenderPlaced');
    expect(audio.playSample).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js" -t "sample-or-synth"`

Expected: FAIL — `playUnitVoice` always calls `playRecipe`, so the "plays the sample" cases fail.

- [ ] **Step 3: Route in FeedbackManager**

Add the import:

```js
import { SAMPLE_VARIANTS } from './UnitSamples.js';
```

Replace `playUnitVoice` with:

```js
  /**
   * Plays a unit's own sound, preferring a supplied sample over the synthesized
   * voice. The decision is per unit, so samples can be adopted one at a time and
   * every unit still makes a sound.
   */
  playUnitVoice(unitName, variant, fallbackRecipe) {
    const key = `${unitName}:${variant}`;

    if (this.audio.hasSample?.(unitName)) {
      this.audio.playSample(unitName, SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire, key);
      return;
    }

    this.audio.playRecipe(resolveVoice(unitName, variant, undefined, fallbackRecipe), key);
  }
```

The `?.` on `hasSample` keeps older test doubles that lack the method working.

- [ ] **Step 4: Load samples on the first-gesture audio start**

In `GameContext.jsx`, add to the imports:

```js
import { SAMPLE_URLS, unknownSampleNames } from "./Feedback/UnitSamples.js";
```

In the `pointerdown` effect that resumes audio, after `feedbackRef.current.audio.setVolumes(...)`, add:

```js
        const misnamed = unknownSampleNames(Object.keys(SAMPLE_URLS));
        if (misnamed.length > 0) {
          console.warn(
            `Audio sample files match no unit class and will never play: ${misnamed.join(", ")}. ` +
            `Rename them to a unit class name - see src/assets/audio/units/README.md.`,
          );
        }
        feedbackRef.current.audio.loadSamples(SAMPLE_URLS);
```

`loadSamples` is intentionally not awaited — the gesture handler must not block, and any unit whose sample has not finished decoding simply uses its synthesized voice until it has.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"`

Expected: all tests in the file PASS. Pre-existing tests in this file supply a mock without `hasSample`; the `?.` guard means they continue to exercise the synth path unchanged. If any pre-existing test fails, report it rather than adjusting it.

- [ ] **Step 6: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js" \
        "Frontend/src/component/GameLogic (MVC)/GameContext.jsx" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js"
git commit -m "feat: prefer a unit's sample over its synthesized voice

The decision is per unit, so samples can be adopted one at a time and no unit
ever goes silent. Misnamed sample files are reported rather than silently
never playing."
```

---

## Task 4: Make the silent units audible

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/DefenderUnits.js` (spell detonation)
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (`enemy:hit` emits)
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: nothing

**Background:** two gaps remain from the previous branch.

`FireBlast` and `IceBomb` contain **no** `emitFeedback` calls, so casting one produces only the shared placement sound — their voices are unreachable.

`enemy:hit` has a single emit site, on the plain-projectile branch. Sniper, Mortar, GrenadeDefender and FrostArcher land hits silently.

**Locate every site by surrounding CODE CONTENT, not by line number** — this file has shifted repeatedly and stale line numbers have already caused defects on this codebase. The previous branch established that these four defenders attack through four different mechanisms, so do not assume a shared path. Report what you find for each.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js`:

```js
describe('spell detonation is audible', () => {
  function createSpellWithEngine(SpellClass) {
    const spell = new SpellClass(0, 0, CARD);
    const emitted = [];
    spell.gameEngine = {
      emitFeedback: (event, payload) => emitted.push({ event, payload }),
      enemies: [],
      defenders: [],
      explosions: [],
      inGameScore: 0,
      enemiesKilled: 0,
      dropManager: { handleEnemyDeath: () => {} },
      waveManager: { totalEnemiesKilled: 0 },
    };
    return { spell, emitted };
  }

  it('Fire Blast emits projectile:fired when it detonates', () => {
    const { spell, emitted } = createSpellWithEngine(FireBlast);

    spell.activate();

    expect(emitted.some((e) => e.event === 'projectile:fired'
      && e.payload.defenderType === 'FireBlast')).toBe(true);
  });

  it('Ice Bomb emits projectile:fired when it detonates', () => {
    const { spell, emitted } = createSpellWithEngine(IceBomb);

    spell.activate();

    expect(emitted.some((e) => e.event === 'projectile:fired'
      && e.payload.defenderType === 'IceBomb')).toBe(true);
  });

  it('a spell without an engine reference does not throw when activated', () => {
    const spell = new FireBlast(0, 0, CARD);
    spell.gameEngine = null;
    expect(() => spell.activate()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js" -t "detonation"`

Expected: the two emit tests FAIL — the spells emit nothing. The "does not throw" test may pass already; its passing confirms the harness reaches `activate()`.

If `activate()` throws for a reason unrelated to feedback because the fake engine is missing something, add only what it needs to the fake and note what you added.

- [ ] **Step 3: Emit at spell detonation**

In `DefenderUnits.js`, find `FireBlast`'s `activate()` — it ends with `this.isAlive = false; this.health = 0;`. Add the emit immediately before that self-termination:

```js
    this.gameEngine?.emitFeedback?.('projectile:fired', { defenderType: this.constructor.name });
```

Do the same in `IceBomb`'s `activate()`, again immediately before its `this.isAlive = false;`.

Placing it before self-termination rather than at the top of `activate()` means the sound fires when the effect actually happens, and only on a path that reaches detonation.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"`

Expected: all tests PASS.

- [ ] **Step 5: Add the missing `enemy:hit` emits**

In `GameEngine.js`, `addDefenderExplosion` applies splash damage inside `for (const enemy of this.enemies)`, calling `enemy.takeDamage(damage, false)`. Add an emit immediately after that call:

```js
        this.emitFeedback('enemy:hit', {
          unitType: enemy.constructor.name,
          damage,
          x: enemy.x + enemy.width / 2,
          y: enemy.y,
        });
```

This covers GrenadeDefender and Mortar, both of which damage through explosions.

The 40ms dedupe window means a splash hitting six enemies of the same type produces one hit sound rather than six stacked — the same protection deaths already have.

Then handle the two remaining paths inside `DefenderUnits.js`.

Locate Sniper's `attack()`, which applies damage directly rather than creating a projectile — find the `takeDamage` call inside it. Add immediately after that call, using whatever local variable holds the target:

```js
      this.gameEngine?.emitFeedback?.('enemy:hit', {
        unitType: target.constructor.name,
        damage: this.attackDamage,
        x: target.x + target.width / 2,
        y: target.y,
      });
```

Locate FrostArcher's `onHit` callback — the function assigned to a projectile's `onHit` property, which applies its damage and slow. Add immediately after its `takeDamage` call, again using whichever local holds the enemy:

```js
      this.gameEngine?.emitFeedback?.('enemy:hit', {
        unitType: target.constructor.name,
        damage: this.attackDamage,
        x: target.x + target.width / 2,
        y: target.y,
      });
```

Rename `target` in either snippet to match the actual local variable at that site — do not introduce a new binding.

**Report which sites you found and what you added at each.** If a unit turns out to route its damage through a path already covered by the explosion emit or the existing projectile emit, say so and add nothing rather than double-emitting — a doubled hit sound would be an audible regression.

- [ ] **Step 6: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

```bash
git add "Frontend/src/component/GameLogic (MVC)/DefenderUnits.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/DefenderUnits.spells.test.js"
git commit -m "fix: make spell detonations and splash hits audible

Fire Blast and Ice Bomb emitted nothing at all, so their voices were
unreachable. enemy:hit fired only on the plain-projectile branch, leaving
Sniper, Mortar, GrenadeDefender and FrostArcher hits silent."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

- [ ] **Verify the zero-files case**

With no sample files present — the state this branch merges in — confirm the suite still passes and that `SAMPLE_URLS` is an empty object. Every unit must still play its synthesized voice. This is success criterion 3 and the reason the branch is mergeable before any audio exists.

- [ ] **Confirm each success criterion from the spec**

1. Dropping `<ClassName>.ogg` into the units folder makes that unit play the sample, with no code change.
2. A unit with no sample file still plays its synthesized voice.
3. With zero sample files present, the game sounds exactly as it does today.
4. One corrupt or missing file does not prevent other samples from loading.
5. Samples obey the same dedupe window and voice cap as synthesized sounds.
6. Casting a Fire Blast or Ice Bomb produces a sound.
7. Sniper, Mortar, GrenadeDefender and FrostArcher hits produce a sound.
8. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 1, 2, 6 and 7 are audible. With no files present, confirm the game sounds as before and that casting a spell and landing Sniper/Mortar hits now produce sounds. Then drop one file — `Mortar.ogg` — into `Frontend/src/assets/audio/units/`, reload, and confirm the Mortar plays it while every other unit is unchanged.
