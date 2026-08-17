# Card Upgrades modal display fixes

Branch: `fix/upgrade-modal-display`, based on `develop` at `665d368`.

## Summary

Three defects reported against the Card Upgrades modal ("seems like a
separate thing from everything, and there seem to be display bug"):

1. A stray `)` rendered as visible text at the bottom of every card panel.
2. The modal layer (five stylesheets) never received the visual-direction
   pass - unstyled headings and browser-default body text.
3. The WCAG contrast guard cannot detect an element with *no* colour rule at
   all, which is exactly how the unstyled heading shipped.

All three are fixed. A new guard closes the gap described in (3). The full
suite is green with the pre-existing playtest edit to `GameLevelConfigs.js`
left untouched and uncommitted, as instructed.

**jsdom has no layout engine.** Nothing in this report claims to have
verified appearance (pixel position, actual rendered contrast, font
rendering) - only markup content (defect 1) and declared CSS text (defects 2
and 3) were checked. A human should still eyeball the modal in a browser.

## Defect 1 - the stray `)`

`UpgradeModal.jsx:143` was a bare `)` between two `</div>` closing tags,
which JSX renders as a literal text node.

**What it structurally was:** history (commit `4d76ff4`, "remove the worker
system and the time system for upgrading") shows this was the tail end of a
ternary: `{isUpgrading ? (<div className="upgrade-in-progress">...</div>) :
(<div className="upgrade-info">...</div>)}`. That commit deleted the
`isUpgrading` state, the `isUpgrading ? (...) : (` branch, and the ternary's
opening paren and wrapping `{`, but left the closing `)` of the false branch
behind - the `)}` became `)` instead of being deleted entirely. The correct
structure is simply an unconditional `<div className="upgrade-info">` as a
direct child of the card wrapper, with no ternary and no leftover paren -
which is what removing the single stray line produces. No other structural
repair was needed; the surrounding JSX was already balanced once the one
character was gone.

**Test:** `UpgradeModal.test.jsx` renders the modal (with `useGame` and
`getUpgradePreview` mocked so the test is about markup, not defender
balance) and asserts `container.textContent` contains no `)` anywhere.
Rejects: a JSX tree that still carries the leftover `)` text node.

## Defect 2 - the modal layer's missing visual identity

Investigated all five stylesheets named in the report
(`UpgradeModal.css`, `CollectionPage.css`, `AchievementPage.css`,
`SettingModal.css`, `CardSelectionModal.css`) against their JSX and found the
gap was narrower than "no heading rule anywhere" - most `h1`/`h2` "modal
title" headers already had a rule with both `font-family` and `color`. The
real gaps were:

- `UpgradeModal.jsx`'s bare `<h2>Card Upgrades</h2>` - literally zero CSS,
  the reported bug.
- Four sub-heading classes with a `color` already set but no
  `font-family` (`.section-title`, `.collection-unit-name` in
  CollectionPage; `.category-title`, `.achievement-title` in
  AchievementPage; `.section-header` in SettingModal) - these render, and
  contrast, fine, but in the browser-default serif rather than
  `--type-display`.
- Body text in all five modals - none of the five root/overlay containers
  declared `font-family: var(--type-body)`, and (checked in `App.jsx`/
  `Lobby.jsx`) none of these five components is a DOM descendant of
  `.game-board-container` (the one place `--type-body` is already set) - they
  are rendered as full replacements, not nested inside it. So every plain
  `<p>`/`<span>`/label in these modals was, in fact, browser-default serif.

**Fixes applied** (colour/type only, no layout properties touched):

| File | Change |
|---|---|
| `UpgradeModal.css` | new `.modal-content h2 { font-family: var(--type-display); color: var(--colors-text-primary); }` (8.45:1 against the panel's `--colors-surface-panel`, computed and confirmed by the existing WCAG guard - see below); `font-family: var(--type-body)` added to `.upgrade-modal` |
| `CollectionPage.css` | `font-family: var(--type-body)` added to `.collection-page`; `font-family: var(--type-display)` added to `.section-title` and `.collection-unit-name` (colour untouched, already passing) |
| `AchievementPage.css` | `font-family: var(--type-body)` added to `.achievement-page`; `font-family: var(--type-display)` added to `.category-title` and `.achievement-title` |
| `SettingModal.css` | `font-family: var(--type-body)` added to `.settings-modal-overlay`; `font-family: var(--type-display)` added to `.section-header` |
| `CardSelectionModal.css` | `font-family: var(--type-body)` added to `.card-selection-overlay` (its own `h2`/body text already had both font and colour) |

**Total across the five stylesheets: 1 new heading colour+font rule
(UpgradeModal's `h2`), 5 font-family-only additions to existing headings
that already had colour, and 5 `font-family: var(--type-body)` additions to
the five modal root containers.**

No new design tokens were needed - `--type-display`, `--type-body` and
`--colors-text-primary` already exist in `tokens.js`/`tokens.generated.css`;
`npm run tokens` was not run because nothing in `tokens.js` changed.

**Contrast verified, not assumed:** ran the numbers through the same
formula `contrastRatio.test.js` uses before writing the fix
(`--colors-surface-panel` `#4a4231` vs `--colors-text-primary` `#f5ecd8` =
8.45:1). After the fix, the existing WCAG guard's own descendant-combinator
matching *automatically* picked up the new `.modal-content h2` rule (it
paired it with `.modal-content`'s background) and added one new passing
case: `UpgradeModal.css .modal-content h2 (bg from .modal-content) meets its
WCAG threshold`. Nothing was hand-waved past that guard.

## Defect 3 - the new guard

`Frontend/src/style/__tests__/headingForegroundColour.test.js`.

**Why contrastRatio.test.js could not have caught this:** it only measures a
rule that declares *both* `color` and `background` on (effectively) the same
selector. An element with *no* colour rule produces no pair, so there is
nothing for that guard to reject - and a pure CSS-only scan can never notice
"this element has zero rules," since there's no rule to inspect. Catching an
absence requires knowing the element exists, which means reading the JSX.

**Scope**, derived the way `sourceFiles.js` already derives file scope (by
what a thing *is*, not a hand-picked list):

- every `.jsx` file under `src/`, via the existing `sourceFiles()` helper;
- excluding a component that imports **zero** stylesheets of its own
  (`LoginPage.jsx` - styled entirely via inline `style={}` objects, a
  different mechanism this CSS-rule guard has no business judging);
- every `<h1>`-`<h6>` found in each remaining file's own JSX text.

For each heading: if it has a static `className`, that class's rule must
declare `color` somewhere in the file's imported stylesheets. If it has no
class, the guard walks the stack of enclosing `<div className="...">`
ancestors (nearest first) and accepts `color` declared on either the
ancestor's own selector or `.ancestor TAG` - i.e. it correctly recognises
inherited colour (e.g. `.notification-content h3` in Lobby.css has no colour
of its own; it inherits from `.notification-content`, which does - the guard
passes this, correctly, rather than false-flagging every heading that relies
on ordinary CSS inheritance).

**What it does not cover, stated plainly:**
- Only headings - not paragraphs, spans, buttons, labels, list items. A
  "every text-bearing tag" version was tried mentally and rejected: most
  such tags legitimately inherit colour from ancestors this scan can't see,
  and would have produced false-positive noise rather than a real guard.
- Only a `<div>` ancestor chain with a literal, static `className="..."`. A
  non-div wrapper, a templated/conditional class, or `>`/multi-class
  selectors are invisible to it.
- "Imports zero stylesheets" is judged from the JSX file's own `import`
  lines, not Vite's bundled dependency graph. `GameBoard.jsx` never imports
  its own `GameBoard.css` (a sibling, `Card.jsx`, does, and Vite loads it
  globally regardless) - so this guard silently skips GameBoard.jsx's four
  headings entirely. I checked all four by hand: all already declare a
  colour, so nothing is hidden by this, but the guard's coverage is real
  narrower than "every heading in the app" as a result. A correct fix needs
  a module import graph, not a single file's text.
- Checks that a colour is *declared*, not that it *contrasts*. A declared
  colour that still fails WCAG is `contrastRatio.test.js`'s job; the two
  guards are deliberately non-overlapping.

**One pre-existing gap found, pinned rather than fixed:** the scan (run
across the whole app, not just the five named stylesheets) also flagged
`Lobby.jsx:304 <h2>` ("Loading Game Data...", shown only before `playerData`
first arrives) - `.loading-screen` has no stylesheet rule at all, the same
bug, just outside this PR's five files. Pinned in `KNOWN_GAPS` (mirroring
`contrastRatio.test.js`'s own `EXPECTED_OPT_OUTS` pattern) with a comment
explaining it is a real, un-fixed, out-of-scope finding for a follow-up - not
silently absorbed into a growing exemption list. A new uncovered heading
anywhere else fails the suite.

## Mutation testing (both restored afterward)

1. **Reintroduced the stray `)`** in `UpgradeModal.jsx`. `UpgradeModal.test.jsx`
   failed exactly as expected: `expected '...Card Pieces: 2 / 5)' not to
   match /\)/`. Restored; test passes again.
2. **Deleted the new `.modal-content h2` rule** from `UpgradeModal.css`
   (reproducing the original bug exactly). `headingForegroundColour.test.js`
   failed on both `UpgradeModal.jsx:42 <h2> has a declared foreground
   colour` and the `KNOWN_GAPS` drift check, with the same message a real
   regression would produce. Restored; both tests pass again. This is the
   guard proving it would have caught the original bug, observed directly
   rather than asserted.

## Test results

- Baseline at `665d368`: 1228 passing (confirmed by running the suite before
  any change).
- Final: **43 test files, 1248 tests, all passing.** The +20 breaks down as:
  1 new `UpgradeModal.test.jsx` test, 18 new
  `headingForegroundColour.test.js` tests, and 1 new case
  `contrastRatio.test.js` picked up automatically (the new `.modal-content
  h2` rule).
- `npm run lint` - clean.
- Working tree after commit: only the intentional files touched; the
  pre-existing uncommitted edit to `GameLevelConfigs.js` was never staged,
  touched, or reverted.

## Concerns

- The heading guard's "zero CSS imports = out of scope" and
  "own-JSX-imports-only, not bundle graph" limits are real and documented
  above, not hidden. `GameBoard.jsx` in particular is invisible to it for a
  structural reason (transitive CSS import), not because its headings are
  fine (they happen to be fine, verified by hand, but the guard doesn't know
  that).
- `Lobby.jsx:304`'s unstyled loading-screen heading is a genuine, real bug
  of the exact same class, left un-fixed and pinned for a follow-up per the
  five-file scope of this task.
- Appearance (actual rendered contrast, font substitution, layout) was not
  and cannot be verified in this environment - jsdom has no layout engine.
