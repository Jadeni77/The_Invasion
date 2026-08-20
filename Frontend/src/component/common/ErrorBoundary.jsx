import React from "react";

/*
 * What a crash looks like to a player.
 *
 * React unmounts the whole tree when a render throws, and the page is left with
 * an empty root - so the game became a blank screen of whatever colour the
 * theme-color happened to be. That is what an iPhone showed for
 * `screen.orientation.lock is not a function`, and finding out what it said
 * took a USB cable and Safari's Web Inspector.
 *
 * This does not prevent the crash. It makes the crash SAY something, which is
 * the difference between a player reporting "the game is broken" and a player
 * screenshotting the line that names the bug.
 *
 * A class, because getDerivedStateFromError and componentDidCatch have no hook
 * equivalent - this is the one thing React still requires a class for.
 *
 * The fallback deliberately depends on nothing: no context, no game state, no
 * design tokens beyond a colour it can do without. Whatever just broke might be
 * any of those.
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Still logged, so the console keeps the stack for anyone who can reach it.
        console.error("The game crashed:", error, info?.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        /* The message is shown, not hidden behind "an error occurred". A player
           who can read `screen.orientation.lock is not a function` off their own
           screen can report the bug in one message. */
        const message = error?.message || String(error);

        return (
            <div className="crash-screen" role="alert">
                <h1 className="crash-title">The game hit a problem</h1>
                <p className="crash-body">
                    Nothing you did caused this, and your progress is saved on the server.
                    Reloading usually fixes it.
                </p>
                <button
                    type="button"
                    className="crash-reload"
                    onClick={() => window.location.reload()}
                >
                    Reload the game
                </button>
                <p className="crash-detail">
                    If it keeps happening, send this line along:
                </p>
                <code className="crash-message">{message}</code>
            </div>
        );
    }
}

export default ErrorBoundary;
