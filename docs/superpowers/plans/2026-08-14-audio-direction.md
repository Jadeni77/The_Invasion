# Audio Direction and Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game one coherent audio identity by grouping sounds into archetypes, add a mix hierarchy so constant sounds sit beneath big ones, cover the four actionable events that are still silent, and make the skeleton's attack animation fire with its projectile.

**Architecture:** A resolution layer maps `(unitName, variant)` to a **sound key** — an archetype like `projectile` or `death-small` — and every lookup, sample and synthesized, is keyed by that instead of by unit. Several units resolving to one key is the point. A mix tier per key sets its level relative to the others.

**Tech Stack:** Vite 7, Vitest 4, Web Audio API, plain ES modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-14-audio-direction-design.md`

**Branch:** `feature/per-unit-audio` — continues the branch behind PR #5.

## Global Constraints

- **Sound identity is by archetype, not by unit.** Several units resolving to one sound is intended design, not a compromise.
- **Four units keep signature overrides:** `Mortar`, `Sniper`, `TitanEnemy`, `BossEnemy`.
- **Mix tiers are exact:** loud `1.0`, mid `0.7`, quiet `0.4`. The multiplier applies on top of a sound's own gain.
- **Quiet tier is `projectile`, `hit`, `energy`** — they fire constantly and must sit under everything else.
- **The existing shared `hit` sound is reused unchanged** and is not one of the new sounds.
- Sample files are supplied by the project owner and named after the **sound key**, not the unit.
- Every unit must still produce a sound with zero sample files present — the synthesized fallback stays.
- Existing test convention: tests in `__tests__/` beside the source, explicit `vitest` imports (`globals: false`).
- Path note: `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `Feedback/SoundGroups.js` | Create | `soundKeyFor(unitName, variant)`, the group tables, `MIX_TIERS`, `mixGainFor(soundKey)` |
| `Feedback/UnitVoices.js` | Modify | Table re-keyed from 29 unit names to 14 sound keys |
| `Feedback/FeedbackManager.js` | Modify | Resolves the sound key before looking up sample or synth |
| `Feedback/AudioManager.js` | Modify | Applies the mix multiplier |
| `assets/audio/units/README.md` | Rewrite | Checklist becomes 14 sound-key filenames, not 29 unit names |
| `CombatManager.js` | Modify | Enemy ranged fire emits; triggers the attack animation |
| `EnemyUnits.js` | Modify | Melee, spell and summon emits; `updateBehavior` stops driving animation |

---

## Task 1: Sound groups and mix tiers

