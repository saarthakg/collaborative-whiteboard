from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException

from app.auth import create_access_token, get_current_user
from app.db import get_pool
from app.models import LoginRequest, SignupRequest, TokenResponse, UserOut

router = APIRouter()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/signup", response_model=TokenResponse)
async def signup(body: SignupRequest):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Username required")
    if not body.email.strip():
        raise HTTPException(status_code=400, detail="Email required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE username = $1 OR email = $2",
            body.username.strip(),
            body.email.strip().lower(),
        )
        if existing:
            raise HTTPException(status_code=409, detail="Username or email already taken")

        password_hash = hash_password(body.password)
        row = await conn.fetchrow(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id::text",
            body.username.strip(),
            body.email.strip().lower(),
            password_hash,
        )

    token = create_access_token(row["id"])
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id::text, password_hash FROM users WHERE email = $1",
            body.email.strip().lower(),
        )
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(row["id"])
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return UserOut(**user)
