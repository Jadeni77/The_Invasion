import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { sourceFiles, relativeToSrc, read } from '../../test/sourceFiles.js';

/**
 * Closes a specific gap in contrastRatio.test.js: that guard only measures a
 * rule that declares *both* `color` and `background`, so an element with no
 * colour rule at all - not a bad pair, no pair - is invisible to it. That is
 * exactly how `<h2>Card Upgrades</h2>` (UpgradeModal.jsx) shipped with no
 * colour anywhere, rendering in the browser's UA-default near-black on a
 * dark panel: there was no pair for the contrast guard to reject, because
 * there was no rule.
 *
 * This module cannot just widen contrastRatio.test.js's own scan, because
 * the bug is an *absence* - a stylesheet scan alone can never notice a
 * heading that has zero rules written for it, since there is no rule to
 * find. Detecting "nothing was written for this element" requires knowing
 * the element exists at all, which means reading the JSX, not just the CSS.
 *
 * Scope, derived the way sourceFiles.js derives it - by what a file *is*,
 * not by a hand-picked list:
 *  - every `.jsx` file under `src/` (via `sourceFiles`), except a component
 *    that imports zero stylesheets. That is not scope narrowed by directory;
 *    it is a component that has opted out of the CSS layer entirely (inline
 *    `style={}`, as LoginPage.jsx does) and so has nothing for a *CSS*-rule
 *    guard to check - a different, real gap this module does not cover.
 *  - every heading tag (`h1`-`h6`) in each such file, found by scanning the
 *    JSX text itself, not by a list of known modal components.
 *
 * What "has a declared foreground colour" means here, and what it does not:
 *  - if the heading carries its own static `className`, that class's rule
 *    (anywhere in the file's imported stylesheets) must declare `color`.
 *  - otherwise, this walks the stack of `<div className="...">` ancestors
 *    enclosing the heading (nearest first) and accepts either `.ancestor` or
 *    `.ancestor TAG` declaring `color` - i.e. the heading's own rule, or
 *    inheriting from a container the way `.notification-content h3` (Lobby.css)
 *    actually does (colour lives on `.notification-content`, not on the `h3`
 *    rule, which only sets font metrics).
 *
 * What this does NOT cover, plainly:
 *  - only headings - not paragraphs, spans, buttons, labels or list items,
 *    all of which can go unstyled the same way. A broad "every text tag"
 *    version was rejected: most such tags legitimately rely on inheritance
 *    from an ancestor this module cannot see (fragments, non-div wrappers,
 *    multi-class attributes), and a naive per-tag check would have been
 *    false-positive noise, not a guard.
 *  - only a `<div className="literal">` ancestor chain. A non-div wrapper,
 *    a dynamic/templated className, or a selector combinator other than a
 *    single-space descendant (`>` , multiple classes) is invisible to the
 *    ancestor walk, the same documented limit contrastRatio.test.js's own
 *    descendant-pair matching carries.
 *  - "imports zero stylesheets" is judged from the JSX file's *own* import
 *    statements, not from Vite's bundled CSS graph. GameBoard.jsx never
 *    writes `import ".../GameBoard.css"` itself - a sibling it renders
 *    (Card.jsx) does, and Vite's bundler makes that stylesheet apply
 *    globally regardless of which module imported it - so this scan treats
 *    GameBoard.jsx as having no CSS layer and silently skips its four
 *    headings (verified by hand while building this: all four already
 *    declare a colour). A real fix needs a module import graph, not a
 *    single file's text; noted here rather than papered over.
 *  - no colour *value* is checked - only that one is declared. A declared
 *    colour that fails contrast is contrastRatio.test.js's job, not this
 *    one's; the two guards are deliberately non-overlapping.
 */

const JSX_FILES = sourceFiles({ extensions: ['.jsx'] });