**Files:**
- Create: `Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `soundKeyFor(unitName, variant): string` — resolves a unit and variant to its archetype sound key
  - `SOUND_KEYS: string[]` — every valid key
  - `MIX_TIERS: Record<string, number>` — sound key to gain multiplier
  - `mixGainFor(soundKey): number` — the multiplier, defaulting to `0.7` for an unknown key

- [ ] **Step 1: Write the failing test**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { soundKeyFor, SOUND_KEYS, mixGainFor, MIX_TIERS } from '../SoundGroups.js';
import { SFX } from '../SfxLibrary.js';

describe('archetype grouping', () => {
  it('gives a Shooter and a Skeleton the same firing sound', () => {
    expect(soundKeyFor('BasicDefender', 'fire')).toBe('projectile');
    expect(soundKeyFor('RangeEnemy', 'fire')).toBe('projectile');
  });

  it('groups the magic users together', () => {
    expect(soundKeyFor('FrostArcher', 'fire')).toBe('magic');
    expect(soundKeyFor('IceBomb', 'fire')).toBe('magic');
    expect(soundKeyFor('MageEnemy', 'fire')).toBe('magic');
  });

  it('gives artillery its own group', () => {
    expect(soundKeyFor('GrenadeDefender', 'fire')).toBe('artillery');
  });

  it('groups healers on both sides', () => {
    expect(soundKeyFor('HealerDefender', 'fire')).toBe('heal');
    expect(soundKeyFor('HealerEnemy', 'fire')).toBe('heal');
  });
});

describe('signature overrides', () => {
  it.each([
    ['Mortar', 'fire', 'mortar'],
    ['Sniper', 'fire', 'sniper'],
    ['TitanEnemy', 'death', 'titan'],
    ['BossEnemy', 'death', 'boss'],
  ])('%s keeps its own %s sound', (unit, variant, expected) => {
    expect(soundKeyFor(unit, variant)).toBe(expected);
  });

  it('a signature unit does not fall back to its category', () => {
    expect(soundKeyFor('Mortar', 'fire')).not.toBe('artillery');
    expect(soundKeyFor('TitanEnemy', 'death')).not.toBe('death-medium');
  });
});

describe('death tiering', () => {
  it.each(['BasicEnemy', 'FastEnemy', 'MiniEnemy', 'SwarmLeader'])(
    '%s dies small', (unit) => {
      expect(soundKeyFor(unit, 'death')).toBe('death-small');
    },
  );

  it.each(['TankEnemy', 'ShieldEnemy', 'BerserkerEnemy', 'NecromancerEnemy'])(
    '%s dies medium', (unit) => {
      expect(soundKeyFor(unit, 'death')).toBe('death-medium');
    },
  );

  it('defenders share one death sound', () => {
    expect(soundKeyFor('BasicDefender', 'death')).toBe('death-defender');
    expect(soundKeyFor('Mortar', 'death')).toBe('death-defender');
  });

  it('small, medium and Titan deaths are all different', () => {
    const keys = new Set([
      soundKeyFor('BasicEnemy', 'death'),
      soundKeyFor('TankEnemy', 'death'),
      soundKeyFor('TitanEnemy', 'death'),
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('resolution safety', () => {
  it('every resolved key is a declared key', () => {
    const units = [
      'BasicDefender', 'Mortar', 'Sniper', 'FrostArcher', 'HealerDefender',
      'BasicEnemy', 'TankEnemy', 'TitanEnemy', 'BossEnemy', 'MageEnemy',
    ];
    for (const unit of units) {
      for (const variant of ['fire', 'hit', 'death']) {
        expect(SOUND_KEYS, `${unit}/${variant}`).toContain(soundKeyFor(unit, variant));
      }
    }
  });

  it('an unknown unit resolves to a usable key rather than undefined', () => {
    expect(SOUND_KEYS).toContain(soundKeyFor('NoSuchUnit', 'death'));
    expect(SOUND_KEYS).toContain(soundKeyFor('NoSuchUnit', 'fire'));
  });

  it('does not throw on a null or undefined unit name', () => {
    expect(() => soundKeyFor(null, 'death')).not.toThrow();
    expect(() => soundKeyFor(undefined, 'fire')).not.toThrow();
  });

  it('every hit resolves to the shared hit sound', () => {
    expect(soundKeyFor('TankEnemy', 'hit')).toBe('hit');
    expect(soundKeyFor('TitanEnemy', 'hit')).toBe('hit');
  });
});

describe('mix tiers', () => {
  it('puts constant sounds in the quiet tier', () => {
    expect(mixGainFor('projectile')).toBe(0.4);
    expect(mixGainFor('hit')).toBe(0.4);
    expect(mixGainFor('energy')).toBe(0.4);
  });

  it('puts big moments in the loud tier', () => {
    expect(mixGainFor('boss')).toBe(1.0);
    expect(mixGainFor('baseDamaged')).toBe(1.0);
    expect(mixGainFor('levelWon')).toBe(1.0);
  });

  it('tiers game-event sounds by their SfxLibrary id', () => {
    // These play through playSfx, not unit resolution. If the ids drift from
    // SfxLibrary the tier silently stops applying, so assert against the real
    // library rather than string literals alone.
    for (const id of ['energyCollected', 'baseDamaged', 'levelWon', 'levelLost']) {
      expect(SFX, `${id} missing from SfxLibrary`).toHaveProperty(id);
      expect(MIX_TIERS, `${id} has no tier`).toHaveProperty(id);
    }
  });

  it('puts everything else in the mid tier', () => {
    expect(mixGainFor('death-small')).toBe(0.7);
    expect(mixGainFor('artillery')).toBe(0.7);
  });

  it('projectiles are quieter than deaths, which are quieter than boss deaths', () => {
    expect(mixGainFor('projectile')).toBeLessThan(mixGainFor('death-small'));
    expect(mixGainFor('death-small')).toBeLessThan(mixGainFor('boss'));
  });

  it('defaults an unknown key to the mid tier rather than silence', () => {
    expect(mixGainFor('nonsense')).toBe(0.7);
  });

  it('every declared key has a tier', () => {
    for (const key of SOUND_KEYS) {
      expect(MIX_TIERS, `no tier for ${key}`).toHaveProperty(key);
    }
  });
});

describe('playSfx also gets a tier', () => {
  it('a game event resolves a multiplier without going through unit resolution', () => {
    // base damage is one of the loudest moments in the game; if playSfx ignored
    // the tier it would sit at the same level as a projectile.
    expect(mixGainFor('baseDamaged')).toBeGreaterThan(mixGainFor('projectile'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js"`

Expected: FAIL — cannot resolve `../SoundGroups.js`.

- [ ] **Step 3: Implement SoundGroups**

Create `Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js`:

