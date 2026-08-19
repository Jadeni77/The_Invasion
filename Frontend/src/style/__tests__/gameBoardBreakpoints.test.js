/* Every real device size lands in exactly one gameboard layout. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'GameBoard.css'), 'utf8');

/** Every @media condition in the file, in source order. */
function conditions() {
  return [...css.matchAll(/@media([^{]+)\{/g)].map((m) => m[1].trim());
}

/**
 * Does `condition` match a viewport? Supports the features this stylesheet uses:
 * min/max width, min/max height, and orientation.
 */
function matches(condition, { w, h }) {
  return condition.split(/\s+and\s+/).every((raw) => {
    const term = raw.replace(/[()]/g, '').trim();
    const [feature, value] = term.split(':').map((x) => x.trim());
    const px = Number.parseInt(value, 10);
    switch (feature) {
      case 'min-width': return w >= px;
      case 'max-width': return w <= px;
      case 'min-height': return h >= px;
      case 'max-height': return h <= px;
      case 'orientation': return (w >= h ? 'landscape' : 'portrait') === value;
      default: return true;
    }
  });
}

/** Real viewports, in CSS pixels. */
const DEVICES = [
  { name: 'iPhone 14 portrait', w: 390, h: 844 },
  { name: 'iPhone 14 landscape', w: 844, h: 390 },
  { name: 'iPhone 14 Pro Max landscape', w: 932, h: 430 },
  { name: 'small phone landscape', w: 740, h: 360 },
  { name: 'iPad portrait', w: 768, h: 1024 },
  { name: 'iPad landscape', w: 1024, h: 768 },
  { name: 'laptop', w: 1470, h: 956 },
];

describe('the gameboard breakpoints cover real devices', () => {
  it('parses a real set of media conditions (guards against a vacuous run)', () => {
    expect(conditions().length).toBeGreaterThanOrEqual(4);
  });

  it.each(DEVICES.map((d) => [d.name, d]))('%s matches at most one layout block', (_name, device) => {
    // Two blocks matching is not automatically wrong in CSS, but here it was: the
    // tablet block followed the landscape block and overrode the properties they
    // shared, which is how a phone got tablet chrome.
    const hit = conditions().filter((c) => matches(c, device));
    expect(hit, `${_name} matched ${hit.length}: ${hit.join(' | ')}`).toHaveLength(
      hit.length > 1 ? 1 : hit.length,
    );
  });

  it('gives every landscape phone a block of its own', () => {
    const phones = DEVICES.filter((d) => d.w > d.h && d.h <= 500);
    expect(phones.length, 'no landscape phones in the table').toBeGreaterThan(0);

    for (const phone of phones) {
      const hit = conditions().filter((c) => matches(c, phone));
      expect(hit, `${phone.name} matched no layout block`).not.toHaveLength(0);
      // And it must be the short-viewport one, not the tablet one.
      expect(
        hit.some((c) => /max-height/.test(c)),
        `${phone.name} matched ${hit.join(' | ')} - none of them keyed on height`,
      ).toBe(true);
    }
  });

  it('keeps the tablet block off short viewports', () => {
    const tablet = conditions().find((c) => /min-width:\s*769px/.test(c));
    expect(tablet, 'no tablet block found').toBeTruthy();
    expect(tablet, 'a landscape phone is 844-932px wide and would match this')
      .toMatch(/min-height/);
  });

  it('does not key the landscape block on width, which is what missed every phone', () => {
    const landscape = conditions().filter((c) => /orientation:\s*landscape/.test(c));
    expect(landscape.length).toBeGreaterThan(0);
    for (const c of landscape) {
      expect(c, `"${c}" caps width, so a 844px phone falls out of it`).not.toMatch(/max-width/);
    }
  });
});
