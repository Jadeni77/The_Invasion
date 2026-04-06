export class SessionManager {
    static TOKEN_KEY = "auth_token";
    static USER_KEY = "user_data";

    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    static setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    }

    static getUser() {
        const data = localStorage.getItem(this.USER_KEY);
        return data ? JSON.parse(data) : null;
    }

    static setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    
    static isLoggedIn() {
        return !!this.getToken();
    }

    static clearSession() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);

    }

    // Helper for authenticated API calls
    static authHeaders() {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.getToken()}`,
        };
    }
}