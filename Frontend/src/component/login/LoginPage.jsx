import React, { useState } from "react";
import { apiUrl } from "../../config/api.js";

const MODE_LOGIN = "login";
const MODE_REGISTER = "register";
const MODE_FORGOT_REQUEST = "forgot-request";  // ask for email
const MODE_FORGOT_RESET = "forgot-reset";      // submit code + new password
const MODE_VERIFY_EMAIL = "verify-email";      // confirm a new account's address

export default function LoginPage( { onLogin }) {
    const [mode, setMode] = useState(MODE_LOGIN);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);
    /* The free host spins the backend down when nobody is playing, and the
       next request waits for it to come back - tens of seconds, against a
       server that itself starts in about two. Saying so beats a button that
       sits on "..." long enough to look broken. */
    const [waking, setWaking] = useState(false);

    const resetTransientState = () => {
        setError("");
        setInfo("");
        setWaking(false);
    };

    /** How long a request may take before it is worth explaining the wait. */
    const WAKING_AFTER_MS = 4000;

    const switchMode = (next) => {
        resetTransientState();
        setMode(next);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        resetTransientState();
        setLoading(true);

        const wakingTimer = setTimeout(() => setWaking(true), WAKING_AFTER_MS);

        try {
            if (mode === MODE_LOGIN || mode === MODE_REGISTER) {
                const endpoint = mode === MODE_REGISTER ? "/api/auth/register" : "/api/auth/login";
                const body = mode === MODE_REGISTER
                    ? { email, password, displayName }
                    : { email, password };
                const res = await fetch(apiUrl(`${endpoint}`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                if (!res.ok) {
                    const text = await res.text();
                    if (res.status === 403 && /confirm your email/i.test(text)) {
                        setInfo("This account still needs confirming. Enter the code, or send a new one.");
                        setMode(MODE_VERIFY_EMAIL);
                        return;
                    }
                    setError(text || "Something went wrong");
                    return;
                }
                const data = await res.json();
                if (data.verificationRequired) {
                    setInfo(data.message || "Check your email for a confirmation code.");
                    setMode(MODE_VERIFY_EMAIL);
                    return;
                }
                onLogin(data.token, data.player);
            } else if (mode === MODE_VERIFY_EMAIL) {
                const res = await fetch(apiUrl("/api/auth/verify-email"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code }),
                });
                if (!res.ok) {
                    setError(await res.text() || "That code did not work");
                    return;
                }
                const data = await res.json();
                onLogin(data.token, data.player);
            } else if (mode === MODE_FORGOT_REQUEST) {
                const res = await fetch(apiUrl("/api/auth/forgot-password"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                if (!res.ok) {
                    setError(await res.text() || "Could not send code");
                    return;
                }
                setInfo("If that email is registered, a 6-digit code has been sent.");
                setMode(MODE_FORGOT_RESET);
            } else if (mode === MODE_FORGOT_RESET) {
                const res = await fetch(apiUrl("/api/auth/reset-password"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code, newPassword })
                });
                if (!res.ok) {
                    setError(await res.text() || "Invalid or expired code");
                    return;
                }
                setInfo("Password reset. You can now log in with your new password.");
                setPassword("");
                setCode("");
                setNewPassword("");
                setMode(MODE_LOGIN);
            }
        } catch (_e) {
            setError("Cannot connect to server");
        } finally {
            setLoading(false);
            setWaking(false);
            clearTimeout(wakingTimer);
        }
    };

    const title = {
        [MODE_LOGIN]: "Login",
        [MODE_REGISTER]: "Create Account",
        [MODE_FORGOT_REQUEST]: "Reset Password",
        [MODE_FORGOT_RESET]: "Enter Verification Code",
        [MODE_VERIFY_EMAIL]: "Confirm Your Email"
    }[mode];

    const submitLabel = {
        [MODE_LOGIN]: "Login",
        [MODE_REGISTER]: "Register",
        [MODE_FORGOT_REQUEST]: "Send Code",
        [MODE_FORGOT_RESET]: "Reset Password",
        [MODE_VERIFY_EMAIL]: "Confirm"
    }[mode];

    return (
        <div style={styles.overlay}>
            <form onSubmit={handleSubmit} style={styles.form}>
                <h2 style={styles.title}>{title}</h2>

                {mode === MODE_REGISTER && (
                    <input
                        type="text"
                        placeholder="Display Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={styles.input}
                    />
                )}

                {(mode === MODE_LOGIN
                  || mode === MODE_REGISTER
                  || mode === MODE_FORGOT_REQUEST
                  || mode === MODE_FORGOT_RESET) && (
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={styles.input}
                    />
                )}

                {mode === MODE_VERIFY_EMAIL && (
                    <>
                        {/* Read-only: the code went to this address, so letting
                            it be edited here would only produce a code that
                            cannot match. */}
                        <input
                            type="email"
                            value={email}
                            readOnly
                            style={{ ...styles.input, opacity: 0.7 }}
                        />
                        <input
                            type="text"
                            placeholder="6-digit Code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            maxLength={6}
                            style={styles.input}
                        />
                        <p
                            style={{ ...styles.toggle, marginTop: 0 }}
                            onClick={async () => {
                                resetTransientState();
                                await fetch(apiUrl("/api/auth/resend-verification"), {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ email }),
                                });
                                setInfo("Another code is on its way.");
                            }}
                        >
                            Didn't get it? Send another
                        </p>
                    </>
                )}

                {(mode === MODE_LOGIN || mode === MODE_REGISTER) && (
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={styles.input}
                    />
                )}

                {mode === MODE_FORGOT_RESET && (
                    <>
                        <input
                            type="text"
                            placeholder="6-digit Code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            maxLength={6}
                            style={styles.input}
                        />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            style={styles.input}
                        />
                    </>
                )}

                {error && <p style={styles.error}>{error}</p>}
                {info && <p style={styles.info}>{info}</p>}
                {waking && (
                    <p style={styles.info}>
                        Waking the server &mdash; it sleeps when nobody is playing.
                        This takes up to a minute the first time.
                    </p>
                )}

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? (waking ? "Waking the server\u2026" : "\u2026") : submitLabel}
                </button>

                {mode === MODE_LOGIN && (
                    <>
                        <p style={styles.toggle} onClick={() => switchMode(MODE_REGISTER)}>
                            No account? Register
                        </p>
                        <p style={styles.toggle} onClick={() => switchMode(MODE_FORGOT_REQUEST)}>
                            Forgot password?
                        </p>
                    </>
                )}
                {mode === MODE_REGISTER && (
                    <p style={styles.toggle} onClick={() => switchMode(MODE_LOGIN)}>
                        Already have an account? Login
                    </p>
                )}
                {(mode === MODE_FORGOT_REQUEST
                  || mode === MODE_FORGOT_RESET
                  || mode === MODE_VERIFY_EMAIL) && (
                    <p style={styles.toggle} onClick={() => switchMode(MODE_LOGIN)}>
                        Back to login
                    </p>
                )}
            </form>
        </div>
    );
}

const styles = {
    overlay: {
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "100vh", width: "100vw",
        background: "linear-gradient(135deg, #1a1a2e, #16213e)",
    },
    form: {
        display: "flex", flexDirection: "column", gap: "12px",
        padding: "40px", borderRadius: "12px",
        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)", minWidth: "300px",
    },
    title: { color: "#fff", textAlign: "center", margin: 0 },
    input: {
        padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "14px", outline: "none",
    },
    button: {
        padding: "10px", borderRadius: "8px", border: "none",
        background: "#4CAF50", color: "#fff", fontSize: "16px",
        cursor: "pointer", fontWeight: "bold",
    },
    error: { color: "#ff6b6b", fontSize: "13px", margin: 0, textAlign: "center" },
    info: { color: "#7fffa4", fontSize: "13px", margin: 0, textAlign: "center" },
    toggle: {
        color: "#88aaff", fontSize: "13px", textAlign: "center",
        cursor: "pointer", margin: 0,
    },
};
