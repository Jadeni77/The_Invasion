# Known Issues and Follow-ups

**Recorded:** 2026-08-13, at the close of the `feature/game-feel-audio` branch.

Everything here was found during that work, reviewed, and **deliberately not fixed** — either
because it predates the branch or because fixing it needed a decision or a spec of its own. None of
it blocks that branch. It is written down so it does not have to be rediscovered.

## Pre-existing bugs (predate the branch)

### 1. Splash kills award double score and double kill-count

`GameEngine.addDefenderExplosion` handles a splash kill — awarding `inGameScore`, incrementing
`enemiesKilled`, and calling `dropManager.handleEnemyDeath` — but it never splices the enemy from
`this.enemies` nor sets `enemy.deathHandled`. Since `updateDefenders()` runs before
`updateEnemies()` in the same frame, `updateEnemies`' death sweep then calls `handleEnemyDeath` on
that same enemy and awards everything a second time.

Effect: every Grenadier/Mortar-style splash kill counts twice. That inflates score, `enemiesKilled`,
and therefore the `totalEnemiesKilled` achievement counter added in `4ee5641`.

Only direct projectile kills are unaffected, because they splice the enemy before `updateEnemies`
runs.

The audio layer added on `feature/game-feel-audio` explicitly does NOT have this bug — `enemy:died`
is deduplicated per enemy via `GameEngine.emitEnemyDeathFeedback`. So the death sound is currently
the honest signal and the score is the inaccurate one. **Settle this before tuning achievement
thresholds**, since existing player data is already inflated.

### 2. CI pins Node 20 with thin margin

`.github/workflows/frontend-tests.yml` and `pr-checks.yml` both set `node-version: '20'`, while
`jsdom@29` declares `engines: ^20.19.0 || ^22.13.0 || >=24.0.0`.

This resolves today — `setup-node` installs the latest 20.x, which is past 20.19 — and there is no
`.npmrc`, so `engine-strict` is off and a mismatch would only warn. Moving both workflows to `'22'`
would remove the risk entirely.

### 3. Minor pre-existing oddities

- A stray `console.trace()` in `GameEngine.resetGame()`.
- A likely double call of `drawUIs.showWaveAnnouncement` inside `GameEngine.showWaveAnnouncement`.
- Two dead fields, written but never read: `DefenderUnits.js` `lastHitTime`, `WaveManager.js`
  `waveStartTime`.
- `WaveManager.getTimeUntilNextWave` does not exist, so `DrawUIs.drawNextWaveTimer` is dead code.

## Deferred from the branch

### 4. `SettingsStore.merge()` returns a shallow copy

Its early-return path is `{ ...DEFAULT_SETTINGS }`, so on a cold start
`getSettings().audio === DEFAULT_SETTINGS.audio`. Not currently exploitable — every writer uses
immutable spreads — but a future in-place mutation would corrupt the fallback for all later merges.

The fix is to deep-copy per category inside `merge()`. Note that `Object.freeze(DEFAULT_SETTINGS)`
would NOT close this, since a shallow freeze leaves the category objects mutable.

### 5. Test coverage gaps

- **No `GameEngine` integration test exists anywhere in the repo.** Consequently, reverting the
  clock-domain fix at `GameEngine.resetGame()` (`lastSpawnTime = this.gameClock.now + 5000`) would
  not be caught by any test, and neither would a regression in auto-collect. Both are currently
  covered only at the unit level or by manual play. Building a minimal engine harness would close
  several gaps at once.
- `canvasState.test.js` guards only the two drop classes. `DrawUIs.drawNormalWaveInfo` and the other
  17 `textAlign` assignment sites have no regression guard, which is narrower than the design spec's
  "after every `draw*`" intent.

### 6. Controls intentionally left disabled

Three settings controls are shown disabled with "(Coming Soon)" rather than wired, because no
behaviour exists behind them:

- **Show Tutorial Hints** — no tutorial system exists.
- **Confirm Deployment** — a two-click confirm flow is real gameplay design and needs its own spec.
- **Auto-deploy Defenders** — was already disabled before this work.

Their keys remain in `DEFAULT_SETTINGS`, so any of them can be wired later without a storage
migration.

### 7. Audio and effects gaps

- **Enemy attacks are silent.** `enemyProjectiles.push` and `spellProjectiles.push` emit nothing;
  the design spec's event catalog has no enemy-attack sound. Adding one would improve game feel.
- **`MusicPlayer` is never stopped.** It starts on the first user gesture and keeps playing through
  logout back to the login page. It also will not restart if the browser suspends the audio context,
  because its `pointerdown` listener has already been removed.

### 8. Minor CSS coupling

The shared numeric-readout rule in `GameBoard.css` uses an unscoped `.score-value` selector, which
also matches an unrelated span on the post-game results screen. Inert today, because that span is
`display: inline` and therefore ignores `width`, `text-align`, and `flex`.

Scoping it to `.game-top-bar .score-value` is the obvious fix, but note that a later rule
(`.score-value, .gold-value`) already overrides font-size and colour — so naive scoping would change
how the top bar looks. Wants a design eye rather than a mechanical edit.

### 9. Spells are modelled as defenders

`FireBlast` and `IceBomb` are `DefenderUnit` subclasses distinguished only by an `isSpell` flag, so
every rule written for defenders applies to them unless individually guarded. Four such guards exist
today, all consulting `isConsumableSpell(unit)`: the base `takeDamage`, the Healer's resurrection
filter, `CombatManager.findTargetForEnemy`, and `GameEngine.markDefenderDead`.

Three bugs came from this before the guards were added — a resurrection exploit, destructible spells,
and casts counting as casualties. If a third spell type is ever added, move spells into their own
entity collection instead of adding a fifth guard.

## Not a defect: known verification limits

- **jsdom has no layout engine** (`offsetWidth` is always `0`), so no automated test can prove the
  top-bar text-shift fix works. It is verified by CSS assertion plus manual visual confirmation, by
  deliberate decision recorded in the design spec.
- The music is deliberately simple synthesized ambience so the Music Volume slider controls something
  real. It is not a composed soundtrack.
