import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TitanEnemy } from '../EnemyUnits.js';
import { setFrameDeltaMs } from '../Animation/FrameTime.js';
import { attackAnimationDurationMs } from '../Animation/AttackPlayback.js';
import { AssetManifest } from '../../../assets/AssetManifest.js';
import { FeedbackBus } from '../Feedback/FeedbackBus.js';
import { FeedbackManager } from '../Feedback/FeedbackManager.js';
import { resolveVoice } from '../Feedback/UnitVoices.js';
import { mixGainFor } from '../Feedback/SoundGroups.js';

/**
 * Playtest report: "there is no audio for the earthquake attack, no audio for
 * the phase change... when I place a defender close to titan, it instantly dies
 * without seeing the titan attack at all."
 *
 * Both halves of that are feedback, not balance. The Titan's two AoE abilities
 * work exactly as written - they are simply invisible and inaudible:
 *
 *   - performGroundPound charges for 500ms and then lands three expanding waves
 *     of 45 damage each. Nothing called setAnimation, so the Titan walked
 *     through its own earthquake, and nothing emitted, so it was silent.
 *   - createPhaseTransition disables and damages everything within 1500px at
 *     66% and 33% health, and was equally silent.
 *
 * The damage numbers are deliberately untouched here; they are the owner's
 * balance decision, reported in docs/superpowers/2026-08-15-titan-feedback-report.md.
 */

/** The Titan's own ground-pound schedule, read off performGroundPound. */
const CHARGE_MS = 500;
const WAVE_GAP_MS = 200;
const WAVE_COUNT = 3;
const WAVE_DAMAGE = 45;
/** Charge, then the last wave 400ms later, then the 800ms recovery. */
const POUND_MS = CHARGE_MS + 800;
/**
 * Reaching the first wave takes one tick PAST the charge, because the wave
 * timers are scheduled by the charge timer's own callback: they do not exist
 * yet when the fake clock lands exactly on 500ms.
 */
const FIRST_WAVE_MS = CHARGE_MS + 1;

const FRAME_MS_60HZ = 1000 / 60;