/**
 * From `start` (the `<` of an opening tag), returns the index just past the
 * tag's own closing `>` - skipping over `{...}` JS expressions and quoted
 * strings inside attributes, so a `>` used inside e.g.
 * `className={cond ? "a" : "b"}` cannot end the tag early. There is no
 * comparison operator in this codebase's attribute expressions that pairs
 * with an unmatched `{`, so unmatched-brace corruption is not a risk this
 * scan needs to guard against beyond what it already does.
 */
function endOfOpeningTag(text, start) {
  let j = start;
  let braceDepth = 0;
  let quote = null;
  while (j < text.length) {
    const c = text[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '{') {
      braceDepth++;
    } else if (c === '}') {
      braceDepth--;
    } else if (c === '>' && braceDepth === 0) {
      return j + 1;
    }
    j++;
  }
  return j;
}

/** The first class in a static `className="a b"` attribute, or null. */
function staticClassOf(tagText) {
  const m = tagText.match(/className\s*=\s*"([^"]+)"/);
  return m ? m[1].trim().split(/\s+/)[0] : null;
}

/**
 * The stack of enclosing `<div>` ancestors' static classNames (nearest
 * last), as of `position` in `jsxText`. Only `<div>` is tracked - see the
 * module doc for why that is a named, deliberate limit rather than a gap.
 */
function divAncestorStack(jsxText, position) {
  const stack = [];
  const re = /<(\/?)div\b/g;
  let m;
  while ((m = re.exec(jsxText))) {
    if (m.index >= position) break;
    if (m[1] === '/') {
      const gt = jsxText.indexOf('>', m.index);
      stack.pop();
      re.lastIndex = gt + 1;
    } else {
      const end = endOfOpeningTag(jsxText, m.index);
      const tagText = jsxText.slice(m.index, end);
      if (!/\/\s*>$/.test(tagText)) stack.push(staticClassOf(tagText));
      re.lastIndex = end;
    }
  }
  return stack;
}

/** Every `<h1>`-`<h6>` in `jsxText`, with its own static class (if any). */
function headingsIn(jsxText) {
  const out = [];
  const re = /<h([1-6])\b/g;
  let m;
  while ((m = re.exec(jsxText))) {
    const end = endOfOpeningTag(jsxText, m.index);
    out.push({
      tag: `h${m[1]}`,
      pos: m.index,
      line: jsxText.slice(0, m.index).split('\n').length,
      ownClass: staticClassOf(jsxText.slice(m.index, end)),
    });
    re.lastIndex = end;
  }
  return out;
}

