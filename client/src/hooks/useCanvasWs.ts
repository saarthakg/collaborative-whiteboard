import { useCallback, useEffect, useRef, useState } from "react";
import type { RemoteCursor, WsMessage } from "../types";
import type { WhiteboardAction } from "./useWhiteboard";

interface PendingConfirm {
  deleteHistoryIndex?: number;
  oldShapeId?: string;
}

interface UseCanvasWsOptions {
  canvasId: string;
  token: string | null;
  dispatch: React.Dispatch<WhiteboardAction>;
  myUserId: string;
}

export function useCanvasWs({ canvasId, token, dispatch, myUserId }: UseCanvasWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfirms = useRef<Map<string, PendingConfirm>>(new Map());

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  function connect() {
    if (!token) return;
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}/ws/${canvasId}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "shape_created") {
        const clientId = msg.client_id ?? "";
        if (clientId && pendingConfirms.current.has(clientId)) {
          const pending = pendingConfirms.current.get(clientId)!;
          pendingConfirms.current.delete(clientId);
          if (pending.deleteHistoryIndex !== undefined && pending.oldShapeId !== undefined) {
            // This create was an undo-restore of a deleted shape
            dispatch({
              type: "SHAPE_UNDO_RESTORE_CONFIRMED",
              oldShapeId: pending.oldShapeId,
              shape: msg.shape,
              deleteHistoryIndex: pending.deleteHistoryIndex,
            });
          } else {
            dispatch({ type: "SHAPE_CONFIRMED", clientId, shape: msg.shape });
          }
        } else {
          dispatch({ type: "REMOTE_SHAPE_CREATED", shape: msg.shape });
        }
      } else if (msg.type === "shape_updated") {
        dispatch({ type: "REMOTE_SHAPE_UPDATED", shape: msg.shape });
      } else if (msg.type === "shape_deleted") {
        dispatch({ type: "REMOTE_SHAPE_DELETED", shapeId: msg.shape_id });
      } else if (msg.type === "cursor_moved") {
        if (msg.user_id === myUserId) return;
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(msg.user_id, {
            user_id: msg.user_id,
            username: msg.username,
            x: msg.x,
            y: msg.y,
          });
          return next;
        });
      } else if (msg.type === "cursor_left") {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.delete(msg.user_id);
          return next;
        });
      }
    };

    ws.onclose = (e) => {
      // Clear all remote cursors — we've lost track of who's still connected
      setRemoteCursors(new Map());
      if (e.code === 4001 || e.code === 4003) return;
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, token]);

  function trackPending(clientId: string, opts?: { deleteHistoryIndex?: number; oldShapeId?: string }) {
    pendingConfirms.current.set(clientId, opts ?? {});
  }

  return { sendMessage, remoteCursors, trackPending };
}
