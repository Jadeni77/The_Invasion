import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(join(here, '..', 'Lobby.jsx'), 'utf8');
const css = readFileSync(join(here, '..', '..', '..', 'style', 'Lobby.css'), 'utf8');
const energyCss = readFileSync(join(here, '..', '..', '..', 'style', 'EnergyBar.css'), 'utf8');

function bodyIn(sheet, selector) {
  const m = sheet.match(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 's'));
  return m ? m[1] : '';
}

function ruleBody(selector) {
  return bodyIn(css, selector);
}

describe('top chrome is one band', () => {
  // Source-text checks, not render checks: jsdom has no layout engine, so
  // nothing here proves the band actually appears on screen as one row - see
  // the two tests below for exactly what each does and does not verify.
  it('Lobby.jsx source references the lobby-topband class', () => {
    expect(jsx).toContain('lobby-topband');
  });

  it('Lobby.css declares .lobby-topband as flex, not flex-direction: column', () => {
    const body = ruleBody('.lobby-topband');
    expect(body).toMatch(/display\s*:\s*flex/);
    expect(body).not.toMatch(/flex-direction\s*:\s*column/);
  });

  it('does not let the band grow at the map\'s expense', () => {
    expect(ruleBody('.lobby-topband')).toMatch(/flex\s*:\s*0 0 auto/);
  });

  /*
   * The band wrapped into three stacked rows at the owner's window width,
   * which undid the compaction it exists for: it became the three stacked
   * blocks it replaced, with an extra border around them.
   *
   * jsdom has no layout engine, so nothing here can measure whether the band
   * fits one line at any particular width - that is the owner's to confirm.
   * What is checkable is the two declarations that decide it: the band must
   * not be allowed to wrap, and each block must be allowed to shrink. A block
   * that cannot shrink is what forces a wrap, so `nowrap` alone would just
   * move the failure to overflow.
   */
  it('does not allow the band to wrap onto a second row', () => {
    expect(ruleBody('.lobby-topband')).toMatch(/flex-wrap\s*:\s*nowrap/);
    expect(ruleBody('.lobby-topband')).not.toMatch(/flex-wrap\s*:\s*wrap/);
  });

  it.each([
    ['.top-menu-bar', css],
    ['.resource-bar', css],
    ['.energy-bar', energyCss],
  ])('lets %s shrink rather than force a wrap', (selector, sheet) => {
    const body = bodyIn(sheet, selector);
    expect(body.trim().length, `${selector} has no rule`).toBeGreaterThan(0);
    expect(body, `${selector} cannot shrink below its content`).toMatch(/min-width\s*:\s*0/);
  });
});

/**
 * Each block kept its own panel chrome inside the band's chrome - borders,
 * gradients and shadows nested in borders, gradients and shadows. Three boxes
 * in a box, which is what the band read as.
 *
 * The band keeps its surface; the blocks give up theirs. Asserted on the
 * blocks' own rules, since that is where the nested panels were declared.
 */
describe('the band is one surface, not three boxes in a box', () => {
  it('still gives the band itself a surface to be', () => {
    // Vacuity guard: the checks below would also pass if the band had lost its
    // panel too, leaving no surface at all.
    const band = ruleBody('.lobby-topband');
    expect(band).toMatch(/background\s*:/);
    expect(band).toMatch(/border\s*:/);
    expect(band).toMatch(/box-shadow\s*:/);
  });

  it.each([
    ['.top-menu-bar', css],
    ['.resource-bar', css],
    ['.energy-bar', energyCss],
  ])('%s draws no panel of its own inside the band', (selector, sheet) => {
    const body = bodyIn(sheet, selector);
    expect(body.trim().length, `${selector} has no rule`).toBeGreaterThan(0);
    expect(body, `${selector} still paints its own background`).not.toMatch(/background\s*:/);
    expect(body, `${selector} still draws its own border`).not.toMatch(/border(?:-\w+)?\s*:/);
    expect(body, `${selector} still casts its own shadow`).not.toMatch(/box-shadow\s*:/);
  });

  it('leaves the controls inside the blocks looking like controls', () => {
    // The blocks give up their panels; the buttons and resource pills keep
    // theirs. A button that does not look pressable is a different bug, and
    // "strip every background in the band" would be that bug.
    expect(ruleBody('.menu-button')).toMatch(/background\s*:/);
    expect(ruleBody('.resource-icon')).toMatch(/background\s*:/);
  });
});

/**
 * `.upgrade-button` was `position: absolute; bottom: 20px; right: 20px`, so it
 * floated over the bottom-right of the map. Pre-existing rather than from the
 * map branch, but it looks like a bug and it covers terrain.
 *
 * It also leaked: UpgradeModal.jsx puts this same class on its per-card "Start
 * Upgrade" button and UpgradeModal.css declares no base rule for it, so those
 * buttons inherited the absolute positioning and were pinned to a corner
 * instead of sitting in their card.
 */
describe('the upgrade button sits in the page, not over the map', () => {
  it('is not absolutely positioned', () => {
    const body = ruleBody('.upgrade-button');
    expect(body.trim().length, 'no .upgrade-button rule').toBeGreaterThan(0);
    expect(body).not.toMatch(/position\s*:\s*absolute/);
    expect(body).not.toMatch(/(?:^|[;\s])(?:bottom|right)\s*:/);
  });

  it('does not stack itself above the map either', () => {
    // z-index: 100 only mattered because it was floating; left behind it would
    // put this button above the whole map layer stack for no reason.
    expect(ruleBody('.upgrade-button')).not.toMatch(/z-index\s*:/);
  });

  it('follows the map in the markup, so normal flow puts it below', () => {
    const mapAt = jsx.indexOf('game-map-container');
    const buttonAt = jsx.indexOf('upgrade-button');
    expect(mapAt).toBeGreaterThan(-1);
    expect(buttonAt).toBeGreaterThan(mapAt);
  });
});
