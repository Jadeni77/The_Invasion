/**
 * What can and cannot be clicked on the lobby map.
 *
 * These are source-level guards on purpose. jsdom has no layout engine and
 * **ignores `pointer-events` for synthetic clicks**, so a rendering test cannot
 * tell an element that swallows a click from one that does not - every bug below
 * was live while the whole suite was green, and each was found by driving a real
 * browser instead (see the CDP checks in the branch notes).
 *
 * Three separate things made the map unclickable:
 *
 * 1. `onMapPointerDown` called `setPointerCapture` immediately. Pointer capture
 *    retargets later pointer events to the capturing element, and the browser
 *    then dispatches `click` against the capture target instead of the element
 *    under the cursor - so no level node and no chest could ever be clicked.
 *    Verified: with capture restored on pointerdown, a real click on the
 *    available node opened nothing.
 *
 * 2. `.chest-glow` was declared twice, the two rules disagreed about how it was
 *    positioned, and neither took it out of hit-testing. The winning rule inset
 *    it -10px around a 40px chest, so `elementFromPoint` at a chest's centre
 *    returned `chest-glow` and collection was impossible.
 *
 * 3. `.level-name` and `.stars` are children of `.level-node` that hang outside
 *    the circle on negative offsets, so they were part of the node's hover area
 *    while `:hover` scales the node - which moves them away from the cursor
 *    hovering them. The node oscillated between 62px and 68.2px for as long as
 *    the pointer rested between the circle and its name.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../test/sourceFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(join(HERE, '..', 'Lobby.jsx'), 'utf8');
const css = stripComments(readFileSync(join(HERE, '..', '..', '..', 'style', 'Lobby.css'), 'utf8'));

/** The body of a handler, from its arrow head to the closing `};`. */
function handlerBody(name) {
  const start = jsx.indexOf(`const ${name} = (`);
  if (start === -1) return '';
  const end = jsx.indexOf('\n  };', start);
  return end === -1 ? '' : jsx.slice(start, end);
}

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

function declarationsOf(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (css.match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{`, 'g')) || []).length;
}

describe('a click on the map reaches what was clicked', () => {
  it('does not capture the pointer on pointerdown', () => {
    const body = handlerBody('onMapPointerDown');
    expect(body, 'onMapPointerDown not found').not.toBe('');
    expect(body).not.toMatch(/setPointerCapture/);
  });

  it('captures the pointer only once the gesture passes the drag threshold', () => {
    const body = handlerBody('onMapPointerMove');
    expect(body, 'onMapPointerMove not found').not.toBe('');
    expect(body).toMatch(/setPointerCapture/);
    // The capture must sit behind the threshold test, not beside it: capturing
    // on every move is capturing on the first move, which is a click again.
    const threshold = body.indexOf('DRAG_THRESHOLD_PX');
    const capture = body.indexOf('setPointerCapture');
    expect(threshold).toBeGreaterThan(-1);
    expect(capture).toBeGreaterThan(threshold);
  });

  it('still blocks the click that ends a drag', () => {
    // The fix must not have traded one bug for the other: a pan that releases
    // over a node must still not launch it.
    expect(jsx).toMatch(/const guardClick\s*=/);
    expect(jsx).toMatch(/if \(drag\.current\.moved\) return;/);
  });
});

describe('decoration does not swallow clicks', () => {
  it('declares .chest-glow exactly once', () => {
    // Two rules that disagreed about positioning, neither of them inert.
    expect(declarationsOf('.chest-glow')).toBe(1);
  });

  it.each([
    ['.chest-glow', 'covers the chest it decorates'],
    ['.level-name', 'hangs below the node on a negative offset'],
    ['.stars', 'hangs below the node on a negative offset'],
  ])('takes %s out of hit-testing (%s)', (selector) => {
    const body = ruleBody(selector);
    expect(body, `${selector} rule not found`).not.toBe('');
    expect(body).toMatch(/pointer-events\s*:\s*none/);
  });

  it('keeps the node itself clickable', () => {
    // The circle is the target. If this ever gains `pointer-events: none` the
    // three rules above stop being a fix and become the bug.
    expect(ruleBody('.level-node')).not.toMatch(/pointer-events\s*:\s*none/);
    expect(ruleBody('.level-node')).toMatch(/cursor\s*:\s*pointer/);
  });
});
