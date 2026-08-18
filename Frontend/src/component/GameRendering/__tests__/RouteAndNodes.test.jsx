import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelsMapData } from '../MapLayout.jsx';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');

function ruleBody(selector) {
  const m = css.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

describe('node states', () => {
  it.each(['.level-node.completed', '.level-node.available', '.level-node.locked'])(
    '%s has its own declared appearance',
    (selector) => {
      expect(ruleBody(selector).trim().length, `${selector} has no rule`).toBeGreaterThan(0);
    },
  );

  it('makes the three states visually distinct, not three shades of one', () => {
    const bodies = ['.level-node.completed', '.level-node.available', '.level-node.locked']
      .map((s) => ruleBody(s).replace(/\s+/g, ''));
    expect(new Set(bodies).size).toBe(3);
  });

  it('draws the available node with the energy accent so it reads as next', () => {
    expect(ruleBody('.level-node.available')).toMatch(/--colors-accent-energy/);
  });

  it('gives node numbers the display font', () => {
    expect(ruleBody('.level-node')).toMatch(/--type-display/);
  });

  it('makes a boss node read as fortified, not just red', () => {
    const boss = ruleBody('.level-node.boss');
    expect(boss.trim().length, 'no .level-node.boss rule').toBeGreaterThan(0);
    // Shape and weight, not only hue - a red circle is still a circle.
    expect(boss).toMatch(/border-radius|border-width|--borders-heavy/);
  });

  it('draws chests as landmarks with their own rule', () => {
    expect(ruleBody('.map-chest').trim().length, 'no .map-chest rule').toBeGreaterThan(0);
  });
});

describe('interactive elements keep their hit target', () => {
  /*
   * jsdom has no rendering/layout engine and does not honour `pointer-events`
   * for synthetic events - `fireEvent.click(chestEl)` fires the React handler
   * whether or not `pointer-events: none` is present on the element, so a
   * render-level "can I click the chest" test would pass either way and
   * cannot catch this class of bug. A draft of `.map-chest` set
   * `pointer-events: none` on the same element that carries the chest's
   * onClick (a real collectTreasure() call), which silently disables
   * collection in a real browser while every jsdom test kept passing. Only a
   * CSS-level assertion can catch it - do not "upgrade" this to a
   * click/fireEvent test, it would look more thorough while testing nothing.
   */
  it.each([
    '.map-chest',
    '.level-node',
    '.level-node.completed',
    '.level-node.available',
    '.level-node.locked',
    '.level-node.boss',
  ])('%s does not disable pointer events on a real click target', (selector) => {
    expect(ruleBody(selector)).not.toMatch(/pointer-events:\s*none/);
  });
});

describe('the route uses the full height', () => {
  const ys = levelsMapData.map((l) => l.y);

  it('spans most of the map height rather than a narrow band', () => {
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(spread).toBeGreaterThan(200);
  });

  it('alternates rather than drifting one way', () => {
    let reversals = 0;
    for (let i = 2; i < ys.length; i++) {
      const prev = Math.sign(ys[i - 1] - ys[i - 2]);
      const next = Math.sign(ys[i] - ys[i - 1]);
      if (prev !== 0 && next !== 0 && prev !== next) reversals++;
    }
    expect(reversals).toBeGreaterThan(4);
  });
});
