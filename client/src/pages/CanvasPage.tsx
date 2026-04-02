import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCanvas, getShapes } from "../api";
import Toolbar from "../components/Toolbar";
import WhiteboardSVG from "../components/WhiteboardSVG";
import { useAuth } from "../contexts/AuthContext";
import { useCanvasWs } from "../hooks/useCanvasWs";
import { useWhiteboard } from "../hooks/useWhiteboard";
import type { Canvas, Shape } from "../types";

export default function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);

  const { state, dispatch, stateRef } = useWhiteboard();
  const { sendMessage, remoteCursors, trackPending } = useCanvasWs({
    canvasId: canvasId!,
    token,
    dispatch,
    myUserId: user?.id ?? "",
  });

  // Keep a ref to sendMessage so undo/redo handlers are stable
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    if (!canvasId) return;
    Promise.all([getCanvas(canvasId), getShapes(canvasId)])
      .then(([c, shapes]) => {
        setCanvas(c);
        dispatch({ type: "LOAD_SHAPES", shapes });
      })
      .catch(() => navigate("/"));
  }, [canvasId, dispatch, navigate]);

  // Keyboard shortcuts: undo/redo, delete
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isEditing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;
      if (isEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUndo() {
    const s = stateRef.current;
    if (s.historyIndex < 0) return;
    const entry = s.history[s.historyIndex];

    if (entry.type === "create") {
      dispatch({ type: "UNDO" });
      sendRef.current({ type: "shape_delete", shape_id: entry.shape.id });
    } else if (entry.type === "update") {
      dispatch({ type: "UNDO" });
      const { before } = entry;
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(before) as Array<keyof Shape>) {
        if (["x","y","width","height","x2","y2","color","fill","stroke_width","content","z_index"].includes(k)) {
          patch[k] = before[k];
        }
      }
      sendRef.current({ type: "shape_update", shape_id: before.id, patch });
    } else if (entry.type === "delete") {
      const tmpId = crypto.randomUUID();
      const { shape } = entry;
      // currentId tracks the live server id after a previous undo-restore confirms
      const liveId = (entry as typeof entry & { currentId?: string }).currentId ?? shape.id;
      // Capture historyIndex BEFORE dispatch (dispatch decrements it)
      const deleteHistoryIndex = s.historyIndex;
      dispatch({ type: "UNDO" });
      trackPending(tmpId, { deleteHistoryIndex, oldShapeId: liveId });
      sendRef.current({
        type: "shape_create",
        client_id: tmpId,
        shape: {
          type: shape.type,
          x: shape.x, y: shape.y,
          width: shape.width, height: shape.height,
          x2: shape.x2, y2: shape.y2,
          color: shape.color, fill: shape.fill,
          stroke_width: shape.stroke_width,
          content: shape.content,
        },
      });
    }
  }

  function handleRedo() {
    const s = stateRef.current;
    if (s.historyIndex >= s.history.length - 1) return;
    const entry = s.history[s.historyIndex + 1];
    dispatch({ type: "REDO" });
    // Send forward WS op
    if (entry.type === "create") {
      const tmpId = crypto.randomUUID();
      trackPending(tmpId);
      sendRef.current({
        type: "shape_create",
        client_id: tmpId,
        shape: {
          type: entry.shape.type,
          x: entry.shape.x, y: entry.shape.y,
          width: entry.shape.width, height: entry.shape.height,
          x2: entry.shape.x2, y2: entry.shape.y2,
          color: entry.shape.color, fill: entry.shape.fill,
          stroke_width: entry.shape.stroke_width,
          content: entry.shape.content,
        },
      });
    } else if (entry.type === "update") {
      const { after } = entry;
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(after) as Array<keyof Shape>) {
        if (["x","y","width","height","x2","y2","color","fill","stroke_width","content","z_index"].includes(k)) {
          patch[k] = after[k];
        }
      }
      sendRef.current({ type: "shape_update", shape_id: after.id, patch });
    } else if (entry.type === "delete") {
      const idToDelete = (entry as typeof entry & { currentId?: string }).currentId ?? entry.shape.id;
      sendRef.current({ type: "shape_delete", shape_id: idToDelete });
    }
  }

  function handleDeleteSelected() {
    const s = stateRef.current;
    if (!s.selectedId) return;
    const shape = s.shapes.find((sh) => sh.id === s.selectedId);
    if (!shape) return;
    dispatch({ type: "SHAPE_DELETE_CONFIRMED", shape });
    sendRef.current({ type: "shape_delete", shape_id: shape.id });
  }

  const handleShapeCreate = useCallback(
    (shapeData: Omit<Shape, "id" | "canvas_id" | "created_by" | "created_at" | "updated_at" | "z_index">) => {
      const tmpId = crypto.randomUUID();
      const tmpShape: Shape = {
        ...shapeData,
        id: tmpId,
        canvas_id: canvasId!,
        created_by: user?.id ?? "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        z_index: 0,
      };
      dispatch({ type: "OPTIMISTIC_ADD", tmpId, shape: tmpShape });
      trackPending(tmpId);
      sendMessage({
        type: "shape_create",
        client_id: tmpId,
        shape: shapeData,
      });
    },
    [canvasId, user, dispatch, trackPending, sendMessage]
  );

  const handleShapeUpdate = useCallback(
    (before: Shape, patch: Partial<Shape>) => {
      const after = { ...before, ...patch };
      dispatch({ type: "SHAPE_UPDATE_CONFIRMED", before, after });
      sendMessage({ type: "shape_update", shape_id: before.id, patch });
    },
    [dispatch, sendMessage]
  );

  const handleShapeDelete = useCallback(
    (shape: Shape) => {
      dispatch({ type: "SHAPE_DELETE_CONFIRMED", shape });
      sendMessage({ type: "shape_delete", shape_id: shape.id });
    },
    [dispatch, sendMessage]
  );

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      sendMessage({ type: "cursor_move", x, y });
    },
    [sendMessage]
  );

  // Color change on selected shape
  function handleColorChange(c: string) {
    dispatch({ type: "SET_COLOR", color: c });
    const s = stateRef.current;
    if (s.selectedId) {
      const shape = s.shapes.find((sh) => sh.id === s.selectedId);
      if (shape) handleShapeUpdate(shape, { color: c });
    }
  }

  function handleFillChange(f: string) {
    dispatch({ type: "SET_FILL", fill: f });
    const s = stateRef.current;
    if (s.selectedId) {
      const shape = s.shapes.find((sh) => sh.id === s.selectedId);
      if (shape) handleShapeUpdate(shape, { fill: f });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate("/")}>
          ← Back
        </button>
        <span style={styles.canvasName}>{canvas?.name ?? "…"}</span>
        <span style={styles.userLabel}>{user?.username}</span>
      </div>

      {/* Toolbar */}
      <Toolbar
        tool={state.tool}
        color={state.color}
        fill={state.fill}
        strokeWidth={strokeWidth}
        onToolChange={(t) => dispatch({ type: "SET_TOOL", tool: t })}
        onColorChange={handleColorChange}
        onFillChange={handleFillChange}
        onStrokeWidthChange={setStrokeWidth}
        canUndo={state.historyIndex >= 0}
        canRedo={state.historyIndex < state.history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDelete={handleDeleteSelected}
        hasSelection={!!state.selectedId}
      />

      {/* Whiteboard */}
      <WhiteboardSVG
        shapes={state.shapes}
        selectedId={state.selectedId}
        tool={state.tool}
        color={state.color}
        fill={state.fill}
        strokeWidth={strokeWidth}
        remoteCursors={remoteCursors}
        dispatch={dispatch}
        onShapeCreate={handleShapeCreate}
        onShapeUpdate={handleShapeUpdate}
        onShapeDelete={handleShapeDelete}
        onCursorMove={handleCursorMove}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    height: 44,
    background: "#1e293b",
    display: "flex",
    alignItems: "center",
    padding: "0 0.75rem",
    gap: "0.75rem",
    flexShrink: 0,
  },
  backBtn: {
    padding: "0.25rem 0.6rem",
    borderRadius: 4,
    border: "1px solid #475569",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  canvasName: {
    color: "#f1f5f9",
    fontWeight: 600,
    fontSize: "0.95rem",
    flex: 1,
  },
  userLabel: {
    color: "#64748b",
    fontSize: "0.85rem",
  },
};
