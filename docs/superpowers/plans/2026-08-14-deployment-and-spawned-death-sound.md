# Deployment Sizing and Spawned-Enemy Death Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two diagnosed bugs — defenders cannot be placed adjacent to each other on smaller windows, and enemies spawned by other enemies die silently.

**Architecture:** Both fixes remove an incorrect coupling. Unit sprite size is currently hardcoded independently of the grid cell it must fit, so it is derived from the cell instead. Death *feedback* is currently emitted inside the *scoring* guard, so it is moved outside — a spawned enemy awards no score but is still a death the player should hear.

**Tech Stack:** Vite 7, Vitest 4, plain ES modules. No new dependencies.

**Branch:** `feature/per-unit-audio` — continues the branch behind PR #5. Task 2 is an audio fix that belongs to that work; Task 1 is independent gameplay but shares files with it, so keeping both here avoids a conflict-prone parallel branch.

## Global Constraints

- **Grid cell size is dynamic**: `Math.min(floor(availableWidth / 9), floor(availableHeight / rows), 80)`, floored at 40. It ranges 40–80 depending on window size.
- **`checkCollision` is strict AABB** (`x1 + w1 > x2`), so units that merely touch do NOT collide. A unit exactly one cell wide can always sit beside another.
- **Death feedback must never depend on score eligibility.** `emitEnemyDeathFeedback` is already idempotent per enemy via the `deathFeedbackEmitted` flag, so moving calls outside the scoring guard cannot double-fire.
- Scoring behaviour must not change: spawned enemies (`isSpawned`) and self-destructing bombers (`shouldExplode`) still award no score, no `enemiesKilled`, no drops, no wave-kill count.
- Existing test convention: tests in `__tests__/` beside the source, explicit `vitest` imports (`globals: false`). `GameEngine` methods are tested by borrowing them onto stub objects via `GameEngine.prototype.method.call(stub, ...)` — there is no engine test harness.
- Path note: `Frontend/src/component/GameLogic (MVC)/` contains a space and parentheses. Always quote it in shell commands.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `GameEngine.js` | Modify | New `sizeUnitToGrid`; `deployDefender` uses it; three `enemy:died` emits moved out of the scoring guard |
| `__tests__/GameEngine.test.js` | Modify | Sizing tests and adjacency proof appended |
| `__tests__/GameEngine.casualties.test.js` | Modify | Spawned-enemy death-sound tests appended |

---

## Task 1: Size units to the grid cell

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (new method; `deployDefender` around lines 469-500)
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.test.js` (append)

**Interfaces:**
- Consumes: nothing
- Produces: `GameEngine.prototype.sizeUnitToGrid(unit)` — sets `unit.width` and `unit.height` to the current grid cell size and returns the unit; a no-op when no grid manager is attached

**Background:** every defender declares `width: 64, height: 64` (spells declare 60 and 50). The grid cell is computed from the window and ranges 40–80. `deployDefender` centres the unit in its cell with `gridCell.x + (gridSize - unit.width) / 2`, so at a 60px cell a 64px unit spans `[x-2, x+62]` while its neighbour spans `[x+58, x+122]` — a 4px overlap. `isValidDeploymentPosition` rejects any placement overlapping an existing defender, so **nothing can be placed beside an existing unit whenever the cell is under 64px**. Six-row levels need roughly 794px of browser content height to reach a 64px cell, which an ordinary laptop window does not have.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.test.js`:

