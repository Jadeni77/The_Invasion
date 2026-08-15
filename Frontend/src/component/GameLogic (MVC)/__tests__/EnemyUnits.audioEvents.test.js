import { describe, it, expect, vi } from 'vitest';
import {
  BasicEnemy, RangeEnemy, MiniEnemy, VampireEnemy, BerserkerEnemy, AssassinEnemy,
  MageEnemy, NecromancerEnemy, SplitterEnemy, SwarmLeader, BossEnemy, Enemy,
  ATTACK_ANIMATION_LOCK_FRAMES,
} from '../EnemyUnits.js';
import { BasicDefender } from '../DefenderUnits.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';
import { GameEngine } from '../GameEngine.js';
import { FeedbackBus } from '../Feedback/FeedbackBus.js';
import { FeedbackManager } from '../Feedback/FeedbackManager.js';
import { AudioManager, DEDUPE_WINDOW_SECONDS } from '../Feedback/AudioManager.js';

/**
 * Task 4: enemy melee, spells and summons were silent, and the enemy attack
 * animation was driven by a frame countdown of its own while the projectile
 * was fired on CombatManager's time-based cooldown - two clocks that drift
 * apart immediately, so a skeleton's swing never lined up with its shot.
 *
 * Every emit below is placed at the site where the action actually happens,
 * because that is the only placement that survives the two ways enemies deal
 * damage: CombatManager calls enemy.attack() BOTH for a genuine melee strike
 * AND from a ranged projectile's onHit callback, so an emit inside the base
 * Enemy.attack() would announce a melee swing every time an arrow landed.
 */
const CARD = { level: 1, image: null };

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

/** A defender-shaped target sitting exactly on top of the given unit. */
function overlappingTarget(unit) {
  return {
    x: unit.x, y: unit.y, width: unit.width, height: unit.height,
    isAlive: true, health: 100, maxHealth: 100,
    takeDamage: vi.fn(() => false),
  };
}