beforeEach(() => {
  setFrameDeltaMs(FRAME_MS_60HZ);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Records every emitFeedback call so a test can count events by name. */
function createEngine(extra = {}) {
  return {
    emitFeedback: vi.fn(),
    enemies: [],
    enemyProjectiles: [],
    spellProjectiles: [],
    explosions: [],
    defenders: [],
    ...extra,
  };
}

function eventsNamed(engine, name) {
  return engine.emitFeedback.mock.calls.filter((call) => call[0] === name);
}

function createTitan(engine) {
  const titan = new TitanEnemy(0, 0, null);
  titan.gameEngine = engine;
  return titan;
}

/**
 * A defender-shaped object centred on the Titan, so it is inside even the
 * first and smallest earthquake wave (earthquakeRadius/3 ~ 117px).
 */
function createDefender({ isAlive = true, id = Math.random() } = {}) {
  return {
    id,
    x: 90, y: 64, width: 0, height: 0,
    isAlive,
    health: 100,
    maxHealth: 100,
    disabled: false,
    disabledDuration: 0,
    takeDamage: vi.fn(() => false),
  };
}

/** Sprite data in the shape GameEngine hands a unit after loading. */
function withManifestAnimations(unit, category, manifestName) {
  const config = AssetManifest[category][manifestName].config;
  unit.animationConfig = config;
  unit.animationFrames = Object.fromEntries(
    Object.entries(config).map(([animation, { frameCount }]) => [
      animation,
      Array.from({ length: frameCount }, (_, index) => `${animation}:${index}`),
    ]),
  );
  return unit;
}

/** Damage large enough to drive the Titan below a phase threshold in one hit. */
function damageToReach(titan, healthFraction) {
  const target = titan.maxHealth * healthFraction;
  const reduction = titan.hasArmor ? titan.armorDamageReduction : 0.5;
  return (titan.health - target + 1) / reduction;
}

describe('the earthquake damages every live defender, whatever the array order', () => {
  /**
   * THE BUG. performGroundPound's damage loop opened with
   *
   *     for (const defender of this.gameEngine.defenders) {
   *       if (!defender.isAlive) return;
   *
   * `return` inside a for...of leaves the whole METHOD, so the first corpse in
   * the array ended the wave early and every defender behind it was spared.
   * Which defenders survived therefore depended on where the dead ones happened
   * to sit in the array - the sort of thing that reads as "sometimes it hits me
   * and sometimes it doesn't". `continue` is what was meant, and it is what the
   * identical loop in EMPEnemy.triggerEMP already uses.
   */
  it('damages a live defender that sits behind a dead one in the array', () => {
    const engine = createEngine();
    const titan = createTitan(engine);
    const dead = createDefender({ isAlive: false, id: 'dead' });
    const live = createDefender({ isAlive: true, id: 'live' });
    engine.defenders = [dead, live];

    titan.performGroundPound();
    vi.advanceTimersByTime(FIRST_WAVE_MS);

    expect(live.takeDamage).toHaveBeenCalledWith(WAVE_DAMAGE);
  });

  it('deals the same damage however the corpses are ordered', () => {
    const run = (order) => {
      const engine = createEngine();
      const titan = createTitan(engine);
      const live = createDefender({ isAlive: true, id: 'live' });
      const dead = createDefender({ isAlive: false, id: 'dead' });
      engine.defenders = order === 'deadFirst' ? [dead, live] : [live, dead];

      titan.performGroundPound();
      vi.advanceTimersByTime(POUND_MS);
      return live.takeDamage.mock.calls.length;
    };

    expect(run('deadFirst')).toBe(WAVE_COUNT);
    expect(run('liveFirst')).toBe(WAVE_COUNT);
  });

  it('skips the corpse itself rather than damaging it', () => {
    const engine = createEngine();
    const titan = createTitan(engine);
    const dead = createDefender({ isAlive: false, id: 'dead' });
    engine.defenders = [dead, createDefender({ id: 'live' })];

    titan.performGroundPound();
    vi.advanceTimersByTime(POUND_MS);

    expect(dead.takeDamage).not.toHaveBeenCalled();
  });

  it('still notices a live defender in range when a dead one comes first', () => {
    // The two OTHER `if (!defender.isAlive) return;` sites - PhantomEnemy's
    // phase-shift check and the Titan's own earthquake trigger - sit inside
    // Array.prototype.find PREDICATES, not for...of loops. There `return`
    // (undefined) means "this one does not match, keep looking", which is
    // correct, and `continue` would not even be legal. Characterised here so a
    // future sweep that "fixes" all three sites the same way has something to
    // fail against.
    const engine = createEngine();
    const titan = createTitan(engine);
    titan.currentGroundPoundCooldown = 1;
    const dead = createDefender({ isAlive: false, id: 'dead' });
    const live = createDefender({ isAlive: true, id: 'live' });
    engine.defenders = [dead, live];

    titan.updateBehavior([dead, live]);

    expect(titan.isGroundPounding).toBe(true);
  });
});

describe('the ground pound impact is audible when it lands', () => {
  // The wind-up used to also emit 'enemy:groundPoundCharge', a separate sound
  // 500ms before the impact - dropped per the owner's ask ("can we only keep
  // the earthquake sound without the initial beep?"). The wind-up itself is
  // silent now; only the impact still makes a sound. See
  // 'produces exactly one sound for the whole pound: the impact, no charge'
  // below, which pins that directly against the real audio-routing path.

  it('emits the impact when the first wave actually lands', () => {
    const engine = createEngine();
    const titan = createTitan(engine);
    const defender = createDefender();
    engine.defenders = [defender];

    titan.performGroundPound();
    vi.advanceTimersByTime(FIRST_WAVE_MS);

    expect(defender.takeDamage).toHaveBeenCalled(); // the wave really landed
    expect(eventsNamed(engine, 'enemy:groundPoundImpact')).toHaveLength(1);
  });

  it('emits ONE impact for all three waves, not three', () => {
    // The three waves are 200ms apart - five times AudioManager's 40ms dedupe
    // window - so three emits would be three full-volume copies of the same
    // sound, not one sound with a rhythm. The three waves are one ability; the
    // rhythm is authored into the recipe's layers instead.
    const engine = createEngine();
    const titan = createTitan(engine);
    const defender = createDefender();
    engine.defenders = [defender];

    titan.performGroundPound();
    vi.advanceTimersByTime(POUND_MS);

    expect(defender.takeDamage).toHaveBeenCalledTimes(WAVE_COUNT); // all three ran
    expect(eventsNamed(engine, 'enemy:groundPoundImpact')).toHaveLength(1);
  });

  it('stays silent about an impact the Titan died before delivering', () => {
    const engine = createEngine();
    const titan = createTitan(engine);
    engine.defenders = [createDefender()];

    titan.performGroundPound();
    titan.isAlive = false;
    vi.advanceTimersByTime(POUND_MS);

    expect(eventsNamed(engine, 'enemy:groundPoundImpact')).toHaveLength(0);
  });

  it('does not throw when the Titan has no engine reference', () => {
    const titan = new TitanEnemy(0, 0, null);
    expect(() => titan.performGroundPound()).not.toThrow();
  });
});

describe('the phase transition is audible', () => {
  it('emits a phase-change event when the Titan crosses 66% health', () => {
    const engine = createEngine();
    const titan = createTitan(engine);

    titan.takeDamage(damageToReach(titan, 0.66));

    expect(titan.phase).toBe(2);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:phaseChange',
      { unitType: 'TitanEnemy', phase: 2 },
    );
  });

  it('emits again, carrying the new phase, at 33%', () => {
    const engine = createEngine();
    const titan = createTitan(engine);

    titan.takeDamage(damageToReach(titan, 0.66));
    titan.takeDamage(damageToReach(titan, 0.33));

    expect(titan.phase).toBe(3);
    expect(eventsNamed(engine, 'enemy:phaseChange')).toHaveLength(2);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:phaseChange',
      { unitType: 'TitanEnemy', phase: 3 },
    );
  });

  it('emits once per transition, not once per defender it disables', () => {
    // The transition disables everything within 1500px - in practice the whole
    // board. An emit inside that loop would stack one copy of the sound per
    // defender the player owns.
    const engine = createEngine();
    const titan = createTitan(engine);
    engine.defenders = [createDefender(), createDefender(), createDefender()];

    titan.takeDamage(damageToReach(titan, 0.66));

    expect(engine.defenders.every((d) => d.disabled)).toBe(true); // it really fired
    expect(eventsNamed(engine, 'enemy:phaseChange')).toHaveLength(1);
  });

  it('says nothing on a hit that crosses no threshold', () => {
    const engine = createEngine();
    const titan = createTitan(engine);

    titan.takeDamage(10);

    expect(titan.phase).toBe(1);
    expect(eventsNamed(engine, 'enemy:phaseChange')).toHaveLength(0);
  });
});

