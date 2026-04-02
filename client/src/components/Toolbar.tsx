import type { Tool } from "../types";

interface Props {
  tool: Tool;
  color: string;
  fill: string;
  strokeWidth: number;
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onFillChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Line" },
  { id: "text", label: "Text" },
];

export default function Toolbar({
  tool,
  color,
  fill,
  strokeWidth,
  onToolChange,
  onColorChange,
  onFillChange,
  onStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDelete,
  hasSelection,
}: Props) {
  return (
    <div style={styles.bar}>
      {/* Tools */}
      <div style={styles.group}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            style={{ ...styles.toolBtn, ...(tool === t.id ? styles.active : {}) }}
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.divider} />

      {/* Stroke color */}
      <div style={styles.group}>
        <label style={styles.label}>Stroke</label>
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          style={styles.colorInput}
          title="Stroke color"
        />
      </div>

      {/* Fill color */}
      <div style={styles.group}>
        <label style={styles.label}>Fill</label>
        <input
          type="color"
          value={fill === "transparent" ? "#ffffff" : fill}
          onChange={(e) => onFillChange(e.target.value)}
          style={styles.colorInput}
          title="Fill color"
        />
        <button
          style={{
            ...styles.smallBtn,
            background: fill === "transparent" ? "#2563eb" : "transparent",
            color: fill === "transparent" ? "#fff" : "#333",
          }}
          onClick={() => onFillChange("transparent")}
          title="No fill"
        >
          ∅
        </button>
      </div>

      {/* Stroke width */}
      <div style={styles.group}>
        <label style={styles.label}>Width</label>
        <select
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          style={styles.select}
        >
          {[1, 2, 3, 4, 6, 8].map((w) => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </div>

      <div style={styles.divider} />

      {/* Undo/redo */}
      <div style={styles.group}>
        <button style={styles.toolBtn} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button style={styles.toolBtn} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          ↪
        </button>
      </div>

      {/* Delete */}
      {hasSelection && (
        <>
          <div style={styles.divider} />
          <button
            style={{ ...styles.toolBtn, color: "#dc2626" }}
            onClick={onDelete}
            title="Delete selected (Del)"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 48,
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    padding: "0 0.75rem",
    gap: "0.25rem",
    flexShrink: 0,
    overflowX: "auto",
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  toolBtn: {
    padding: "0.3rem 0.6rem",
    borderRadius: 4,
    border: "1px solid #e5e7eb",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  active: {
    background: "#dbeafe",
    borderColor: "#2563eb",
    color: "#2563eb",
  },
  label: {
    fontSize: "0.75rem",
    color: "#666",
    marginRight: "0.1rem",
  },
  colorInput: {
    width: 28,
    height: 28,
    padding: 1,
    border: "1px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
  },
  smallBtn: {
    padding: "0.2rem 0.45rem",
    borderRadius: 4,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  select: {
    padding: "0.25rem",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: "0.85rem",
  },
  divider: {
    width: 1,
    height: 24,
    background: "#e5e7eb",
    margin: "0 0.35rem",
  },
};
