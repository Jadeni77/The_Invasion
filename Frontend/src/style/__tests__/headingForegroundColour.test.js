import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { sourceFiles, relativeToSrc, read } from '../../test/sourceFiles.js';

/*
 * Closes a specific gap in contrastRatio.test.js: that guard only measures a
 * rule that declares *both* `color` and `background`, so an element with no
 * colour rule at all - not a bad pair, no pair - is invisible to it.
 */

const JSX_FILES = sourceFiles({ extensions: ['.jsx'] });

/*
 * From `start` (the `<` of an opening tag), returns the index just past the
 * tag's own closing `>` - skipping over `{...}` JS expressions and quoted
 * strings inside attributes, so a `>` used inside e.g.
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

/*
 * Pre-existing headings this branch's scan finds uncovered but does not fix -
 * pinned by name so a *new* uncovered heading fails the suite instead of
 * silently joining an ever-growing exemption list, the same discipline
 * contrastRatio.test.js's EXPECTED_OPT_OUTS applies to contrast opt-outs.
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
