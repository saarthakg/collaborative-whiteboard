import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, login } from "../api";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await login(email, password);
      localStorage.setItem("token", token);
      const user = await getMe();
      setAuth(token, user);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Whiteboard</h1>
        <h2 style={styles.subtitle}>Sign in</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p style={styles.link}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: "2rem",
    width: 360,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  },
  title: { margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 700 },
  subtitle: { margin: "0 0 1.5rem", fontSize: "1rem", fontWeight: 400, color: "#666" },
  form: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  input: {
    padding: "0.6rem 0.8rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: "0.95rem",
  },
  button: {
    padding: "0.7rem",
    borderRadius: 4,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: "0.95rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 4,
    padding: "0.5rem 0.75rem",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  },
  link: { marginTop: "1rem", textAlign: "center", fontSize: "0.9rem", color: "#555" },
};
