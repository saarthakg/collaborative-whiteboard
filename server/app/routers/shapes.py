from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.db import get_pool
from app.models import ShapeOut
from app.routers.canvases import require_canvas_member

router = APIRouter()


@router.get("/canvases/{canvas_id}/shapes", response_model=list[ShapeOut])
async def get_shapes(canvas_id: str, user: Annotated[dict, Depends(get_current_user)]):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await require_canvas_member(canvas_id, user["id"], conn)
        rows = await conn.fetch(
            """
            SELECT id::text, canvas_id::text, type, x, y, width, height,
                   x2, y2, color, fill, stroke_width, content, z_index,
                   created_by::text, created_at, updated_at
            FROM shapes
            WHERE canvas_id = $1
            ORDER BY z_index ASC, created_at ASC
            """,
            canvas_id,
        )
    return [ShapeOut(**dict(r)) for r in rows]