describe('melee strikes are audible', () => {
  /** A melee enemy primed so its very next update() lands a damage tick. */
  function createPrimedMelee(engine) {
    const enemy = new BasicEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.attackCountdown = 1;
    return enemy;
  }

  it('emits enemy:melee on the damage tick, carrying the enemy type', () => {
    const engine = createEngine();
    const enemy = createPrimedMelee(engine);
    const defender = overlappingTarget(enemy);

    enemy.update([defender]);

    expect(defender.takeDamage).toHaveBeenCalledWith(enemy.attackDamage);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'BasicEnemy' },
    );
  });

  it('emits once per damage tick, not once per frame spent in contact', () => {
    // Rejects: an emit placed beside `this.isAttacking = true` rather than
    // beside the takeDamage call. That version fires ~60 times a second while
    // an enemy stands on a defender - a buzz, not a swing.
    const engine = createEngine();
    const enemy = createPrimedMelee(engine);
    const defender = overlappingTarget(enemy);

    for (let i = 0; i < 40; i++) enemy.update([defender]);

    expect(defender.takeDamage).toHaveBeenCalledTimes(1);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(1);
  });

  it('stays silent on the frames between damage ticks', () => {
    const engine = createEngine();
    const enemy = new BasicEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.attackCountdown = 5;
    const defender = overlappingTarget(enemy);

    for (let i = 0; i < 4; i++) enemy.update([defender]);

    expect(defender.takeDamage).not.toHaveBeenCalled();
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });

  it('does not throw when the enemy has no engine reference', () => {
    const enemy = new BasicEnemy(0, 0, null);
    enemy.attackCountdown = 1;

    expect(() => enemy.update([overlappingTarget(enemy)])).not.toThrow();
  });

  it('a landing arrow is a hit, not a melee swing', () => {
    // THE placement test. CombatManager calls enemy.attack() from two sites:
    // the melee branch, and the ranged projectile's onHit callback. An emit
    // inside Enemy.attack() therefore makes a skeleton emit 'enemy:fired' on
    // release and 'enemy:melee' when the arrow lands - wrong sound, wrong
    // moment. This drives the projectile through its real onHit and requires
    // silence from the melee channel.
    const engine = createEngine();
    const skeleton = new RangeEnemy(0, 0, null);
    skeleton.gameEngine = engine;
    const defender = { x: 60, y: 0, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    expect(engine.enemyProjectiles).toHaveLength(1);
    engine.enemyProjectiles[0].onHit();

    expect(defender.takeDamage).toHaveBeenCalled(); // the arrow really landed
    expect(eventsNamed(engine, 'enemy:fired')).toHaveLength(1);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });

  it.each([
    ['NecromancerEnemy', () => new NecromancerEnemy(0, 0, null)],
    ['SwarmLeader', () => new SwarmLeader(0, 0, null)],
  ])('%s strikes through CombatManager alone, and is still heard', (name, build) => {
    // Fix round 1. These two override updateBehavior WITHOUT calling super and
    // WITHOUT applying damage there, and do not override attack() either, so
    // their melee damage arrives only through CombatManager's melee branch ->
    // base Enemy.attack(). Every emit site added in the first round missed
    // them and their strikes were silent.
    const engine = createEngine();
    const enemy = build();
    enemy.gameEngine = engine;
    const defender = { x: enemy.x, y: enemy.y, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [enemy], 5000);

    expect(defender.takeDamage).toHaveBeenCalled(); // the strike really landed
    expect(engine.emitFeedback).toHaveBeenCalledWith('enemy:melee', { unitType: name });
  });

  it('says nothing for a stunned enemy, whose strike is a no-op', () => {
    // Enemy.attack() bails out on stunned before dealing damage, but
    // updateEnemyCombat only filters frozen - so without a guard the melee
    // branch would announce a swing that never happened.
    const engine = createEngine();
    const enemy = new MiniEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.stunned = true;
    const defender = { x: 0, y: 0, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [enemy], 5000);

    expect(defender.takeDamage).not.toHaveBeenCalled();
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });

  it('VampireEnemy emits its own melee event - its attack() never calls super', () => {
    const engine = createEngine();
    const vampire = new VampireEnemy(0, 0, null);
    vampire.gameEngine = engine;
    const target = overlappingTarget(vampire);

    vampire.attack(target, 1000);

    expect(target.takeDamage).toHaveBeenCalled();
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'VampireEnemy' },
    );
  });

  it('BerserkerEnemy emits its own melee event - its attack() never calls super', () => {
    const engine = createEngine();
    const berserker = new BerserkerEnemy(0, 0, null);
    berserker.gameEngine = engine;
    const target = overlappingTarget(berserker);

    berserker.attack(target, 1000);

    expect(target.takeDamage).toHaveBeenCalled();
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'BerserkerEnemy' },
    );
  });

  it('AssassinEnemy emits for its one critical strike, and only once', () => {
    // The assassination applies damage inside updateBehavior, bypassing both
    // Enemy.attack and the base countdown, so it needs an emit of its own.
    // After hasStruck it delegates to the base behaviour, which is covered by
    // the damage-tick emit - the second update must not add another event.
    const engine = createEngine();
    const assassin = new AssassinEnemy(0, 0, null);
    assassin.gameEngine = engine;
    const defender = new BasicDefender(0, 0, CARD);

    assassin.updateBehavior([defender]);
    assassin.updateBehavior([defender]);

    expect(assassin.hasStruck).toBe(true);
    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:melee',
      { unitType: 'AssassinEnemy' },
    );
  });

  it('the assassin says nothing when its strike never happens', () => {
    const engine = createEngine();
    const assassin = new AssassinEnemy(0, 0, null);
    assassin.gameEngine = engine;

    assassin.updateBehavior([]); // nobody to strike

    expect(eventsNamed(engine, 'enemy:melee')).toHaveLength(0);
  });
});

