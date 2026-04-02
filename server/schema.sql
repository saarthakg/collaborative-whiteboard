-- Runs automatically when the Postgres container starts for the first time.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE canvases (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE canvas_members (
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (canvas_id, user_id)
);

CREATE TABLE shapes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_id    UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN ('rect', 'ellipse', 'line', 'text')),
    x            DOUBLE PRECISION NOT NULL DEFAULT 0,
    y            DOUBLE PRECISION NOT NULL DEFAULT 0,
    width        DOUBLE PRECISION,
    height       DOUBLE PRECISION,
    x2           DOUBLE PRECISION,
    y2           DOUBLE PRECISION,
    color        TEXT NOT NULL DEFAULT '#000000',
    fill         TEXT NOT NULL DEFAULT 'transparent',
    stroke_width INTEGER NOT NULL DEFAULT 2,
    content      TEXT,
    z_index      INTEGER NOT NULL DEFAULT 0,
    created_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shapes_canvas_id_idx ON shapes(canvas_id);
CREATE INDEX canvas_members_user_id_idx ON canvas_members(user_id);
