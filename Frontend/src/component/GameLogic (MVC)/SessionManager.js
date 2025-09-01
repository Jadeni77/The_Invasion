export class SessionManager {
    static SESSION_KEY = "game_session_id";

    static getOrCreateSessionId() {
        let sessionId = localStorage.getItem(this.SESSION_KEY);

        if (!sessionId) {
            //generate one
            sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(this.SESSION_KEY, sessionId);
        }
        return sessionId;
    }

    static clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
    }

    static getSession() {
       return localStorage.getItem(this.SESSION_KEY);
    }

    static hasSession() {
        return !!localStorage.getItem(this.SESSION_KEY);
    }
}