```js
/**
 * Sound identity is by archetype, not by unit.
 *
 * A Shooter and a Skeleton firing a basic projectile carry no information that
 * distinguishing them would convey, so they share one sound. Grouping this way
 * cuts the sound set from 29 to 14, and that reduction is itself the fix for
 * incoherence: a small set can come from a single pack, while a large one
 * pushes toward mixing packs with different room tone and mastering.
 */

/** Units whose firing sound is their own, not their category's. */
const FIRE_SIGNATURES = {
  Mortar: 'mortar',
  Sniper: 'sniper',
};

/** Firing sound by unit, for units without a signature. */
const FIRE_GROUPS = {
  BasicDefender: 'projectile',
  RangeEnemy: 'projectile',
  AssassinEnemy: 'projectile',
  GrenadeDefender: 'artillery',
  FrostArcher: 'magic',
  IceBomb: 'magic',
  MageEnemy: 'magic',
  FireBlast: 'fire',
  HealerDefender: 'heal',
  HealerEnemy: 'heal',
  NecromancerEnemy: 'summon',
  SplitterEnemy: 'summon',
};

/** Units whose death sound is their own. */
const DEATH_SIGNATURES = {
  TitanEnemy: 'titan',
  BossEnemy: 'boss',
};

/** Enemies small enough to die lightly. Everything else dies medium. */
const SMALL_ENEMIES = new Set([
  'BasicEnemy', 'FastEnemy', 'MiniEnemy', 'SwarmLeader',
]);

/** Every defender, for death-sound purposes. */
const DEFENDERS = new Set([
  'BasicDefender', 'HealerDefender', 'GrenadeDefender', 'BarricadeDefender',
  'EnergyGenerator', 'Sniper', 'Mortar', 'FrostArcher', 'FireBlast', 'IceBomb',
]);

/**
 * Every sound key soundKeyFor can return.
 *
 * Game events (deploy, energy, wave, win, lose) are NOT here - they play through
 * playSfx by their SfxLibrary id, not through unit resolution. They still get a
 * mix tier, keyed by that id; see MIX_TIERS.
 */
export const SOUND_KEYS = [
  'projectile', 'artillery', 'magic', 'fire', 'heal', 'melee', 'summon', 'hit',
  'mortar', 'sniper',
  'death-small', 'death-medium', 'death-defender', 'titan', 'boss',
];

/**
 * Resolves a unit and variant to its sound key.
 *
 * Unknown units resolve to a sensible default rather than undefined, so a unit
 * added later is generic rather than silent.
 */
export function soundKeyFor(unitName, variant) {
  if (variant === 'hit') return 'hit';

  if (variant === 'death') {
    if (DEATH_SIGNATURES[unitName]) return DEATH_SIGNATURES[unitName];
    if (DEFENDERS.has(unitName)) return 'death-defender';
    if (SMALL_ENEMIES.has(unitName)) return 'death-small';
    return 'death-medium';
  }

  // Everything else is a firing or acting sound.
  return FIRE_SIGNATURES[unitName] ?? FIRE_GROUPS[unitName] ?? 'projectile';
}

const LOUD = 1.0;
const MID = 0.7;
const QUIET = 0.4;

/**
 * Relative level per sound key.
 *
 * Projectiles and hits fire constantly, so they must sit under everything else -
 * without this the mix has no foreground and reads as noise however well the
 * individual sounds are chosen.
 */
export const MIX_TIERS = {
  // Unit sound keys, returned by soundKeyFor.
  projectile: QUIET, hit: QUIET,
  artillery: MID, magic: MID, fire: MID, heal: MID, melee: MID, summon: MID,
  mortar: MID, sniper: MID,
  'death-small': MID, 'death-medium': MID, 'death-defender': MID,
  titan: LOUD, boss: LOUD,

  // Game-event sounds, keyed by their SfxLibrary id because they play through
  // playSfx rather than through unit resolution. The ids must match exactly or
  // the tier silently never applies.
  energyCollected: QUIET, defenderPlaced: QUIET, deployRejected: QUIET,
  waveStarted: MID, bossWaveStarted: MID,
  baseDamaged: LOUD, levelWon: LOUD, levelLost: LOUD,
};

/** The multiplier for a key; unknown keys sit mid rather than silent. */
export function mixGainFor(soundKey) {
  return MIX_TIERS[soundKey] ?? MID;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js"`

Expected: all tests PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

The new module is imported by nothing yet, so no existing test can break.

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js"
git commit -m "feat: group sounds by archetype with a mix hierarchy

