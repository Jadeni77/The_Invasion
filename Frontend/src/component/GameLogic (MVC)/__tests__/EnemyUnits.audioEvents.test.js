import { describe, it, expect, vi } from 'vitest';
import {
  BasicEnemy, RangeEnemy, MiniEnemy, VampireEnemy, BerserkerEnemy, AssassinEnemy,
  MageEnemy, NecromancerEnemy, SplitterEnemy, SwarmLeader,
  ATTACK_ANIMATION_LOCK_FRAMES,
} from '../EnemyUnits.js';
import { BasicDefender } from '../DefenderUnits.js';
import { CombatManager } from '../GameEngineBreakDown/InGameManagerHandlers/CombatManager.js';
import { FeedbackBus } from '../Feedback/FeedbackBus.js';
import { FeedbackManager } from '../Feedback/FeedbackManager.js';
import { AudioManager } from '../Feedback/AudioManager.js';

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

describe('the two melee damage paths collapse to one sound', () => {
  /**
   * The smallest AudioContext AudioManager.playRecipe can render into, plus a
   * count of the voices actually started. The melee recipe has noise: true, so
   * a voice is a BufferSource. currentTime is writable so a test can advance
   * the clock between frames instead of relying on a frozen zero, which would
   * make the dedupe window look like a mute.
   */
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

  /**
   * A melee enemy wired to a real bus, FeedbackManager and AudioManager, in
   * contact with a defender. MiniEnemy has a real attackRange (40), so BOTH
   * melee damage paths are live for it: the base updateBehavior countdown and
   * CombatManager's melee branch.
   */
  function createWiredMelee() {
    const { ctx, audio, counts } = createFakeAudio();
    const bus = new FeedbackBus();
    const juice = {
      addTrauma: vi.fn(), triggerHitStop: vi.fn(),
      addDamageNumber: vi.fn(), triggerFlash: vi.fn(), setEnabled: vi.fn(),
    };
    new FeedbackManager(bus, audio, juice).attach();

    const heard = [];
    bus.on('enemy:melee', () => heard.push('melee'));

    const engine = {
      emitFeedback: (event, payload) => bus.emit(event, payload),
      enemyProjectiles: [], projectiles: [], enemies: [], explosions: [], defenders: [],
    };
    const enemy = new MiniEnemy(0, 0, null);
    enemy.gameEngine = engine;
    enemy.attackCountdown = 1; // the base tick lands on the next update()
    const defender = { x: 0, y: 0, width: 32, height: 32, isAlive: true, takeDamage: vi.fn(() => false) };

    return { ctx, counts, heard, engine, enemy, defender, combat: new CombatManager(engine) };
  }

  it('emits twice in one frame but starts only one voice', () => {
    // Verifies the reasoning behind emitting in CombatManager's melee branch
    // while the base updateBehavior tick also emits: GameEngine runs
    // enemy.update() and then updateEnemyCombat within a single frame, so both
    // events land far inside AudioManager's 40ms dedupe window and, sharing
    // the constant dedupe key 'melee:melee', collapse to one sound.
    const { ctx, counts, heard, enemy, defender, combat } = createWiredMelee();
    ctx.currentTime = 10;

    enemy.update([defender]);           // base damage tick
    combat.updateEnemyCombat([defender], [enemy], 5000); // melee branch

    expect(heard).toHaveLength(2);      // the double emit is real
    expect(counts.voices).toBe(1);      // ...and it is heard once
  });

  it('still plays a second sound for a strike beyond the dedupe window', () => {
    // The collapse must be a window, not a mute: a genuinely separate strike
    // later still makes its own sound. Without this, the test above would be
    // satisfied by an implementation that simply never played melee twice.
    const { ctx, counts, enemy, defender, combat } = createWiredMelee();
    ctx.currentTime = 10;

    enemy.update([defender]);
    combat.updateEnemyCombat([defender], [enemy], 5000);
    expect(counts.voices).toBe(1);

    ctx.currentTime = 10 + 0.05; // just past DEDUPE_WINDOW_SECONDS (0.04)
    enemy.attackCountdown = 1;
    enemy.update([defender]);

    expect(counts.voices).toBe(2);
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
    // would re-latch the animation permanently by always being renewed before
    // it expired. attackRate is frames-per-attack, so it IS the gap in frames.
    const { skeleton } = createSkeletonAndDefender();

    expect(ATTACK_ANIMATION_LOCK_FRAMES).toBeGreaterThan(0);
    expect(ATTACK_ANIMATION_LOCK_FRAMES).toBeLessThan(skeleton.attackRate);
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
