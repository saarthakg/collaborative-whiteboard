from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.auth import decode_token
from app.db import close_pool, get_pool
from app.routers import auth_router, canvases, shapes
from app.ws import handle_message, manager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await get_pool()
    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(canvases.router, prefix="/api")
app.include_router(shapes.router, prefix="/api")


@app.get("/health")
async def health() -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"ok": True}


@app.websocket("/ws/{canvas_id}")
async def websocket_endpoint(
    ws: WebSocket,
    canvas_id: str,
    token: str = Query(...),
) -> None:
    # Validate token
    try:
        user_id = decode_token(token)
    except Exception:
        await ws.close(code=4001)
        return

    # Validate canvas membership
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.username FROM canvas_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.canvas_id = $1 AND cm.user_id = $2
            """,
            canvas_id,
            user_id,
        )
    if row is None:
        await ws.close(code=4003)
        return

    username = row["username"]
    await manager.connect(canvas_id, user_id, username, ws)

    try:
        while True:
            data = await ws.receive_json()
            await handle_message(data, canvas_id, user_id, username, pool)
    except WebSocketDisconnect:
        manager.disconnect(canvas_id, user_id)
        await manager.broadcast(canvas_id, {"type": "cursor_left", "user_id": user_id})
    except Exception:
        manager.disconnect(canvas_id, user_id)
        await manager.broadcast(canvas_id, {"type": "cursor_left", "user_id": user_id})
