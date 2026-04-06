import React, { useState } from "react";

export default function LoginPage( { onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
        const body = isRegister 
            ? { email, password, displayName }
            : { email, password };

        try {
            const res = await fetch(`http://localhost:8080${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const msg = await res.text()
                setError(msg || "Something went wrong");
                return;
            }

            const data = await res.json();
            onLogin(data.token, data.player);
        } catch (_e) {
            setError("Cannot connect to server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <form onSubmit={handleSubmit} style={styles.form}>
                <h2 style={styles.title}>
                    {isRegister ? "Create Account" : "Login"}
                </h2>

                {isRegister && (
                    <input
                        type="text"
                        placeholder="Display Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={styles.input}
                    />
                )}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={styles.input}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={styles.input}
                />

                {error && <p style={styles.error}>{error}</p>}

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? "..." : isRegister ? "Register" : "Login"}
                </button>

                <p style={styles.toggle} onClick={() => setIsRegister(!isRegister)}>
                    {isRegister
                        ? "Already have an account? Login"
                        : "No account? Register"}
                </p>
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
    toggle: {
        color: "#88aaff", fontSize: "13px", textAlign: "center",
        cursor: "pointer", margin: 0,
    },
};