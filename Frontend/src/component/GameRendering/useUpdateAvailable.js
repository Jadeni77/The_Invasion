import { useEffect, useState } from "react";
import {
  UPDATE_POLL_MS,
  fetchDeployedBuildId,
  updateAvailable,
} from "../../config/version.js";

/**
 * True once the site has been redeployed since this tab loaded.
 *
 * Latches: once an update exists it does not un-exist, so a slow network or a
 * failed poll cannot make the notice flicker away while the player is reading
 * it.
 *
 * It keeps polling only until it finds one - there is nothing further to learn
 * after that, and the answer cannot change back.
 */
export function useUpdateAvailable(pollMs = UPDATE_POLL_MS) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available) return undefined;

    let cancelled = false;

    const check = async () => {
      const deployed = await fetchDeployedBuildId();
      if (!cancelled && updateAvailable(deployed)) setAvailable(true);
    };

    // Not on mount: a tab that has just loaded IS the current build, and asking
    // immediately only costs a request to be told so.
    const interval = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [available, pollMs]);

  return available;
}
