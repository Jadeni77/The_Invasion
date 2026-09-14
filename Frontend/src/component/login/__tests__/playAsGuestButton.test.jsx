/*
 * The feature's front door has to look like a door.
 *
 * `secondaryButton` copied `input`'s border and background verbatim, so "Play
 * as guest" rendered as a third text field beneath email and password - the
 * one control a visitor with no account is supposed to find. Its comment said
 * it used "the outline the rest of the form uses for things that are not the
 * main action", but no other button in this form is outlined: that outline IS
 * the input style.
 *
 * Asserted against the two things it must not be mistaken for rather than
 * against a particular colour, so restyling the form does not break this while
 * the confusion it exists to prevent stays fixed.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from '../LoginPage.jsx';

const renderLogin = () => render(<LoginPage onLogin={vi.fn()} onPlayAsGuest={vi.fn()} />);

const guestButton = () => screen.getByRole('button', { name: /play as guest/i });

describe('the way into guest mode', () => {
  it('does not wear a text field as a costume', () => {
    renderLogin();
    const email = screen.getByPlaceholderText(/email/i);

    expect(
      guestButton().style.background,
      'a control filled like an input reads as an input',
    ).not.toBe(email.style.background);
    expect(
      guestButton().style.borderColor || guestButton().style.border,
      'and outlined like one finishes the illusion',
    ).not.toBe(email.style.borderColor || email.style.border);
  });

  it('does not claim to be the main action either', () => {
    renderLogin();
    const submit = screen.getByRole('button', { name: /^login$/i });

    expect(guestButton().style.background).not.toBe(submit.style.background);
  });

  it('is still the same size and shape as the button above it', () => {
    renderLogin();
    const submit = screen.getByRole('button', { name: /^login$/i });

    expect(guestButton().style.padding).toBe(submit.style.padding);
    expect(guestButton().style.borderRadius).toBe(submit.style.borderRadius);
    expect(guestButton().style.fontSize).toBe(submit.style.fontSize);
  });
});
