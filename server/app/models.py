from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# Auth
class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    username: str
    email: str


# Canvases
class CanvasCreate(BaseModel):
    name: str


class CanvasOut(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime


class InviteRequest(BaseModel):
    identifier: str  # username or email


# Shapes
class ShapeOut(BaseModel):
    id: str
    canvas_id: str
    type: str
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    color: str
    fill: str
    stroke_width: int
    content: Optional[str] = None
    z_index: int
    created_by: str
    created_at: datetime
    updated_at: datetime
