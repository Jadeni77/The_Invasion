/**
 * The lobby's account control: one button whose meaning depends on who is playing.
 *
 * A guest is offered a way to keep their progress; somebody signed in is
 * offered a way out. Both run the same handler, which is the part that reads
 * as a mistake and is not - see the comment on the click handler below.
 *
 * `icon-save` does not exist in the stylesheet (none of these menu buttons'
 * `icon-*` classes carry a rule - they are unstyled placeholders), so this
 * reuses `icon-logout` for both rather than inventing a glyph that would be
 * just as unstyled but harder to account for later.
 */
import { MODE_GUEST } from '../../GameLogic (MVC)/playerPersistence.js';

export default function AccountButton({ mode, onClick }) {
  /* The exported constant, not the word it happens to hold. playerPersistence
     is where the mode vocabulary lives; a literal here was a second copy of it,
     and a rename there would have left this quietly offering every guest the
     logout wording. */
  const isGuest = mode === MODE_GUEST;

  return (
    /*
     * handleLogout for a guest too. It clears a session a guest does not have
     * and never touches the guest slot, so this lands on the login screen with
     * their progress still on the device - which is exactly what "save your
     * progress" has to do to be true.
     */
    <button className="menu-button settings" onClick={onClick}>
      <i className="icon-logout" />
      <span>{isGuest ? 'Save your progress' : 'Logout'}</span>
    </button>
  );
}
