from datetime import datetime, timezone

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # canvas_id -> {user_id: (WebSocket, username)}
        self._rooms: dict[str, dict[str, tuple[WebSocket, str]]] = {}

    async def connect(self, canvas_id: str, user_id: str, username: str, ws: WebSocket):
        await ws.accept()
        self._rooms.setdefault(canvas_id, {})[user_id] = (ws, username)

    def disconnect(self, canvas_id: str, user_id: str):
        room = self._rooms.get(canvas_id, {})
        room.pop(user_id, None)
        if not room:
            self._rooms.pop(canvas_id, None)

    async def broadcast(self, canvas_id: str, message: dict, exclude_user: str | None = None):
        room = self._rooms.get(canvas_id, {})
        dead = []
        for uid, (ws, _) in list(room.items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(canvas_id, uid)

    async def send_to(self, canvas_id: str, user_id: str, message: dict):
        room = self._rooms.get(canvas_id, {})
        if user_id in room:
            ws, _ = room[user_id]
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(canvas_id, user_id)


manager = ConnectionManager()


def _shape_row_to_dict(row) -> dict:
    d = dict(row)
    # Convert UUIDs to strings and datetimes to ISO strings for JSON serialization
    for k in ("id", "canvas_id", "created_by"):
        if d.get(k) is not None:
            d[k] = str(d[k])
    for k in ("created_at", "updated_at"):
        if d.get(k) is not None:
            v = d[k]
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
    return d


async def handle_message(data: dict, canvas_id: str, user_id: str, username: str, pool) -> None:
    msg_type = data.get("type")

    if msg_type == "cursor_move":
        await manager.broadcast(
            canvas_id,
            {
                "type": "cursor_moved",
                "user_id": user_id,
                "username": username,
                "x": data["x"],
                "y": data["y"],
            },
            exclude_user=user_id,
        )
        return

    async with pool.acquire() as conn:
        if msg_type == "shape_create":
            s = data["shape"]
            now = datetime.now(timezone.utc)
            max_z = await conn.fetchval(
                "SELECT COALESCE(MAX(z_index), 0) FROM shapes WHERE canvas_id = $1",
                canvas_id,
            )
            row = await conn.fetchrow(
                """
                INSERT INTO shapes
                    (canvas_id, type, x, y, width, height, x2, y2,
                     color, fill, stroke_width, content, z_index, created_by, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
                RETURNING id::text, canvas_id::text, type, x, y, width, height,
                          x2, y2, color, fill, stroke_width, content, z_index,
                          created_by::text, created_at, updated_at
                """,
                canvas_id,
                s["type"],
                s.get("x", 0),
                s.get("y", 0),
                s.get("width"),
                s.get("height"),
                s.get("x2"),
                s.get("y2"),
                s.get("color", "#000000"),
                s.get("fill", "transparent"),
                s.get("stroke_width", 2),
                s.get("content"),
                max_z + 1,
                user_id,
                now,
            )
            await manager.broadcast(
                canvas_id,
                {
                    "type": "shape_created",
                    "client_id": data.get("client_id"),
                    "shape": _shape_row_to_dict(row),
                },
            )

        elif msg_type == "shape_update":
            shape_id = data["shape_id"]
            patch = data.get("patch", {})
            allowed = {"x", "y", "width", "height", "x2", "y2", "color", "fill", "stroke_width", "content", "z_index"}
            patch = {k: v for k, v in patch.items() if k in allowed}
            if not patch:
                return

            set_clauses = ", ".join(f"{k} = ${i+1}" for i, k in enumerate(patch))
            values = list(patch.values())
            now = datetime.now(timezone.utc)
            row = await conn.fetchrow(
                f"""
                UPDATE shapes SET {set_clauses}, updated_at = ${len(values)+1}
                WHERE id = ${len(values)+2} AND canvas_id = ${len(values)+3}
                RETURNING id::text, canvas_id::text, type, x, y, width, height,
                          x2, y2, color, fill, stroke_width, content, z_index,
                          created_by::text, created_at, updated_at
                """,
                *values,
                now,
                shape_id,
                canvas_id,
            )
            if row:
                await manager.broadcast(
                    canvas_id,
                    {"type": "shape_updated", "shape": _shape_row_to_dict(row)},
                )

        elif msg_type == "shape_delete":
            shape_id = data["shape_id"]
            await conn.execute(
                "DELETE FROM shapes WHERE id = $1 AND canvas_id = $2",
                shape_id,
                canvas_id,
            )
            await manager.broadcast(
                canvas_id,
                {"type": "shape_deleted", "shape_id": shape_id},
            )
