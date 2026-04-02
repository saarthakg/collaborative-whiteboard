import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCanvas, inviteToCanvas, listCanvases } from "../api";
import { useAuth } from "../contexts/AuthContext";
import type { Canvas } from "../types";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteCanvasId, setInviteCanvasId] = useState<string | null>(null);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listCanvases()
      .then(setCanvases)
      .catch((e) => setError(e.message));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const canvas = await createCanvas(newName.trim());
      setCanvases((prev) => [canvas, ...prev]);
      setNewName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create canvas");
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCanvasId || !inviteIdentifier.trim()) return;
    try {
      await inviteToCanvas(inviteCanvasId, inviteIdentifier.trim());
      setInviteMsg("Invited successfully!");
      setInviteIdentifier("");
      setTimeout(() => {
        setInviteMsg("");
        setInviteCanvasId(null);
      }, 2000);
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Failed to invite");
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Whiteboard</h1>
        <div style={styles.userInfo}>
          <span style={{ color: "#555" }}>
            {user?.username}
          </span>
          <button style={styles.logoutBtn} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleCreate} style={styles.createForm}>
          <input
            style={styles.input}
            placeholder="New canvas name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button style={styles.primaryBtn} type="submit" disabled={creating}>
            {creating ? "Creating…" : "New canvas"}
          </button>
        </form>

        {canvases.length === 0 ? (
          <p style={{ color: "#888", marginTop: "2rem" }}>
            No canvases yet. Create one above.
          </p>
        ) : (
          <div style={styles.grid}>
            {canvases.map((c) => (
              <div key={c.id} style={styles.card}>
                <div
                  style={styles.cardTitle}
                  onClick={() => navigate(`/canvas/${c.id}`)}
                >
                  {c.name}
                </div>
                <div style={styles.cardMeta}>
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
                <div style={styles.cardActions}>
                  <button
                    style={styles.openBtn}
                    onClick={() => navigate(`/canvas/${c.id}`)}
                  >
                    Open
                  </button>
                  <button
                    style={styles.inviteBtn}
                    onClick={() => {
                      setInviteCanvasId(c.id);
                      setInviteMsg("");
                      setInviteIdentifier("");
                    }}
                  >
                    Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Invite modal */}
      {inviteCanvasId && (
        <div style={styles.modalOverlay} onClick={() => setInviteCanvasId(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 1rem" }}>Invite to canvas</h3>
            <form onSubmit={handleInvite} style={styles.form}>
              <input
                style={styles.input}
                placeholder="Username or email"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button style={styles.primaryBtn} type="submit">
                  Invite
                </button>
                <button
                  style={styles.cancelBtn}
                  type="button"
                  onClick={() => setInviteCanvasId(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
            {inviteMsg && (
              <p
                style={{
                  marginTop: "0.75rem",
                  color: inviteMsg.includes("success") ? "#16a34a" : "#dc2626",
                }}
              >
                {inviteMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f5f5f5" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.5rem",
    height: 56,
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  logo: { margin: 0, fontSize: "1.2rem", fontWeight: 700 },
  userInfo: { display: "flex", alignItems: "center", gap: "1rem" },
  logoutBtn: {
    padding: "0.3rem 0.8rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  main: { maxWidth: 800, margin: "2rem auto", padding: "0 1rem" },
  createForm: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem" },
  input: {
    flex: 1,
    padding: "0.6rem 0.8rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: "0.95rem",
  },
  primaryBtn: {
    padding: "0.6rem 1.2rem",
    borderRadius: 4,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: "1rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    marginBottom: "0.25rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardMeta: { fontSize: "0.8rem", color: "#888", marginBottom: "0.75rem" },
  cardActions: { display: "flex", gap: "0.5rem" },
  openBtn: {
    padding: "0.35rem 0.75rem",
    borderRadius: 4,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  inviteBtn: {
    padding: "0.35rem 0.75rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  error: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 4,
    padding: "0.5rem 0.75rem",
    marginBottom: "1rem",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "#fff",
    borderRadius: 8,
    padding: "1.5rem",
    width: 360,
    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  cancelBtn: {
    padding: "0.6rem 1rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
};