```js
describe('sizeUnitToGrid', () => {
  function engineWithCell(gridSize) {
    return {
      gridManager: gridSize === null ? null : { gridSize },
      sizeUnitToGrid: GameEngine.prototype.sizeUnitToGrid,
      checkCollision: GameEngine.prototype.checkCollision,
    };
  }

  it('sizes a unit to the cell when the cell is small', () => {
    const engine = engineWithCell(48);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(48);
    expect(unit.height).toBe(48);
  });

  it('sizes a unit up to a larger cell too', () => {
    const engine = engineWithCell(80);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(80);
    expect(unit.height).toBe(80);
  });

  it('returns the unit so it can be used inline', () => {
    const engine = engineWithCell(60);
    const unit = { width: 64, height: 64 };

    expect(engine.sizeUnitToGrid(unit)).toBe(unit);
  });

  it('leaves the unit alone when no grid manager is attached', () => {
    const engine = engineWithCell(null);
    const unit = { width: 64, height: 64 };

    engine.sizeUnitToGrid(unit);

    expect(unit.width).toBe(64);
  });
});

describe('adjacent deployment at small cell sizes', () => {
  /**
   * Reproduces the reported bug directly: two units in neighbouring cells.
   * checkCollision is strict AABB, so units that exactly touch do not collide.
   */
  function placeInCell(engine, cellIndex, cellSize, unitSize) {
    const cellX = cellIndex * cellSize;
    return {
      x: cellX + (cellSize - unitSize) / 2,
      y: 0,
      width: unitSize,
      height: unitSize,
    };
  }

  const engine = { checkCollision: GameEngine.prototype.checkCollision };

  it('64px units in 60px cells DO overlap - this is the bug', () => {
    const a = placeInCell(engine, 0, 60, 64);
    const b = placeInCell(engine, 1, 60, 64);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(true);
  });

  it('cell-sized units in 60px cells do NOT overlap - this is the fix', () => {
    const a = placeInCell(engine, 0, 60, 60);
    const b = placeInCell(engine, 1, 60, 60);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(false);
  });

  it('cell-sized units do not overlap at the minimum cell size either', () => {
    const a = placeInCell(engine, 0, 40, 40);
    const b = placeInCell(engine, 1, 40, 40);

    expect(
      engine.checkCollision(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height),
    ).toBe(false);
  });
});
```

The first test in the second block asserts the *buggy* behaviour deliberately. It documents the mechanism and will keep passing after the fix — it proves the overlap is real, while its sibling proves cell-sizing removes it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.test.js" -t "sizeUnitToGrid"`

Expected: FAIL — `sizeUnitToGrid` is not a function. The `adjacent deployment` block should PASS already, since it only exercises the existing `checkCollision`; its passing confirms the arithmetic in the test itself is sound.

- [ ] **Step 3: Add the method**

In `GameEngine.js`, add this method immediately above `deployDefender`:

```js
  /**
   * Sizes a unit to exactly one grid cell.
   *
   * Sprites declare a fixed 64px while the cell is computed from window size and
   * ranges 40-80. At any cell under 64 a placed unit overhangs its neighbours,
   * and isValidDeploymentPosition then refuses to place anything in an adjacent
   * cell - so on an ordinary laptop window later levels could not be filled.
   */
  sizeUnitToGrid(unit) {
    const cellSize = this.gridManager?.gridSize;
    if (!cellSize) return unit;

    unit.width = cellSize;
    unit.height = cellSize;
    return unit;
  }
```

- [ ] **Step 4: Use it in `deployDefender`**

`deployDefender` currently reads:

```js
    const tempUnit = new UnitClass(0, 0, cardData);
```

Change it to size the probe unit before any geometry is computed from it:

```js
    const tempUnit = this.sizeUnitToGrid(new UnitClass(0, 0, cardData));
```

Then find where the real unit is constructed:

```js
    const newUnit = new UnitClass(deployX, deployY, cardData);
```

and size it the same way:

```js
    const newUnit = this.sizeUnitToGrid(new UnitClass(deployX, deployY, cardData));
```

Leave the `deployX` / `deployY` centring arithmetic exactly as it is. With a cell-sized unit the centring term evaluates to zero, so the unit lands flush in its cell — but the expression stays correct if a unit is ever sized differently.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.test.js"`

Expected: all tests in the file PASS, including the pre-existing ones.

- [ ] **Step 6: Run the full suite**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

Expected: all tests pass. If a pre-existing test asserts a 64px unit dimension, read it before changing anything — that would be a real interaction worth reporting rather than silently updating.

- [ ] **Step 7: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.test.js"
git commit -m "fix: size defenders to the grid cell so they can be placed adjacently

