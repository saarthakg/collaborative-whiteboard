import type { RemoteCursor } from "../types";

interface Props {
  cursors: Map<string, RemoteCursor>;
}

const COLORS = [
  "#e53e3e", "#dd6b20", "#d69e2e", "#38a169",
  "#3182ce", "#805ad5", "#d53f8c", "#00b5d8",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function CursorOverlay({ cursors }: Props) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {Array.from(cursors.values()).map((c) => {
        const color = colorForId(c.user_id);
        return (
          <g key={c.user_id} transform={`translate(${c.x}, ${c.y})`}>
            {/* Arrow cursor */}
            <path
              d="M0,0 L0,16 L4,12 L7,18 L9,17 L6,11 L12,11 Z"
              fill={color}
              stroke="#fff"
              strokeWidth={1}
            />
            {/* Username label */}
            <rect
              x={14}
              y={-2}
              width={c.username.length * 7 + 8}
              height={18}
              rx={3}
              fill={color}
            />
            <text
              x={18}
              y={12}
              fontSize={11}
              fill="#fff"
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {c.username}
            </text>
          </g>
        );
      })}
    </g>
  );
}