describe('the ground pound is visible before it lands', () => {
  /**
   * The owner watched a defender die "without seeing the titan attack at all".
   * AssetManifest.enemies.Titan declares an 11-frame attack sheet at 5.5fps -
   * 2000ms, exactly the Titan's attackRate 120 cadence - and nothing ever
   * played it outside melee contact.
   *
   * The telegraph reuses the cadence-derived playback from 01801f4 rather than
   * adding a second animation clock: beginAttackAnimation() restarts the sheet
   * at frame 0 and sizes one full pass to min(authored, cadence).
   */
  function createAnimatedTitan(engine) {
    return withManifestAnimations(createTitan(engine), 'enemies', 'Titan');
  }

  it('has an attack sheet to play at all', () => {
    // If this ever fails, the telegraph below is animating an asset that does
    // not exist and the right answer is to say so, not to invent a sheet.
    const attack = AssetManifest.enemies.Titan.config.attack;

    expect(attack.frameCount).toBeGreaterThan(1);
    expect(attack.fps).toBeGreaterThan(0);
    expect(AssetManifest.enemies.Titan.sprites.attack).toBeTypeOf('function');
  });

  it('plays the attack animation during the wind-up, before any damage lands', () => {
    const engine = createEngine();
    const titan = createAnimatedTitan(engine);
    const defender = createDefender();
    engine.defenders = [defender];

    titan.performGroundPound();
    titan.update([]); // one engine frame, still inside the 500ms charge

    expect(titan.currentAnimation).toBe('attack');
    expect(defender.takeDamage).not.toHaveBeenCalled();
  });

  it('starts the sheet from its first frame rather than mid-swing', () => {
    const engine = createEngine();
    const titan = createAnimatedTitan(engine);
    titan.animationFrame = 7; // as though it were mid-walk

    titan.performGroundPound();

    expect(titan.animationFrame).toBe(0);
    expect(titan.attackAnimationRemainingMs).toBe(
      attackAnimationDurationMs(AssetManifest.enemies.Titan.config.attack, titan.attackCadenceMs()),
    );
  });

  it('holds the swing for the whole pound, not for a single frame', () => {
    // The base updateBehavior clears isAttacking on every frame with nothing in
    // melee contact, and a ground pound is not melee contact - so a telegraph
    // that only sets the flag once is erased by the next update() and the
    // player sees one frame of it.
    const engine = createEngine();
    const titan = createAnimatedTitan(engine);
    engine.defenders = [createDefender()];

    titan.performGroundPound();
    for (let i = 0; i < 20; i++) titan.update([]); // ~333ms, still charging

    expect(titan.isGroundPounding).toBe(true);
    expect(titan.currentAnimation).toBe('attack');
  });

  it('stands still while it winds up instead of walking through its own quake', () => {
    const engine = createEngine();
    const titan = createAnimatedTitan(engine);
    engine.defenders = [createDefender()];
    const startX = titan.x;

    titan.performGroundPound();
    for (let i = 0; i < 20; i++) titan.update([]);

    expect(titan.x).toBe(startX);
  });

  it('goes back to walking once the pound is over', () => {
    const engine = createEngine();
    const titan = createAnimatedTitan(engine);
    engine.defenders = [createDefender()];

    titan.performGroundPound();
    vi.advanceTimersByTime(POUND_MS);
    titan.update([]);

    expect(titan.isGroundPounding).toBe(false);
    expect(titan.isAttacking).toBe(false);
    expect(titan.currentAnimation).toBe('move');
  });
});