A Shooter and a Skeleton now share one projectile sound. Grouping cuts the
sound set from 29 to 14, which is what makes sourcing from a single pack
practical - and a single pack is what makes the audio cohere. Adds mix tiers so
constant sounds sit beneath the big moments."
```

---

## Task 2: Key voices and samples by sound key

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js`
- Rewrite: `Frontend/src/assets/audio/units/README.md`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js` and `FeedbackManager.test.js`

**Interfaces:**
- Consumes: `soundKeyFor(unitName, variant)` from Task 1
- Produces: `UNIT_VOICES` re-keyed by sound key; `FeedbackManager.playUnitVoice` resolves the key before lookup

**Background:** `UNIT_VOICES` currently holds 29 entries keyed by unit class name, and `FeedbackManager.playUnitVoice` looks up samples and synth recipes by that name. Both now key on the archetype instead. This is what makes the owner's checklist 14 filenames rather than 29.

- [ ] **Step 1: Re-key the voice table**

In `UnitVoices.js`, replace the 29-entry `UNIT_VOICES` with one entry per sound key. Keep the existing recipe shape and reuse the closest existing recipe for each key so the synthesized fallback still sounds deliberate:

```js
export const UNIT_VOICES = {
  projectile:       { wave: 'square',   freqStart: 640,  freqEnd: 880,  duration: 0.06, gain: 0.18, noise: false },
  artillery:        { wave: 'sawtooth', freqStart: 220,  freqEnd: 110,  duration: 0.14, gain: 0.40, noise: true  },
  mortar:           { wave: 'sawtooth', freqStart: 120,  freqEnd: 60,   duration: 0.30, gain: 0.50, noise: true  },
  sniper:           { wave: 'square',   freqStart: 1400, freqEnd: 700,  duration: 0.05, gain: 0.30, noise: false },
  magic:            { wave: 'triangle', freqStart: 1100, freqEnd: 1500, duration: 0.12, gain: 0.22, noise: false },
  fire:             { wave: 'sawtooth', freqStart: 300,  freqEnd: 80,   duration: 0.40, gain: 0.50, noise: true  },
  heal:             { wave: 'sine',     freqStart: 660,  freqEnd: 990,  duration: 0.18, gain: 0.28, noise: false },
  melee:            { wave: 'triangle', freqStart: 320,  freqEnd: 200,  duration: 0.10, gain: 0.30, noise: true  },
  summon:           { wave: 'triangle', freqStart: 200,  freqEnd: 130,  duration: 0.30, gain: 0.35, noise: false },
  hit:              { wave: 'triangle', freqStart: 320,  freqEnd: 240,  duration: 0.07, gain: 0.25, noise: false },
  'death-small':    { wave: 'sawtooth', freqStart: 300,  freqEnd: 180,  duration: 0.12, gain: 0.25, noise: true  },
  'death-medium':   { wave: 'sawtooth', freqStart: 200,  freqEnd: 110,  duration: 0.20, gain: 0.35, noise: true  },
  'death-defender': { wave: 'sawtooth', freqStart: 180,  freqEnd: 60,   duration: 0.35, gain: 0.40, noise: true  },
  titan:            { wave: 'sawtooth', freqStart: 100,  freqEnd: 50,   duration: 0.40, gain: 0.55, noise: true  },
  boss:             { wave: 'sawtooth', freqStart: 130,  freqEnd: 55,   duration: 0.50, gain: 0.60, noise: true  },
};
```

- [ ] **Step 2: Update the voice-table tests**

`UnitVoices.test.js` currently asserts 29 unit-class keys and coverage against the exported unit classes. That coverage check no longer applies — the table is keyed by sound key now, not by unit.

Replace the coverage block with one asserting every entry in `SOUND_KEYS` that represents a *unit* sound has a voice. The nine game-event keys (`energy`, `base-damaged`, `wave`, `boss-wave`, `won`, `lost`, `place`, `reject`) are served by the existing `SFX` library and are deliberately absent from `UNIT_VOICES` — assert that explicitly so the absence is documented rather than looking like an omission:

```js
const UNIT_SOUND_KEYS = [
  'projectile', 'artillery', 'mortar', 'sniper', 'magic', 'fire', 'heal',
  'melee', 'summon', 'hit', 'death-small', 'death-medium', 'death-defender',
  'titan', 'boss',
];

it('every unit sound key has a voice', () => {
  const missing = UNIT_SOUND_KEYS.filter((key) => !UNIT_VOICES[key]);
  expect(missing, `keys without a voice: ${missing.join(', ')}`).toEqual([]);
});

it('game-event sounds are served by SFX, not the voice table', () => {
  for (const key of ['energy', 'base-damaged', 'won', 'lost']) {
    expect(UNIT_VOICES).not.toHaveProperty(key);
  }
});
```

Delete the now-meaningless "covers all 29 units" and "defines no voice for a class that does not exist" tests, and the `allUnitNames` helper with them. Report that you did so.

- [ ] **Step 3: Resolve the key in FeedbackManager**

Add the import:

```js
import { soundKeyFor } from './SoundGroups.js';
```

`playUnitVoice` currently keys everything on `unitName`. Change it to resolve the sound key first and use that for the sample lookup, the synth lookup and the dedupe key:

```js
  playUnitVoice(unitName, variant, fallbackRecipe) {
    const soundKey = soundKeyFor(unitName, variant);
    const dedupeKey = `${soundKey}:${variant}`;

    if (this.audio.hasSample?.(soundKey)) {
      this.audio.playSample(soundKey, SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire, dedupeKey);
      return;
    }

    this.audio.playRecipe(resolveVoice(soundKey, variant, undefined, fallbackRecipe), dedupeKey);
  }
