import { useReducer, useRef } from "react";
import type { Shape, Tool } from "../types";

// History entry types for undo/redo.
// `currentId` on delete entries tracks the live server id of the restored shape —
// it can differ from `shape.id` when undo re-creates the shape (new server uuid).
type HistoryEntry =
  | { type: "create"; shape: Shape }
  | { type: "update"; before: Shape; after: Shape }
  | { type: "delete"; shape: Shape; currentId?: string };

export interface WhiteboardState {
  shapes: Shape[];
  selectedId: string | null;
  tool: Tool;
  color: string;
  fill: string;
  history: HistoryEntry[];
  historyIndex: number;
}

export type WhiteboardAction =
  // Local confirmed actions (push to history)
  | { type: "SHAPE_CONFIRMED"; clientId: string; shape: Shape }
  | { type: "SHAPE_UPDATE_CONFIRMED"; before: Shape; after: Shape }
  | { type: "SHAPE_DELETE_CONFIRMED"; shape: Shape }
  // Undo-restore of a deleted shape: server gave back a new id
  | { type: "SHAPE_UNDO_RESTORE_CONFIRMED"; oldShapeId: string; shape: Shape; deleteHistoryIndex: number }
  // Optimistic local (no history yet)
  | { type: "OPTIMISTIC_ADD"; tmpId: string; shape: Omit<Shape, "id"> }
  | { type: "OPTIMISTIC_UPDATE"; shapeId: string; patch: Partial<Shape> }
  // Remote events (no history)
  | { type: "REMOTE_SHAPE_CREATED"; shape: Shape }
  | { type: "REMOTE_SHAPE_UPDATED"; shape: Shape }
  | { type: "REMOTE_SHAPE_DELETED"; shapeId: string }
  // Initial load — also resets history
  | { type: "LOAD_SHAPES"; shapes: Shape[] }
  // Undo/redo
  | { type: "UNDO" }
  | { type: "REDO" }
  // UI state
  | { type: "SET_TOOL"; tool: Tool }
  | { type: "SET_COLOR"; color: string }
  | { type: "SET_FILL"; fill: string }
  | { type: "SELECT"; id: string | null };

const MAX_HISTORY = 50;

function pushHistory(state: WhiteboardState, entry: HistoryEntry): WhiteboardState {
  const newHistory = [
    ...state.history.slice(0, state.historyIndex + 1),
    entry,
  ].slice(-MAX_HISTORY);
  return { ...state, history: newHistory, historyIndex: newHistory.length - 1 };
}