describe('enemy spells are audible', () => {
  function createMage(engine, spellType) {
    const mage = new MageEnemy(0, 0, null);
    mage.gameEngine = engine;
    mage.spellType = spellType;
    mage.currentTarget = overlappingTarget(mage);
    return mage;
  }

  it.each(['fireball', 'icebolt'])('emits enemy:spell when the %s leaves the mage', (spell) => {
    const engine = createEngine();
    const mage = createMage(engine, spell);

    mage.performSpellAttack();

    expect(engine.spellProjectiles).toHaveLength(1);
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:spell',
      { unitType: 'MageEnemy' },
    );
  });

  it('emits once for a lightning strike however many defenders it chains to', () => {
    // Lightning deals its damage directly - no projectile - so it is silent
    // unless its own emit exists. Emitting per damaged defender would stack
    // several copies of one spell on top of each other.
    const engine = createEngine();
    const mage = createMage(engine, 'lightning');
    const neighbour = { ...overlappingTarget(mage), id: 'neighbour' };
    const second = { ...overlappingTarget(mage), id: 'second' };
    mage.currentTarget.id = 'primary';
    engine.defenders = [mage.currentTarget, neighbour, second];

    mage.performSpellAttack();

    expect(neighbour.takeDamage).toHaveBeenCalled(); // the chain really fired
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(1);
  });

  it('says nothing when the cast is abandoned because the target died', () => {
    const engine = createEngine();
    const mage = createMage(engine, 'fireball');
    mage.currentTarget.isAlive = false;

    mage.performSpellAttack();

    expect(engine.spellProjectiles).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:spell')).toHaveLength(0);
  });
});

describe('enemy summons are audible', () => {
  it('the swarm witch emits enemy:summon for each periodic spawn', () => {
    const engine = createEngine();
    const witch = new SwarmLeader(0, 0, null);
    witch.gameEngine = engine;

    witch.spawnEnemy();
    witch.spawnEnemy();

    expect(engine.enemies).toHaveLength(2);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(2);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:summon',
      { unitType: 'SwarmLeader' },
    );
  });

  it('the swarm witch emits one summon for its whole death split, not five', () => {
    const engine = createEngine();
    const witch = new SwarmLeader(0, 0, null);
    witch.gameEngine = engine;

    witch.takeDamage(9999); // dies, splitting into splitCount splitters

    expect(engine.enemies).toHaveLength(witch.splitCount);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(1);
  });

  it('the swarm witch says nothing while frozen, when no spawn happens', () => {
    const engine = createEngine();
    const witch = new SwarmLeader(0, 0, null);
    witch.gameEngine = engine;
    witch.frozen = true;

    witch.spawnEnemy();

    expect(engine.enemies).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(0);
  });

  it('the necromancer emits enemy:summon when a skeleton actually appears', () => {
    const engine = createEngine();
    const necromancer = new NecromancerEnemy(0, 0, null);
    necromancer.gameEngine = engine;

    necromancer.reviveSkeletons();

    expect(engine.enemies).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:summon',
      { unitType: 'NecromancerEnemy' },
    );
  });

  it('the necromancer says nothing while frozen, when no skeleton appears', () => {
    const engine = createEngine();
    const necromancer = new NecromancerEnemy(0, 0, null);
    necromancer.gameEngine = engine;
    necromancer.frozen = true;

    necromancer.reviveSkeletons();

    expect(engine.enemies).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(0);
  });

  it('a splitter emits one summon for the whole split, not one per mini', () => {
    // Three minis appear in the same instant; three events would be three
    // copies of one sound fighting each other. The split is one moment.
    const engine = createEngine();
    const splitter = new SplitterEnemy(0, 0, null);
    splitter.gameEngine = engine;

    splitter.takeDamage(9999); // dies, and splits on the way out

    expect(engine.enemies).toHaveLength(splitter.splitCount);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(1);
    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:summon',
      { unitType: 'SplitterEnemy' },
    );
  });

  it('a splitter that survives the hit summons nothing and says nothing', () => {
    const engine = createEngine();
    const splitter = new SplitterEnemy(0, 0, null);
    splitter.gameEngine = engine;

    splitter.takeDamage(1);

    expect(engine.enemies).toHaveLength(0);
    expect(eventsNamed(engine, 'enemy:summon')).toHaveLength(0);
  });
});

