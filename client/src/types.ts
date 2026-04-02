export type ShapeType = "rect" | "ellipse" | "line" | "text";
export type Tool = "select" | ShapeType;

export interface Shape {
  id: string;
  canvas_id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  color: string;
  fill: string;
  stroke_width: number;
  content?: string;
  z_index: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Canvas {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface RemoteCursor {
  user_id: string;
  username: string;
  x: number;
  y: number;
}

// WebSocket message types
export type WsMessage =
  | { type: "shape_created"; client_id: string | null; shape: Shape }
  | { type: "shape_updated"; shape: Shape }
  | { type: "shape_deleted"; shape_id: string }
  | { type: "cursor_moved"; user_id: string; username: string; x: number; y: number }
  | { type: "cursor_left"; user_id: string }
  | { type: "error"; message: string };