function reducer(state: WhiteboardState, action: WhiteboardAction): WhiteboardState {
  switch (action.type) {
    case "LOAD_SHAPES":
      // Reset history when loading a (potentially different) canvas
      return { ...state, shapes: action.shapes, history: [], historyIndex: -1, selectedId: null };

    case "OPTIMISTIC_ADD": {
      const tmp: Shape = { id: action.tmpId, ...action.shape } as Shape;
      return { ...state, shapes: [...state.shapes, tmp] };
    }

    case "OPTIMISTIC_UPDATE": {
      return {
        ...state,
        shapes: state.shapes.map((s) =>
          s.id === action.shapeId ? { ...s, ...action.patch } : s
        ),
      };
    }

    case "SHAPE_CONFIRMED": {
      const exists = state.shapes.find((s) => s.id === action.shape.id);
      let shapes: Shape[];
      if (exists) {
        shapes = state.shapes.map((s) => (s.id === action.shape.id ? action.shape : s));
      } else {
        shapes = state.shapes
          .filter((s) => s.id !== action.clientId)
          .concat(action.shape);
      }
      return pushHistory({ ...state, shapes }, { type: "create", shape: action.shape });
    }

    case "SHAPE_UPDATE_CONFIRMED": {
      const shapes = state.shapes.map((s) =>
        s.id === action.after.id ? action.after : s
      );
      return pushHistory(
        { ...state, shapes },
        { type: "update", before: action.before, after: action.after }
      );
    }

    case "SHAPE_DELETE_CONFIRMED": {
      const shapes = state.shapes.filter((s) => s.id !== action.shape.id);
      const selectedId = state.selectedId === action.shape.id ? null : state.selectedId;
      return pushHistory(
        { ...state, shapes, selectedId },
        { type: "delete", shape: action.shape }
      );
    }

    case "SHAPE_UNDO_RESTORE_CONFIRMED": {
      // Replace optimistic old-id shape with confirmed server shape,
      // and update the delete history entry to track the new server id.
      const shapes = state.shapes
        .filter((s) => s.id !== action.oldShapeId)
        .concat(action.shape);
      const newHistory = [...state.history];
      const entry = newHistory[action.deleteHistoryIndex];
      if (entry?.type === "delete") {
        newHistory[action.deleteHistoryIndex] = { ...entry, currentId: action.shape.id };
      }
      return { ...state, shapes, history: newHistory };
    }

    case "REMOTE_SHAPE_CREATED": {
      if (state.shapes.some((s) => s.id === action.shape.id)) {
        return { ...state, shapes: state.shapes.map((s) => s.id === action.shape.id ? action.shape : s) };
      }
      return { ...state, shapes: [...state.shapes, action.shape] };
    }

    case "REMOTE_SHAPE_UPDATED": {
      return {
        ...state,
        shapes: state.shapes.map((s) =>
          s.id === action.shape.id ? action.shape : s
        ),
      };
    }

    case "REMOTE_SHAPE_DELETED": {
      return {
        ...state,
        shapes: state.shapes.filter((s) => s.id !== action.shapeId),
        selectedId: state.selectedId === action.shapeId ? null : state.selectedId,
      };
    }

    case "UNDO": {
      if (state.historyIndex < 0) return state;
      const entry = state.history[state.historyIndex];
      let shapes = state.shapes;
      if (entry.type === "create") {
        shapes = shapes.filter((s) => s.id !== entry.shape.id);
      } else if (entry.type === "update") {
        shapes = shapes.map((s) => (s.id === entry.before.id ? entry.before : s));
      } else if (entry.type === "delete") {
        // Add the shape back optimistically using whatever id we have.
        // SHAPE_UNDO_RESTORE_CONFIRMED will swap to the confirmed server id.
        const liveId = entry.currentId ?? entry.shape.id;
        const restoredShape = { ...entry.shape, id: liveId };
        shapes = [...shapes, restoredShape];
      }
      return { ...state, shapes, historyIndex: state.historyIndex - 1, selectedId: null };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const entry = state.history[state.historyIndex + 1];
      let shapes = state.shapes;
      if (entry.type === "create") {
        if (!shapes.some((s) => s.id === entry.shape.id)) {
          shapes = [...shapes, entry.shape];
        }
      } else if (entry.type === "update") {
        shapes = shapes.map((s) => (s.id === entry.after.id ? entry.after : s));
      } else if (entry.type === "delete") {
        // Use currentId if available (it was updated after undo-restore confirmed)
        const idToDelete = entry.currentId ?? entry.shape.id;
        shapes = shapes.filter((s) => s.id !== idToDelete);
      }
      return { ...state, shapes, historyIndex: state.historyIndex + 1, selectedId: null };
    }

    case "SET_TOOL":
      return { ...state, tool: action.tool, selectedId: null };

    case "SET_COLOR":
      return { ...state, color: action.color };

    case "SET_FILL":
      return { ...state, fill: action.fill };

    case "SELECT":
      return { ...state, selectedId: action.id };

    default:
      return state;
  }
}

const initial: WhiteboardState = {
  shapes: [],
  selectedId: null,
  tool: "select",
  color: "#000000",
  fill: "transparent",
  history: [],
  historyIndex: -1,
};

export function useWhiteboard() {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  return { state, dispatch, stateRef };
}
