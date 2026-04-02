from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.db import get_pool
from app.models import CanvasCreate, CanvasOut, InviteRequest

router = APIRouter()


async def require_canvas_member(canvas_id: str, user_id: str, conn) -> None:
    row = await conn.fetchrow(
        "SELECT 1 FROM canvas_members WHERE canvas_id = $1 AND user_id = $2",
        canvas_id,
        user_id,
    )
    if row is None:
        raise HTTPException(status_code=403, detail="Not a member of this canvas")


@router.get("/canvases", response_model=list[CanvasOut])
async def list_canvases(user: Annotated[dict, Depends(get_current_user)]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT c.id::text, c.name, c.owner_id::text, c.created_at
            FROM canvases c
            JOIN canvas_members cm ON cm.canvas_id = c.id
            WHERE cm.user_id = $1
            ORDER BY c.created_at DESC
            """,
            user["id"],
        )
    return [CanvasOut(**dict(r)) for r in rows]


@router.post("/canvases", response_model=CanvasOut, status_code=201)
async def create_canvas(body: CanvasCreate, user: Annotated[dict, Depends(get_current_user)]):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Canvas name required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "INSERT INTO canvases (name, owner_id) VALUES ($1, $2) RETURNING id::text, name, owner_id::text, created_at",
                body.name.strip(),
                user["id"],
            )
            await conn.execute(
                "INSERT INTO canvas_members (canvas_id, user_id) VALUES ($1, $2)",
                row["id"],
                user["id"],
            )
    return CanvasOut(**dict(row))


@router.get("/canvases/{canvas_id}", response_model=CanvasOut)
async def get_canvas(canvas_id: str, user: Annotated[dict, Depends(get_current_user)]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await require_canvas_member(canvas_id, user["id"], conn)
        row = await conn.fetchrow(
            "SELECT id::text, name, owner_id::text, created_at FROM canvases WHERE id = $1",
            canvas_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Canvas not found")
    return CanvasOut(**dict(row))


@router.post("/canvases/{canvas_id}/invite", status_code=200)
async def invite_to_canvas(
    canvas_id: str,
    body: InviteRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await require_canvas_member(canvas_id, user["id"], conn)
        # Resolve identifier to user
        identifier = body.identifier.strip()
        target = await conn.fetchrow(
            "SELECT id::text FROM users WHERE username = $1 OR email = LOWER($1)",
            identifier,
        )
        if target is None:
            raise HTTPException(status_code=404, detail="User not found")
        # Insert member (ignore if already a member)
        await conn.execute(
            "INSERT INTO canvas_members (canvas_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            canvas_id,
            target["id"],
        )
    return {"message": "invited"}