describe('how many melee sounds a real engine tick actually produces', () => {
  /**
   * These run the REAL GameEngine.updateEnemies() loop - the one that calls
   * enemy.update(this.defenders) and then combatManager.updateEnemyCombat(...)
   * - against real unit geometry, with the AudioContext clock advanced in step
   * with the game clock, and count the voices AudioManager actually starts.
   *
   * They replace a pair of tests that pinned AudioManager's dedupe MECHANISM
   * against a hand-built engine stub and a frozen ctx.currentTime. Those tests
   * were green for a claim they could not check: that the two melee emits
   * always land in the same frame and therefore always collapse. The emits are
   * gated by different conditions on different clocks (AABB overlap driven by
   * a frame counter, versus centre distance gated by a wall-clock cooldown),
   * so their phase offset is arbitrary, and the numbers below are what a real
   * tick produces rather than what the mechanism permits.
   */

  /** The smallest AudioContext playRecipe can render into, counting voices. */
  function createFakeAudio() {
    const counts = { voices: 0 };
    const param = () => ({
      value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {},
    });
    const ctx = {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
      createOscillator: () => {
        counts.voices++;
        return { type: 'sine', frequency: param(), connect() {}, start() {}, stop() {} };
      },
      createBufferSource: () => {
        counts.voices++;
        return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} };
      },
      createBuffer: () => ({ getChannelData: () => new Float32Array(64) }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {} }),
    };
    const audio = new AudioManager(() => ctx);
    audio.init();
    return { ctx, audio, counts };
  }

  const FRAME_MS = 1000 / 60;

  /**
   * Walks one enemy into one Shooter on a real GameEngine and reports what was
   * emitted and what was heard. The defender is given absurd health so the run
   * covers many attack cycles, and defenseLineX is pushed far right so the
   * enemy is never removed for reaching the base.
   */
  function runApproach(EnemyClass, frames = 900) {
    const { ctx, audio, counts } = createFakeAudio();
    const bus = new FeedbackBus();
    const juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    new FeedbackManager(bus, audio, juice).attach();

    const engine = new GameEngine();
    engine.defenseLineX = 1e6;
    engine.feedbackBus = bus;

    const defender = new BasicDefender(400, 100, CARD);
    defender.health = 1e9;
    defender.maxHealth = 1e9;
    engine.defenders = [defender];

    const enemy = new EnemyClass(100, 100, null);
    enemy.setGameEngine(engine);
    engine.enemies = [enemy];

    let now = 10000;
    const emitsAt = [];
    const voicesAt = [];
    bus.on('enemy:melee', () => emitsAt.push(now));
    // Voices are counted where AudioManager decides to start one, so a
    // suppressed duplicate is visible as an emit with no voice behind it.
    const reserve = audio.reserveVoiceSlot.bind(audio);
    audio.reserveVoiceSlot = (key, at) => {
      const allowed = reserve(key, at);
      if (allowed && key === 'melee:melee') voicesAt.push(now);
      return allowed;
    };

    for (let i = 0; i < frames; i++) {
      now += FRAME_MS;
      ctx.currentTime = now / 1000;
      engine.updateEnemies(now);
    }

    const gapsBetween = (times) => times.slice(1).map((t, i) => t - times[i]);
    return {
      enemy,
      emits: emitsAt.length,
      voices: voicesAt.length,
      // The tail, once the enemy has stopped and is in steady-state combat.
      voiceGaps: gapsBetween(voicesAt).slice(-6),
      emitGaps: gapsBetween(emitsAt).slice(-6),
      cycleMs: (enemy.attackRate * 1000) / 60,
      counts,
    };
  }

  it('plays one melee sound per attack cycle for an ordinary melee enemy', () => {
    // A MiniEnemy is 32 wide and a Shooter 64, so AABB contact happens at a
    // centre distance of 48 - OUTSIDE the MiniEnemy's 40px attackRange. It
    // stops on contact and never becomes a CombatManager target at all, so
    // only the base updateBehavior tick ever fires. The two paths are mutually
    // exclusive here by geometry, not by deduplication.
    const run = runApproach(MiniEnemy);

    expect(run.voices).toBe(run.emits);
    for (const gap of run.voiceGaps) {
      expect(gap).toBeGreaterThan(run.cycleMs * 0.75);
    }
  });

  it('collapses the two emits a Vampire produces for a single strike', () => {
    // VampireEnemy emits at its own damage line inside attack(), and
    // CombatManager emits again in the melee branch that just called it. Those
    // two emits are in ONE call stack - zero milliseconds apart, whatever
    // order GameEngine runs its calls in - so the dedupe window collapses them
    // reliably. This is the case where the collapse genuinely holds, and it
    // holds because of the call stack, not because of frame timing.
    const run = runApproach(VampireEnemy);

    expect(run.emits).toBe(run.voices * 2);
    for (const gap of run.voiceGaps) {
      expect(gap).toBeGreaterThan(run.cycleMs * 0.75);
    }
  });

  it('plays TWO melee sounds per attack cycle for a Boss - a known defect', () => {
    // KNOWN DEFECT, characterised rather than fixed. BossEnemy uses the base
    // updateBehavior tick AND has an attackRange (1000) far larger than the
    // 82px centre distance it stops at, so it is a CombatManager target as
    // well. Both damage paths run, on independent clocks, and land several
    // HUNDRED milliseconds apart - orders of magnitude outside the 40ms dedupe
    // window. The player hears two thumps per swing.
    //
    // This is issue 14 (melee double damage) surfacing as audio: the correct
    // repair is one damage path, which is a balance decision, not an audio
    // one. When that is fixed this test SHOULD fail - replace it then with an
    // assertion of one sound per cycle.
    const run = runApproach(BossEnemy);

    expect(run.voices).toBe(run.emits); // nothing is collapsed
    const shortest = Math.min(...run.voiceGaps);
    expect(shortest).toBeGreaterThan(DEDUPE_WINDOW_SECONDS * 1000);
    expect(shortest).toBeLessThan(run.cycleMs * 0.75); // ...twice per cycle
  });
});

