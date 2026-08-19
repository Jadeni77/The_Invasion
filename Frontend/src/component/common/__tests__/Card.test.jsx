import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Card from '../Card.jsx';

const fakeCard = {
  id: 'test-card',
  name: 'Not A Real Defender', // deliberately unmatched in AssetManifest, so
                                // useSpriteFrame's effect no-ops and no
                                // dynamic asset import or canvas is touched.
  level: 1,
  cost: 3,
  damage: 5,
  health: 10,
};

/** The sweep overlay Card.jsx renders for on-card recharge (Card.css
 *  ".cooldown-sweep"). Queries by class rather than role/text since it's a
 *  purely decorative, non-interactive layer. */
function sweepEl(container) {
  return container.querySelector('.cooldown-sweep');
}

function sweepAngle(container) {
  return sweepEl(container).style.getPropertyValue('--sweep-angle');
}

describe('Card cooldown sweep - ready default', () => {
  it('renders the overlay at all', () => {
    const { container } = render(<Card card={fakeCard} />);
    expect(sweepEl(container), 'no .cooldown-sweep element rendered').toBeTruthy();
  });

  it('defaults to fully ready (0deg) when cooldownFraction is omitted entirely', () => {
    // Rejects an implementation that requires the caller to always pass
    // cooldownFraction (e.g. reads `cooldownFraction * 360` directly and
    // produces "NaNdeg"), which is exactly the CardSelectionModal usage
    // today - that call site never passes this prop at all.
    const { container } = render(<Card card={fakeCard} />);
    expect(sweepAngle(container)).toBe('0deg');
  });

  it('defaults to fully ready (0deg) when cooldownFraction is explicitly undefined', () => {
    const { container } = render(<Card card={fakeCard} cooldownFraction={undefined} />);
    expect(sweepAngle(container)).toBe('0deg');
  });

  it('defaults to fully ready (0deg) when cooldownFraction is NaN', () => {
    // Rejects a `cooldownFraction ?? 0` implementation: NaN is neither null
    // nor undefined, so `??` would let it through unchanged and produce
    // "NaNdeg". Number.isFinite is what actually catches this.
    const { container } = render(<Card card={fakeCard} cooldownFraction={NaN} />);
    expect(sweepAngle(container)).toBe('0deg');
  });

  it('renders 0deg (not just "falls back the same way") when cooldownFraction is a real, explicit 0', () => {
    // Distinct from the "prop missing" tests above - this is the ordinary
    // just-became-ready case, not a data gap.
    const { container } = render(<Card card={fakeCard} cooldownFraction={0} />);
    expect(sweepAngle(container)).toBe('0deg');
  });
});

describe('Card cooldown sweep - proportional angle', () => {
  it('maps a mid-recharge fraction to a proportional angle, not a fixed on/off toggle', () => {
    // Rejects an implementation that only distinguishes "cooling down" vs
    // "ready" (e.g. `cooldownFraction > 0 ? 360 : 0`) instead of actually
    // sweeping as time passes.
    const { container } = render(<Card card={fakeCard} cooldownFraction={0.5} />);
    expect(sweepAngle(container)).toBe('180deg');
  });

  it('reaches a full 360deg sweep right after use (fraction 1)', () => {
    const { container } = render(<Card card={fakeCard} cooldownFraction={1} />);
    expect(sweepAngle(container)).toBe('360deg');
  });

  it('clamps a fraction above 1 to 360deg rather than sweeping past a full circle', () => {
    // Rejects `fraction * 360` with no clamping, which would produce
    // "504deg" for corrupted upstream data (e.g. a cooldown map that
    // briefly holds a value larger than the card's own duration).
    const { container } = render(<Card card={fakeCard} cooldownFraction={1.4} />);
    expect(sweepAngle(container)).toBe('360deg');
  });

  it('clamps a negative fraction to 0deg rather than an inverted/negative sweep', () => {
    const { container } = render(<Card card={fakeCard} cooldownFraction={-0.3} />);
    expect(sweepAngle(container)).toBe('0deg');
  });
});
