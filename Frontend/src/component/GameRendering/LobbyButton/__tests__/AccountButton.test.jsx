/*
 * A guest needs a way to reach the login screen without losing the slot -
 * otherwise the only route from guest to account is clearing site data, which
 * takes the progress with it.
 *
 * One button, two labels. Both run handleLogout, which for a guest clears a
 * session that does not exist and leaves the slot alone - so it lands on the
 * login screen with their progress still on the device. That reads as a
 * mistake without the comment in the component saying why it is not.
 *
 * Tested standalone rather than through Lobby: rendering the lobby needs a
 * fully populated player and would be testing the lobby, not this.
 */
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountButton from '../AccountButton.jsx';
import { MODE_GUEST } from '../../../GameLogic (MVC)/playerPersistence.js';
import { SRC_ROOT, read, stripComments } from '../../../../test/sourceFiles.js';

describe('the account button', () => {
  it('offers a guest a way to keep their progress', () => {
    render(<AccountButton mode="guest" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /save your progress/i })).toBeInTheDocument();
  });

  it('offers somebody signed in a way out', () => {
    render(<AccountButton mode="account" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /log ?out/i })).toBeInTheDocument();
  });

  it('does not offer a signed-in player the guest wording', () => {
    render(<AccountButton mode="account" onClick={() => {}} />);
    expect(screen.queryByRole('button', { name: /save your progress/i })).not.toBeInTheDocument();
  });

  /*
   * The modes are named once, in playerPersistence.js - the file whose comment
   * calls itself "the only place the mode is chosen". This component held the
   * codebase's one string-literal mode comparison, so renaming MODE_GUEST
   * would have left it testing against a word nothing produces any more, and
   * every guest would quietly have been offered the logout wording instead.
   */
  it('follows the mode the module exports', () => {
    render(<AccountButton mode={MODE_GUEST} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /save your progress/i })).toBeInTheDocument();
  });

  it('names no mode of its own', () => {
    const source = stripComments(read(
      join(SRC_ROOT, 'component', 'GameRendering', 'LobbyButton', 'AccountButton.jsx'),
    ));

    expect(source, 'import MODE_GUEST rather than repeating the value it holds')
      .not.toMatch(/['"]guest['"]/);
  });

  it('calls its handler in either mode', () => {
    const onClick = vi.fn();

    const { unmount } = render(<AccountButton mode="guest" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    unmount();

    render(<AccountButton mode="account" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