describe('the attack animation follows the shot, not a countdown of its own', () => {
  /** A skeleton with a defender comfortably inside its 150px attack range. */
  function createSkeletonAndDefender() {
    const skeleton = new RangeEnemy(0, 0, null);
    const defender = new BasicDefender(50, 0, CARD);
    return { skeleton, defender };
  }

  /**
   * Attaches minimal animation data so setAnimation actually records a state -
   * it is a no-op on a unit with no frames, which is how the real units are
   * built in these tests. This lets a test read the animation the player would
   * see rather than only the isAttacking flag that feeds it.
   */
  function withAnimations(enemy) {
    enemy.animationFrames = { idle: ['idle'], move: ['move'], attack: ['attack'] };
    enemy.animationConfig = {
      idle: { frameCount: 1, fps: 10 },
      move: { frameCount: 1, fps: 10 },
      attack: { frameCount: 1, fps: 10 },
    };
    return enemy;
  }

  it('does not play the attack animation just because a defender is in range', () => {
    // THE regression test. RangeEnemy.updateBehavior used to set isAttacking
    // on EVERY frame a defender was in range, so the swing ran continuously
    // and could not line up with anything. A fix that adds the new trigger in
    // CombatManager WITHOUT removing this one looks identical in a test that
    // only checks "firing sets isAttacking" - the animation is simply always
    // on - which is why this test asserts the negative over many frames.
    const { skeleton, defender } = createSkeletonAndDefender();

    for (let i = 0; i < 120; i++) skeleton.update([defender]);

    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.isMoving).toBe(false); // it does still stop to shoot
  });

  it('plays the attack animation on the frame the shot leaves', () => {
    const engine = createEngine();
    const { skeleton, defender } = createSkeletonAndDefender();
    skeleton.gameEngine = engine;
    const combat = new CombatManager(engine);

    skeleton.update([defender]);
    expect(skeleton.isAttacking).toBe(false); // nothing fired yet

    combat.updateEnemyCombat([defender], [skeleton], 1000);

    expect(engine.enemyProjectiles).toHaveLength(1);
    expect(skeleton.isAttacking).toBe(true);
  });

  it('stops attacking between two shots, while still in range', () => {
    // THE case the first round missed, and the one the spec's own regression
    // test names: "an enemy in range but not firing is not stuck in its attack
    // animation". Setting isAttacking at the shot without ever clearing it
    // leaves the flag latched on until the target leaves range, so between
    // shots the skeleton is still mid-swing - which is what the player sees as
    // "the attack and the projectile don't correlate".
    const engine = createEngine();
    const { skeleton, defender } = createSkeletonAndDefender();
    withAnimations(skeleton);
    skeleton.gameEngine = engine;
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    expect(skeleton.isAttacking).toBe(true);

    // 40 frames in range with the cooldown still running: canAttack stays
    // false, so this is exactly "in range but not firing".
    for (let i = 1; i <= 40; i++) {
      skeleton.update([defender]);
      combat.updateEnemyCombat([defender], [skeleton], 1000 + i);
    }

    expect(engine.enemyProjectiles).toHaveLength(1); // no second shot happened
    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.currentAnimation).not.toBe('attack');
  });

  it('keeps the swing on screen for the frames right after the shot', () => {
    // The other half of the same requirement: clearing the flag too eagerly
    // means the attack animation never renders at all, because GameEngine runs
    // enemy.update() BEFORE updateEnemyCombat, so determineAnimationState
    // would read a flag that was already cleared.
    const engine = createEngine();
    const { skeleton, defender } = createSkeletonAndDefender();
    withAnimations(skeleton);
    skeleton.gameEngine = engine;
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [skeleton], 1000);
    skeleton.update([defender]);

    expect(skeleton.isAttacking).toBe(true);
    expect(skeleton.currentAnimation).toBe('attack');
  });

  it('holds the swing for less time than the gap between shots', () => {
    // Rejects: a lock as long as (or longer than) the firing cadence, which
    // would re-latch the animation permanently by being renewed before it
    // expired.
    //
    // Stated in MILLISECONDS on purpose. The lock is counted in frames while
    // the cooldown canAttack enforces is wall-clock, so a frames-to-frames
    // comparison (20 < 50) hides the real margin: it shrinks as frame time
    // grows, and at roughly 24fps or below the lock outlasts the cooldown and
    // the latch comes back. See ATTACK_ANIMATION_LOCK_FRAMES for that
    // assumption written down at the constant.
    const { skeleton } = createSkeletonAndDefender();
    const FRAME_MS = 1000 / 60;
    const lockMs = ATTACK_ANIMATION_LOCK_FRAMES * FRAME_MS;
    const cooldownMs = (skeleton.attackRate * 1000) / 60;

    expect(ATTACK_ANIMATION_LOCK_FRAMES).toBeGreaterThan(0);
    expect(lockMs).toBeLessThan(cooldownMs);
  });

  it('releases the lock for any ranged enemy, not only a RangeEnemy', () => {
    // CombatManager locks on isRanged, but the countdown used to live in
    // RangeEnemy.updateBehavior alone. MageEnemy also declares isRanged and is
    // kept out of that branch only by its canAttack() override returning
    // false; relax that, or add a ranged enemy that does not extend
    // RangeEnemy, and isAttacking latches on forever - the bug this task
    // fixed, and the shape of the dead attackAnimationLock in
    // DefenderUnits.js. The release therefore belongs where the lock can
    // always reach it: the base class.
    class TurretEnemy extends Enemy {
      constructor(x, y) {
        super(x, y, {
          isAttacker: true, isRanged: true, attackRange: 500,
          attackDamage: 5, attackRate: 50, width: 40, height: 40,
        });
      }

      // Holds position and keeps no animation state of its own, so nothing
      // except the lock can bring isAttacking back down.
      updateBehavior() {}
    }

    const engine = createEngine();
    const enemy = new TurretEnemy(0, 0);
    enemy.gameEngine = engine;
    const defender = { x: 60, y: 0, width: 40, height: 40, isAlive: true, takeDamage: vi.fn(() => false) };
    const combat = new CombatManager(engine);

    combat.updateEnemyCombat([defender], [enemy], 1000);
    expect(enemy.isAttacking).toBe(true);

    for (let i = 0; i < ATTACK_ANIMATION_LOCK_FRAMES; i++) enemy.update([defender]);

    expect(enemy.isAttacking).toBe(false);
  });

  it('returns to the walk animation once nothing is in range', () => {
    // Rejects: deleting RangeEnemy.updateBehavior's else branch along with the
    // countdown. Without it the enemy would walk forward stuck mid-swing.
    const { skeleton } = createSkeletonAndDefender();
    skeleton.isAttacking = true; // as though it had just fired

    skeleton.update([]);

    expect(skeleton.isAttacking).toBe(false);
    expect(skeleton.isMoving).toBe(true);
    expect(skeleton.x).toBeGreaterThan(0);
  });
});
