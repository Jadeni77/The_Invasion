import { useEffect } from "react";

/*
 * Asking the device to hold landscape during a level.
 *
 * The Screen Orientation API is Chromium-only. WebKit ships
 * `screen.orientation` with `type` and `angle` and no `lock` or `unlock` at
 * all - so every iPhone threw
 *
 *   TypeError: screen.orientation.lock is not a function
 *
 * from inside an effect on mount, React unwound the tree, and the whole game
 * was a blank screen. The guard was `screen.orientation && screen.orientation.lock()`,
 * which CALLS the function it is testing for: it cannot survive the function
 * being absent, and on Chromium it called lock() twice, the first time with no
 * argument.
 *
 * jsdom has no `screen.orientation` whatsoever, so that guard short-circuited
 * and the bug was invisible to the whole test suite. The tests here define one.
 *
 * Nothing here is load-bearing: where the API is missing the game plays in
 * whatever orientation the device is in.
 */

/** The API, or null wherever it is not implemented. */
const orientationApi = () =>
    (typeof screen !== "undefined" && screen.orientation) ? screen.orientation : null;

const lockLandscape = () => {
    const api = orientationApi();
    if (typeof api?.lock !== "function") return;
    // Rejects unless the page is fullscreen, which is not something to report:
    // it is the normal answer on a desktop browser.
    Promise.resolve(api.lock("landscape")).catch(() => {});
};

const releaseOrientation = () => {
    const api = orientationApi();
    if (typeof api?.unlock !== "function") return;
    try {
        api.unlock();
    } catch {
        /* Same again: a refusal here changes nothing about the game. */
    }
};

export const useMobileOrientation = (gameState) => {
    useEffect(() => {
        if (gameState === "inGame" && window.innerWidth < 768) {
            lockLandscape();
        } else {
            releaseOrientation();
        }

        return releaseOrientation;
    }, [gameState]);

    //force viewpoint to change
    useEffect(() => {
        if (gameState === 'inGame' && window.innerWidth < 768) {
            let viewport = document.querySelector('meta[name=viewport]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
            }
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }, [gameState]);
};
