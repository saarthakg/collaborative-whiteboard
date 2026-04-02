import type { Shape } from "../types";

interface Props {
  shape: Shape;
  isSelected?: boolean;
  onPointerDown?: (e: React.PointerEvent, shape: Shape) => void;
  onDoubleClick?: (e: React.MouseEvent, shape: Shape) => void;
  ghost?: boolean;
}

export default function ShapeRenderer({
  shape,
  isSelected,
  onPointerDown,
  onDoubleClick,
  ghost,
}: Props) {
  const { type, x, y, width = 0, height = 0, x2 = 0, y2 = 0, color, fill, stroke_width, content } = shape;

  const commonProps = {
    stroke: color,
    strokeWidth: stroke_width,
    fill: fill ?? "transparent",
    opacity: ghost ? 0.5 : 1,
    style: { cursor: "default" } as React.CSSProperties,
    onPointerDown: onPointerDown ? (e: React.PointerEvent) => { e.stopPropagation(); onPointerDown(e, shape); } : undefined,
    onDoubleClick: onDoubleClick ? (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick(e, shape); } : undefined,
  };

  if (type === "rect") {
    return (
      <rect
        x={x}
        y={y}
        width={Math.max(1, width)}
        height={Math.max(1, height)}
        {...commonProps}
      />
    );
  }

  if (type === "ellipse") {
    const rx = Math.max(1, width / 2);
    const ry = Math.max(1, height / 2);
    return (
      <ellipse
        cx={x + rx}
        cy={y + ry}
        rx={rx}
        ry={ry}
        {...commonProps}
      />
    );
  }

  if (type === "line") {
    return (
      <line
        x1={x}
        y1={y}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={stroke_width}
        strokeLinecap="round"
        opacity={ghost ? 0.5 : 1}
        style={{ cursor: "default" }}
        onPointerDown={onPointerDown ? (e: React.PointerEvent) => { e.stopPropagation(); onPointerDown(e, shape); } : undefined}
        onDoubleClick={onDoubleClick ? (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick(e, shape); } : undefined}
      />
    );
  }

  if (type === "text") {
    return (
      <text
        x={x}
        y={y + 20}
        fontSize={16}
        fill={color}
        opacity={ghost ? 0.5 : 1}
        style={{ cursor: "default", userSelect: "none" }}
        onPointerDown={onPointerDown ? (e: React.PointerEvent) => { e.stopPropagation(); onPointerDown(e, shape); } : undefined}
        onDoubleClick={onDoubleClick ? (e: React.MouseEvent) => { e.stopPropagation(); onDoubleClick(e, shape); } : undefined}
      >
        {content || "Text"}
      </text>
    );
  }

  return null;
}
