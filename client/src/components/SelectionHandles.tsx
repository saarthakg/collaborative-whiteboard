import type { Shape } from "../types";

export type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Props {
  shape: Shape;
  onHandlePointerDown: (e: React.PointerEvent, handle: HandleDir) => void;
}

const HANDLE_SIZE = 8;

const cursorMap: Record<HandleDir, string> = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
};

export function getBounds(shape: Shape): { x: number; y: number; w: number; h: number } {
  if (shape.type === "line") {
    const x = Math.min(shape.x, shape.x2 ?? shape.x);
    const y = Math.min(shape.y, shape.y2 ?? shape.y);
    const w = Math.abs((shape.x2 ?? shape.x) - shape.x);
    const h = Math.abs((shape.y2 ?? shape.y) - shape.y);
    return { x, y, w, h };
  }
  return { x: shape.x, y: shape.y, w: shape.width ?? 0, h: shape.height ?? 0 };
}

export default function SelectionHandles({ shape, onHandlePointerDown }: Props) {
  const { x, y, w, h } = getBounds(shape);

  const handles: Array<{ dir: HandleDir; cx: number; cy: number }> = [
    { dir: "nw", cx: x, cy: y },
    { dir: "n", cx: x + w / 2, cy: y },
    { dir: "ne", cx: x + w, cy: y },
    { dir: "e", cx: x + w, cy: y + h / 2 },
    { dir: "se", cx: x + w, cy: y + h },
    { dir: "s", cx: x + w / 2, cy: y + h },
    { dir: "sw", cx: x, cy: y + h },
    { dir: "w", cx: x, cy: y + h / 2 },
  ];

  return (
    <g>
      {/* Selection outline */}
      <rect
        x={x - 1}
        y={y - 1}
        width={w + 2}
        height={h + 2}
        fill="none"
        stroke="#2563eb"
        strokeWidth={1}
        strokeDasharray="4 2"
        pointerEvents="none"
      />
      {/* Handles */}
      {handles.map(({ dir, cx, cy }) => (
        <rect
          key={dir}
          x={cx - HANDLE_SIZE / 2}
          y={cy - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="#fff"
          stroke="#2563eb"
          strokeWidth={1.5}
          style={{ cursor: cursorMap[dir] }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandlePointerDown(e, dir);
          }}
        />
      ))}
    </g>
  );
}