/** Absolute paths of every `.css` file this JSX file imports. */
function cssImportsOf(jsxFile, jsxText) {
  return [...jsxText.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((m) =>
    resolve(dirname(jsxFile), m[1]),
  );
}

function rulesOf(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

function selectorNames(selector) {
  return selector.split(',').map((s) => s.trim());
}

/** Last declared `color` for an exact selector text, cascade order (last rule wins). */
function declaredColourFor(rules, selectorText) {
  let winner = null;
  for (const rule of rules) {
    if (!selectorNames(rule.selector).includes(selectorText)) continue;
    const m = rule.body.match(/(?:^|[;{\s])color:\s*([^;]+);/);
    if (m) winner = m[1].trim();
  }
  return winner;
}

function isCovered(rules, heading, ancestorStack) {
  if (heading.ownClass) {
    if (declaredColourFor(rules, `.${heading.ownClass}`) !== null) return true;
  }
  for (let i = ancestorStack.length - 1; i >= 0; i--) {
    const cls = ancestorStack[i];
    if (!cls) continue;
    if (declaredColourFor(rules, `.${cls} ${heading.tag}`) !== null) return true;
    if (declaredColourFor(rules, `.${cls}`) !== null) return true;
  }
  return false;
}

/**
 * Pre-existing headings this branch's scan finds uncovered but does not fix
 * - pinned by name so a *new* uncovered heading fails the suite instead of
 * silently joining an ever-growing exemption list, the same discipline
 * contrastRatio.test.js's EXPECTED_OPT_OUTS applies to contrast opt-outs.
 *
 * Was: ['component/GameRendering/Lobby.jsx:304 <h2>'] - `.loading-screen`
 * (Lobby.jsx's "Loading Game Data..." state) still has no stylesheet rule of
 * its own, but this module's own rule parser (`rulesOf` above) does not strip
 * comments first, and its selector group `[^{}]+` happily swallows whatever
 * comment text precedes a rule along with the real selector. Two of
 * Lobby.css's three `.lobby-container` blocks were immediately preceded by a
 * comment (`/* Lobby Container *\/`, `/* Lobby.css - Enhanced... *\/`), so
 * their captured "selector" was the comment plus `.lobby-container` glued
 * together - a string that never equals `.lobby-container` - and only the
 * file's first block (the one with no preceding comment, and no `color`)
 * was ever found. (Not `@keyframes`, despite what an earlier version of this
 * comment claimed: stripping only comments from the pre-collapse file, with
 * every `@keyframes` block left untouched, was enough to make the parser
 * find all three blocks - verified directly against the pre-collapse
 * source, not inferred.) Collapsing those three into the one required by
 * lobbyCascade.test.js (task 1 of the lobby-campaign-map plan) removed the
 * other two, so the sole remaining `.lobby-container` - which does declare
 * `color: var(--colors-text-primary)` - is now the one this parser finds,
 * and the `<h2>` inherits from it via the ancestor walk. Confirmed by hand:
 * still true after the collapse, not a parser fluke.
 */
const KNOWN_GAPS = [];

function labelFor(relPath, heading) {
  const cls = heading.ownClass ? `.${heading.ownClass}` : '';
  return `${relPath}:${heading.line} <${heading.tag}>${cls}`;
}

const cases = [];
for (const jsxFile of JSX_FILES) {
  const jsxText = read(jsxFile);
  const cssFiles = cssImportsOf(jsxFile, jsxText);
  if (cssFiles.length === 0) continue; // no CSS layer - different styling mechanism, out of scope
  const rules = cssFiles.flatMap((f) => rulesOf(read(f)));
  const relPath = relativeToSrc(jsxFile);
  for (const heading of headingsIn(jsxText)) {
    cases.push({
      label: labelFor(relPath, heading),
      covered: isCovered(rules, heading, divAncestorStack(jsxText, heading.pos)),
    });
  }
}

describe('heading elements resolve to a declared foreground colour, not the browser default', () => {
  it('finds JSX files to check', () => {
    expect(JSX_FILES.length).toBeGreaterThan(5);
  });

  it('checked at least one heading (guards against a vacuous run)', () => {
    expect(cases.length).toBeGreaterThan(5);
  });

  it('finds exactly the known, pre-existing uncovered headings', () => {
    const uncovered = cases.filter((c) => !c.covered).map((c) => c.label).sort();
    const expected = [...KNOWN_GAPS].sort();
    expect(
      uncovered,
      `Uncovered headings drifted from KNOWN_GAPS.\n` +
        `  new (fix it, or pin it deliberately with a reason): ${uncovered.filter((l) => !expected.includes(l)).join(', ') || 'none'}\n` +
        `  gone (good news - delete from KNOWN_GAPS): ${expected.filter((l) => !uncovered.includes(l)).join(', ') || 'none'}`,
    ).toEqual(expected);
  });

  it.each(cases.filter((c) => !KNOWN_GAPS.includes(c.label)).map((c) => [c.label, c]))(
    '%s has a declared foreground colour',
    (_label, c) => {
      expect(
        c.covered,
        `${c.label}: no rule in its imported stylesheet(s) declares a colour for it, ` +
          `itself or an ancestor container - it will render in the browser's default text colour.`,
      ).toBe(true);
    },
  );
});
