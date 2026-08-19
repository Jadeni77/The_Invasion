import { useEffect } from "react";

/**
 * Ask the browser to confirm before a refresh or a closed tab throws a level away.
 *
 * There is no resuming a level in progress: reloading drops the run, and the
 * energy spent to start it is already gone. The quit button says so, but a
 * refresh said nothing at all - the player came back to the lobby poorer with no
 * account of why.
 *
 * Browsers ignore any message given here and show their own wording, and they
 * only show it at all once the page has been interacted with. `active` is what
 * keeps the prompt off every other screen, where there is nothing to lose.
 */
export function useLeaveWarning(active) {
  useEffect(() => {
    if (!active) return undefined;

    const warn = (event) => {
      event.preventDefault();
      // Set for the browsers that still read it; ignored by the rest.
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