describe('what the player actually hears, through the real feedback path', () => {
  /**
   * The emits above prove the events leave the Titan. These prove they arrive
   * as sound: the real FeedbackBus, the real FeedbackManager routing and the
   * real SoundGroups/UnitVoices resolution, with only the AudioManager faked.
   */
  function createWiredEngine() {
    const bus = new FeedbackBus();
    const audio = { playSfx: vi.fn(), playRecipe: vi.fn(), setVolumes: vi.fn(), hasSample: () => false };
    const juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    new FeedbackManager(bus, audio, juice).attach();

    const engine = createEngine();
    engine.emitFeedback = vi.fn((event, payload) => bus.emit(event, payload));
    return { engine, audio, juice };
  }

  it('produces exactly one sound for the whole pound: the impact, no charge', () => {
    // The owner's ask, verbatim: "can we only keep the earthquake sound
    // without the initial beep?" The wind-up used to play a separate rising
    // synth tone (quake-charge) 500ms before the impact; that event no longer
    // exists, so the only sound the ability makes is the impact landing. If a
    // future change reintroduces a wind-up emit, this goes from one call to
    // two and fails.
    const { engine, audio } = createWiredEngine();
    const titan = createTitan(engine);
    engine.defenders = [createDefender()];

    titan.performGroundPound();
    vi.advanceTimersByTime(POUND_MS);

    expect(audio.playRecipe).toHaveBeenCalledTimes(1);
    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('quake-impact', 'impact'),
      'quake-impact:impact',
      mixGainFor('quake-impact'),
    );
  });

  it('plays the phase-change sound when the Titan escalates', () => {
    const { engine, audio } = createWiredEngine();
    const titan = createTitan(engine);
    engine.defenders = [createDefender()];

    titan.takeDamage(damageToReach(titan, 0.66));

    expect(audio.playRecipe).toHaveBeenCalledWith(
      resolveVoice('phase-change', 'phase'),
      'phase-change:phase',
      mixGainFor('phase-change'),
    );
  });

  it('neither ability falls back to the generic projectile sound', () => {
    // Rejects a missing soundKeyFor branch. Every unknown variant resolves to
    // 'projectile' by design, so a typo'd or unrouted variant is not silent -
    // it is a bow twang under a boss's earthquake, which is worse.
    const { engine, audio } = createWiredEngine();
    const titan = createTitan(engine);
    engine.defenders = [createDefender()];

    titan.performGroundPound();
    vi.advanceTimersByTime(POUND_MS);
    titan.takeDamage(damageToReach(titan, 0.66));

    const keys = audio.playRecipe.mock.calls.map((call) => call[1]);
    expect(keys).not.toContain('projectile:impact');
    expect(keys).not.toContain('projectile:phase');
  });
});
