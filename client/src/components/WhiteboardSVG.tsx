import { useCallback, useRef, useState } from "react";
import type { RemoteCursor, Shape, ShapeType } from "../types";
import type { WhiteboardAction } from "../hooks/useWhiteboard";
import type { HandleDir } from "./SelectionHandles";
import CursorOverlay from "./CursorOverlay";
import SelectionHandles from "./SelectionHandles";
import ShapeRenderer from "./ShapeRenderer";

interface Props {
  shapes: Shape[];
  selectedId: string | null;
  tool: string;
  color: string;
  fill: string;
  strokeWidth: number;
  remoteCursors: Map<string, RemoteCursor>;
  dispatch: React.Dispatch<WhiteboardAction>;
  onShapeCreate: (shape: Omit<Shape, "id" | "canvas_id" | "created_by" | "created_at" | "updated_at" | "z_index">) => void;
  onShapeUpdate: (before: Shape, patch: Partial<Shape>) => void;
  onShapeDelete: (shape: Shape) => void;
  onCursorMove: (x: number, y: number) => void;
}

function getSVGCoords(e: React.PointerEvent | React.MouseEvent, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export default function WhiteboardSVG({
  shapes,
  selectedId,
  tool,
  color,
  fill,
  strokeWidth,
  remoteCursors,
  dispatch,
  onShapeCreate,
  onShapeUpdate,
  onShapeDelete,
  onCursorMove,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Drawing state
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Move state
  const moveRef = useRef<{
    shape: Shape;        // snapshot at drag start
    startPt: { x: number; y: number };
  } | null>(null);

  // Resize state
  const resizeRef = useRef<{
    shape: Shape;
    handle: HandleDir;
    startPt: { x: number; y: number };
  } | null>(null);

  // Text editing state
  const [editingShape, setEditingShape] = useState<Shape | null>(null);
  const [editText, setEditText] = useState("");

  // Cursor throttle
  const lastCursorSend = useRef(0);

  const selectedShape = shapes.find((s) => s.id === selectedId) ?? null;

  // Build ghost shape during draw
  const ghostShape: (Shape & { id: string }) | null = (() => {
    if (!drawStart || !drawCurrent || tool === "select") return null;
    const t = tool as ShapeType;
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    return {
      id: "__ghost__",
      canvas_id: "",
      type: t,
      x: t === "line" ? drawStart.x : x,
      y: t === "line" ? drawStart.y : y,
      width: t === "line" ? undefined : w,
      height: t === "line" ? undefined : h,
      x2: t === "line" ? drawCurrent.x : undefined,
      y2: t === "line" ? drawCurrent.y : undefined,
      color,
      fill: t === "line" || t === "text" ? "transparent" : fill,
      stroke_width: strokeWidth,
      content: t === "text" ? "Text" : undefined,
      z_index: 0,
      created_by: "",
      created_at: "",
      updated_at: "",
    };
  })();

  // --- Pointer handlers on SVG background ---
  function handleSVGPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "select") {
      // Click on background → deselect
      dispatch({ type: "SELECT", id: null });
      return;
    }
    if (!svgRef.current) return;
    const pt = getSVGCoords(e, svgRef.current);
    setDrawStart(pt);
    setDrawCurrent(pt);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleSVGPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const pt = getSVGCoords(e, svgRef.current);

    // Throttle cursor
    const now = Date.now();
    if (now - lastCursorSend.current > 33) {
      onCursorMove(pt.x, pt.y);
      lastCursorSend.current = now;
    }

    // Drawing
    if (drawStart && tool !== "select") {
      setDrawCurrent(pt);
      return;
    }

    // Moving
    if (moveRef.current) {
      const { shape, startPt } = moveRef.current;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      if (shape.type === "line") {
        dispatch({
          type: "OPTIMISTIC_UPDATE",
          shapeId: shape.id,
          patch: {
            x: shape.x + dx,
            y: shape.y + dy,
            x2: (shape.x2 ?? 0) + dx,
            y2: (shape.y2 ?? 0) + dy,
          },
        });
      } else {
        dispatch({
          type: "OPTIMISTIC_UPDATE",
          shapeId: shape.id,
          patch: { x: shape.x + dx, y: shape.y + dy },
        });
      }
      return;
    }

    // Resizing
    if (resizeRef.current) {
      const { shape, handle, startPt } = resizeRef.current;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      const patch = computeResizePatch(shape, handle, dx, dy);
      dispatch({ type: "OPTIMISTIC_UPDATE", shapeId: shape.id, patch });
      return;
    }
  }

  function handleSVGPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const pt = getSVGCoords(e, svgRef.current);

    // Finalize draw
    if (drawStart && tool !== "select") {
      const t = tool as ShapeType;
      const x = Math.min(drawStart.x, pt.x);
      const y = Math.min(drawStart.y, pt.y);
      const w = Math.abs(pt.x - drawStart.x);
      const h = Math.abs(pt.y - drawStart.y);

      const MIN = 4;
      const isLine = t === "line";
      const tooSmall = isLine
        ? Math.abs(pt.x - drawStart.x) < MIN && Math.abs(pt.y - drawStart.y) < MIN
        : w < MIN || h < MIN;

      if (!tooSmall) {
        const shapeData = {
          type: t,
          x: isLine ? drawStart.x : x,
          y: isLine ? drawStart.y : y,
          width: isLine ? undefined : w,
          height: isLine ? undefined : h,
          x2: isLine ? pt.x : undefined,
          y2: isLine ? pt.y : undefined,
          color,
          fill: isLine || t === "text" ? "transparent" : fill,
          stroke_width: strokeWidth,
          content: t === "text" ? "Text" : undefined,
        };
        onShapeCreate(shapeData);
      }
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    // Finalize move
    if (moveRef.current) {
      const { shape, startPt } = moveRef.current;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      const patch: Partial<Shape> =
        shape.type === "line"
          ? { x: shape.x + dx, y: shape.y + dy, x2: (shape.x2 ?? 0) + dx, y2: (shape.y2 ?? 0) + dy }
          : { x: shape.x + dx, y: shape.y + dy };
      onShapeUpdate(shape, patch);
      moveRef.current = null;
      return;
    }

    // Finalize resize
    if (resizeRef.current) {
      const { shape, handle, startPt } = resizeRef.current;
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      const patch = computeResizePatch(shape, handle, dx, dy);
      onShapeUpdate(shape, patch);
      resizeRef.current = null;
      return;
    }
  }

  // --- Shape pointer down (select + start move) ---
  const handleShapePointerDown = useCallback(
    (e: React.PointerEvent, shape: Shape) => {
      if (tool !== "select") return;
      e.stopPropagation();
      dispatch({ type: "SELECT", id: shape.id });

      if (!svgRef.current) return;
      const pt = getSVGCoords(e, svgRef.current);
      moveRef.current = {
        shape,
        startPt: pt,
      };
      (svgRef.current as Element).setPointerCapture(e.pointerId);
    },
    [tool, dispatch]
  );

  // --- Handle resize pointer down ---
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, handle: HandleDir) => {
      if (!selectedShape || !svgRef.current) return;
      e.stopPropagation();
      const pt = getSVGCoords(e, svgRef.current);
      resizeRef.current = { shape: { ...selectedShape }, handle, startPt: pt };
      (svgRef.current as Element).setPointerCapture(e.pointerId);
    },
    [selectedShape]
  );

  // --- Double click to edit text ---
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, shape: Shape) => {
      if (shape.type !== "text") return;
      setEditingShape(shape);
      setEditText(shape.content ?? "");
    },
    []
  );

  function commitTextEdit() {
    if (!editingShape) return;
    if (editText !== editingShape.content) {
      onShapeUpdate(editingShape, { content: editText });
    }
    setEditingShape(null);
  }

  // Resize geometry helper
  function computeResizePatch(shape: Shape, handle: HandleDir, dx: number, dy: number): Partial<Shape> {
    if (shape.type === "line") {
      const isStart = handle === "nw" || handle === "n" || handle === "w" || handle === "sw";
      if (isStart) {
        return { x: shape.x + dx, y: shape.y + dy };
      } else {
        return { x2: (shape.x2 ?? 0) + dx, y2: (shape.y2 ?? 0) + dy };
      }
    }

    const { x, y, width = 0, height = 0 } = shape;
    let nx = x, ny = y, nw = width, nh = height;

    if (handle.includes("w")) { nx = x + dx; nw = Math.max(4, width - dx); }
    if (handle.includes("e")) { nw = Math.max(4, width + dx); }
    if (handle.includes("n")) { ny = y + dy; nh = Math.max(4, height - dy); }
    if (handle.includes("s")) { nh = Math.max(4, height + dy); }

    return { x: nx, y: ny, width: nw, height: nh };
  }

  const svgCursor =
    tool === "select" ? "default" :
    tool === "text" ? "text" : "crosshair";

  // Text editor overlay position
  const textEditorStyle: React.CSSProperties | null = (() => {
    if (!editingShape || !svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      left: rect.left + editingShape.x,
      top: rect.top + editingShape.y,
      minWidth: Math.max(100, editingShape.width ?? 100),
      fontSize: 16,
      padding: "2px 4px",
      border: "2px solid #2563eb",
      borderRadius: 3,
      outline: "none",
      fontFamily: "sans-serif",
      zIndex: 50,
    };
  })();

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#fafafa", position: "relative" }}>
      <svg
        ref={svgRef}
        width={2400}
        height={1600}
        style={{ display: "block", cursor: svgCursor, background: "#fff" }}
        onPointerDown={handleSVGPointerDown}
        onPointerMove={handleSVGPointerMove}
        onPointerUp={handleSVGPointerUp}
        onPointerLeave={() => {
          setDrawStart(null);
          setDrawCurrent(null);
        }}
      >
        {/* Grid dots */}
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.8" fill="#ddd" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Shapes */}
        {shapes.map((s) => (
          <ShapeRenderer
            key={s.id}
            shape={s}
            isSelected={s.id === selectedId}
            onPointerDown={handleShapePointerDown}
            onDoubleClick={handleDoubleClick}
          />
        ))}

        {/* Ghost shape while drawing */}
        {ghostShape && <ShapeRenderer shape={ghostShape} ghost />}

        {/* Selection handles */}
        {selectedShape && tool === "select" && (
          <SelectionHandles
            shape={selectedShape}
            onHandlePointerDown={handleResizePointerDown}
          />
        )}

        {/* Remote cursors */}
        <CursorOverlay cursors={remoteCursors} />
      </svg>

      {/* Inline text editor */}
      {editingShape && textEditorStyle && (
        <textarea
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingShape(null);
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitTextEdit();
            }
          }}
          style={{
            ...textEditorStyle,
            resize: "none",
            overflow: "hidden",
          }}
          rows={1}
        />
      )}
    </div>
  );
}