Sprites were a fixed 64px while the cell is computed from window size and can
be as small as 40. Units then overhung their cell and the overlap check refused
any adjacent placement - on an ordinary laptop window, later levels could not
be filled."
```

---

## Task 2: Spawned enemies die audibly

**Files:**
- Modify: `Frontend/src/component/GameLogic (MVC)/GameEngine.js` (three emit sites)
- Test: `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js` (append)

**Interfaces:**
- Consumes: `GameEngine.prototype.emitEnemyDeathFeedback(enemy)` — already exists and is idempotent per enemy via `enemy.deathFeedbackEmitted`
- Produces: nothing

**Background:** `enemy:died` is emitted from three places, and at every one the call sits *inside* the block that awards score:

- `handleEnemyDeath`, inside `if (!enemy.isSpawned && !enemy.shouldExplode)`
- the splash-damage loop in `addDefenderExplosion`, inside `if (!enemy.isSpawned)`
- the projectile direct-hit path, inside `if (!projectile.target.isSpawned)`

Those guards correctly stop players farming score from Splitter minis, Necromancer skeletons and self-destructing bombers. They should not govern sound. The player reported exactly this: spawned enemies die silently.

**Scoring must not change.** Only the feedback call moves.

- [ ] **Step 1: Write the failing test**

Append to `Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js`:

```js
describe('spawned enemies still make a death sound', () => {
  function createEngineStub() {
    return {
      gameOver: false,
      inGameScore: 0,
      enemiesKilled: 0,
      emitFeedback: vi.fn(),
      updateScoreCb: vi.fn(),
      dropManager: { handleEnemyDeath: vi.fn() },
      waveManager: { totalEnemiesKilled: 0 },
      emitEnemyDeathFeedback: GameEngine.prototype.emitEnemyDeathFeedback,
      handleEnemyDeath: GameEngine.prototype.handleEnemyDeath,
      addEnemyExplosion: vi.fn(),
    };
  }

  function makeEnemy(overrides = {}) {
    return {
      constructor: { name: 'MiniEnemy' },
      x: 10, y: 20, width: 30, height: 30,
      bounty: 5, isSpawned: false, shouldExplode: false,
      ...overrides,
    };
  }

  it('emits a death sound for a spawned enemy', () => {
    const engine = createEngineStub();

    engine.handleEnemyDeath(makeEnemy({ isSpawned: true }));

    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:died',
      expect.objectContaining({ unitType: 'MiniEnemy' }),
    );
  });

  it('still awards no score for a spawned enemy', () => {
    const engine = createEngineStub();

    engine.handleEnemyDeath(makeEnemy({ isSpawned: true }));

    expect(engine.inGameScore).toBe(0);
    expect(engine.enemiesKilled).toBe(0);
    expect(engine.updateScoreCb).not.toHaveBeenCalled();
    expect(engine.dropManager.handleEnemyDeath).not.toHaveBeenCalled();
  });

  it('emits a death sound for a self-destructing bomber', () => {
    const engine = createEngineStub();

    engine.handleEnemyDeath(makeEnemy({
      constructor: { name: 'BombEnemy' }, shouldExplode: true,
    }));

    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:died',
      expect.objectContaining({ unitType: 'BombEnemy' }),
    );
  });

  it('still awards no score for a self-destructing bomber', () => {
    const engine = createEngineStub();

    engine.handleEnemyDeath(makeEnemy({
      constructor: { name: 'BombEnemy' }, shouldExplode: true,
    }));

    expect(engine.inGameScore).toBe(0);
  });

  it('an ordinary enemy still both sounds and scores', () => {
    const engine = createEngineStub();

    engine.handleEnemyDeath(makeEnemy({ constructor: { name: 'BasicEnemy' } }));

    expect(engine.emitFeedback).toHaveBeenCalledWith(
      'enemy:died',
      expect.objectContaining({ unitType: 'BasicEnemy' }),
    );
    expect(engine.inGameScore).toBe(5);
    expect(engine.enemiesKilled).toBe(1);
  });

  it('emits nothing once the game is over', () => {
    const engine = createEngineStub();
    engine.gameOver = true;

    engine.handleEnemyDeath(makeEnemy({ isSpawned: true }));

    expect(engine.emitFeedback).not.toHaveBeenCalled();
  });

  it('still emits only once per enemy', () => {
    const engine = createEngineStub();
    const enemy = makeEnemy({ isSpawned: true });

    engine.handleEnemyDeath(enemy);
    engine.handleEnemyDeath(enemy);

    expect(engine.emitFeedback).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js" -t "spawned enemies"`

Expected: the two "emits a death sound" tests FAIL — the emit is currently skipped for spawned and exploding enemies. The scoring tests and the ordinary-enemy test should PASS already, confirming the stub drives the real method correctly.

If the ordinary-enemy test fails at this stage, stop and report — that would mean the stub is not reaching the scoring path and the other assertions would prove nothing.

- [ ] **Step 3: Move the emit out of the scoring guard in `handleEnemyDeath`**

The method currently reads:

```js
  handleEnemyDeath(enemy) {
    if (!this.gameOver) {
      if (!enemy.isSpawned && !enemy.shouldExplode) {
        this.inGameScore += enemy.bounty;
        this.enemiesKilled++;
        this.emitEnemyDeathFeedback(enemy);
        this.updateScoreCb(this.inGameScore);
        this.dropManager.handleEnemyDeath(enemy);
        this.waveManager.totalEnemiesKilled++;
      } else {
```

Move the feedback call above the scoring guard:

```js
  handleEnemyDeath(enemy) {
    if (!this.gameOver) {
      // Feedback is not score: a spawned mini or a self-destructing bomber
      // awards nothing, but it is still a death the player should hear.
      this.emitEnemyDeathFeedback(enemy);

      if (!enemy.isSpawned && !enemy.shouldExplode) {
        this.inGameScore += enemy.bounty;
        this.enemiesKilled++;
        this.updateScoreCb(this.inGameScore);
        this.dropManager.handleEnemyDeath(enemy);
        this.waveManager.totalEnemiesKilled++;
      } else {
```

Leave the `else` branch and everything after the `if (!this.gameOver)` block untouched.

- [ ] **Step 4: Move the emit at the splash-damage site**

In `addDefenderExplosion`, the block currently reads:

```js
        if (died && !this.gameOver) {
          if (!enemy.isSpawned) {
            //only change game score when game still playing
            this.inGameScore += enemy.bounty;
            this.enemiesKilled++;
            this.emitEnemyDeathFeedback(enemy);
            this.updateScoreCb(this.inGameScore);
          }
```

Move the feedback call above the inner guard:

```js
        if (died && !this.gameOver) {
          this.emitEnemyDeathFeedback(enemy);

          if (!enemy.isSpawned) {
            //only change game score when game still playing
            this.inGameScore += enemy.bounty;
            this.enemiesKilled++;
            this.updateScoreCb(this.inGameScore);
          }
```

- [ ] **Step 5: Move the emit at the projectile direct-hit site**

That block currently reads:

```js
          if (died && !this.gameOver) {
            if (!projectile.target.isSpawned) {
              this.inGameScore += projectile.target.bounty;
              this.enemiesKilled++;
              this.emitEnemyDeathFeedback(projectile.target);
              this.updateScoreCb(this.inGameScore);
            }
```

Move the feedback call above the inner guard:

```js
          if (died && !this.gameOver) {
            this.emitEnemyDeathFeedback(projectile.target);

            if (!projectile.target.isSpawned) {
              this.inGameScore += projectile.target.bounty;
              this.enemiesKilled++;
              this.updateScoreCb(this.inGameScore);
            }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd Frontend && npx vitest run "src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js"`

Expected: all tests in the file PASS, including the pre-existing `markDefenderDead` ones.

- [ ] **Step 7: Run the full suite**

Run: `cd Frontend && npm test` then `cd Frontend && npm run lint`

Expected: all tests pass. Pay particular attention to any pre-existing test asserting that a spawned enemy emits nothing — if one exists it was encoding the bug, and it should be updated with a comment explaining that feedback is now decoupled from scoring. Report it explicitly rather than changing it silently.

- [ ] **Step 8: Update the known-issues note**

`docs/superpowers/2026-08-12-known-issues-and-followups.md` entry 12 states that `MiniEnemy` and `BombEnemy` never emit `enemy:died`. That is now fixed. Remove that bullet from entry 12, and remove the corresponding footnotes from `Frontend/src/assets/audio/units/README.md` for `MiniEnemy` and `BombEnemy` so the owner's checklist no longer warns about a limitation that no longer exists.

Leave the `BossEnemy` footnote in both files — that one is still true.

- [ ] **Step 9: Commit**

```bash
git add "Frontend/src/component/GameLogic (MVC)/GameEngine.js" \
        "Frontend/src/component/GameLogic (MVC)/__tests__/GameEngine.casualties.test.js" \
        docs/superpowers/2026-08-12-known-issues-and-followups.md \
        Frontend/src/assets/audio/units/README.md
git commit -m "fix: spawned enemies and bombers now make a death sound

The enemy:died emit sat inside the score-awarding guard at all three sites,
so Splitter minis, Necromancer skeletons and self-destructing bombers died
silently. Feedback is not score - scoring behaviour is unchanged."
```

---

## Final verification

- [ ] **Run the full suite**

Run: `cd Frontend && npm test`

Expected: every test passes. Report the actual output; do not claim success without it.

- [ ] **Run the linter**

Run: `cd Frontend && npm run lint`

- [ ] **Manual check in the running game**

Run: `cd Frontend && npm run dev`

Two things only play can confirm:

1. **Resize the browser window small** — short enough that the board shrinks — then reach a later level and place two defenders in adjacent cells. Before this fix that was impossible; it should now work at any window size. Confirm units still look right at both small and large window sizes, since they now scale with the board.
2. **Kill a Splitter** so it splits into minis, then kill the minis. Each mini death should now make a sound. Do the same with a bomber self-destructing.