```

Note the dedupe key is now built from the sound key, so two different units sharing a sound also share a dedupe slot — a Shooter and a Skeleton firing in the same frame produce one pew, which is the intended consequence of grouping.

- [ ] **Step 4: Update the FeedbackManager tests**

Existing tests assert calls like `playRecipe(resolveVoice('TankEnemy', 'hit'), 'TankEnemy:hit')`. Those unit-keyed expectations are now wrong. Update each to its resolved key — `'hit'` and `'hit:hit'` for that example — and add:

```js
it('a Shooter and a Skeleton firing share one sound and one dedupe key', () => {
  audio.hasSample.mockReturnValue(false);

  bus.emit('projectile:fired', { defenderType: 'BasicDefender' });
  bus.emit('projectile:fired', { defenderType: 'RangeEnemy' });

  const keys = audio.playRecipe.mock.calls.map((call) => call[1]);
  expect(new Set(keys).size).toBe(1);
});

it('Mortar keeps a sound of its own', () => {
  audio.hasSample.mockReturnValue(false);

  bus.emit('projectile:fired', { defenderType: 'Mortar' });
  bus.emit('projectile:fired', { defenderType: 'GrenadeDefender' });

  const keys = audio.playRecipe.mock.calls.map((call) => call[1]);
  expect(new Set(keys).size).toBe(2);
});
```

Report exactly which pre-existing tests you changed and why. Do NOT weaken any to a bare `toHaveBeenCalled()`.

- [ ] **Step 5: Rewrite the owner's checklist**

Replace `Frontend/src/assets/audio/units/README.md` entirely. The checklist is now 15 sound keys rather than 29 unit names:

```markdown
# Game sound files

Drop a file here named after a **sound**, not a unit. Several units share each sound
on purpose — a Shooter and a Skeleton firing the same basic projectile use one file.

Supported extensions: `.wav` or `.mp3` (Safari has gaps decoding `.ogg`).

**Any sound without a file falls back to a synthesized version**, so you can add these a
few at a time and hear each one. Nothing goes silent, and a page reload is needed after
adding a file.

## Getting them to sound like one game

Take all of these from a **single pack**. That matters more than any individual choice —
samples from different packs carry different room tone and mastering, which is what makes
a set sound like assorted noises rather than one game.

Aim for cartoon-arcade character: soft pops, comic thuds, squelches. Short, 0.1–0.5s.

## Combat sounds (14)

- [ ] `projectile.wav` — every basic ranged shot, both sides (Shooter, Skeleton, Assassin)
- [ ] `artillery.wav` — Grenadier
- [ ] `mortar.wav` — Mortar only, a heavier thump
- [ ] `sniper.wav` — Sniper only, a sharp crack
- [ ] `magic.wav` — Frost Archer, Ice Bomb, Mage spells
- [ ] `fire.wav` — Fire Blast
- [ ] `heal.wav` — Healer, both sides
- [ ] `melee.wav` — any enemy striking a defender
- [ ] `summon.wav` — Necromancer and Splitter creating enemies
- [ ] `death-small.wav` — Basic, Fast, Mini, Swarm Leader
- [ ] `death-medium.wav` — every other ordinary enemy
- [ ] `death-defender.wav` — any defender destroyed
- [ ] `titan.wav` — Titan death, should feel heavy
- [ ] `boss.wav` — Boss death, the biggest sound in the game

The shared `hit` sound (an enemy taking damage) is already in place and needs no file.

## Levels

Sounds are mixed in three tiers so the game has a foreground. You do not need to match
these yourself — the game applies them — but it helps to know that `projectile`, `hit`
and pickups play at 40%, most sounds at 70%, and `titan`, `boss` and base damage at full.
Pick samples that sound right at those relative levels.

Good CC0 source: [Kenney](https://kenney.nl/assets?q=audio) — Impact Sounds and Digital
Audio suit this game, and staying inside one of them is the point.
```

- [ ] **Step 6: Run the full suite and commit**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/UnitVoices.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/UnitVoices.test.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/FeedbackManager.test.js" \
        Frontend/src/assets/audio/units/README.md
git commit -m "feat: key sounds by archetype rather than by unit

Voices and samples now resolve through a sound key, so a Shooter and a Skeleton
share one projectile sound and one dedupe slot. The owner checklist drops from
29 unit filenames to 14 sound filenames, which is what makes sourcing from a
single pack practical."
```

---

## Task 3: Apply the mix hierarchy

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js`
- Test: `Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js` (append)

**Interfaces:**
- Consumes: nothing — the multiplier arrives as a plain number, so `AudioManager` stays free of unit and archetype knowledge
- Produces: `playRecipe(recipe, dedupeKey, mixGain = 1)` and `playSample(name, transform, dedupeKey, mixGain = 1)` — an optional trailing multiplier applied to the envelope gain

**Background:** every sound currently plays at its own gain with no relative weighting, so a projectile firing competes with a boss dying. Applying a tier multiplier gives the mix a foreground.

`AudioManager` must NOT import `SoundGroups` — the caller resolves the multiplier and passes a number.

- [ ] **Step 1: Write the failing test**

Append to `AudioManager.test.js`:

```js
describe('mix gain', () => {
  const RECIPE = { wave: 'sine', freqStart: 440, freqEnd: 220, duration: 0.2, gain: 0.5, noise: false };

  function readyAudio() {
    const { ctx, made } = createMockContext();
    const audio = new AudioManager(() => ctx);
    audio.init();
    audio.resume();
    return { ctx, made, audio };
  }

  it('defaults to full level when no multiplier is given', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a');
    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
  });

  it('scales the envelope by the multiplier', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a', 0.4);
    expect(made.gains.at(-1).gain.setValueAtTime).toHaveBeenCalledWith(0.2, expect.any(Number));
  });

  it('a quiet sound ends up quieter than a loud one', () => {
    const { made, audio } = readyAudio();

    audio.playRecipe(RECIPE, 'quiet', 0.4);
    const quiet = made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0];

    audio.playRecipe(RECIPE, 'loud', 1.0);
    const loud = made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0];

    expect(quiet).toBeLessThan(loud);
  });

  it('never produces a zero or negative gain, which would break the ramp', () => {
    const { made, audio } = readyAudio();
    audio.playRecipe(RECIPE, 'a', 0);
    expect(made.gains.at(-1).gain.setValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js" -t "mix gain"`

Expected: the scaling tests FAIL — the multiplier is ignored. The "defaults to full level" test should PASS already.

- [ ] **Step 3: Apply the multiplier**

In `playRecipe`, change the signature and the envelope line:

```js
  playRecipe(recipe, dedupeKey, mixGain = 1) {
```

and where the envelope gain is set, scale it — clamping above zero because `exponentialRampToValueAtTime` cannot start from zero:

```js
    envelope.gain.setValueAtTime(Math.max(0.0001, recipe.gain * mixGain), now);
```

Do the same in `playSample`:

```js
  playSample(name, transform, dedupeKey, mixGain = 1) {
```

```js
    envelope.gain.setValueAtTime(
      Math.max(0.0001, SAMPLE_BASE_GAIN * transform.gainScale * mixGain), now,
    );
```

- [ ] **Step 4: Give `playSfx` a tier too**

Game-event sounds — base damage, win, lose, energy pickup — play through `playSfx` by their `SfxLibrary` id, not through unit resolution. Without this they would ignore the hierarchy entirely, and base damage would sit at the same level as a projectile.

Change `playSfx` to accept and forward a multiplier:

```js
  playSfx(id, mixGain = 1) {
    this.playRecipe(SFX[id], id, mixGain);
  }
```

Then in `FeedbackManager.js`, pass the tier at each `playSfx` call — the sound's id is also its `MIX_TIERS` key:

```js
    on('energy:collected', () => this.audio.playSfx('energyCollected', mixGainFor('energyCollected')));
    on('deploy:rejected', () => this.audio.playSfx('deployRejected', mixGainFor('deployRejected')));
    on('defender:placed', () => this.audio.playSfx('defenderPlaced', mixGainFor('defenderPlaced')));
    on('level:won', () => this.audio.playSfx('levelWon', mixGainFor('levelWon')));
    on('level:lost', () => this.audio.playSfx('levelLost', mixGainFor('levelLost')));
```

and for the two that pick an id conditionally:

```js
    on('base:damaged', () => {
      this.audio.playSfx('baseDamaged', mixGainFor('baseDamaged'));
      this.juice.addTrauma(0.5);
      this.juice.triggerFlash('#ff0000', 250);
    });

    on('wave:started', ({ isBoss }) => {
      const id = isBoss ? 'bossWaveStarted' : 'waveStarted';
      this.audio.playSfx(id, mixGainFor(id));
    });
```

`defender:placed` keeps its single shared sound — only its level changes.

- [ ] **Step 5: Pass the multiplier from `playUnitVoice`**

In `FeedbackManager.js`, add `mixGainFor` to the `SoundGroups` import and pass it at both call sites in `playUnitVoice`:

```js
    const mixGain = mixGainFor(soundKey);

    if (this.audio.hasSample?.(soundKey)) {
      this.audio.playSample(soundKey, SAMPLE_VARIANTS[variant] ?? SAMPLE_VARIANTS.fire, dedupeKey, mixGain);
      return;
    }

    this.audio.playRecipe(resolveVoice(soundKey, variant, undefined, fallbackRecipe), dedupeKey, mixGain);
```

- [ ] **Step 6: Run the tests and commit**

Run the targeted file, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

Existing `FeedbackManager` tests assert `playSfx` was called with a single argument. Those now receive two. Update each to expect the multiplier rather than loosening the assertion, and report which you changed.

```bash
git add "Frontend/src/component/GameLogic (MVC)/Feedback/AudioManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/AudioManager.test.js"
git commit -m "feat: apply the mix hierarchy so the game has a foreground

Projectiles and hits fire constantly and previously played at the same level as
boss deaths and explosions, which reads as noise however well the individual
sounds are chosen. They now sit at 40% against full for the big moments."
```

---

## Task 4: Cover the silent events and sync the attack animation

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/CombatManager.js`
- Modify: `Frontend/src/component/GameLogic (MVC)/EnemyUnits.js`
- Test: `Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing

**Background — the four silent events.** Enemy ranged fire, enemy melee, enemy spells and enemy summons emit nothing. All four are things the player watches happen.

**Background — the sync bug.** `RangeEnemy.updateBehavior` sets `isAttacking = true` and runs a frame-based `attackCountdown`, driving the animation. `CombatManager.updateEnemyCombat` independently checks `canAttack(now)` against `lastAttackTime` — a time-based cooldown — and creates the projectile. Two clocks that drift immediately. And `isAttacking` is set true on *every frame* a target is in range, so the animation plays continuously.

**Locate every site by surrounding CODE CONTENT, not line number.** These files have shifted repeatedly and stale line numbers have already caused defects here.

- [ ] **Step 1: Write the failing test**

Append to `CombatManager.test.js`:

```js
describe('enemy ranged fire is audible and animated', () => {
  function createEnemy(overrides = {}) {
    return {
      x: 0, y: 0, width: 40, height: 40,
      isAttacker: true, isAlive: true, isRanged: true, frozen: false,
      attackRange: 500, attackDamage: 7, isAttacking: false,
      canAttack: () => true, constructor: { name: 'RangeEnemy' },
      ...overrides,
    };
  }

  function createDefender() {
    return { x: 50, y: 0, width: 40, height: 40, isAlive: true };
  }

  function createEngine() {
    return {
      enemyProjectiles: [], projectiles: [],
      emitFeedback: vi.fn(),
    };
  }

  it('emits a firing event carrying the enemy type', () => {
    const engine = createEngine();
    const combat = new CombatManager(engine);
    const enemy = createEnemy();

    combat.updateEnemyCombat([createDefender()], [enemy], 1000);

    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:fired',
      expect.objectContaining({ unitType: 'RangeEnemy' }),
    );
  });

  it('sets the attacking state at the moment it fires', () => {
    const engine = createEngine();
    const combat = new CombatManager(engine);
    const enemy = createEnemy();

    combat.updateEnemyCombat([createDefender()], [enemy], 1000);

    expect(enemy.isAttacking).toBe(true);
    expect(engine.enemyProjectiles).toHaveLength(1);
  });

  it('does not fire or animate when the cooldown says no', () => {
    const engine = createEngine();
    const combat = new CombatManager(engine);
    const enemy = createEnemy({ canAttack: () => false });

    combat.updateEnemyCombat([createDefender()], [enemy], 1000);

    expect(enemy.isAttacking).toBe(false);
    expect(engine.enemyProjectiles).toHaveLength(0);
    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('emits once per shot, not once per nearby defender', () => {
    const engine = createEngine();
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat(
      [createDefender(), createDefender(), createDefender()],
      [createEnemy()],
      1000,
    );

    const fired = engine.emitFeedback.mock.calls.filter((c) => c[0] === 'enemy:fired');
    expect(fired).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js" -t "enemy ranged fire"`

Expected: the emit and animation tests FAIL. The "does not fire when the cooldown says no" test should PASS already.

- [ ] **Step 3: Emit and animate at the firing site**

In `CombatManager.js`, find where enemy projectiles are created — `this.gameEngine.enemyProjectiles.push({ ... })` inside `updateEnemyCombat`. Immediately after that push and the existing `enemy.lastAttackTime = now;`, add:

```js
                        // The animation is driven from the actual shot, not from a
                        // separate countdown - two independent timers is why the
                        // skeleton's attack and its projectile never lined up.
                        enemy.isAttacking = true;
                        this.gameEngine.emitFeedback?.('enemy:fired', {
                            unitType: enemy.constructor.name,
                        });
```

- [ ] **Step 4: Stop `updateBehavior` driving the animation**

In `EnemyUnits.js`, find `RangeEnemy`'s `updateBehavior`. It currently reads:

```js
      this.isMoving = false;
      this.isAttacking = true;
      this.attackCountdown--;
      if (this.attackCountdown <= 0) {
        this.attackCountdown = this.attackRate;
      }
```

Remove the animation drive, leaving only the movement decision:

```js
      // Stop to shoot, but let CombatManager decide when a shot actually happens -
      // it owns the real cooldown. Setting isAttacking here made the animation play
      // continuously while a defender was in range.
      this.isMoving = false;
```

Delete the now-unused `attackCountdown` decrement. Leave the `else` branch as it is, including its `this.isAttacking = false;` — that is what returns the enemy to its walk animation once nothing is in range.

**If `attackCountdown` or `attackRate` is read anywhere else, do not delete the fields** — only stop using them to drive the animation here. Report what you find.

- [ ] **Step 5: Emit for melee, spells and summons**

Three more sites in `EnemyUnits.js`. Use `this.gameEngine?.emitFeedback?.(...)` at each so a unit without an engine reference cannot throw.

**Melee** — the base `Enemy.attack(target, currentTime)` applies `target.takeDamage(this.attackDamage)`. Add immediately after that call:

```js
    this.gameEngine?.emitFeedback?.('enemy:melee', { unitType: this.constructor.name });
```

Three subclasses override `attack`. Check each: if it calls `super.attack(...)` the emit is already covered; if it applies damage itself, add the same line there. **Report which of the three needed their own emit.**

**Spells** — `MageEnemy` creates a fireball and an icebolt, each pushed to `this.gameEngine.spellProjectiles`. Add after each push:

```js
    this.gameEngine?.emitFeedback?.('enemy:spell', { unitType: this.constructor.name });
```

**Summons** — where a spawned enemy is pushed to `this.gameEngine.enemies`. Add after that push:

```js
    this.gameEngine?.emitFeedback?.('enemy:summon', { unitType: this.constructor.name });
```

`SplitterEnemy` splits into minis through its own path — add the same emit there, and report whether it shares the Necromancer's code or has its own.

- [ ] **Step 6: Route the four new events**

In `FeedbackManager.js`, inside `attach()`, add:

```js
    on('enemy:fired', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:melee', ({ unitType }) => this.playUnitVoice(unitType, 'melee'));
    on('enemy:spell', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
    on('enemy:summon', ({ unitType }) => this.playUnitVoice(unitType, 'fire'));
```

`enemy:melee` uses a `melee` variant so it resolves to the shared melee sound regardless of which enemy struck. That variant is new, so it needs registering in **three** places or it silently degrades:

**1.** `soundKeyFor` in `SoundGroups.js` — add alongside the existing `hit` early return:

```js
  if (variant === 'melee') return 'melee';
```

**2.** `SAMPLE_VARIANTS` in `UnitSamples.js` — same transform as `hit`:

```js
  melee: { playbackRate: 1, gainScale: 0.55, durationScale: 0.35 },
```

**3.** `VARIANTS` in `UnitVoices.js` — without this, `resolveVoice` falls through to `VARIANTS.fire` and a melee strike plays at full length and full gain instead of short and quiet:

```js
  melee: { freqScale: 1, durationScale: 0.35, gainScale: 0.55 },
```

Add tests: `soundKeyFor` returns `'melee'` for any unit with the `melee` variant, and `resolveVoice('melee', 'melee')` produces a shorter, quieter recipe than `resolveVoice('melee', 'fire')` — that second one is what catches a missing `VARIANTS` entry, which would otherwise pass every other test.

- [ ] **Step 7: Run everything and commit**

Run the targeted test files, then `cd Frontend && npm test` and `cd Frontend && npm run lint`.

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/CombatManager.js" \
        "Frontend/src/component/GameLogic (MVC)/GameEngineBreakDown/InGameManagerHandlers/__tests__/CombatManager.test.js" \
        "Frontend/src/component/GameLogic (MVC)/EnemyUnits.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/FeedbackManager.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/SoundGroups.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/UnitSamples.js" \
        "Frontend/src/component/GameLogic (MVC)/Feedback/__tests__/SoundGroups.test.js"
git commit -m "feat: enemy actions are audible and the attack animation fires with the shot

Enemy ranged fire, melee, spells and summons all emitted nothing. The attack
animation was also driven by its own countdown while the projectile fired on a
separate cooldown, so the two never lined up and the animation played
continuously while a target was in range. Both now come from the shot itself."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

- [ ] **Confirm the zero-files case**

With no sample files present, every sound must still play its synthesized fallback. Confirm the suite passes and that nothing made the synth path conditional on samples existing.

- [ ] **Confirm each success criterion from the spec**

1. All samples come from a single pack and share an obvious character.
2. A Shooter and a Skeleton firing produce the same sound.
3. Mortar, Sniper, Titan and Boss remain individually recognisable.
4. A small enemy and a medium enemy die with audibly different weight.
5. Projectiles and hits sit clearly beneath deaths and explosions in the mix.
6. Enemy ranged fire, melee, spells and summons all produce sound.
7. A skeleton's attack animation plays when it fires, and only when it fires.
8. The full test suite passes.

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Criteria 2 through 7 are audible or visible only. Confirm in play: a Skeleton and a Shooter sound the same when firing; a Mortar does not; a Titan dies more heavily than a mushroom; projectiles no longer drown out deaths; enemy attacks, spells and summons all make sounds; and a Skeleton's attack animation plays on each shot rather than running continuously while a defender is in range.
